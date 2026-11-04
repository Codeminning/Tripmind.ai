// Verification script for Growth Features
import { formatCurrencyAmount, detectCurrencyForDestination, getRatesLastUpdated } from '../src/currency.js'
import { generateTripIcs, detectDestinationTimezone, parseLocalTripStartDate, getDayLocalDate } from '../src/calendarExport.js'

console.log('🧪 Starting Growth Features Unit & Integration Verification...\n')

let failures = 0

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`)
  } else {
    console.error(`  ❌ FAIL: ${message}`)
    failures++
  }
}

// ---------------- 1. Currency Helper Resilience ----------------
console.log('📌 Test 1: Currency Helper (never return undefined or NaN)')

const edgeCases = [
  undefined,
  null,
  NaN,
  'invalid',
  '$120',
  '-50',
  0,
  100,
  Infinity,
  -Infinity,
  {},
  []
]

edgeCases.forEach((val) => {
  const result = formatCurrencyAmount(val, 'JPY')
  assert(
    typeof result.amount === 'number' && Number.isFinite(result.amount) && !isNaN(result.amount),
    `formatCurrencyAmount(${JSON.stringify(val)}, 'JPY').amount is valid finite number (${result.amount})`
  )
  assert(
    typeof result.formatted === 'string' && result.formatted !== 'NaN' && result.formatted !== 'undefined' && result.formatted.length > 0,
    `formatCurrencyAmount(${JSON.stringify(val)}, 'JPY').formatted is clean string ("${result.formatted}")`
  )
  assert(
    typeof result.formattedWithSymbol === 'string' && !result.formattedWithSymbol.includes('NaN') && !result.formattedWithSymbol.includes('undefined'),
    `formatCurrencyAmount(${JSON.stringify(val)}, 'JPY').formattedWithSymbol contains no NaN/undefined ("${result.formattedWithSymbol}")`
  )
})

// Invalid currency code
const invalidCurr = formatCurrencyAmount(50, 'XYZ_INVALID')
assert(invalidCurr.formattedWithSymbol.startsWith('$'), 'Falls back to USD on unknown currency code')

// Rates updated label
const updatedDate = getRatesLastUpdated()
assert(typeof updatedDate === 'string' && updatedDate.length > 0, `getRatesLastUpdated() returns readable string ("${updatedDate}")`)

// ---------------- 2. Calendar Export & Local Date Math ----------------
console.log('\n📌 Test 2: Calendar Export (.ics) & Local Date Calculation')

// Test start date parser
const parsedDate = parseLocalTripStartDate('2026-11-15')
assert(parsedDate.getFullYear() === 2026 && parsedDate.getMonth() === 10 && parsedDate.getDate() === 15, 'parseLocalTripStartDate parses local date parts correctly without UTC shift')

// Test day date calculation
const day1 = getDayLocalDate(parsedDate, 1)
const day3 = getDayLocalDate(parsedDate, 3)
assert(day1.year === '2026' && day1.month === '11' && day1.day === '15', 'Day 1 date matches start date')
assert(day3.year === '2026' && day3.month === '11' && day3.day === '17', 'Day 3 date matches start date + 2 days without UTC shift')

// Test Destination Timezones
const kyotoTz = detectDestinationTimezone('Kyoto, Japan')
assert(kyotoTz === 'Asia/Tokyo', `Kyoto timezone correctly detected as Asia/Tokyo (got ${kyotoTz})`)

const amalfiTz = detectDestinationTimezone('Amalfi Coast, Italy')
assert(amalfiTz === 'Europe/Rome', `Amalfi timezone correctly detected as Europe/Rome (got ${amalfiTz})`)

const unknownTz = detectDestinationTimezone('Unknown Space Station')
assert(unknownTz === null, 'Unknown destination returns null (will use floating local time)')

// Test ICS generation
const sampleTrip = {
  id: 'test_trip_123',
  destination: 'Kyoto, Japan',
  startDate: '2026-11-15',
  travelTip: 'Walk early to avoid crowds',
  days: [
    {
      day: 1,
      title: 'Arashiyama Bamboo Grove',
      activities: [
        { title: 'Morning Matcha', time: '08:30', description: 'Fresh green tea', category: 'food', cost: 12, latitude: 35.0116, longitude: 135.6777 },
        { title: 'Bamboo Walk', time: '10:30', description: 'Towering green stalks', category: 'walk', cost: 0, latitude: 35.0175, longitude: 135.6698 }
      ]
    }
  ]
}

const icsContent = generateTripIcs(sampleTrip)
assert(icsContent.includes('BEGIN:VCALENDAR'), 'ICS contains BEGIN:VCALENDAR')
assert(icsContent.includes('BEGIN:VEVENT'), 'ICS contains BEGIN:VEVENT')
assert(icsContent.includes('TZID=Asia/Tokyo:20261115T083000'), 'ICS includes DTSTART with Kyoto timezone')
assert(icsContent.includes('SUMMARY:Morning Matcha'), 'ICS includes activity summary')
assert(icsContent.includes('END:VCALENDAR'), 'ICS contains END:VCALENDAR')

// Test floating time ICS generation
const floatingTrip = {
  ...sampleTrip,
  destination: 'Remote Mountain Spot'
}
const floatingIcs = generateTripIcs(floatingTrip)
assert(floatingIcs.includes('DTSTART:20261115T083000'), 'Floating time has no TZID parameter (RFC 5545 local floating time)')

// ---------------- 3. Geographic Coordinates Validation ----------------
console.log('\n📌 Test 3: Geographic Coordinates Validation')

function validateCoords(lat, lng) {
  const nLat = typeof lat === 'string' ? parseFloat(lat) : Number(lat)
  const nLng = typeof lng === 'string' ? parseFloat(lng) : Number(lng)
  if (
    Number.isFinite(nLat) && Number.isFinite(nLng) &&
    nLat >= -90 && nLat <= 90 &&
    nLng >= -180 && nLng <= 180 &&
    !(nLat === 0 && nLng === 0)
  ) {
    return { latitude: Number(nLat.toFixed(6)), longitude: Number(nLng.toFixed(6)) }
  }
  return null
}

assert(validateCoords(35.0116, 135.6777) !== null, 'Valid Kyoto coordinates accepted')
assert(validateCoords('40.6340', '14.6027') !== null, 'String coordinates parsed and accepted')
assert(validateCoords(95.0, 10.0) === null, 'Out of bounds latitude (>90) rejected')
assert(validateCoords(10.0, 200.0) === null, 'Out of bounds longitude (>180) rejected')
assert(validateCoords(0, 0) === null, 'Null island (0, 0) coordinate dropped')
assert(validateCoords(undefined, null) === null, 'Undefined/null coordinates rejected')

console.log(`\n========================================`)
if (failures === 0) {
  console.log('🎉 All Growth Features Unit Tests Passed!')
} else {
  console.error(`❌ ${failures} test(s) failed.`)
  process.exit(1)
}

