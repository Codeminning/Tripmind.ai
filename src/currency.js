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

export function detectCurrencyForDestination(destination) {
  if (!destination || typeof destination !== 'string') return CURRENCIES.USD
  const d = destination.toLowerCase().trim()

  if (d.includes('japan') || d.includes('kyoto') || d.includes('tokyo') || d.includes('osaka') || d.includes('hokkaido')) return CURRENCIES.JPY
  if (d.includes('italy') || d.includes('amalfi') || d.includes('rome') || d.includes('florence') || d.includes('venice') ||
      d.includes('france') || d.includes('paris') || d.includes('spain') || d.includes('barcelona') || d.includes('madrid') ||
      d.includes('portugal') || d.includes('lisbon') || d.includes('porto') || d.includes('germany') || d.includes('berlin') ||
      d.includes('netherlands') || d.includes('amsterdam') || d.includes('greece') || d.includes('santorini') || d.includes('athens') ||
      d.includes('austria') || d.includes('vienna') || d.includes('ireland') || d.includes('dublin')) return CURRENCIES.EUR
  if (d.includes('uk') || d.includes('united kingdom') || d.includes('london') || d.includes('england') || d.includes('scotland') || d.includes('edinburgh')) return CURRENCIES.GBP
  if (d.includes('india') || d.includes('delhi') || d.includes('mumbai') || d.includes('goa') || d.includes('jaipur') || d.includes('kerala') || d.includes('bengaluru') || d.includes('hyderabad')) return CURRENCIES.INR
  if (d.includes('mexico') || d.includes('oaxaca') || d.includes('cancun') || d.includes('cdmx')) return CURRENCIES.MXN
  if (d.includes('indonesia') || d.includes('bali') || d.includes('ubud') || d.includes('jakarta')) return CURRENCIES.IDR
  if (d.includes('switzerland') || d.includes('swiss') || d.includes('zurich') || d.includes('geneva') || d.includes('interlaken') || d.includes('zermatt')) return CURRENCIES.CHF
  if (d.includes('australia') || d.includes('sydney') || d.includes('melbourne') || d.includes('brisbane')) return CURRENCIES.AUD
  if (d.includes('canada') || d.includes('toronto') || d.includes('vancouver') || d.includes('montreal')) return CURRENCIES.CAD
  if (d.includes('thailand') || d.includes('bangkok') || d.includes('phuket') || d.includes('chiang mai')) return CURRENCIES.THB
  if (d.includes('singapore')) return CURRENCIES.SGD
  if (d.includes('uae') || d.includes('dubai') || d.includes('abu dhabi')) return CURRENCIES.AED
  if (d.includes('korea') || d.includes('seoul') || d.includes('busan')) return CURRENCIES.KRW
  if (d.includes('iceland') || d.includes('reykjavik')) return CURRENCIES.ISK
  if (d.includes('brazil') || d.includes('rio') || d.includes('sao paulo')) return CURRENCIES.BRL

  return CURRENCIES.USD
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
