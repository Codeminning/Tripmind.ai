// TripMind AI - Currency Detection and Formatting Engine

export const CURRENCIES = {
  USD: { code: 'USD', symbol: '$', name: 'US Dollar', rateFromUsd: 1, rateToUsd: 1, flag: '🇺🇸' },
  EUR: { code: 'EUR', symbol: '€', name: 'Euro', rateFromUsd: 0.92, rateToUsd: 0.92, flag: '🇪🇺' },
  GBP: { code: 'GBP', symbol: '£', name: 'British Pound', rateFromUsd: 0.78, rateToUsd: 0.78, flag: '🇬🇧' },
  JPY: { code: 'JPY', symbol: '¥', name: 'Japanese Yen', rateFromUsd: 155, rateToUsd: 155, flag: '🇯🇵' },
  INR: { code: 'INR', symbol: '₹', name: 'Indian Rupee', rateFromUsd: 85, rateToUsd: 85, flag: '🇮🇳' },
  MXN: { code: 'MXN', symbol: 'Mex$', name: 'Mexican Peso', rateFromUsd: 19.5, rateToUsd: 19.5, flag: '🇲🇽' },
  IDR: { code: 'IDR', symbol: 'Rp', name: 'Indonesian Rupiah', rateFromUsd: 15800, rateToUsd: 15800, flag: '🇮🇩' },
  CHF: { code: 'CHF', symbol: 'CHF', name: 'Swiss Franc', rateFromUsd: 0.89, rateToUsd: 0.89, flag: '🇨🇭' },
  AUD: { code: 'AUD', symbol: 'A$', name: 'Australian Dollar', rateFromUsd: 1.52, rateToUsd: 1.52, flag: '🇦🇺' },
  CAD: { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar', rateFromUsd: 1.38, rateToUsd: 1.38, flag: '🇨🇦' },
  THB: { code: 'THB', symbol: '฿', name: 'Thai Baht', rateFromUsd: 36, rateToUsd: 36, flag: '🇹🇭' },
  SGD: { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar', rateFromUsd: 1.35, rateToUsd: 1.35, flag: '🇸🇬' },
  AED: { code: 'AED', symbol: 'AED', name: 'UAE Dirham', rateFromUsd: 3.67, rateToUsd: 3.67, flag: '🇦🇪' },
  KRW: { code: 'KRW', symbol: '₩', name: 'South Korean Won', rateFromUsd: 1380, rateToUsd: 1380, flag: '🇰🇷' },
  ISK: { code: 'ISK', symbol: 'kr', name: 'Icelandic Króna', rateFromUsd: 138, rateToUsd: 138, flag: '🇮🇸' },
  BRL: { code: 'BRL', symbol: 'R$', name: 'Brazilian Real', rateFromUsd: 5.7, rateToUsd: 5.7, flag: '🇧🇷' }
}

let ratesMetadata = {
  lastUpdated: null,
  source: 'static',
  isLoaded: false
}

// Format a date string into readable e.g. "Oct 29, 2026" or "today"
export function formatRatesDate(dateStr) {
  if (!dateStr) return 'today'
  try {
    const parts = dateStr.split('-')
    if (parts.length === 3) {
      const year = Number(parts[0])
      const month = Number(parts[1]) - 1
      const day = Number(parts[2])
      const d = new Date(year, month, day)
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    }
    const d = new Date(dateStr)
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    }
  } catch (e) {}
  return dateStr
}

export function getRatesLastUpdated() {
  if (ratesMetadata.lastUpdated) {
    return formatRatesDate(ratesMetadata.lastUpdated)
  }
  // Try local storage cache
  try {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem('tripmind_cached_rates')
      if (saved) {
        const parsed = JSON.parse(saved)
        if (parsed.lastUpdated) return formatRatesDate(parsed.lastUpdated)
      }
    }
  } catch (e) {}
  return 'today'
}

