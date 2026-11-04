import React, { useState } from 'react';
import {
  Compass,
  Sun,
  Calendar,
  Clock,
  CheckCircle2,
  Circle,
  PlusCircle,
  ArrowRight,
  Sparkles,
  MapPin,
  ChevronRight,
  TrendingUp,
  Wallet,
  AlertCircle
} from 'lucide-react';
import { calculateTripCountdown } from '../tripReminders';

export function TodayCompanionView({
  trip,
  checkedActivities = {},
  onToggleActivity,
  onQuickLogExpense,
  onAskAssistant,
  onSwitchDay,
  formatLocal,
  tripSheetCurrencyMode,
  selectedTripCurrency
}) {
  const [selectedDayOverride, setSelectedDayOverride] = useState(null);

  if (!trip) return null;

  const countdown = calculateTripCountdown(
    trip.startDate,
    new Date(),
    trip.days?.length || 1
  );

  // Determine current active day number
  let calculatedDayNum = 1;
  const isTripOngoing = countdown.status === 'ongoing' || countdown.status === 'today';

  if (countdown.status === 'ongoing') {
    const elapsed = Math.abs(countdown.diffDays || 0);
    calculatedDayNum = Math.min(elapsed + 1, trip.days?.length || 1);
  } else if (countdown.status === 'today') {
    calculatedDayNum = 1;
  } else if (countdown.status === 'completed') {
    calculatedDayNum = trip.days?.length || 1;
  } else {
    // Upcoming trip
    calculatedDayNum = 1;
  }

  const activeDayNumber = selectedDayOverride !== null ? selectedDayOverride : calculatedDayNum;
  const activeDayData = trip.days?.find(d => d.day === activeDayNumber) || trip.days?.[0];

  const totalActivities = activeDayData?.activities?.length || 0;
  const completedCount = (activeDayData?.activities || []).reduce((acc, act, idx) => {
    const actKey = `${trip.id || trip.destination}_d${activeDayData.day}_${idx}`;
    return acc + (checkedActivities[actKey] ? 1 : 0);
  }, 0);

  const progressPercent = totalActivities > 0 ? Math.round((completedCount / totalActivities) * 100) : 0;

  return (
    <div className="today-companion-shell print-hide">
      {/* Header Banner */}
      <div className="today-banner-card">
        <div className="today-banner-top">
          <div className="today-live-pill">
            <span className="live-pulsing-dot" aria-hidden="true" />
            <span>
              {isTripOngoing ? 'Trip in Progress' : countdown.badgeText || 'Trip Overview'}
            </span>
          </div>

          {/* Day Selector Pills */}
          {trip.days && trip.days.length > 1 && (
            <div className="today-day-switcher" role="tablist" aria-label="Select trip day to view">
              {trip.days.map(d => {
                const isSelected = d.day === activeDayNumber;
                const isRealToday = isTripOngoing && d.day === calculatedDayNum;
                return (
                  <button
                    key={d.day}
                    type="button"
                    role="tab"
                    aria-selected={isSelected}
                    className={`today-day-chip ${isSelected ? 'active' : ''} ${isRealToday ? 'is-today-marker' : ''}`}
                    onClick={() => setSelectedDayOverride(d.day)}
                  >
                    <span>Day {d.day}</span>
                    {isRealToday && <span className="today-sub-dot" title="Current Day" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="today-banner-content">
          <div className="today-headline-group">
            <h3 className="today-title">
              Day 0{activeDayData?.day}: {activeDayData?.title || 'Daily Schedule'}
            </h3>
            <p className="today-subtitle">
              <MapPin size={14} /> {trip.destination} · {completedCount} of {totalActivities} activities done
            </p>
          </div>

          {/* Quick Progress Indicator */}
          <div className="today-progress-wrap">
            <div className="today-progress-meta">
              <span>Day Progress</span>
              <strong>{progressPercent}%</strong>
            </div>
            <div className="today-progress-bar-bg">
              <div
                className="today-progress-bar-fill"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid: Schedule on left, Quick Actions on right */}
      <div className="today-grid-layout">
        {/* Left Column: Sequential Schedule */}
        <div className="today-timeline-card">
          <div className="today-card-header">
            <h4>Today's Timeline</h4>
            <span className="today-timeline-count">{totalActivities} stops</span>
          </div>

          {totalActivities === 0 ? (
            <p className="no-activities-hint">No activities planned for this day yet.</p>
          ) : (
            <div className="today-timeline-list">
              {activeDayData.activities.map((act, actIdx) => {
                const actKey = `${trip.id || trip.destination}_d${activeDayData.day}_${actIdx}`;
                const isChecked = Boolean(checkedActivities[actKey]);

                return (
                  <div
                    key={actIdx}
                    className={`today-timeline-item ${isChecked ? 'completed' : ''}`}
                  >
                    <button
                      type="button"
                      className="today-check-btn"
                      onClick={() => onToggleActivity?.(actKey)}
                      aria-label={isChecked ? `Mark ${act.title} as incomplete` : `Mark ${act.title} as completed`}
                    >
                      {isChecked ? (
                        <CheckCircle2 size={20} className="check-icon-done" />
                      ) : (
                        <Circle size={20} className="check-icon-pending" />
                      )}
                    </button>

                    <div className="today-item-body">
                      <div className="today-item-time-row">
                        <span className="today-time-badge">
                          <Clock size={12} /> {act.time || 'Flexible'}
                        </span>
                        {act.cost !== undefined && (
                          <span className="today-cost-chip">
                            {act.cost === 0
                              ? 'Free'
                              : tripSheetCurrencyMode === 'local' && selectedTripCurrency?.code !== 'USD'
                                ? `${formatLocal?.(act.cost, selectedTripCurrency.code)} (~$${act.cost})`
                                : formatLocal?.(act.cost, 'USD') || `$${act.cost}`
                            }
                          </span>
                        )}
                      </div>

                      <strong className="today-item-title">{act.title}</strong>
                      <p className="today-item-desc">{act.description}</p>

                      {/* Item Quick Actions */}
                      <div className="today-item-actions">
                        <button
                          type="button"
                          className="today-item-log-btn"
                          onClick={() => onQuickLogExpense?.({
                            amount: act.cost !== undefined && act.cost !== null ? act.cost : 15,
                            note: `${act.title} (Day ${activeDayData.day})`,
                            category: act.category === 'walk' ? 'activities' : (act.category || 'activities'),
                            activityId: actKey
                          })}
                        >
                          <Wallet size={12} />
                          <span>Log Expense</span>
                        </button>

                        <button
                          type="button"
                          className="today-item-ask-btn"
                          onClick={() => onAskAssistant?.(`Tell me practical tips, best entrance, or nearby café recommendations for: ${act.title} in ${trip.destination}`)}
                        >
                          <Sparkles size={12} />
                          <span>Ask AI</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: In-Trip Companion Shortcuts */}
        <div className="today-side-col">
          {/* AI Companion Prompt Card */}
          <div className="today-companion-card ai-prompts">
            <div className="companion-card-header">
              <Sparkles size={16} className="sparkle-icon" />
              <h4>Travel Assistant Shortcuts</h4>
            </div>
            <p className="companion-card-desc">
              Tap any in-the-moment question to adjust your schedule with Gemini:
            </p>
            <div className="companion-prompts-list">
              <button
                type="button"
                className="companion-prompt-btn"
                onClick={() => onAskAssistant?.(`I'm running about an hour behind on Day ${activeDayData.day}. How should I adjust the remaining times?`)}
              >
                <span>⏱️ "I'm running 1 hour behind"</span>
                <ChevronRight size={14} />
              </button>
              <button
                type="button"
                className="companion-prompt-btn"
                onClick={() => onAskAssistant?.(`It's raining today in ${trip.destination}. Suggest indoor alternatives for Day ${activeDayData.day}.`)}
              >
                <span>☔ "It's raining, give indoor swaps"</span>
                <ChevronRight size={14} />
              </button>
              <button
                type="button"
                className="companion-prompt-btn"
                onClick={() => onAskAssistant?.(`Recommend the best authentic local lunch spot near our activities on Day ${activeDayData.day}.`)}
              >
                <span>🍜 "Where should we grab lunch nearby?"</span>
                <ChevronRight size={14} />
              </button>
            </div>
          </div>

          {/* Trip Tip Card */}
          {trip.travelTip && (
            <div className="today-companion-card tip-card">
              <div className="companion-card-header">
                <Compass size={16} />
                <h4>Local Travel Tip</h4>
              </div>
              <p className="today-tip-text">"{trip.travelTip}"</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

