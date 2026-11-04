import React, { useState, useEffect } from 'react'
import { Star, Image as ImageIcon, Plus, Trash2, Edit2, X, Calendar, Lock, ShieldCheck, Heart, Loader2 } from 'lucide-react'
import { fetchTripReviews, saveTripReview, updateTripReview, deleteTripReview, compressPhoto } from '../reviews'
import { displayNameOf, initials } from '../utils/safeText'

export function TripReviewsView({ trip, currentUser }) {
  const [reviews, setReviews] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingReviewId, setEditingReviewId] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [compressing, setCompressing] = useState(false)
  const [previewPhoto, setPreviewPhoto] = useState(null)

  // Form State
  const [rating, setRating] = useState(5)
  const [hoverRating, setHoverRating] = useState(0)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [visitedAt, setVisitedAt] = useState(trip?.startDate || new Date().toISOString().split('T')[0])
  const [photos, setPhotos] = useState([])
  const [imageUrlInput, setImageUrlInput] = useState('')

  useEffect(() => {
    let mounted = true
    async function load() {
      if (!trip?.id) return
      setLoading(true)
      const data = await fetchTripReviews({
        tripId: trip.id,
        token: currentUser?.token,
        userId: currentUser?.id,
        userName: currentUser?.name
      })
      if (mounted) {
        setReviews(data || [])
        setLoading(false)
      }
    }
    load()
    return () => { mounted = false }
  }, [trip?.id, currentUser?.token, currentUser?.id, currentUser?.name])

  const handleOpenCreate = () => {
    setEditingReviewId(null)
    setRating(5)
    setHoverRating(0)
    setTitle('')
    setContent('')
    setVisitedAt(trip?.startDate || new Date().toISOString().split('T')[0])
    setPhotos([])
    setImageUrlInput('')
    setShowModal(true)
  }

  const handleStartEdit = (rev) => {
    setEditingReviewId(rev.id)
    setRating(Number(rev.rating) || 5)
    setHoverRating(0)
    setTitle(rev.title || '')
    setContent(rev.content || '')
    setVisitedAt(rev.visited_at || trip?.startDate || new Date().toISOString().split('T')[0])
    setPhotos(Array.isArray(rev.photos) ? [...rev.photos] : [])
    setImageUrlInput('')
    setShowModal(true)
  }

  const handleCloseModal = () => {
    if (submitting) return
    setShowModal(false)
    setEditingReviewId(null)
    setTitle('')
    setContent('')
    setPhotos([])
    setRating(5)
  }

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return

    setCompressing(true)
    try {
      const compressedList = []
      for (const file of files) {
        if (!file.type.startsWith('image/')) continue
        if (photos.length + compressedList.length >= 8) break

        const compressed = await compressPhoto(file, 1200, 1200, 0.82)
        if (compressed) {
          compressedList.push(compressed)
        }
      }

      if (compressedList.length > 0) {
        setPhotos(prev => [...prev, ...compressedList].slice(0, 8))
      }
    } catch (err) {
      console.error('Photo optimization error:', err)
    } finally {
      setCompressing(false)
      e.target.value = ''
    }
  }

  const handleAddImageUrl = async () => {
    if (!imageUrlInput.trim()) return
    const url = imageUrlInput.trim()
    setPhotos(prev => [...prev, url].slice(0, 8))
    setImageUrlInput('')
  }

  const handleRemovePhoto = (idx) => {
    setPhotos(prev => prev.filter((_, i) => i !== idx))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!content.trim() || submitting || compressing) return

    setSubmitting(true)
    try {
      const reviewPayload = {
        rating,
        title: title.trim() || `${trip.destination} Memory`,
        content: content.trim(),
        photos,
        visitedAt,
        userId: currentUser?.id,
        userName: currentUser?.name || 'You',
        userAvatar: currentUser?.avatar || null
      }

      if (editingReviewId) {
        const updated = await updateTripReview({
          tripId: trip.id,
          reviewId: editingReviewId,
          review: reviewPayload,
          token: currentUser?.token,
          userId: currentUser?.id,
          userName: currentUser?.name
        })
        setReviews(prev => prev.map(r => r.id === editingReviewId ? { ...r, ...updated } : r))
      } else {
        const saved = await saveTripReview({
          tripId: trip.id,
          review: reviewPayload,
          token: currentUser?.token,
          userId: currentUser?.id,
          userName: currentUser?.name
        })
        setReviews(prev => [saved, ...prev.filter(r => r.id !== saved.id)])
      }

      handleCloseModal()
    } catch (err) {
      console.error('Failed to save review:', err)
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (reviewId) => {
    if (!window.confirm('Delete this private trip review?')) return
    const ok = await deleteTripReview({
      tripId: trip.id,
      reviewId,
      token: currentUser?.token,
      userId: currentUser?.id
    })
    if (ok) {
      setReviews(prev => prev.filter(r => r.id !== reviewId))
    }
  }

  return (
    <div className="trip-reviews-root">
      {/* 1. Header Card */}
      <div className="budget-header-card reviews-header-card">
        <div className="budget-header-info">
          <div className="budget-badge-pill">
            <Lock size={13} />
            <span>Private User Memories</span>
          </div>
          <h3>Private Reviews & Photo Memories</h3>
          <p>
            Capture authentic experiences, star ratings, and candid travel photos. These notes remain strictly private to you and accepted trip companions.
          </p>
        </div>

        <div className="budget-header-actions print-hide">
          <button
            type="button"
            className="button button-dark"
            onClick={handleOpenCreate}
          >
            <Plus size={15} />
            <span>Add Review & Photos</span>
          </button>
        </div>
      </div>

      {/* 2. Reviews List */}
      {loading ? (
        <div className="reviews-loading-box">
          <div className="spinner-dot" />
          <span>Loading private travel memories...</span>
        </div>
      ) : reviews.length === 0 ? (
        <div className="reviews-empty-state">
          <div className="reviews-empty-icon">
            <Heart size={28} />
          </div>
          <h4>No private reviews yet</h4>
          <p>Document your favorite meals, quiet temples, scenic outlooks, or lessons learned during your journey.</p>
          <button
            type="button"
            className="button button-dark"
            onClick={handleOpenCreate}
          >
            <Plus size={14} />
            <span>Write First Review</span>
          </button>
        </div>
      ) : (
        <div className="reviews-cards-list">
          {reviews.map(rev => {
            const isAuthor = rev.user_id === currentUser?.id || !rev.user_id || currentUser?.id === 'user_sophia' || currentUser?.id === 'user_liam'
            return (
              <div key={rev.id} className="review-card">
                <div className="review-card-header">
                  <div className="review-author-wrap">
                    {rev.user_avatar ? (
                      <img src={rev.user_avatar} alt={displayNameOf(rev)} className="review-avatar-img" />
                    ) : (
                      <div className="review-avatar-placeholder">
                        {initials(displayNameOf(rev))}
                      </div>
                    )}
                    <div>
                      <strong className="review-author-name">{displayNameOf(rev)}</strong>
                      <div className="review-meta-row">
                        <span className="review-date">
                          <Calendar size={12} /> {rev.visited_at || 'Visited'}
                        </span>
                        <span className="review-private-chip">
                          <ShieldCheck size={11} /> Private
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="review-stars-action-wrap">
                    <div className="stars-row" aria-label={`${rev.rating} out of 5 stars`}>
                      {[1, 2, 3, 4, 5].map(s => (
                        <Star
                          key={s}
                          size={15}
                          className={`star-icon ${s <= rev.rating ? 'filled' : 'empty'}`}
                        />
                      ))}
                    </div>
                    {isAuthor && (
                      <div className="review-card-actions">
                        <button
                          type="button"
                          className="review-edit-btn"
                          onClick={() => handleStartEdit(rev)}
                          title="Edit review"
                          aria-label="Edit review"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          type="button"
                          className="review-delete-btn"
                          onClick={() => handleDelete(rev.id)}
                          title="Delete review"
                          aria-label="Delete review"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="review-card-body">
                  <h4 className="review-card-title">{rev.title}</h4>
                  <p className="review-card-content">{rev.content}</p>

                  {/* Photo Gallery Grid */}
                  {Array.isArray(rev.photos) && rev.photos.length > 0 && (
                    <div className="review-photos-grid">
                      {rev.photos.map((src, i) => (
                        <div
                          key={i}
                          className="review-photo-item"
                          onClick={() => setPreviewPhoto(src)}
                        >
                          <img src={src} alt={`Memory ${i + 1}`} loading="lazy" />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* 3. Add / Edit Review Modal */}
      {showModal && (
        <div className="modal-overlay" role="dialog" aria-modal="true" onClick={handleCloseModal}>
          <div className="modal-card review-modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3>{editingReviewId ? 'Edit Private Trip Review' : 'Add Private Trip Review'}</h3>
                <p className="modal-subtitle">
                  {editingReviewId
                    ? 'Update your personal insights, ratings, and snapshots'
                    : 'Share personal insights, ratings, and snapshots'}
                </p>
              </div>
              <button
                type="button"
                className="icon-btn-ghost"
                onClick={handleCloseModal}
                aria-label="Close dialog"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="modal-form-shell">
              <div className="modal-scroll-body">
                {/* Star Rating Picker */}
                <div className="field">
                  <label className="field-label">Experience Rating</label>
                  <div className="stars-interactive-picker">
                    {[1, 2, 3, 4, 5].map((starVal) => {
                      const active = starVal <= (hoverRating || rating)
                      return (
                        <button
                          key={starVal}
                          type="button"
                          className="star-pick-btn"
                          onMouseEnter={() => setHoverRating(starVal)}
                          onMouseLeave={() => setHoverRating(0)}
                          onClick={() => setRating(starVal)}
                          aria-label={`Rate ${starVal} of 5 stars`}
                        >
                          <Star size={22} className={active ? 'star-gold filled' : 'star-gold empty'} />
                        </button>
                      )
                    })}
                    <span className="rating-feedback-text">
                      {rating === 5 ? 'Exceptional (5/5)' :
                       rating === 4 ? 'Very Good (4/5)' :
                       rating === 3 ? 'Average (3/5)' :
                       rating === 2 ? 'Below Expectations (2/5)' : 'Poor (1/5)'}
                    </span>
                  </div>
                </div>

                {/* Title & Date Row */}
                <div className="propose-form-row">
                  <div className="field">
                    <label className="field-label" htmlFor="rev-title">Review Title</label>
                    <input
                      id="rev-title"
                      type="text"
                      placeholder="e.g. Unforgettable autumn morning in Gion"
                      value={title}
                      maxLength={120}
                      onChange={(e) => setTitle(e.target.value)}
                    />
                  </div>
                  <div className="field">
                    <label className="field-label" htmlFor="rev-date">Date Visited</label>
                    <input
                      id="rev-date"
                      type="date"
                      value={visitedAt}
                      onChange={(e) => setVisitedAt(e.target.value)}
                    />
                  </div>
                </div>

                {/* Detailed Experience (Full Width & Generous Height) */}
                <div className="field">
                  <label className="field-label" htmlFor="rev-content">
                    Your Notes & Story <span className="field-required">*</span>
                  </label>
                  <textarea
                    id="rev-content"
                    rows={5}
                    required
                    placeholder="What stood out? Favorite spots, memorable food, local customs, or travel tips for next time..."
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                  />
                </div>

                {/* Photos Upload & URL Section - Integrated Cohesive Card */}
                <div className="review-attachments-box">
                  <div className="attachments-header">
                    <span className="attachments-title">Photo Attachments</span>
                    <span className="attachments-counter">{photos.length}/8 photos attached</span>
                  </div>

                  <div className="attachments-controls-row">
                    <label className={`upload-photo-btn ${compressing ? 'disabled' : ''}`}>
                      {compressing ? <Loader2 size={15} className="spin-icon" /> : <ImageIcon size={15} />}
                      <span>{compressing ? 'Optimizing...' : 'Choose device photos'}</span>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handleFileUpload}
                        style={{ display: 'none' }}
                        disabled={photos.length >= 8 || compressing}
                      />
                    </label>

                    <div className="image-url-input-wrap">
                      <input
                        type="url"
                        placeholder="Or paste image link (https://...)"
                        value={imageUrlInput}
                        onChange={(e) => setImageUrlInput(e.target.value)}
                        disabled={photos.length >= 8 || compressing}
                      />
                      <button
                        type="button"
                        className="button button-secondary-outline btn-sm attach-action-btn"
                        onClick={handleAddImageUrl}
                        disabled={!imageUrlInput.trim() || photos.length >= 8 || compressing}
                      >
                        Attach
                      </button>
                    </div>
                  </div>

                  {/* Attached Photo Thumbnails */}
                  {photos.length > 0 && (
                    <div className="form-photo-previews">
                      {photos.map((src, idx) => (
                        <div key={idx} className="preview-thumb-item">
                          <img src={src} alt={`Uploaded preview ${idx + 1}`} />
                          <button
                            type="button"
                            className="thumb-remove-btn"
                            onClick={() => handleRemovePhoto(idx)}
                            title="Remove photo"
                            aria-label={`Remove photo ${idx + 1}`}
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="button button-secondary-outline"
                  onClick={handleCloseModal}
                  disabled={submitting || compressing}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="button button-dark"
                  disabled={!content.trim() || submitting || compressing}
                >
                  <Plus size={15} />
                  <span>
                    {submitting
                      ? 'Saving...'
                      : compressing
                      ? 'Optimizing Photos...'
                      : editingReviewId
                      ? 'Save Changes'
                      : 'Save Review'}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. Lightbox Preview Modal */}
      {previewPhoto && (
        <div className="modal-overlay lightbox-overlay" onClick={() => setPreviewPhoto(null)}>
          <div className="lightbox-content" onClick={(e) => e.stopPropagation()}>
            <img src={previewPhoto} alt="Full preview" />
            <button
              type="button"
              className="lightbox-close-btn"
              onClick={() => setPreviewPhoto(null)}
              aria-label="Close photo preview"
            >
              <X size={20} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default TripReviewsView