export async function fetchExchangeRates() {
  try {
    // Try localStorage initial hydration first
    if (typeof localStorage !== 'undefined' && !ratesMetadata.isLoaded) {
      try {
        const local = localStorage.getItem('tripmind_cached_rates')
        if (local) {
          const parsed = JSON.parse(local)
          if (parsed && parsed.rates) {
            for (const [code, rate] of Object.entries(parsed.rates)) {
              if (CURRENCIES[code] && typeof rate === 'number' && rate > 0) {
                CURRENCIES[code].rateFromUsd = rate
                CURRENCIES[code].rateToUsd = rate
              }
            }
            ratesMetadata.lastUpdated = parsed.lastUpdated || null
          }
        }
      } catch (e) {}
    }

    const resp = await fetch('/api/rates')
    if (!resp.ok) return ratesMetadata

    const data = await resp.json()
    if (data && data.rates && typeof data.rates === 'object') {
      for (const [code, rate] of Object.entries(data.rates)) {
        if (CURRENCIES[code] && typeof rate === 'number' && rate > 0) {
          CURRENCIES[code].rateFromUsd = rate
          CURRENCIES[code].rateToUsd = rate
        }
      }
      ratesMetadata.lastUpdated = data.lastUpdated || new Date().toISOString().split('T')[0]
      ratesMetadata.source = data.source || 'api'
      ratesMetadata.isLoaded = true

      if (typeof localStorage !== 'undefined') {
        try {
          localStorage.setItem('tripmind_cached_rates', JSON.stringify({
            rates: data.rates,
            lastUpdated: ratesMetadata.lastUpdated,
            cachedAt: Date.now()
          }))
        } catch (e) {}
      }
    }
  } catch (err) {
    console.warn('[Currency] Failed to fetch live exchange rates, keeping static fallback:', err)
  }
  return ratesMetadata
}

export const COUNTRY_CODE_TO_CURRENCY = {
  IN: 'INR',
  US: 'USD',
  JP: 'JPY',
  GB: 'GBP',
  UK: 'GBP',
  FR: 'EUR',
  DE: 'EUR',
  IT: 'EUR',
  ES: 'EUR',
  PT: 'EUR',
  NL: 'EUR',
  GR: 'EUR',
  AT: 'EUR',
  IE: 'EUR',
  BE: 'EUR',
  FI: 'EUR',
  LU: 'EUR',
  CH: 'CHF',
  AU: 'AUD',
  CA: 'CAD',
  MX: 'MXN',
  ID: 'IDR',
  TH: 'THB',
  SG: 'SGD',
  AE: 'AED',
  KR: 'KRW',
  IS: 'ISK',
  BR: 'BRL',
  NZ: 'AUD'
}

