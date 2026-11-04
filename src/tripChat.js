/**
 * TripMind AI - Trip Chat & Itinerary Diff Engine
 * Handles conversational itinerary modifications, edit validation, diff generation, and undo history.
 */

// Permitted activity categories
export const ALLOWED_CATEGORIES = ['food', 'nature', 'culture', 'walk', 'adventure', 'art', 'other'];

/**
 * Validates a single time string (e.g. "09:00", "14:30")
 */
export function sanitizeTimeString(timeStr, fallback = '12:00') {
  if (!timeStr || typeof timeStr !== 'string') return fallback;
  const match = timeStr.trim().match(/^([01]?[0-9]|2[0-3]):([0-5][0-9])/);
  if (match) {
    const hh = match[1].padStart(2, '0');
    const mm = match[2];
    return `${hh}:${mm}`;
  }
  return fallback;
}

/**
 * Validates and sanitizes an activity object
 */
export function sanitizeActivity(activity, defaultCategory = 'culture') {
  if (!activity || typeof activity !== 'object') return null;

  const title = String(activity.title || '').trim().slice(0, 120);
  if (!title) return null;

  const category = ALLOWED_CATEGORIES.includes(activity.category) ? activity.category : defaultCategory;
  const time = sanitizeTimeString(activity.time);
  const cost = Math.max(0, Math.round(Number(activity.cost) || 0));
  const description = String(activity.description || '').trim().slice(0, 300);
  const location = String(activity.location || '').trim().slice(0, 100);

  const cleanAct = {
    title,
    time,
    category,
    cost,
    description: description || `Experience ${title} in the heart of the city.`,
    location: location || 'Central'
  };

  // Validate coordinates if provided
  const lat = typeof activity.latitude === 'string' ? parseFloat(activity.latitude) : Number(activity.latitude);
  const lng = typeof activity.longitude === 'string' ? parseFloat(activity.longitude) : Number(activity.longitude);
  if (
    Number.isFinite(lat) && Number.isFinite(lng) &&
    lat >= -90 && lat <= 90 &&
    lng >= -180 && lng <= 180 &&
    !(lat === 0 && lng === 0)
  ) {
    cleanAct.latitude = Number(lat.toFixed(6));
    cleanAct.longitude = Number(lng.toFixed(6));
  }

  return cleanAct;
}

/**
 * Validates and sanitizes a list of edits against an existing trip structure.
 * Rejects malformed edits and drops invalid ones.
 */
export function validateAndSanitizeEdits(rawEdits, trip) {
  if (!Array.isArray(rawEdits) || !trip || !Array.isArray(trip.days)) {
    return { valid: false, sanitizedEdits: [], errors: ['Invalid edits format or missing trip days.'] };
  }

  const validTypes = ['replace_activity', 'add_activity', 'remove_activity', 'move_activity'];
  const sanitizedEdits = [];
  const errors = [];

  const daysMap = new Map();
  trip.days.forEach(d => {
    daysMap.set(Number(d.day), d);
  });

  for (let i = 0; i < rawEdits.length; i++) {
    const edit = rawEdits[i];
    if (!edit || typeof edit !== 'object') {
      errors.push(`Edit #${i + 1} is not an object.`);
      continue;
    }

    const type = String(edit.type || '').trim().toLowerCase();
    if (!validTypes.includes(type)) {
      errors.push(`Edit #${i + 1} has invalid edit type: "${edit.type}".`);
      continue;
    }

    const dayNum = Number(edit.day);
    if (!daysMap.has(dayNum)) {
      errors.push(`Edit #${i + 1} references Day ${edit.day}, which does not exist in this itinerary.`);
      continue;
    }

    const targetDay = daysMap.get(dayNum);
    const activitiesCount = Array.isArray(targetDay.activities) ? targetDay.activities.length : 0;
    const index = Number(edit.index);

    if (type === 'replace_activity' || type === 'remove_activity') {
      if (!Number.isInteger(index) || index < 0 || index >= activitiesCount) {
        errors.push(`Edit #${i + 1} specifies index ${index} out of bounds for Day ${dayNum} (0-${activitiesCount - 1}).`);
        continue;
      }
    }

    if (type === 'replace_activity' || type === 'add_activity') {
      const sanitizedAct = sanitizeActivity(edit.activity);
      if (!sanitizedAct) {
        errors.push(`Edit #${i + 1} (${type}) has an invalid or incomplete activity payload.`);
        continue;
      }

      sanitizedEdits.push({
        type,
        day: dayNum,
        index: Number.isInteger(index) && index >= 0 ? index : activitiesCount,
        activity: sanitizedAct
      });
    } else if (type === 'remove_activity') {
      sanitizedEdits.push({
        type,
        day: dayNum,
        index
      });
    } else if (type === 'move_activity') {
      const targetIndex = Number(edit.targetIndex ?? index);
      if (Number.isInteger(index) && index >= 0 && index < activitiesCount) {
        sanitizedEdits.push({
          type,
          day: dayNum,
          index,
          targetIndex: Math.max(0, Math.min(activitiesCount - 1, targetIndex))
        });
      }
    }
  }

  return {
    valid: sanitizedEdits.length > 0 && errors.length === 0,
    sanitizedEdits,
    errors
  };
}

/**
 * Creates human-readable diff details for an edit
 */
