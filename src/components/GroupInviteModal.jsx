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
  const [maxMembers, setMaxMembers] = useState(trip?.maxMembers || 10)
  const [confirmThreshold, setConfirmThreshold] = useState(trip?.confirmThreshold || 'owner')
  const [generating, setGenerating] = useState(false)

  const isOwner = trip?.userMemberRole === 'owner' || trip?.userId === currentUser?.id || trip?.user_id === currentUser?.id

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
    try {
      const data = await generateInviteLink({
        tripId: trip.id,
        maxMembers,
        confirmThreshold,
        token: currentUser?.token
      })
      setInviteToken(data.inviteToken)
      showToast?.('Invite link generated! 🔗')
    } catch (err) {
      showToast?.(err.message || 'Could not generate invite link.')
    } finally {
      setGenerating(false)
    }
  }

  const handleRevokeLink = async () => {
    try {
      await revokeInviteLink({ tripId: trip.id, token: currentUser?.token })
      setInviteToken(null)
      showToast?.('Invite link revoked.')
    } catch (err) {
      showToast?.('Could not revoke invite link.')
    }
  }

  const handleCopy = () => {
    if (!inviteToken) return
    const fullUrl = `${window.location.origin}/join/${inviteToken}`
    navigator.clipboard.writeText(fullUrl).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2400)
      showToast?.('Invite link copied to clipboard! 📋')
    })
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
              <div className="invite-url-box">
                <input
                  type="text"
                  readOnly
                  value={inviteUrl}
                  aria-label="Group invite URL"
                  className="invite-url-input"
                />
                <button
                  type="button"
                  className="button button-dark btn-sm"
                  onClick={handleCopy}
                  title="Copy invite URL"
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>
                {isOwner && (
                  <button
                    type="button"
                    className="button button-secondary btn-sm"
                    onClick={handleRevokeLink}
                    title="Revoke and disable this invite link"
                  >
                    <span>Revoke Link</span>
                  </button>
                )}
              </div>
            ) : (
              isOwner && (
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
                  >
                    <Link2 size={14} />
                    <span>{generating ? 'Generating...' : 'Create Invite Link'}</span>
                  </button>
                </div>
              )
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

