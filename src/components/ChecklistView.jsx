import React, { useState, useEffect } from 'react'
import {
  CheckSquare,
  Square,
  Plus,
  Trash2,
  Sparkles,
  AlertCircle,
  FileText,
  CloudRain,
  Compass,
  Lightbulb,
  CheckCircle2
} from 'lucide-react'
import {
  fetchTripChecklist,
  saveTripChecklist,
  generateDefaultChecklist
} from '../tripReminders'

const CATEGORY_META = {
  documents: { label: 'Documents & Passes', icon: FileText, color: '#2b5143' },
  weather: { label: 'Weather-Ready Gear', icon: CloudRain, color: '#3a7d68' },
  activities: { label: 'Activity Essentials', icon: Compass, color: '#c76b4e' },
  tips: { label: 'Local Tips & Prep', icon: Lightbulb, color: '#b8860b' }
}

export function ChecklistView({ trip, currentUser, showToast }) {
  const [checklist, setChecklist] = useState([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [newItemText, setNewItemText] = useState('')
  const [newItemCategory, setNewItemCategory] = useState('activities')

  useEffect(() => {
    if (!trip?.id) return
    setLoading(true)
    fetchTripChecklist(trip.id, trip, currentUser?.id)
      .then(items => {
        setChecklist(items || [])
      })
      .finally(() => setLoading(false))
  }, [trip?.id, currentUser?.id])

  const handleToggleItem = async (itemId) => {
    const updated = checklist.map(item =>
      item.id === itemId ? { ...item, checked: !item.checked } : item
    )
    setChecklist(updated)
    await saveTripChecklist(trip.id, updated, currentUser?.id)
  }

  const handleAddItem = async (e) => {
    e.preventDefault()
    const cleanText = newItemText.trim()
    if (!cleanText) return

    const newItem = {
      id: `custom_${Date.now()}`,
      category: newItemCategory,
      text: cleanText,
      checked: false
    }

    const updated = [...checklist, newItem]
    setChecklist(updated)
    setNewItemText('')
    await saveTripChecklist(trip.id, updated, currentUser?.id)
    showToast?.('Item added to checklist!')
  }

  const handleDeleteItem = async (itemId) => {
    const updated = checklist.filter(item => item.id !== itemId)
    setChecklist(updated)
    await saveTripChecklist(trip.id, updated, currentUser?.id)
    showToast?.('Item removed.')
  }

  const handleRegenerateChecklist = async () => {
    setGenerating(true)
    try {
      const res = await fetch(`/api/trips/${trip.id}/checklist/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trip })
      })

      if (res.ok) {
        const data = await res.json()
        if (Array.isArray(data.checklist)) {
          setChecklist(data.checklist)
          await saveTripChecklist(trip.id, data.checklist, currentUser?.id)
          showToast?.('Checklist refreshed with AI! ✨')
          return
        }
      }
      // Fallback
      const fallback = generateDefaultChecklist(trip)
      setChecklist(fallback)
      await saveTripChecklist(trip.id, fallback, currentUser?.id)
      showToast?.('Checklist reset to smart defaults.')
    } catch (err) {
      console.warn('Checklist generation error:', err)
      showToast?.('Could not regenerate checklist.')
    } finally {
      setGenerating(false)
    }
  }

  const totalCount = checklist.length
  const checkedCount = checklist.filter(i => i.checked).length
  const progressPct = totalCount > 0 ? Math.round((checkedCount / totalCount) * 100) : 0

  const grouped = {
    documents: checklist.filter(i => i.category === 'documents'),
    weather: checklist.filter(i => i.category === 'weather'),
    activities: checklist.filter(i => i.category === 'activities'),
    tips: checklist.filter(i => i.category === 'tips')
  }

  return (
    <div className="checklist-view-root" role="region" aria-label="Trip Packing Checklist">
      {/* Header & Progress */}
      <div className="checklist-header-card">
        <div className="checklist-header-info">
          <div className="checklist-badge">
            <CheckCircle2 size={15} />
            <span>Packing & Preparation</span>
          </div>
          <h3>Curated Prep Checklist for {trip?.destination}</h3>
          <p>Personalized gear, documents, and local destination tips.</p>
        </div>

        <div className="checklist-actions">
          <button
            type="button"
            className="button button-secondary btn-sm"
            onClick={handleRegenerateChecklist}
            disabled={generating}
            title="Regenerate checklist using Gemini AI"
          >
            <Sparkles size={14} className={generating ? 'spin' : ''} />
            <span>{generating ? 'Regenerating...' : 'Regenerate with AI'}</span>
          </button>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="checklist-progress-card">
        <div className="checklist-progress-top">
          <span className="checklist-progress-label">
            <strong>{checkedCount}</strong> of <strong>{totalCount}</strong> items packed
          </span>
          <span className="checklist-progress-pct">{progressPct}%</span>
        </div>
        <div className="checklist-progress-track">
          <div
            className="checklist-progress-fill"
            style={{ width: `${progressPct}%` }}
            role="progressbar"
            aria-valuenow={progressPct}
            aria-valuemin={0}
            aria-valuemax={100}
          />
        </div>
      </div>

      {/* Grouped Category Sections */}
      {loading ? (
        <div className="checklist-loading">
          <div className="spinner-dot" />
          <span>Loading checklist items...</span>
        </div>
      ) : (
        <div className="checklist-categories-grid">
          {Object.entries(CATEGORY_META).map(([catKey, meta]) => {
            const items = grouped[catKey] || []
            const Icon = meta.icon

            return (
              <div key={catKey} className="checklist-category-card">
                <div className="category-card-header">
                  <div className="category-header-title">
                    <Icon size={16} style={{ color: meta.color }} />
                    <h4>{meta.label}</h4>
                  </div>
                  <span className="category-count">
                    {items.filter(i => i.checked).length} / {items.length}
                  </span>
                </div>

                <div className="category-items-list" role="list">
                  {items.length === 0 ? (
                    <div className="category-empty-hint">No items in this category yet.</div>
                  ) : (
                    items.map(item => (
                      <div
                        key={item.id}
                        role="listitem"
                        className={`checklist-item-row ${item.checked ? 'completed' : ''}`}
                      >
                        <button
                          type="button"
                          className="checklist-checkbox"
                          onClick={() => handleToggleItem(item.id)}
                          aria-label={item.checked ? `Mark ${item.text} as unpacked` : `Mark ${item.text} as packed`}
                        >
                          {item.checked ? (
                            <CheckSquare size={18} className="checkbox-checked" />
                          ) : (
                            <Square size={18} className="checkbox-empty" />
                          )}
                        </button>

                        <span
                          className="checklist-item-text"
                          onClick={() => handleToggleItem(item.id)}
                        >
                          {item.text}
                        </span>

                        <button
                          type="button"
                          className="checklist-item-delete"
                          onClick={() => handleDeleteItem(item.id)}
                          aria-label={`Delete item: ${item.text}`}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Add Custom Item Form */}
      <form className="checklist-add-form" onSubmit={handleAddItem}>
        <div className="add-form-row">
          <input
            type="text"
            placeholder="Add a custom item (e.g. Camera lenses, Kindle, power strip)..."
            value={newItemText}
            maxLength={150}
            onChange={(e) => setNewItemText(e.target.value)}
          />
          <select
            value={newItemCategory}
            onChange={(e) => setNewItemCategory(e.target.value)}
            aria-label="Item category"
          >
            <option value="activities">Activity Gear</option>
            <option value="documents">Documents</option>
            <option value="weather">Weather Gear</option>
            <option value="tips">Tips / Local</option>
          </select>
          <button
            type="submit"
            className="button button-dark"
            disabled={!newItemText.trim()}
          >
            <Plus size={15} />
            <span>Add Item</span>
          </button>
        </div>
      </form>

      {/* AI Disclaimer */}
      <div className="trip-sheet-disclaimer" role="note" style={{ marginTop: '16px' }}>
        <AlertCircle size={14} aria-hidden="true" />
        <span>Checklist items are tailored recommendations by TripMind AI. Always verify official visa, passport, and customs requirements for your destination before traveling.</span>
      </div>
    </div>
  )
}

