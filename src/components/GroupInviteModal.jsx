import React, { useState, useEffect } from 'react'
import {
  Users,
  Copy,
  Check,
  Link2,
  Trash2,
  X,
  Shield,
  Clock,
  UserX,
  AlertCircle,
  Share2
} from 'lucide-react'
import {
  generateInviteLink,
  revokeInviteLink,
  fetchTripMembers,
  removeTripMember
} from '../groupTrip'

export function GroupInviteModal({
  trip,
  currentUser,
  onClose,
  showToast,
  onMembersUpdated,
  onOpenJoinByLink
}) {
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [inviteToken, setInviteToken] = useState(trip?.inviteToken || null)
  const [copied, setCopied] = useState(false)
  const [shared, setShared] = useState(false)
  const [maxMembers, setMaxMembers] = useState(trip?.maxMembers || 10)
  const [confirmThreshold, setConfirmThreshold] = useState(trip?.confirmThreshold || 'owner')
  const [generating, setGenerating] = useState(false)
  const [revoking, setRevoking] = useState(false)
  const [inviteError, setInviteError] = useState(null)

  // Sync invite token if trip updates
  useEffect(() => {
    if (trip?.inviteToken && !inviteToken) {
      setInviteToken(trip.inviteToken)
    }
  }, [trip?.inviteToken])

  // Determine user's membership and owner rights
  const currentMember = members.find(m =>
    (currentUser?.id && (m.id === currentUser.id || m.user_id === currentUser.id)) ||
    (currentUser?.email && m.email && m.email.toLowerCase() === currentUser.email.toLowerCase()) ||
    (currentUser?.name && m.name && m.name.toLowerCase() === currentUser.name.toLowerCase())
  )

  const isExplicitNonOwner = currentMember && currentMember.role && currentMember.role !== 'owner'

  const isOwner = !isExplicitNonOwner && (
    trip?.userMemberRole === 'owner' ||
    (currentUser?.id && (trip?.userId === currentUser?.id || trip?.user_id === currentUser?.id)) ||
    currentMember?.role === 'owner' ||
    (!trip?.userMemberRole && Boolean(currentUser?.id)) ||
    (!trip?.userId && !trip?.user_id && Boolean(currentUser?.id)) ||
    (members.length <= 1 && Boolean(currentUser?.id))
  )

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  useEffect(() => {
    if (!trip?.id) return
    setLoading(true)
    fetchTripMembers(trip.id, currentUser?.token)
      .then(list => {
        setMembers(list || [])
        onMembersUpdated?.(list)
      })
      .finally(() => setLoading(false))
  }, [trip?.id, currentUser?.token])

  const handleGenerateLink = async () => {
    setGenerating(true)
    setInviteError(null)
    try {
      // If trip has not been persisted to server yet, ensure it is saved
      if (currentUser?.id && currentUser.id !== 'guest') {
        try {
          await fetch('/api/trips', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: currentUser.id, trip })
          })
        } catch (_) {}
      }

      const data = await generateInviteLink({
        tripId: trip.id,
        maxMembers,
        confirmThreshold,
        token: currentUser?.token
      })
      setInviteToken(data.inviteToken)
      showToast?.('Invite link generated! 🔗')
    } catch (err) {
      const msg = err.message || 'Could not generate invite link.'
      setInviteError(msg)
      showToast?.(msg)
    } finally {
      setGenerating(false)
    }
  }

  const handleRevokeLink = async () => {
    if (!confirm('Revoke this invite link? Existing travelers remain in the trip, but this link will stop accepting new joins.')) {
      return
    }
    setRevoking(true)
    setInviteError(null)
    try {
      await revokeInviteLink({ tripId: trip.id, token: currentUser?.token })
      setInviteToken(null)
      showToast?.('Invite link revoked.')
    } catch (err) {
      const msg = err.message || 'Could not revoke invite link.'
      setInviteError(msg)
      showToast?.(msg)
    } finally {
      setRevoking(false)
    }
  }

  const handleCopy = () => {
    if (!inviteToken) return
    const fullUrl = `${window.location.origin}/join/${inviteToken}`
    navigator.clipboard.writeText(fullUrl).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2400)
      showToast?.('Invite link copied to clipboard! 📋')
    }).catch(() => {
      showToast?.('Failed to copy. Please select and copy manually.')
    })
  }

  const handleShare = async () => {
    if (!inviteToken) return
    const fullUrl = `${window.location.origin}/join/${inviteToken}`
    const destName = trip?.destination || 'our destination'
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: `TripMind AI: Join our trip to ${destName}`,
          text: `Join my group trip to ${destName} on TripMind AI!`,
          url: fullUrl
        })
        setShared(true)
        setTimeout(() => setShared(false), 2400)
        showToast?.('Trip invite shared! 🌟')
      } catch (err) {
        if (err.name !== 'AbortError') {
          handleCopy()
        }
      }
    } else {
      handleCopy()
    }
  }

  const handleRemoveMember = async (memberUserId) => {
    if (!confirm('Remove this traveler from the group trip?')) return
    try {
      await removeTripMember({ tripId: trip.id, memberUserId, token: currentUser?.token })
      const updated = members.filter(m => m.id !== memberUserId)
      setMembers(updated)
      onMembersUpdated?.(updated)
      showToast?.('Member removed from group trip.')
    } catch (err) {
      showToast?.('Could not remove member.')
    }
  }

  const inviteUrl = inviteToken ? `${window.location.origin}/join/${inviteToken}` : ''

  return (
    <div className="group-modal-overlay" role="presentation" onClick={onClose}>
      <div
        className="group-modal-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="group-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="group-modal-header">
          <div className="group-modal-title-wrap">
            <div className="group-icon-badge" aria-hidden="true">
              <Users size={18} />
            </div>
            <div>
              <h3 id="group-modal-title">Group Trip & Collaboration</h3>
              <p>Plan {trip?.destination} together on one synchronized itinerary.</p>
            </div>
          </div>
          <button
            type="button"
            className="group-modal-close"
            onClick={onClose}
            aria-label="Close group dialog"
          >
            <X size={18} />
          </button>
        </div>

        <div className="group-modal-body">
          {/* Invite Link Card */}
          <div className="group-section-card">
            <h4>Invite Travelers by Link</h4>
            <p className="section-desc">
              Anyone with this unguessable link can join your trip party upon signing in. Guests can view the plan.
            </p>

            {inviteToken ? (
              <div className="invite-url-container">
                <div className="invite-url-box">
                  <input
                    id="group-invite-url"
                    type="text"
                    readOnly
                    value={inviteUrl}
                    aria-label="Group invite URL"
                    className="invite-url-input"
                    onClick={(e) => e.target.select()}
                    onFocus={(e) => e.target.select()}
                  />
                  <button
                    type="button"
                    className="button button-dark btn-sm"
                    onClick={handleCopy}
                    title="Copy invite URL"
                    aria-label={copied ? "Invite link copied to clipboard" : "Copy invite link to clipboard"}
                  >
                    {copied ? <Check size={14} /> : <Copy size={14} />}
                    <span>{copied ? 'Copied!' : 'Copy link'}</span>
                  </button>
                  <button
                    type="button"
                    className="button button-secondary btn-sm"
                    onClick={handleShare}
                    title="Share invite link"
                    aria-label="Share invite link"
                  >
                    <Share2 size={14} />
                    <span>{shared ? 'Shared!' : 'Share'}</span>
                  </button>
                  {isOwner && (
                    <button
                      type="button"
                      className="button button-secondary btn-sm"
                      onClick={handleRevokeLink}
                      disabled={revoking}
                      title="Revoke and disable this invite link"
                      aria-label="Revoke invite link"
                    >
                      <span>{revoking ? 'Revoking...' : 'Revoke link'}</span>
                    </button>
                  )}
                </div>
                {inviteError && (
                  <div className="invite-error-row" role="alert" style={{ marginTop: '8px' }}>
                    <AlertCircle size={14} />
                    <span>{inviteError}</span>
                  </div>
                )}
              </div>
            ) : !currentUser ? (
              <div className="invite-restricted-box" role="note">
                <AlertCircle size={15} />
                <div>
                  <strong>Sign in required</strong>
                  <p>Please sign in to generate and manage invite links for group collaboration.</p>
                </div>
              </div>
            ) : isOwner ? (
              <div className="invite-generator-container">
                <div className="invite-generator-row">
                  <div className="generator-field">
                    <label htmlFor="invite-max-members">Max Members:</label>
                    <select
                      id="invite-max-members"
                      value={maxMembers}
                      onChange={(e) => setMaxMembers(Number(e.target.value))}
                    >
                      <option value="4">4 Travelers</option>
                      <option value="6">6 Travelers</option>
                      <option value="10">10 Travelers</option>
                      <option value="20">20 Travelers</option>
                    </select>
                  </div>
                  <div className="generator-field">
                    <label htmlFor="invite-confirm-rule">Confirm Rule:</label>
                    <select
                      id="invite-confirm-rule"
                      value={confirmThreshold}
                      onChange={(e) => setConfirmThreshold(e.target.value)}
                    >
                      <option value="owner">Owner Confirms Proposals</option>
                      <option value="majority">Majority Vote Confirms</option>
                    </select>
                  </div>
                  <button
                    type="button"
                    className="button button-dark btn-sm"
                    onClick={handleGenerateLink}
                    disabled={generating}
                    aria-busy={generating}
                    style={{ minWidth: '150px' }}
                  >
                    <Link2 size={14} />
                    <span>{generating ? 'Generating link...' : 'Generate invite link'}</span>
                  </button>
                </div>
                {inviteError && (
                  <div className="invite-error-row" role="alert" style={{ marginTop: '10px' }}>
                    <AlertCircle size={14} />
                    <span>{inviteError}</span>
                    <button
                      type="button"
                      className="retry-btn"
                      onClick={handleGenerateLink}
                    >
                      Try again
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="invite-restricted-box" role="note">
                <Shield size={15} />
                <div>
                  <strong>Organizer-only control</strong>
                  <p>Only the trip organizer can create or revoke group invite links. Ask the organizer to share the link with you.</p>
                </div>
              </div>
            )}
          </div>

          {/* Members List */}
          <div className="group-section-card">
            <div className="members-header-row">
              <h4>Trip Party ({members.length})</h4>
              <span className="privacy-badge">Display names only · Emails hidden</span>
            </div>

            {loading ? (
              <div className="members-loading">
                <div className="spinner-dot" />
                <span>Loading party members...</span>
              </div>
            ) : members.length === 0 ? (
              <div className="empty-members-hint">
                No joined travelers yet. Share your invite link above to bring friends aboard!
              </div>
            ) : (
              <div className="members-list-grid" role="list">
                {members.map(member => {
                  const isMemberOwner = member.role === 'owner'
                  return (
                    <div key={member.id} className="member-card-row" role="listitem">
                      <div className="member-avatar-wrap">
                        {member.avatar ? (
                          <img src={member.avatar} alt="" className="member-avatar-img" />
                        ) : (
                          <div className="member-avatar-initials">
                            {member.initials || (member.name ? member.name.slice(0, 2).toUpperCase() : 'TR')}
                          </div>
                        )}
                      </div>

                      <div className="member-info">
                        <strong className="member-name">{member.name || 'Traveler'}</strong>
                        <span className="member-joined">
                          Joined {member.joinedAt ? new Date(member.joinedAt).toLocaleDateString() : 'recently'}
                        </span>
                      </div>

                      <div className="member-role-badge">
                        {isMemberOwner ? (
                          <span className="role-owner"><Shield size={12} /> Owner</span>
                        ) : (
                          <span className="role-member">Member</span>
                        )}
                      </div>

                      {isOwner && !isMemberOwner && (
                        <button
                          type="button"
                          className="member-remove-btn"
                          onClick={() => handleRemoveMember(member.id)}
                          aria-label={`Remove ${member.name} from group trip`}
                          title="Remove member"
                        >
                          <UserX size={15} />
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        <div className="group-modal-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
          {onOpenJoinByLink ? (
            <button
              type="button"
              className="group-join-switch-link"
              onClick={() => {
                onClose()
                onOpenJoinByLink()
              }}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--brand-sage, #1f4837)',
                fontSize: '13px',
                fontWeight: '500',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 0',
                textDecoration: 'underline'
              }}
              title="Paste an invite link to join someone else's trip"
            >
              <Link2 size={14} />
              <span>Have an invite link? Join a trip</span>
            </button>
          ) : <div />}
          <button type="button" className="button button-secondary" onClick={onClose}>
            <span>Done</span>
          </button>
        </div>
      </div>
    </div>
  )
}