export function detectCurrencyForDestination(destination, metadata = null) {
  // 1. Direct metadata match (from autocomplete suggestion or geocoding)
  if (metadata && metadata.countryCode) {
    const code = COUNTRY_CODE_TO_CURRENCY[String(metadata.countryCode).toUpperCase()]
    if (code && CURRENCIES[code]) {
      return { ...CURRENCIES[code], isDetected: true }
    }
  }

  if (!destination || typeof destination !== 'string') {
    return { ...CURRENCIES.USD, isUnknown: true }
  }

  const d = destination.toLowerCase().trim()
  if (!d) return { ...CURRENCIES.USD, isUnknown: true }

  // Check for country suffixes or components like "potheri,india" or "madurai,tamilnadu"
  const tokens = d.split(/[,\s/]+/).map(t => t.trim()).filter(Boolean)

  // 2. India matching (exhaustive cities, states, keywords)
  const isIndia = (
    d.includes('india') || d.includes('bharat') ||
    d.includes('tamil nadu') || d.includes('tamilnadu') || d.includes('madurai') || d.includes('chennai') ||
    d.includes('potheri') || d.includes('coimbatore') || d.includes('karnataka') || d.includes('bengaluru') ||
    d.includes('bangalore') || d.includes('mysore') || d.includes('mysuru') || d.includes('kerala') ||
    d.includes('kochi') || d.includes('cochin') || d.includes('munnar') || d.includes('alleppey') ||
    d.includes('alappuzha') || d.includes('thiruvananthapuram') || d.includes('trivandrum') ||
    d.includes('delhi') || d.includes('new delhi') || d.includes('mumbai') || d.includes('bombay') ||
    d.includes('maharashtra') || d.includes('pune') || d.includes('goa') || d.includes('panaji') ||
    d.includes('rajasthan') || d.includes('jaipur') || d.includes('udaipur') || d.includes('jodhpur') ||
    d.includes('jaisalmer') || d.includes('agra') || d.includes('varanasi') || d.includes('kashi') ||
    d.includes('uttar pradesh') || d.includes('lucknow') || d.includes('hyderabad') || d.includes('telangana') ||
    d.includes('andhra') || d.includes('kolkata') || d.includes('calcutta') || d.includes('west bengal') ||
    d.includes('gujarat') || d.includes('ahmedabad') || d.includes('punjab') || d.includes('amritsar') ||
    d.includes('himachal') || d.includes('manali') || d.includes('shimla') || d.includes('rishikesh') ||
    d.includes('haridwar') || d.includes('ladakh') || d.includes('leh') || d.includes('kashmir') ||
    d.includes('srinagar') || d.includes('pondicherry') || d.includes('puducherry') || d.includes('hampi') ||
    d.includes('gokarna') || d.includes('ooty') || d.includes('kodaikanal') || d.includes('tirupati') ||
    d.includes('salem') || d.includes('trichy') || d.includes('tiruchirappalli') || d.includes('tirunelveli') ||
    d.includes('tambaram') || d.includes('chengalpattu') || d.includes('vellore') || d.includes('kancheepuram') ||
    tokens.includes('in')
  )
  if (isIndia) return { ...CURRENCIES.INR, isDetected: true }

  // 3. Japan
  if (
    d.includes('japan') || d.includes('kyoto') || d.includes('tokyo') || d.includes('osaka') ||
    d.includes('hokkaido') || d.includes('sapporo') || d.includes('hiroshima') || d.includes('nara') ||
    d.includes('fukuoka') || tokens.includes('jp')
  ) {
    return { ...CURRENCIES.JPY, isDetected: true }
  }

  // 4. Eurozone
  if (
    d.includes('italy') || d.includes('amalfi') || d.includes('rome') || d.includes('florence') ||
    d.includes('venice') || d.includes('milan') || d.includes('naples') || d.includes('sicily') ||
    d.includes('france') || d.includes('paris') || d.includes('nice') || d.includes('lyon') ||
    d.includes('marseille') || d.includes('bordeaux') ||
    d.includes('spain') || d.includes('barcelona') || d.includes('madrid') || d.includes('seville') ||
    d.includes('valencia') || d.includes('mallorca') || d.includes('ibiza') ||
    d.includes('portugal') || d.includes('lisbon') || d.includes('porto') || d.includes('algarve') ||
    d.includes('germany') || d.includes('berlin') || d.includes('munich') || d.includes('frankfurt') ||
    d.includes('hamburg') || d.includes('cologne') ||
    d.includes('netherlands') || d.includes('amsterdam') || d.includes('rotterdam') ||
    d.includes('greece') || d.includes('santorini') || d.includes('athens') || d.includes('mykonos') ||
    d.includes('crete') || d.includes('rhodes') ||
    d.includes('austria') || d.includes('vienna') || d.includes('salzburg') || d.includes('innsbruck') ||
    d.includes('ireland') || d.includes('dublin') || d.includes('galway') ||
    d.includes('belgium') || d.includes('brussels') || d.includes('bruges') || d.includes('ghent') ||
    d.includes('finland') || d.includes('helsinki')
  ) {
    return { ...CURRENCIES.EUR, isDetected: true }
  }

  // 5. United Kingdom
  if (
    d.includes('uk') || d.includes('united kingdom') || d.includes('london') || d.includes('england') ||
    d.includes('scotland') || d.includes('edinburgh') || d.includes('glasgow') || d.includes('manchester') ||
    d.includes('liverpool') || d.includes('belfast') || d.includes('wales') || d.includes('cardiff') ||
    tokens.includes('gb')
  ) {
    return { ...CURRENCIES.GBP, isDetected: true }
  }

  // 6. Mexico
  if (
    d.includes('mexico') || d.includes('oaxaca') || d.includes('cancun') || d.includes('cdmx') ||
    d.includes('guadalajara') || d.includes('tulum') || d.includes('playa del carmen') ||
    d.includes('puerto vallarta') || tokens.includes('mx')
  ) {
    return { ...CURRENCIES.MXN, isDetected: true }
  }

  // 7. Indonesia
  if (
    d.includes('indonesia') || d.includes('bali') || d.includes('ubud') || d.includes('jakarta') ||
    d.includes('lombok') || d.includes('seminyak') || d.includes('canggu') || d.includes('komodo') ||
    tokens.includes('id')
  ) {
    return { ...CURRENCIES.IDR, isDetected: true }
  }

  // 8. Switzerland
  if (
    d.includes('switzerland') || d.includes('swiss') || d.includes('zurich') || d.includes('geneva') ||
    d.includes('interlaken') || d.includes('zermatt') || d.includes('lucerne') || d.includes('basel') ||
    tokens.includes('ch')
  ) {
    return { ...CURRENCIES.CHF, isDetected: true }
  }

  // 9. Australia
  if (
    d.includes('australia') || d.includes('sydney') || d.includes('melbourne') || d.includes('brisbane') ||
    d.includes('perth') || d.includes('gold coast') || d.includes('cairns') || tokens.includes('au')
  ) {
    return { ...CURRENCIES.AUD, isDetected: true }
  }

  // 10. Canada
  if (
    d.includes('canada') || d.includes('toronto') || d.includes('vancouver') || d.includes('montreal') ||
    d.includes('banff') || d.includes('quebec') || d.includes('calgary') || d.includes('ottawa') ||
    tokens.includes('ca')
  ) {
    return { ...CURRENCIES.CAD, isDetected: true }
  }

  // 11. Thailand
  if (
    d.includes('thailand') || d.includes('bangkok') || d.includes('phuket') || d.includes('chiang mai') ||
    d.includes('koh samui') || d.includes('krabi') || d.includes('pattaya') || tokens.includes('th')
  ) {
    return { ...CURRENCIES.THB, isDetected: true }
  }

  // 12. Singapore
  if (d.includes('singapore') || tokens.includes('sg')) return { ...CURRENCIES.SGD, isDetected: true }

  // 13. UAE
  if (d.includes('uae') || d.includes('dubai') || d.includes('abu dhabi') || tokens.includes('ae')) {
    return { ...CURRENCIES.AED, isDetected: true }
  }

  // 14. South Korea
  if (d.includes('korea') || d.includes('seoul') || d.includes('busan') || d.includes('jeju') || tokens.includes('kr')) {
    return { ...CURRENCIES.KRW, isDetected: true }
  }

  // 15. Iceland
  if (d.includes('iceland') || d.includes('reykjavik') || tokens.includes('is')) {
    return { ...CURRENCIES.ISK, isDetected: true }
  }

  // 16. Brazil
  if (d.includes('brazil') || d.includes('rio') || d.includes('sao paulo') || d.includes('salvador') || tokens.includes('br')) {
    return { ...CURRENCIES.BRL, isDetected: true }
  }

  // 17. USA
  if (
    d.includes('usa') || d.includes('united states') || d.includes('new york') || d.includes('california') ||
    d.includes('los angeles') || d.includes('san francisco') || d.includes('miami') || d.includes('hawaii') ||
    d.includes('seattle') || d.includes('chicago') || d.includes('las vegas') || d.includes('austin') ||
    d.includes('boston') || tokens.includes('us')
  ) {
    return { ...CURRENCIES.USD, isDetected: true }
  }

  // Not recognized: return USD with isUnknown: true
  return { ...CURRENCIES.USD, isUnknown: true }
}

