import React from 'react'
import {
  Sparkles,
  Plus,
  Check,
  X,
  ThumbsUp,
  ThumbsDown
} from 'lucide-react'
import { canConfirmProposal } from '../groupTrip'

export function ActivityProposalsList({
  dayNum,
  proposals = [],
  trip,
  currentUser,
  isOwner,
  userRole = 'member',
  confirmThreshold,
  totalMembers,
  onConfirm,
  onDismiss,
  onOpenPropose,
  onConfirmProposal,
  onDismissProposal,
  onOpenProposeModal
}) {
  const effectiveRole = isOwner ? 'owner' : (userRole || 'member')
  const handleConfirm = onConfirm || onConfirmProposal
  const handleDismiss = onDismiss || onDismissProposal
  const handleOpen = onOpenPropose || onOpenProposeModal

  const dayProposals = proposals.filter(p => Number(p.day) === Number(dayNum))

  const proposeButton = (
    <button
      type="button"
      className="propose-activity-pill-btn"
      onClick={() => handleOpen?.(dayNum)}
      aria-label={`Propose an activity for Day ${dayNum}`}
    >
      <Plus size={14} />
      <span>Propose Activity for Day {dayNum}</span>
    </button>
  )

  // When there are no proposals for this day, render only the clean pill button without an empty dashed container
  if (dayProposals.length === 0) {
    return (
      <div className="propose-activity-wrapper">
        {proposeButton}
      </div>
    )
  }

  // When there are pending proposals, display the proposals review card list
  return (
    <div className="day-proposals-container">
      <div className="day-proposals-list">
        <div className="proposals-header">
          <span className="proposals-tag">
            <Sparkles size={13} />
            <span>Pending Group Proposals ({dayProposals.length})</span>
          </span>
          <div className="proposals-header-action">
            {proposeButton}
          </div>
        </div>

        {dayProposals.map(prop => {
          const upVoters = prop.votes?.up || []
          const downVoters = prop.votes?.down || []
          const canConfirm = canConfirmProposal({
            proposal: prop,
            userRole: effectiveRole,
            threshold: confirmThreshold || trip?.confirmThreshold || 'owner',
            totalMembers: totalMembers || (Array.isArray(trip?.travelers) ? trip.travelers.length : 2)
          })

          return (
            <div key={prop.id} className="proposal-card">
              <div className="proposal-card-top">
                <div className="proposal-time-title">
                  <span className="proposal-time">{prop.activity?.time || 'Flexible'}</span>
                  <strong className="proposal-title">{prop.activity?.title}</strong>
                  {prop.activity?.cost !== undefined && (
                    <span className="proposal-cost">
                      {prop.activity?.currency ? `${prop.activity.currency} ` : '$'}
                      {prop.activity.cost}
                    </span>
                  )}
                </div>
                <span className="proposed-by-tag">Proposed by {prop.proposedBy || 'Traveler'}</span>
              </div>

              {prop.activity?.description && (
                <p className="proposal-desc">{prop.activity.description}</p>
              )}

              <div className="proposal-actions-row">
                <div className="proposal-votes-badge">
                  <span className="vote-stat up"><ThumbsUp size={11} /> {upVoters.length}</span>
                  <span className="vote-stat down"><ThumbsDown size={11} /> {downVoters.length}</span>
                </div>

                <div className="proposal-buttons">
                  {canConfirm && (
                    <button
                      type="button"
                      className="button button-dark btn-sm confirm-prop-btn"
                      onClick={() => handleConfirm?.(prop.id)}
                      title="Confirm and add this proposed activity to Day schedule"
                    >
                      <Check size={13} />
                      <span>Confirm & Add</span>
                    </button>
                  )}
                  <button
                    type="button"
                    className="button button-secondary btn-sm dismiss-prop-btn"
                    onClick={() => handleDismiss?.(prop.id)}
                    title="Dismiss proposal"
                  >
                    <X size={13} />
                    <span>Dismiss</span>
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