export function getEditDiffDetails(trip, edit) {
  const day = trip?.days?.find(d => Number(d.day) === Number(edit.day));
  const currentAct = day?.activities?.[edit.index];

  switch (edit.type) {
    case 'replace_activity':
      return {
        type: 'replace',
        badge: 'Replace Activity',
        day: edit.day,
        before: currentAct ? { title: currentAct.title, time: currentAct.time, cost: currentAct.cost } : null,
        after: { title: edit.activity.title, time: edit.activity.time, cost: edit.activity.cost },
        summary: `Day ${edit.day}: Replace "${currentAct?.title || 'Activity'}" with "${edit.activity.title}"`
      };
    case 'add_activity':
      return {
        type: 'add',
        badge: 'Add Activity',
        day: edit.day,
        before: null,
        after: { title: edit.activity.title, time: edit.activity.time, cost: edit.activity.cost },
        summary: `Day ${edit.day}: Add "${edit.activity.title}" at ${edit.activity.time}`
      };
    case 'remove_activity':
      return {
        type: 'remove',
        badge: 'Remove Activity',
        day: edit.day,
        before: currentAct ? { title: currentAct.title, time: currentAct.time, cost: currentAct.cost } : null,
        after: null,
        summary: `Day ${edit.day}: Remove "${currentAct?.title || 'Activity'}"`
      };
    case 'move_activity':
      return {
        type: 'move',
        badge: 'Reorder Activity',
        day: edit.day,
        before: currentAct ? { title: currentAct.title, time: currentAct.time } : null,
        after: { title: currentAct?.title || 'Activity', time: 'Reordered' },
        summary: `Day ${edit.day}: Reorder "${currentAct?.title || 'Activity'}"`
      };
    default:
      return { type: 'unknown', summary: 'Update itinerary' };
  }
}

/**
 * Applies a list of sanitized edits to a trip, returning a new immutable trip copy.
 * Keeps chronological activity order per day and updates budget totals.
 */
export function applyTripEdits(trip, edits) {
  if (!trip || !Array.isArray(trip.days)) return trip;

  // Deep clone days
  const updatedDays = trip.days.map(d => ({
    ...d,
    activities: Array.isArray(d.activities) ? d.activities.map(a => ({ ...a })) : []
  }));

  const daysMap = new Map();
  updatedDays.forEach(d => daysMap.set(Number(d.day), d));

  for (const edit of edits) {
    const day = daysMap.get(Number(edit.day));
    if (!day || !Array.isArray(day.activities)) continue;

    if (edit.type === 'replace_activity') {
      if (edit.index >= 0 && edit.index < day.activities.length) {
        day.activities[edit.index] = { ...edit.activity };
      }
    } else if (edit.type === 'add_activity') {
      const idx = Math.min(day.activities.length, Math.max(0, edit.index ?? day.activities.length));
      day.activities.splice(idx, 0, { ...edit.activity });
    } else if (edit.type === 'remove_activity') {
      if (edit.index >= 0 && edit.index < day.activities.length) {
        day.activities.splice(edit.index, 1);
      }
    } else if (edit.type === 'move_activity') {
      const { index, targetIndex } = edit;
      if (index >= 0 && index < day.activities.length && targetIndex >= 0 && targetIndex < day.activities.length) {
        const [moved] = day.activities.splice(index, 1);
        day.activities.splice(targetIndex, 0, moved);
      }
    }

    // Sort activities chronologically by time to keep day timeline coherent
    day.activities.sort((a, b) => {
      const timeA = String(a.time || '12:00');
      const timeB = String(b.time || '12:00');
      return timeA.localeCompare(timeB);
    });
  }

  // Recalculate activities budget estimate if present
  let totalActivitiesCost = 0;
  updatedDays.forEach(d => {
    d.activities.forEach(a => {
      totalActivitiesCost += Number(a.cost) || 0;
    });
  });

  const updatedBudget = trip.budgetBreakdown ? {
    ...trip.budgetBreakdown,
    categories: {
      ...(trip.budgetBreakdown.categories || {}),
      activities: totalActivitiesCost
    }
  } : trip.budgetBreakdown;

  return {
    ...trip,
    days: updatedDays,
    budgetBreakdown: updatedBudget,
    updatedAt: new Date().toISOString()
  };
}

/**
 * Sends a message to /api/trip-chat
 */
export async function sendTripChatMessage({ trip, message, chatHistory = [], token, signal }) {
  const cleanMessage = String(message || '').trim().slice(0, 500);
  if (!cleanMessage) {
    throw new Error('Please type a message to chat with your itinerary.');
  }

  // Last 6 messages max for context control
  const recentHistory = chatHistory.slice(-6).map(m => ({
    role: m.role === 'assistant' ? 'assistant' : 'user',
    content: String(m.content || '').slice(0, 500)
  }));

  const headers = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch('/api/trip-chat', {
    method: 'POST',
    headers,
    signal,
    body: JSON.stringify({
      trip: {
        id: trip?.id,
        destination: trip?.destination,
        startDate: trip?.startDate,
        days: trip?.days,
        budgetBreakdown: trip?.budgetBreakdown,
        travelTip: trip?.travelTip
      },
      chatHistory: recentHistory,
      message: cleanMessage
    })
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const errorMsg = data.error || (
      res.status === 429
        ? 'Too many chat requests. Please wait a moment before sending another message.'
        : res.status === 504
        ? 'AI response timed out. Please try asking in a simpler way.'
        : 'Could not communicate with the AI travel assistant.'
    );
    const error = new Error(errorMsg);
    error.status = res.status;
    error.code = data.code;
    throw error;
  }

  return data;
}

