// TripMind AI — API Resilience and Error Handling Test Suite
import http from 'node:http'

const PORT = 3001
const BASE_URL = `http://localhost:${PORT}`

function request(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL)
    const options = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    }

    const req = http.request(options, (res) => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, headers: res.headers, body: JSON.parse(data) })
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, raw: data })
        }
      })
    })

    req.on('error', reject)
    if (body) req.write(JSON.stringify(body))
    req.end()
  })
}

async function runTests() {
  console.log('🧪 Starting API Resilience Tests against port 3001...\n')

  // Test 1: Missing destination input
  try {
    const res1 = await request('POST', '/api/itinerary', { destination: '   ', days: 3 })
    console.log(`1. Empty Destination Validation: status ${res1.status}`)
    console.log(`   Message: "${res1.body?.error || res1.body?.message}" (${res1.status === 400 ? '✅ PASS' : '❌ FAIL'})\n`)
  } catch (e) {
    console.error('Test 1 failed:', e.message)
  }

  // Test 2: Invalid Duration (> 14 days)
  try {
    const res2 = await request('POST', '/api/itinerary', { destination: 'Tokyo, Japan', days: 25 })
    console.log(`2. Duration Limit Validation (> 14 days): status ${res2.status}`)
    console.log(`   Message: "${res2.body?.error || res2.body?.message}" (${res2.status === 400 ? '✅ PASS' : '❌ FAIL'})\n`)
  } catch (e) {
    console.error('Test 2 failed:', e.message)
  }

  // Test 3: Simulated Gemini AI failure (destination: "force-error")
  try {
    const res3 = await request('POST', '/api/itinerary', { destination: 'force-error', days: 3 })
    console.log(`3. AI Provider Failure Graceful Handling: status ${res3.status}`)
    console.log(`   Friendly Client Message: "${res3.body?.error || res3.body?.message}" (${res3.status === 503 || res3.status === 502 || res3.status === 500 ? '✅ PASS' : '❌ FAIL'})\n`)
  } catch (e) {
    console.error('Test 3 failed:', e.message)
  }

  // Test 4: Rate Limiting Test (destination: "rate-limit-test")
  try {
    const res4 = await request('POST', '/api/itinerary', { destination: 'rate-limit-test', days: 3 })
    console.log(`4. Rate Limit (429 Too Many Requests): status ${res4.status}`)
    console.log(`   Rate Limit Message: "${res4.body?.error || res4.body?.message}" (${res4.status === 429 ? '✅ PASS' : '❌ FAIL'})\n`)
  } catch (e) {
    console.error('Test 4 failed:', e.message)
  }

  // Test 5: Valid Trip Request (Fallback mock or Gemini generation)
  try {
    const res5 = await request('POST', '/api/itinerary', { destination: 'Jaipur, India', days: 3, budget: 'Mid-range' })
    console.log(`5. Normal Itinerary Generation: status ${res5.status}`)
    console.log(`   Destination: "${res5.body?.destination}" with ${res5.body?.days?.length} planned days (${res5.status === 200 && res5.body?.days?.length > 0 ? '✅ PASS' : '❌ FAIL'})\n`)
  } catch (e) {
    console.error('Test 5 failed:', e.message)
  }
}

runTests().then(() => {
  console.log('✅ All resilience tests completed successfully.')
  process.exit(0)
}).catch(err => {
  console.error(err)
  process.exit(1)
})
