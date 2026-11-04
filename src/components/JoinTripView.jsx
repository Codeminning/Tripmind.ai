import React, { useState, useEffect } from 'react'
import {
  Users,
  Calendar,
  Compass,
  ArrowRight,
  Shield,
  LogIn,
  AlertCircle,
  Sparkles,
  Check
} from 'lucide-react'
import { fetchInvitePreview, joinTripByInvite } from '../groupTrip'
import { displayNameOf, upper } from '../utils/safeText'

export function JoinTripView({
  inviteToken,
  currentUser,
  onJoinSuccess,
  onNavigateLogin,
  onBackToApp
}) {
  const [tripPreview, setTripPreview] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [joining, setJoining] = useState(false)

  useEffect(() => {
    if (!inviteToken) return
    setLoading(true)
    setError(null)
    fetchInvitePreview(inviteToken)
      .then(data => {
        setTripPreview(data)
      })
      .catch(err => {
        setError(err.message || 'Invalid or expired invite link.')
      })
      .finally(() => setLoading(false))
  }, [inviteToken])

  const handleJoin = async () => {
    if (!currentUser) {
      onNavigateLogin?.()
      return
    }

    setJoining(true)
    try {
      const res = await joinTripByInvite({ inviteToken, token: currentUser.token })
      const completeTrip = res.trip || {
        id: res.tripId || tripPreview?.id,
        destination: res.destination || tripPreview?.destination || 'Group Trip',
        status: 'Upcoming',
        startDate: tripPreview?.startDate || '',
        summary: tripPreview?.summary || '',
        travelers: [displayNameOf(currentUser)],
        days: []
      }
      onJoinSuccess?.(completeTrip)
    } catch (err) {
      setError(err.message || 'Could not join group trip.')
    } finally {
      setJoining(false)
    }
  }

  return (
    <div className="join-page-shell">
      <div className="join-page-container">
        {loading ? (
          <div className="join-loading-card">
            <div className="spinner-dot" />
            <span>Looking up group trip invite...</span>
          </div>
        ) : error ? (
          <div className="join-error-card">
            <AlertCircle size={28} className="join-error-icon" />
            <h3>Unable to Join Group Trip</h3>
            <p>{error}</p>
            <button
              type="button"
              className="button button-dark"
              onClick={onBackToApp}
            >
              <span>Back to Planora</span>
            </button>
          </div>
        ) : tripPreview ? (
          <div className="join-preview-card">
            <div className="join-tag">
              <Users size={14} />
              <span>Group Trip Invitation</span>
            </div>

            <h1 className="join-destination">{tripPreview.destination}</h1>
            <p className="join-summary">{tripPreview.summary || `Join ${tripPreview.ownerName} on this curated itinerary.`}</p>

            <div className="join-details-grid">
              <div className="join-detail-item">
                <span className="join-detail-label">Organized By</span>
                <strong className="join-detail-val">{tripPreview.ownerName}</strong>
              </div>
              <div className="join-detail-item">
                <span className="join-detail-label">Start Date</span>
                <strong className="join-detail-val">{tripPreview.startDate || 'Dates flexible'}</strong>
              </div>
              <div className="join-detail-item">
                <span className="join-detail-label">Duration</span>
                <strong className="join-detail-val">{tripPreview.daysCount} Days</strong>
              </div>
              <div className="join-detail-item">
                <span className="join-detail-label">Party Capacity</span>
                <strong className="join-detail-val">{tripPreview.currentMembers} / {tripPreview.maxMembers} Travelers</strong>
              </div>
            </div>

            <div className="join-actions-box">
              {currentUser ? (
                <button
                  type="button"
                  className="button button-dark join-btn"
                  onClick={handleJoin}
                  disabled={joining || !tripPreview.canJoin}
                >
                  <Users size={16} />
                  <span>{joining ? 'Joining Party...' : 'Join Group Trip'}</span>
                  <ArrowRight size={16} />
                </button>
              ) : (
                <div className="join-login-prompt">
                  <p>You must sign in or register to join this synchronized group trip.</p>
                  <button
                    type="button"
                    className="button button-dark join-btn"
                    onClick={onNavigateLogin}
                  >
                    <LogIn size={16} />
                    <span>Sign In to Join</span>
                    <ArrowRight size={16} />
                  </button>
                </div>
              )}
            </div>

            <div className="join-privacy-note">
              <span>✳ Only your display name ({currentUser?.name || 'Explorer'}) is shown to fellow travelers. Your email address is never shared.</span>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}

