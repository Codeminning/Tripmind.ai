import React, { useState, useEffect, useMemo, lazy, Suspense } from 'react'
import {
  AlertCircle,
  Calendar,
  Check,
  Clock,
  Compass,
  FileDown,
  Globe,
  Map,
  MapPin,
  Printer,
  Sparkles,
  Utensils,
  Footprints,
  Landmark,
  Palmtree,
  Camera,
  Share2
} from 'lucide-react'
import {
  detectCurrencyForDestination,
  formatCurrencyAmount,
  fetchExchangeRates,
  getRatesLastUpdated
} from '../currency'
import { downloadTripIcs } from '../calendarExport'
import { AppFooter } from './AppFooter'
import { upper, lower, displayNameOf } from '../utils/safeText'

const MapView = lazy(() => import('./MapView'))

function getCategoryIcon(cat) {
  const c = (cat || '').toLowerCase()
  if (c.includes('food') || c.includes('café') || c.includes('dining')) return Utensils
  if (c.includes('walk') || c.includes('stroll')) return Footprints
  if (c.includes('culture') || c.includes('heritage') || c.includes('temple') || c.includes('museum')) return Landmark
  if (c.includes('nature') || c.includes('park') || c.includes('beach')) return Palmtree
  if (c.includes('art') || c.includes('photo')) return Camera
  return Compass
}

