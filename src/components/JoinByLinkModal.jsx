import React, { useState, useEffect } from 'react'
import {
  Link2,
  Users,
  Calendar,
  X,
  Clipboard,
  Check,
  AlertCircle,
  ArrowRight,
  LogIn,
  Loader2,
  Compass,
  ShieldCheck
} from 'lucide-react'
import { fetchInvitePreview, joinTripByInvite, extractInviteToken } from '../groupTrip'
import { displayNameOf, upper } from '../utils/safeText'

export { extractInviteToken }

export function JoinByLinkModal({
  isOpen,
  currentUser,
  existingTripIds = [],
  onClose,
  onJoinSuccess,
  onNavigateLogin,
  showToast
}) {
  const [rawLink, setRawLink] = useState('')
  const [token, setToken] = useState('')
  const [preview, setPreview] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [joining, setJoining] = useState(false)
  const [copied, setCopied] = useState(false)

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  // Reset state when opened
  useEffect(() => {
    if (isOpen) {
      setRawLink('')
      setToken('')
      setPreview(null)
      setError(null)
      setJoining(false)
    }
  }, [isOpen])

  // Validate and look up invite as user types or pastes
  useEffect(() => {
    const trimmed = rawLink.trim()
    const extracted = extractInviteToken(trimmed)
    setToken(extracted)

    if (!extracted) {
      setPreview(null)
      setError(trimmed.length > 3 ? "That doesn't look like a valid group link" : null)
      return
    }

    let isMounted = true
    setLoading(true)
    setError(null)

    fetchInvitePreview(extracted)
      .then(data => {
        if (!isMounted) return
        setPreview(data)
        setError(null)
      })
      .catch(err => {
        if (!isMounted) return
        setPreview(null)
        setError(err.message || 'Invalid, expired, or revoked invite link.')
      })
      .finally(() => {
        if (isMounted) setLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [rawLink])

  // Paste from clipboard support
  const handlePasteClipboard = async () => {
    try {
      if (navigator.clipboard?.readText) {
        const text = await navigator.clipboard.readText()
        if (text) {
          setRawLink(text.trim())
          setCopied(true)
          setTimeout(() => setCopied(false), 2000)
          showToast?.('Link pasted from clipboard! 📋')
        }
      } else {
        showToast?.('Please paste the link using Ctrl+V or Cmd+V.')
      }
    } catch (err) {
      showToast?.('Clipboard permission not granted. Please paste manually.')
    }
  }

  const isAlreadyMember = preview && existingTripIds.includes(preview.id)

  const handleJoin = async () => {
    if (!token) return

    if (!currentUser) {
      try {
        sessionStorage.setItem('tripmind_pending_invite', token)
      } catch (_) {}
      showToast?.('Please sign in to join this group trip.')
      onNavigateLogin?.()
      onClose?.()
      return
    }

    if (isAlreadyMember) {
      onJoinSuccess?.(preview)
      onClose?.()
      return
    }

    setJoining(true)
    try {
      const res = await joinTripByInvite({ inviteToken: token, token: currentUser.token })
      showToast?.(`🎒 Successfully joined ${res.destination || preview?.destination || 'the trip party'}!`)
      const completeTrip = res.trip || {
        id: res.tripId || preview?.id,
        destination: res.destination || preview?.destination || 'Group Trip',
        status: 'Upcoming',
        startDate: preview?.startDate || '',
        summary: preview?.summary || '',
        travelers: [displayNameOf(currentUser)],
        days: []
      }
      onJoinSuccess?.(completeTrip)
      onClose?.()
    } catch (err) {
      setError(err.message || 'Could not join group trip.')
    } finally {
      setJoining(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="group-modal-overlay" role="presentation" onClick={onClose}>
      <div
        className="group-modal-dialog join-link-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="join-link-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="group-modal-header">
          <div className="group-modal-title-wrap">
            <div className="group-icon-badge" aria-hidden="true">
              <Link2 size={18} />
            </div>
            <div>
              <h3 id="join-link-title">Join a Trip with an Invite Link</h3>
              <p>Paste a private group link from your trip organizer to collaborate.</p>
            </div>
          </div>
          <button
            type="button"
            className="group-modal-close"
            onClick={onClose}
            aria-label="Close join dialog"
          >
            <X size={18} />
          </button>
        </div>

        <div className="group-modal-body">
          {/* Explanation note */}
          <div className="join-helper-note">
            <Compass size={16} className="helper-icon" />
            <div>
              <strong>Where to get a link?</strong>
              <p>
                Ask the trip organizer for their private TripMind invite URL. Joining connects you to the live synchronized itinerary, group voting, and shared expense splitting.
              </p>
            </div>
          </div>

          {/* Paste Input Box */}
          <div className="join-input-group">
            <label htmlFor="invite-link-input" className="join-field-label">
              Paste invite link or token
            </label>
            <div className="join-input-wrap">
              <input
                id="invite-link-input"
                type="text"
                className="join-link-input"
                placeholder="e.g. https://tripmind.app/join/abc123... or code"
                value={rawLink}
                onChange={(e) => setRawLink(e.target.value)}
                autoFocus
              />
              <button
                type="button"
                className="join-paste-btn"
                onClick={handlePasteClipboard}
                title="Paste from clipboard"
              >
                {copied ? <Check size={14} /> : <Clipboard size={14} />}
                <span>{copied ? 'Pasted' : 'Paste'}</span>
              </button>
            </div>
          </div>

          {/* Validation & Preview States */}
          {loading && (
            <div className="join-status-pill checking">
              <Loader2 size={14} className="spin-icon" />
              <span>Verifying invite link...</span>
            </div>
          )}

          {error && !loading && (
            <div className="join-status-pill error">
              <AlertCircle size={14} />
              <span>{error}</span>
            </div>
          )}

          {/* Trip Preview Card */}
          {preview && !loading && (
            <div className="join-preview-box">
              <div className="preview-top-row">
                <span className="preview-tag">
                  <ShieldCheck size={12} /> Valid Invitation
                </span>
                <span className="preview-capacity">
                  {preview.currentMembers} / {preview.maxMembers} Travelers
                </span>
              </div>

              <h4 className="preview-destination">{preview.destination}</h4>
              <p className="preview-summary">
                {preview.summary || `Join ${preview.ownerName} on this curated itinerary.`}
              </p>

              <div className="preview-meta-grid">
                <div className="preview-meta-item">
                  <span className="meta-label">Organized By</span>
                  <span className="meta-val">{preview.ownerName}</span>
                </div>
                <div className="preview-meta-item">
                  <span className="meta-label">Duration</span>
                  <span className="meta-val">{preview.daysCount} Days</span>
                </div>
                <div className="preview-meta-item">
                  <span className="meta-label">Start Date</span>
                  <span className="meta-val">{preview.startDate || 'Flexible dates'}</span>
                </div>
              </div>

              {isAlreadyMember && (
                <div className="already-member-notice">
                  <Check size={14} />
                  <span>You are already a member of this trip party!</span>
                </div>
              )}
            </div>
          )}

          {/* Unauthenticated User Guidance */}
          {!currentUser && preview && !loading && (
            <div className="join-guest-notice">
              <LogIn size={15} />
              <p>
                Sign in is required to join this group trip. Your invite will be preserved and automatically resumed after sign-in.
              </p>
            </div>
          )}
        </div>

        <div className="group-modal-footer">
          <button
            type="button"
            className="button button-secondary-outline"
            onClick={onClose}
          >
            Cancel
          </button>

          {preview && isAlreadyMember ? (
            <button
              type="button"
              className="button button-dark"
              onClick={handleJoin}
            >
              <span>View Trip</span>
              <ArrowRight size={15} />
            </button>
          ) : (
            <button
              type="button"
              className="button button-dark"
              disabled={!preview || loading || joining || (preview && !preview.canJoin)}
              onClick={handleJoin}
            >
              {joining ? (
                <>
                  <Loader2 size={15} className="spin-icon" />
                  <span>Joining Party...</span>
                </>
              ) : currentUser ? (
                <>
                  <Users size={15} />
                  <span>Join Trip</span>
                  <ArrowRight size={15} />
                </>
              ) : (
                <>
                  <LogIn size={15} />
                  <span>Sign In to Join</span>
                  <ArrowRight size={15} />
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
