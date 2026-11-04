import React, { useState } from 'react'
import {
  ThumbsUp,
  ThumbsDown,
  MessageSquare,
  Send,
  Trash2,
  X,
  User
} from 'lucide-react'

export function ActivityCollaboration({
  tripId,
  activityKey,
  votes = { up: [], down: [] },
  comments = [],
  currentUser,
  onVote,
  onAddComment,
  onDeleteComment
}) {
  const [commentsOpen, setCommentsOpen] = useState(false)
  const [commentText, setCommentText] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const upVoters = Array.isArray(votes.up) ? votes.up : []
  const downVoters = Array.isArray(votes.down) ? votes.down : []

  const currentUserName = currentUser?.name || 'Traveler'
  const hasUpvoted = upVoters.includes(currentUserName)
  const hasDownvoted = downVoters.includes(currentUserName)

  const activityComments = comments.filter(c => c.activityKey === activityKey)

  const handleVote = (voteType, e) => {
    e.stopPropagation()
    onVote?.(activityKey, voteType)
  }

  const handleCommentSubmit = async (e) => {
    e.preventDefault()
    e.stopPropagation()
    const clean = commentText.trim()
    if (!clean || submitting) return

    setSubmitting(true)
    try {
      await onAddComment?.(activityKey, clean)
      setCommentText('')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="activity-collab-root" onClick={(e) => e.stopPropagation()}>
      {/* Collaboration Bar: Voting and Comment Toggle */}
      <div className="activity-collab-bar">
        <div className="collab-votes-group">
          <button
            type="button"
            className={`collab-vote-btn up ${hasUpvoted ? 'active' : ''}`}
            onClick={(e) => handleVote('up', e)}
            aria-label={`Upvote activity (${upVoters.length} votes)`}
            title={upVoters.length > 0 ? `Upvoted by: ${upVoters.join(', ')}` : 'Upvote this activity'}
          >
            <ThumbsUp size={12} />
            <span>{upVoters.length}</span>
          </button>

          <button
            type="button"
            className={`collab-vote-btn down ${hasDownvoted ? 'active' : ''}`}
            onClick={(e) => handleVote('down', e)}
            aria-label={`Downvote activity (${downVoters.length} votes)`}
            title={downVoters.length > 0 ? `Downvoted by: ${downVoters.join(', ')}` : 'Downvote this activity'}
          >
            <ThumbsDown size={12} />
            <span>{downVoters.length}</span>
          </button>
        </div>

        <button
          type="button"
          className={`collab-comments-toggle ${commentsOpen ? 'active' : ''}`}
          onClick={(e) => {
            e.stopPropagation()
            setCommentsOpen(!commentsOpen)
          }}
          aria-expanded={commentsOpen}
          aria-label={`View comments (${activityComments.length})`}
        >
          <MessageSquare size={13} />
          <span>{activityComments.length > 0 ? `${activityComments.length}` : 'Comment'}</span>
        </button>
      </div>

      {/* Expanded Activity Comments Drawer */}
      {commentsOpen && (
        <div className="activity-comments-drawer" onClick={(e) => e.stopPropagation()}>
          <div className="activity-comments-header">
            <span>Activity Discussion ({activityComments.length})</span>
            <button
              type="button"
              className="comments-close-btn"
              onClick={() => setCommentsOpen(false)}
              aria-label="Close comments"
            >
              <X size={13} />
            </button>
          </div>

          <div className="activity-comments-list" role="list">
            {activityComments.length === 0 ? (
              <div className="empty-comments-note">
                No notes yet. Share a tip, coordinate meeting times, or discuss alternatives with your group.
              </div>
            ) : (
              activityComments.map(c => {
                const isAuthor = c.userId === currentUser?.id || c.userName === currentUser?.name
                return (
                  <div key={c.id} className="comment-item" role="listitem">
                    <div className="comment-meta">
                      <span className="comment-author">{c.userName || 'Traveler'}</span>
                      <span className="comment-time">
                        {c.createdAt ? new Date(c.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                      </span>
                      {isAuthor && onDeleteComment && (
                        <button
                          type="button"
                          className="comment-del-btn"
                          onClick={() => onDeleteComment(c.id)}
                          aria-label="Delete comment"
                          title="Delete comment"
                        >
                          <Trash2 size={11} />
                        </button>
                      )}
                    </div>
                    <p className="comment-text">{c.text}</p>
                  </div>
                )
              })
            )}
          </div>

          {/* Add comment input */}
          <form className="activity-comment-form" onSubmit={handleCommentSubmit}>
            <input
              type="text"
              placeholder="Leave a comment for your party..."
              value={commentText}
              maxLength={300}
              onChange={(e) => setCommentText(e.target.value)}
              disabled={submitting}
            />
            <button
              type="submit"
              className="comment-submit-btn"
              disabled={!commentText.trim() || submitting}
              aria-label="Send comment"
            >
              <Send size={13} />
            </button>
          </form>
        </div>
      )}
    </div>
  )
}