export default function SharedTripView({ shareId, onNavigateHome }) {
  const [trip, setTrip] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [viewTab, setViewTab] = useState('itinerary') // 'itinerary' | 'map'
  const [currencyMode, setCurrencyMode] = useState('local') // 'local' | 'usd'
  const [ratesUpdated, setRatesUpdated] = useState(() => getRatesLastUpdated())

  useEffect(() => {
    fetchExchangeRates().then(() => {
      setRatesUpdated(getRatesLastUpdated())
    })
  }, [])

  useEffect(() => {
    if (!shareId) {
      setError('No shared trip identifier provided.')
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    fetch(`/api/shared/${encodeURIComponent(shareId)}`)
      .then(async (res) => {
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}))
          throw new Error(errData.error || 'This shared trip link is private, expired, or invalid.')
        }
        return res.json()
      })
      .then((data) => {
        setTrip(data)
        setLoading(false)
      })
      .catch((err) => {
        setError(err.message || 'Unable to load shared trip.')
        setLoading(false)
      })
  }, [shareId])

  const destinationCurrency = useMemo(() => {
    if (!trip?.destination) return detectCurrencyForDestination('USD')
    return detectCurrencyForDestination(trip.destination)
  }, [trip?.destination])

  const formatLocal = (usdAmount, code) => {
    const targetCode = currencyMode === 'usd' ? 'USD' : (code || destinationCurrency?.code || 'USD')
    const res = formatCurrencyAmount(usdAmount, targetCode)
    return res.formattedWithSymbol || '-'
  }

  const handlePrint = () => {
    window.print()
  }

  const handleExportCalendar = () => {
    if (trip) {
      downloadTripIcs(trip)
    }
  }

  if (loading) {
    return (
      <div className="shared-trip-page-root">
        <header className="shared-trip-nav">
          <div className="shared-nav-brand brand" onClick={onNavigateHome} role="button" tabIndex={0}>
            <Sparkles size={20} className="brand-logo-icon" />
            <span className="brand-logo-text">tripmind<span className="brand-ai">.ai</span></span>
          </div>
        </header>
        <div className="shared-loading-state" role="status" aria-live="polite">
          <div className="spinner-dot" style={{ width: '28px', height: '28px' }} />
          <h3>Retrieving shared itinerary...</h3>
          <p>Gathering destinations and curated schedules.</p>
        </div>
      </div>
    )
  }

  if (error || !trip) {
    return (
      <div className="shared-trip-page-root">
        <header className="shared-trip-nav">
          <div className="shared-nav-brand brand" onClick={onNavigateHome} role="button" tabIndex={0}>
            <Sparkles size={20} className="brand-logo-icon" />
            <span className="brand-logo-text">tripmind<span className="brand-ai">.ai</span></span>
          </div>
          <button type="button" className="button button-dark btn-sm" onClick={onNavigateHome}>
            Plan Your Own Trip
          </button>
        </header>

        <div className="shared-error-card">
          <AlertCircle size={44} color="#b35a38" />
          <h3>Itinerary Not Available</h3>
          <p>{error || 'This shared trip link may have expired or was set to private by the creator.'}</p>
          <button type="button" className="button button-dark" onClick={onNavigateHome}>
            <span>Explore TripMind AI</span>
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="shared-trip-page-root">
      {/* Top Navigation */}
      <header className="shared-trip-nav">
        <div className="shared-nav-brand brand" onClick={onNavigateHome} role="button" tabIndex={0} title="TripMind Home">
          <Sparkles size={20} className="brand-logo-icon" />
          <span className="brand-logo-text">tripmind<span className="brand-ai">.ai</span></span>
          <span className="shared-tag-pill">Shared Itinerary</span>
        </div>
        <div className="shared-nav-actions">
          <button
            type="button"
            className="button button-secondary btn-sm print-hide"
            onClick={handlePrint}
            title="Print PDF of this itinerary"
          >
            <Printer size={14} />
            <span>Print PDF</span>
          </button>
          <button
            type="button"
            className="button button-secondary btn-sm print-hide"
            onClick={handleExportCalendar}
            title="Download .ics calendar events"
          >
            <Calendar size={14} />
            <span>Add to calendar</span>
          </button>
          <button
            type="button"
            className="button button-dark btn-sm print-hide"
            onClick={onNavigateHome}
          >
            <span>Plan Your Own Trip</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="shared-trip-main-container">
        {/* Banner Card */}
        <div className="trip-sheet-card shared-card">
          <div className="trip-sheet-top">
            <span className="destination-tag">
              {upper(trip?.destination, 'TRIP')} · CURATED ITINERARY
            </span>
            <h2>{trip?.destination || 'Curated Itinerary'}</h2>
            {trip?.startDate && (
              <p className="shared-dates-hint">
                <Calendar size={14} /> Starts: {trip.startDate} ({trip.days?.length || 0} Days)
              </p>
            )}
            <p className="trip-sheet-summary">{trip?.summary || ''}</p>
            {trip.travelTip && (
              <div className="trip-sheet-tip">
                <strong>✳ Local Secret:</strong> {trip.travelTip}
              </div>
            )}

            {/* AI Disclaimer */}
            <div className="trip-sheet-disclaimer" role="note" aria-label="AI Disclaimer">
              <AlertCircle size={15} aria-hidden="true" />
              <span>Prices, timings, and availability are AI-generated estimates. Please verify before booking.</span>
            </div>
          </div>

          {/* Budget Breakdown Strip */}
          {trip.budgetBreakdown && (
            <div className="budget-summary-strip">
              <div className="budget-currency-row">
                <div className="budget-currency-detected">
                  <Globe size={14} aria-hidden="true" />
                  <span>
                    Destination Currency: <strong>{destinationCurrency.flag} {destinationCurrency.code} ({destinationCurrency.symbol})</strong>
                  </span>
                </div>
                <div className="currency-toggle-wrapper print-hide">
                  <button
                    type="button"
                    className={`currency-toggle-btn ${currencyMode === 'local' ? 'active' : ''}`}
                    aria-pressed={currencyMode === 'local'}
                    onClick={() => setCurrencyMode('local')}
                    title={`Display in ${destinationCurrency.name}`}
                  >
                    {destinationCurrency.flag} {destinationCurrency.code} ({destinationCurrency.symbol})
                  </button>
                  <button
                    type="button"
                    className={`currency-toggle-btn ${currencyMode === 'usd' ? 'active' : ''}`}
                    aria-pressed={currencyMode === 'usd'}
                    onClick={() => setCurrencyMode('usd')}
                    title="Display in USD"
                  >
                    💵 USD ($)
                  </button>
                  <span className="currency-updated-hint">Rates updated {ratesUpdated}</span>
                </div>
              </div>

              <div className="budget-strip-item">
                <small>Total Estimated ({currencyMode === 'local' ? destinationCurrency.code : 'USD'})</small>
                <strong>
                  {currencyMode === 'local' && destinationCurrency.code !== 'USD'
                    ? `${formatLocal(trip.budgetBreakdown?.totalEstimatedUsd, destinationCurrency.code)} ${destinationCurrency.code} (~$${(trip.budgetBreakdown?.totalEstimatedUsd || 0).toLocaleString()} USD)`
                    : `${formatLocal(trip.budgetBreakdown?.totalEstimatedUsd, 'USD')} USD`
                  }
                </strong>
              </div>
              <div className="budget-strip-item">
                <small>Daily per person</small>
                <strong>
                  {currencyMode === 'local' && destinationCurrency.code !== 'USD'
                    ? `${formatLocal(trip.budgetBreakdown?.dailyPerPersonUsd, destinationCurrency.code)} / day`
                    : `${formatLocal(trip.budgetBreakdown?.dailyPerPersonUsd, 'USD')} / day`
                  }
                </strong>
              </div>
              {trip.budgetBreakdown?.categories && (
                <div className="budget-strip-breakdown">
                  <span>🏨 Stay: {formatLocal(trip.budgetBreakdown.categories.accommodation)}</span>
                  <span>🍽 Food: {formatLocal(trip.budgetBreakdown.categories.dining)}</span>
                  <span>🎟 Activities: {formatLocal(trip.budgetBreakdown.categories.activities)}</span>
                </div>
              )}
            </div>
          )}

          {/* Sub-Tabs: Itinerary vs Map View */}
          <div className="trip-view-segmented-tabs print-hide">
            <button
              type="button"
              className={`trip-seg-btn ${viewTab === 'itinerary' ? 'active' : ''}`}
              onClick={() => setViewTab('itinerary')}
            >
              <Clock size={15} />
              <span>Itinerary</span>
            </button>
            <button
              type="button"
              className={`trip-seg-btn ${viewTab === 'map' ? 'active' : ''}`}
              onClick={() => setViewTab('map')}
            >
              <Map size={15} />
              <span>Map View</span>
            </button>
          </div>

          {/* Tab Content */}
          {viewTab === 'map' ? (
            <Suspense fallback={<div className="map-loading-placeholder"><div className="spinner-dot" /><span>Loading map...</span></div>}>
              <MapView
                trip={trip}
                selectedCurrencyMode={currencyMode}
                selectedTripCurrency={destinationCurrency}
                formatLocal={formatLocal}
              />
            </Suspense>
          ) : (
            <div className="trip-days-list">
              {trip.days?.map(d => (
                <div key={d.day} className="dashboard-day-card">
                  <div className="day-card-header">
                    <span className="day-badge">Day 0{d.day}</span>
                    <h4>{d.title}</h4>
                  </div>
                  <div className="day-activities-grid">
                    {d.activities?.map((act, actIdx) => {
                      const IconComponent = getCategoryIcon(act.category)
                      return (
                        <div key={actIdx} className="day-activity-row read-only">
                          <div className="activity-time-chip">
                            <Clock size={12} />
                            <span>{act.time || 'Flexible'}</span>
                          </div>
                          <div className="activity-icon-badge">
                            <IconComponent size={15} />
                          </div>
                          <div className="activity-details">
                            <strong>{act.title}</strong>
                            <p>{act.description}</p>
                          </div>
                          {act.cost !== undefined && (
                            <div className="activity-cost-tag">
                              {act.cost === 0
                                ? 'Free'
                                : currencyMode === 'local' && destinationCurrency.code !== 'USD'
                                  ? `${formatLocal(act.cost, destinationCurrency.code)} (~$${act.cost})`
                                  : formatLocal(act.cost, 'USD')
                              }
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Growth Call to Action Banner */}
        <section className="shared-trip-cta-banner print-hide">
          <div className="cta-icon-pill">
            <Sparkles size={24} color="#b35a38" />
          </div>
          <h3>Inspired by this trip?</h3>
          <p>
            Create your own customized, day-by-day itinerary tailored to your style, pacing, and budget in seconds.
          </p>
          <button
            type="button"
            className="button button-dark"
            onClick={onNavigateHome}
          >
            <span>Plan Your Own Trip</span>
          </button>
        </section>
      </main>

      <AppFooter />
    </div>
  )
}

