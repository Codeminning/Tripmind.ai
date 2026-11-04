import React from 'react'
import { Calendar, Clock, Compass, Sparkles, ArrowRight } from 'lucide-react'
import { calculateTripCountdown } from '../tripReminders'
import { upper } from '../utils/safeText'

export function CountdownCard({ trip, onOpenChecklist }) {
  if (!trip?.startDate) return null

  const countdown = calculateTripCountdown(trip.startDate, new Date(), trip.days?.length || 1)
  if (!countdown.hasDate || countdown.status === 'completed') return null

  const isToday = countdown.status === 'today'
  const isTomorrow = countdown.status === 'tomorrow'
  const isUpcoming = countdown.status === 'upcoming'
  const isOngoing = countdown.status === 'ongoing'

  return (
    <div className={`countdown-banner-root print-hide ${countdown.status}`}>
      <div className="countdown-visual-col">
        {isUpcoming && (
          <div className="countdown-number-block">
            <span className="countdown-number">{countdown.diffDays}</span>
            <span className="countdown-unit">DAYS TO GO</span>
          </div>
        )}
        {(isToday || isTomorrow || isOngoing) && (
          <div className="countdown-number-block pulse">
            <span className="countdown-status-badge">{upper(countdown?.badgeText, 'UPCOMING')}</span>
          </div>
        )}
      </div>

      <div className="countdown-info-col">
        <div className="countdown-meta-tag">
          <Calendar size={13} aria-hidden="true" />
          <span>Start Date: {trip.startDate}</span>
        </div>
        <h4 className="countdown-heading">{countdown.headline}</h4>
        <p className="countdown-desc">
          {isUpcoming && `Keep your preparations on schedule. Check destination weather and review your checklist before departure.`}
          {isTomorrow && `Double-check your tickets, passport, and bags tonight so tomorrow starts effortlessly.`}
          {isToday && `Today is the day! Enjoy every hidden alley, local bite, and scenic vista in ${trip.destination}.`}
          {isOngoing && `Immerse yourself in ${trip.destination}. Check your daily activities below.`}
        </p>
      </div>

      {onOpenChecklist && (
        <div className="countdown-action-col">
          <button
            type="button"
            className="button button-dark btn-sm countdown-checklist-btn"
            onClick={onOpenChecklist}
          >
            <span>Prep Checklist</span>
            <ArrowRight size={14} />
          </button>
        </div>
      )}
    </div>
  )
}

