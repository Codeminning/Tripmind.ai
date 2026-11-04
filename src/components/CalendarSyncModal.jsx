import React, { useState, useEffect } from 'react'
import {
  Calendar,
  CalendarDays,
  ExternalLink,
  Download,
  Check,
  X,
  AlertCircle,
  Loader2,
  ShieldCheck,
  Sparkles,
  Unlink,
  ChevronRight
} from 'lucide-react'
import { downloadTripIcs, createGoogleCalendarWebUrl } from '../calendarExport'

export function CalendarSyncModal({
  isOpen,
  trip,
  currentUser,
  onClose,
  showToast
}) {
  const [googleStatus, setGoogleStatus] = useState({
    configured: false,
    connected: false,
    email: null,
    loading: true
  })
  const [syncing, setSyncing] = useState(false)
  const [syncSuccess, setSyncSuccess] = useState(false)
  const [syncCount, setSyncCount] = useState(0)
  const [error, setError] = useState(null)
  const [disconnecting, setDisconnecting] = useState(false)

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  // Check Google Calendar connection status
  useEffect(() => {
    if (!isOpen) return
    setSyncSuccess(false)
    setError(null)

    if (!currentUser?.token) {
      setGoogleStatus({
        configured: false,
        connected: false,
        email: null,
        loading: false
      })
      return
    }

    setGoogleStatus(prev => ({ ...prev, loading: true }))
    fetch('/api/calendar/google/status', {
      headers: { Authorization: `Bearer ${currentUser.token}` }
    })
      .then(res => res.json())
      .then(data => {
        setGoogleStatus({
          configured: Boolean(data.configured),
          connected: Boolean(data.connected),
          email: data.email || null,
          loading: false
        })
      })
      .catch(() => {
        setGoogleStatus({
          configured: false,
          connected: false,
          email: null,
          loading: false
        })
      })
  }, [isOpen, currentUser])

  // Handle 1-Click Google Calendar Web Sync
  const handleOpenGoogleWeb = () => {
    if (!trip) return
    const url = createGoogleCalendarWebUrl(trip)
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer')
      showToast?.('Opened Google Calendar in a new tab! 📅')
    }
  }

  // Handle OAuth Connect
  const handleConnectGoogle = async () => {
    if (!currentUser) {
      showToast?.('Please sign in to connect Google Calendar.')
      return
    }

    try {
      setError(null)
      const res = await fetch('/api/calendar/google/auth-url', {
        headers: { Authorization: `Bearer ${currentUser.token}` }
      })
      const data = await res.json()

      if (data.authUrl) {
        // Open OAuth popup or tab
        window.open(data.authUrl, '_blank', 'width=540,height=680')
        showToast?.('Google sign-in window opened. Complete authorization to connect.')
      } else {
        setError(data.error || 'Google Calendar integration is not configured on the server.')
      }
    } catch (err) {
      setError('Could not initiate Google connection.')
    }
  }

  // Handle Direct API Sync
  const handleSyncToGoogle = async () => {
    if (!trip?.id || !currentUser?.token) return

    setSyncing(true)
    setError(null)
    setSyncSuccess(false)

    try {
      const res = await fetch(`/api/calendar/google/sync/${trip.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${currentUser.token}`
        }
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Sync failed.')
      }

      setSyncSuccess(true)
      setSyncCount(data.syncedCount || trip.days?.length || 1)
      showToast?.(`✨ Synced ${data.syncedCount || ''} events to Google Calendar!`)
    } catch (err) {
      setError(err.message || 'Could not sync events to Google Calendar.')
    } finally {
      setSyncing(false)
    }
  }

  // Handle Disconnect
  const handleDisconnect = async () => {
    if (!confirm('Disconnect your Google Calendar from TripMind?')) return

    setDisconnecting(true)
    try {
      await fetch('/api/calendar/google/disconnect', {
        method: 'POST',
        headers: { Authorization: `Bearer ${currentUser?.token}` }
      })
      setGoogleStatus({
        configured: googleStatus.configured,
        connected: false,
        email: null,
        loading: false
      })
      setSyncSuccess(false)
      showToast?.('Google Calendar disconnected.')
    } catch (err) {
      showToast?.('Could not disconnect Google Calendar.')
    } finally {
      setDisconnecting(false)
    }
  }

  // Handle .ICS download
  const handleDownloadIcs = () => {
    if (!trip) return
    const success = downloadTripIcs(trip)
    if (success) {
      showToast?.('📅 Calendar (.ics) file downloaded!')
    } else {
      showToast?.('Unable to export calendar file.')
    }
  }

  if (!isOpen || !trip) return null

  const daysCount = trip.days?.length || 1
  const activitiesCount = trip.days?.reduce((acc, d) => acc + (d.activities?.length || 0), 0) || 0

  return (
    <div className="group-modal-overlay" role="presentation" onClick={onClose}>
      <div
        className="group-modal-dialog calendar-sync-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="calendar-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="group-modal-header">
          <div className="group-modal-title-wrap">
            <div className="group-icon-badge" aria-hidden="true">
              <CalendarDays size={18} />
            </div>
            <div>
              <h3 id="calendar-modal-title">Add Trip to Calendar</h3>
              <p>Schedule your {trip.destination} journey in Google Calendar or download an .ics file.</p>
            </div>
          </div>
          <button
            type="button"
            className="group-modal-close"
            onClick={onClose}
            aria-label="Close calendar dialog"
          >
            <X size={18} />
          </button>
        </div>

        <div className="group-modal-body">
          {/* Consent and Details Explanation */}
          <div className="calendar-consent-box">
            <ShieldCheck size={16} className="consent-icon" />
            <div>
              <strong>What gets scheduled:</strong>
              <p>
                A multi-day trip event across your dates plus {activitiesCount} scheduled activities (cafés, temples, strolls) timed to local destination hours with descriptions and neighborhood addresses.
              </p>
            </div>
          </div>

          {error && (
            <div className="join-status-pill error">
              <AlertCircle size={14} />
              <span>{error}</span>
            </div>
          )}

          {/* Option 1: Google Calendar Direct Integration */}
          <div className="calendar-option-card google-card">
            <div className="calendar-card-top">
              <div className="calendar-brand">
                <svg className="google-cal-icon" viewBox="0 0 24 24" width="22" height="22">
                  <path fill="#4285F4" d="M19.5 3h-15C3.67 3 3 3.67 3 4.5v15c0 .83.67 1.5 1.5 1.5h15c.83 0 1.5-.67 1.5-1.5v-15c0-.83-.67-1.5-1.5-1.5z" />
                  <path fill="#FFF" d="M19 19H5V8h14v11z" />
                  <path fill="#EA4335" d="M19 8V4.5c0-.83-.67-1.5-1.5-1.5H16v5h3z" />
                  <path fill="#FBBC05" d="M8 8V3H5c-.83 0-1.5.67-1.5 1.5V8h4.5z" />
                  <path fill="#34A853" d="M8 19v-5H5v4.5c0 .28.22.5.5.5H8z" />
                  <path fill="#1A73E8" d="M16 14h3v5h-2.5c-.28 0-.5-.22-.5-.5V14z" />
                  <text x="12" y="15.5" fill="#1A73E8" fontSize="6.5" fontWeight="bold" textAnchor="middle">
                    {new Date(trip.startDate || Date.now()).getDate() || '31'}
                  </text>
                </svg>
                <div>
                  <h4>Google Calendar</h4>
                  <small>
                    {googleStatus.connected
                      ? `Connected to ${googleStatus.email || 'your account'}`
                      : 'Direct sync to your Google Calendar'}
                  </small>
                </div>
              </div>

              {googleStatus.connected && (
                <span className="cal-connected-pill">
                  <Check size={12} /> Connected
                </span>
              )}
            </div>

            {/* Sync Success State */}
            {syncSuccess && (
              <div className="sync-success-banner">
                <Check size={16} />
                <div>
                  <strong>Successfully added to Google Calendar!</strong>
                  <p>{syncCount} events scheduled for {trip.destination}.</p>
                </div>
                <a
                  href="https://calendar.google.com/calendar/r"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="cal-view-link"
                >
                  <span>Open Calendar</span>
                  <ExternalLink size={12} />
                </a>
              </div>
            )}

            {/* Actions for Google Calendar */}
            <div className="calendar-card-actions">
              {googleStatus.configured && googleStatus.connected ? (
                <>
                  <button
                    type="button"
                    className="button button-dark btn-sm"
                    disabled={syncing}
                    onClick={handleSyncToGoogle}
                  >
                    {syncing ? (
                      <>
                        <Loader2 size={14} className="spin-icon" />
                        <span>Adding Events to Calendar...</span>
                      </>
                    ) : (
                      <>
                        <CalendarDays size={14} />
                        <span>{syncSuccess ? 'Update Calendar Events' : 'Add to Google Calendar'}</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    className="button-link disconnect-btn"
                    disabled={disconnecting}
                    onClick={handleDisconnect}
                  >
                    <Unlink size={13} />
                    <span>Disconnect</span>
                  </button>
                </>
              ) : googleStatus.configured && !googleStatus.connected ? (
                <>
                  <button
                    type="button"
                    className="button button-dark btn-sm"
                    onClick={handleConnectGoogle}
                  >
                    <CalendarDays size={14} />
                    <span>Connect Google Calendar</span>
                  </button>

                  <button
                    type="button"
                    className="button button-secondary-outline btn-sm"
                    onClick={handleOpenGoogleWeb}
                  >
                    <span>1-Click Web Sync</span>
                    <ExternalLink size={13} />
                  </button>
                </>
              ) : (
                // Google OAuth not configured on host: offer seamless 1-Click Google Web Intent
                <button
                  type="button"
                  className="button button-dark btn-sm"
                  onClick={handleOpenGoogleWeb}
                >
                  <CalendarDays size={14} />
                  <span>Add to Google Calendar (1-Click)</span>
                  <ExternalLink size={13} />
                </button>
              )}
            </div>
          </div>

          {/* Option 2: Universal .ICS File Download */}
          <div className="calendar-option-card ics-card">
            <div className="calendar-card-top">
              <div className="calendar-brand">
                <div className="ics-icon-box" aria-hidden="true">
                  <Download size={18} />
                </div>
                <div>
                  <h4>Download Calendar File (.ics)</h4>
                  <small>Apple Calendar, Outlook, and manual calendar imports</small>
                </div>
              </div>

              <button
                type="button"
                className="button button-secondary-outline btn-sm"
                onClick={handleDownloadIcs}
              >
                <Download size={14} />
                <span>Download .ics</span>
              </button>
            </div>
            <p className="ics-description">
              Standard iCalendar RFC 5545 file with all {activitiesCount} activities formatted with local destination timezones.
            </p>
          </div>
        </div>

        <div className="group-modal-footer">
          <button
            type="button"
            className="button button-secondary"
            onClick={onClose}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}