const CURRENCY_LOCALES = {
  INR: 'en-IN',
  JPY: 'ja-JP',
  EUR: 'de-DE',
  GBP: 'en-GB',
  IDR: 'id-ID',
  KRW: 'ko-KR',
  USD: 'en-US',
  CAD: 'en-CA',
  AUD: 'en-AU',
  SGD: 'en-SG',
  THB: 'th-TH',
  MXN: 'es-MX',
  BRL: 'pt-BR',
  CHF: 'de-CH',
  AED: 'ar-AE',
  ISK: 'is-IS'
}

export function formatCurrencyAmount(usdAmount, currency) {
  let curr = CURRENCIES.USD
  if (typeof currency === 'string') {
    const code = currency.toUpperCase().trim()
    curr = CURRENCIES[code] || CURRENCIES.USD
  } else if (currency && typeof currency === 'object') {
    curr = currency.code && CURRENCIES[currency.code]
      ? CURRENCIES[currency.code]
      : { ...CURRENCIES.USD, ...currency }
  }

  // Defensively validate input USD amount - never allow NaN or undefined
  const rawNum = typeof usdAmount === 'string' ? parseFloat(usdAmount.replace(/[^0-9.-]+/g, '')) : Number(usdAmount)
  const safeUsd = (usdAmount === undefined || usdAmount === null || !Number.isFinite(rawNum)) ? 0 : rawNum

  // Defensively extract and validate conversion rate
  const rawRate = Number(curr.rateFromUsd ?? curr.rateToUsd)
  const rate = (Number.isFinite(rawRate) && rawRate > 0) ? rawRate : 1

  const amount = Math.round(safeUsd * rate)
  const safeAmount = Number.isFinite(amount) ? amount : 0

  const locale = CURRENCY_LOCALES[curr.code] || 'en-US'
  let formatted = '0'
  try {
    formatted = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(safeAmount)
  } catch (e) {
    formatted = safeAmount.toLocaleString()
  }

  if (!formatted || formatted === 'NaN' || formatted === 'undefined') {
    formatted = '0'
  }

  const symbol = (curr && typeof curr.symbol === 'string') ? curr.symbol : '$'
  const spacer = symbol.length > 1 ? ' ' : ''
  const formattedWithSymbol = `${symbol}${spacer}${formatted}`

  return {
    amount: safeAmount,
    formatted,
    formattedWithSymbol: (formattedWithSymbol.includes('NaN') || formattedWithSymbol.includes('undefined')) ? '$0' : formattedWithSymbol
  }
}
