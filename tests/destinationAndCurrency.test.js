import { test, describe } from 'node:test'
import assert from 'node:assert'
import {
  detectCurrencyForDestination,
  formatCurrencyAmount,
  CURRENCIES,
  COUNTRY_CODE_TO_CURRENCY
} from '../src/currency.js'

describe('Destination Currency Detection & Autocomplete Resolution', () => {
  test('detects INR for Indian destinations including Madurai and Potheri', () => {
    // Exact user test cases from screenshot
    const resMadurai = detectCurrencyForDestination('madurai,tamilnadu')
    assert.strictEqual(resMadurai.code, 'INR')
    assert.strictEqual(resMadurai.symbol, '₹')
    assert.strictEqual(resMadurai.isDetected, true)

    const resPotheri = detectCurrencyForDestination('potheri,india')
    assert.strictEqual(resPotheri.code, 'INR')
    assert.strictEqual(resPotheri.symbol, '₹')
    assert.strictEqual(resPotheri.isDetected, true)

    const resPotheriRaw = detectCurrencyForDestination('potheri')
    assert.strictEqual(resPotheriRaw.code, 'INR')
    assert.strictEqual(resPotheriRaw.symbol, '₹')

    const resChennai = detectCurrencyForDestination('Chennai, Tamil Nadu')
    assert.strictEqual(resChennai.code, 'INR')
  })

  test('detects currency using geocoding metadata countryCode', () => {
    // When selected from autocomplete dropdown
    const resIndia = detectCurrencyForDestination('Custom City', { countryCode: 'IN' })
    assert.strictEqual(resIndia.code, 'INR')

    const resJapan = detectCurrencyForDestination('Somewhere in Honshu', { countryCode: 'JP' })
    assert.strictEqual(resJapan.code, 'JPY')

    const resFrance = detectCurrencyForDestination('Village', { countryCode: 'FR' })
    assert.strictEqual(resFrance.code, 'EUR')

    const resUK = detectCurrencyForDestination('Highlands', { countryCode: 'GB' })
    assert.strictEqual(resUK.code, 'GBP')
  })

  test('correctly identifies major global destinations', () => {
    assert.strictEqual(detectCurrencyForDestination('Kyoto, Japan').code, 'JPY')
    assert.strictEqual(detectCurrencyForDestination('Paris, France').code, 'EUR')
    assert.strictEqual(detectCurrencyForDestination('Florence, Italy').code, 'EUR')
    assert.strictEqual(detectCurrencyForDestination('Edinburgh, Scotland').code, 'GBP')
    assert.strictEqual(detectCurrencyForDestination('Zurich, Switzerland').code, 'CHF')
    assert.strictEqual(detectCurrencyForDestination('Sydney, Australia').code, 'AUD')
  })

  test('marks unrecognized destinations with isUnknown rather than silent USD assumption', () => {
    const unknown = detectCurrencyForDestination('Atlantis Underwater City')
    assert.strictEqual(unknown.code, 'USD')
    assert.strictEqual(unknown.isUnknown, true)
  })

  test('formats currency amounts accurately with conversion rate', () => {
    const formattedInr = formatCurrencyAmount(100, 'INR')
    assert.ok(formattedInr.formattedWithSymbol.includes('₹'))
    assert.ok(formattedInr.amount > 100)

    const formattedJpy = formatCurrencyAmount(10, 'JPY')
    assert.ok(formattedJpy.formattedWithSymbol.includes('¥'))
    assert.ok(formattedJpy.amount > 10)
  })
})

