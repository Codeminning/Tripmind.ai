import React, { useState, useEffect } from 'react'
import { Plus, X, Sparkles, Clock, Tag, DollarSign, MapPin, Calculator } from 'lucide-react'
import { CURRENCIES } from '../currency'

export function ProposeActivityModal({
  isOpen = true,
  dayNum,
  onClose,
  onSubmit,
  destination,
  tripCurrency,
  onOpenCurrencyCalc
}) {
  const defaultCurr = tripCurrency?.code || 'USD'
  const [title, setTitle] = useState('')
  const [time, setTime] = useState('14:00')
  const [category, setCategory] = useState('culture')
  const [cost, setCost] = useState('20')
  const [currency, setCurrency] = useState(defaultCurr)
  const [description, setDescription] = useState('')
  const [location, setLocation] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')

  useEffect(() => {
    if (tripCurrency?.code) {
      setCurrency(tripCurrency.code)
    }
  }, [tripCurrency])

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!title.trim()) {
      setFormError('Please enter an activity title.')
      return
    }
    if (submitting) return

    setSubmitting(true)
    setFormError('')
    try {
      await onSubmit({
        title: title.trim(),
        time: time.trim() || '14:00',
        category,
        cost: Math.max(0, Math.round(Number(cost) || 0)),
        currency,
        description: description.trim() || `Explore ${title.trim()} with the group.`,
        location: location.trim() || destination || 'Central'
      })
      onClose()
    } catch (err) {
      console.error('Failed to submit proposal:', err)
      setFormError('Could not save proposal. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const selectedCurrObj = CURRENCIES[currency] || CURRENCIES.USD

  return (
    <div className="modal-overlay" role="presentation" onClick={onClose}>
      <div
        className="modal-card propose-modal-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="propose-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div className="group-modal-title-wrap">
            <div className="group-icon-badge" aria-hidden="true">
              <Plus size={18} />
            </div>
            <div>
              <h3 id="propose-modal-title">Propose Activity for Day {dayNum}</h3>
              <p className="modal-subtitle">Suggest an experience for group review and voting.</p>
            </div>
          </div>
          <button
            type="button"
            className="icon-btn-ghost"
            onClick={onClose}
            aria-label="Close dialog"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form-shell">
          <div className="modal-scroll-body">
            {formError && (
              <div className="form-error-banner" role="alert">
                <span>{formError}</span>
              </div>
            )}

            {/* Activity Title (Full Width) */}
            <div className="field">
              <label className="field-label" htmlFor="prop-title">
                Activity Title <span className="field-required">*</span>
              </label>
              <input
                id="prop-title"
                type="text"
                placeholder="e.g. Sunset Boat Cruise or Artisan Matcha Tasting"
                value={title}
                maxLength={120}
                onChange={(e) => {
                  setTitle(e.target.value)
                  if (formError) setFormError('')
                }}
                required
                autoFocus
              />
            </div>

            {/* Time & Category Row */}
            <div className="propose-form-row">
              <div className="field">
                <label className="field-label" htmlFor="prop-time">Suggested Time</label>
                <input
                  id="prop-time"
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                />
              </div>
              <div className="field">
                <label className="field-label" htmlFor="prop-category">Category</label>
                <select
                  id="prop-category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  <option value="culture">Culture & Sights</option>
                  <option value="food">Dining & Cafés</option>
                  <option value="walk">Scenic Walks</option>
                  <option value="nature">Nature & Parks</option>
                  <option value="art">Art & Museums</option>
                  <option value="adventure">Outdoor Adventure</option>
                  <option value="other">Other Experience</option>
                </select>
              </div>
            </div>

            {/* Estimated Cost & Explicit Currency Selector */}
            <div className="propose-form-row">
              <div className="field">
                <div className="field-label-row">
                  <label className="field-label" htmlFor="prop-cost">Est. Cost</label>
                  {onOpenCurrencyCalc && (
                    <button
                      type="button"
                      className="calc-helper-link"
                      onClick={onOpenCurrencyCalc}
                      title="Open currency converter"
                    >
                      <Calculator size={11} />
                      <span>Converter</span>
                    </button>
                  )}
                </div>
                <div className="calc-input-wrap">
                  <span className="calc-curr-symbol">{selectedCurrObj.symbol}</span>
                  <input
                    id="prop-cost"
                    type="number"
                    min="0"
                    max="1000000"
                    value={cost}
                    onChange={(e) => setCost(e.target.value)}
                    placeholder="0"
                  />
                </div>
              </div>

              <div className="field">
                <label className="field-label" htmlFor="prop-currency">Currency</label>
                <select
                  id="prop-currency"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  title="Select currency"
                >
                  {Object.values(CURRENCIES).map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.flag} {c.code} ({c.symbol}) - {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Description & Context (Full Width) */}
            <div className="field">
              <div className="field-label-row">
                <label className="field-label" htmlFor="prop-desc">Description & Context (Optional)</label>
                <span className="char-counter">{description.length}/250</span>
              </div>
              <textarea
                id="prop-desc"
                rows={3}
                placeholder="Why this would be great for the group (e.g. recommended by a local host, nearby our afternoon spot)..."
                value={description}
                maxLength={250}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="button button-secondary-outline"
              onClick={onClose}
              disabled={submitting}
            >
              <span>Cancel</span>
            </button>
            <button
              type="submit"
              className="button button-dark"
              disabled={!title.trim() || submitting}
            >
              <Plus size={15} />
              <span>{submitting ? 'Submitting...' : 'Submit Proposal'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
