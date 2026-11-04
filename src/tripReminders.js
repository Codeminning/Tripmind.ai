/**
 * TripMind AI - Trip Countdown, Weather & Reminder Logic
 * Handles local date calculations, countdown metrics, Open-Meteo weather lookups,
 * and packing/prep checklist management.
 */

/**
 * Parses a YYYY-MM-DD string into a Date object at local midnight, avoiding UTC timezone shifts.
 */
export function parseLocalDate(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const match = dateStr.trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (!match) return null;
  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10) - 1;
  const day = parseInt(match[3], 10);
  const d = new Date(year, month, day);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Calculates trip countdown using local calendar day boundaries.
 * @param {string} startDateStr - YYYY-MM-DD
 * @param {Date} [referenceDate] - defaults to new Date()
 * @param {number} [durationDays] - trip length in days
 */
export function calculateTripCountdown(startDateStr, referenceDate = new Date(), durationDays = 1) {
  const tripDate = parseLocalDate(startDateStr);
  if (!tripDate) {
    return {
      hasDate: false,
      diffDays: null,
      badgeText: 'Dates flexible',
      status: 'no_date',
      daysToGo: null
    };
  }

  const today = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate());
  const diffTime = tripDate.getTime() - today.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays > 1) {
    return {
      hasDate: true,
      diffDays,
      daysToGo: diffDays,
      badgeText: `${diffDays} days to go`,
      headline: `${diffDays} days until ${startDateStr}`,
      status: 'upcoming'
    };
  } else if (diffDays === 1) {
    return {
      hasDate: true,
      diffDays: 1,
      daysToGo: 1,
      badgeText: 'Starts tomorrow',
      headline: 'Trip begins tomorrow!',
      status: 'tomorrow'
    };
  } else if (diffDays === 0) {
    return {
      hasDate: true,
      diffDays: 0,
      daysToGo: 0,
      badgeText: 'Starts today',
      headline: 'Your adventure begins today!',
      status: 'today'
    };
  } else {
    // Past or ongoing
    const elapsed = Math.abs(diffDays);
    const duration = Math.max(1, Number(durationDays) || 1);
    if (elapsed < duration) {
      return {
        hasDate: true,
        diffDays,
        daysToGo: 0,
        badgeText: `Day ${elapsed + 1} of trip`,
        headline: `Currently traveling in Day ${elapsed + 1}`,
        status: 'ongoing'
      };
    }

    return {
      hasDate: true,
      diffDays,
      daysToGo: 0,
      badgeText: 'Completed',
      headline: 'Trip completed',
      status: 'completed'
    };
  }
}

/**
 * Checks whether a reminder should be triggered for a trip
 */
export function evaluateTripReminder(trip, userReminderDays = [7, 3, 1], referenceDate = new Date()) {
  if (!trip || !trip.startDate) return { shouldRemind: false };

  const countdown = calculateTripCountdown(trip.startDate, referenceDate);
  if (!countdown.hasDate || countdown.status === 'past' || countdown.status === 'completed' || countdown.status === 'ongoing') {
    return { shouldRemind: false };
  }

  const sentReminders = Array.isArray(trip.remindersSent)
    ? trip.remindersSent
    : (typeof trip.reminders_sent === 'string' ? JSON.parse(trip.reminders_sent || '[]') : (trip.reminders_sent || []));

  for (const threshold of userReminderDays) {
    const reminderType = `${threshold}_day`;
    if (countdown.diffDays === threshold && !sentReminders.includes(reminderType)) {
      return {
        shouldRemind: true,
        reminderType,
        threshold,
        diffDays: countdown.diffDays,
        destination: trip.destination,
        tripId: trip.id
      };
    }
  }

  return { shouldRemind: false };
}

// ---------------- Client API & LocalStorage Helpers ----------------

export async function fetchTripWeather({ destination, startDate, lat, lng }) {
  try {
    const params = new URLSearchParams();
    if (destination) params.set('destination', destination);
    if (startDate) params.set('startDate', startDate);
    if (lat && lng) {
      params.set('lat', String(lat));
      params.set('lng', String(lng));
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(`/api/weather?${params.toString()}`, { signal: controller.signal });
    clearTimeout(timer);

    if (res.ok) {
      const data = await res.json();
      return data.available ? data : null;
    }
    return null;
  } catch (err) {
    // If unavailable or error, return null so UI gracefully hides the section
    return null;
  }
}

export function getLocalChecklist(tripId) {
  try {
    const raw = localStorage.getItem(`tripmind_checklist_${tripId}`);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

export function setLocalChecklist(tripId, checklist) {
  try {
    localStorage.setItem(`tripmind_checklist_${tripId}`, JSON.stringify(checklist));
  } catch (e) {}
}

export async function fetchTripChecklist(tripId, trip, userId) {
  if (!tripId) return [];

  // If in guest mode, load from localStorage first
  if (!userId) {
    const cached = getLocalChecklist(tripId);
    if (cached && cached.length > 0) return cached;
    if (Array.isArray(trip?.checklist) && trip.checklist.length > 0) return trip.checklist;
    return generateDefaultChecklist(trip);
  }

  try {
    const res = await fetch(`/api/trips/${tripId}/checklist`);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        setLocalChecklist(tripId, data);
        return data;
      }
    }
  } catch (e) {
    console.warn('Checklist fetch error:', e);
  }

  const fallback = trip?.checklist || getLocalChecklist(tripId) || generateDefaultChecklist(trip);
  return fallback;
}

export async function saveTripChecklist(tripId, checklist, userId) {
  setLocalChecklist(tripId, checklist);

  if (userId) {
    try {
      await fetch(`/api/trips/${tripId}/checklist`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ checklist })
      });
    } catch (e) {
      console.warn('Checklist save error:', e);
    }
  }
  return checklist;
}

export function generateDefaultChecklist(trip) {
  const dest = trip?.destination || 'your destination';
  return [
    { id: 'doc_1', category: 'documents', text: 'Passport / Travel ID (check validity for 6+ months)', checked: false },
    { id: 'doc_2', category: 'documents', text: 'Travel insurance confirmation & emergency contact numbers', checked: false },
    { id: 'doc_3', category: 'documents', text: 'Boarding passes, train tickets, and hotel bookings saved offline', checked: false },
    { id: 'wea_1', category: 'weather', text: 'Compact travel umbrella or lightweight rain shell', checked: false },
    { id: 'wea_2', category: 'weather', text: 'Comfortable seasonal layering (breathable cottons / evening jacket)', checked: false },
    { id: 'wea_3', category: 'weather', text: 'Sun protection: UV sunglasses, SPF 50+ sunscreen, and sun hat', checked: false },
    { id: 'act_1', category: 'activities', text: 'Broken-in walking sneakers for long cobblestone & temple exploration', checked: false },
    { id: 'act_2', category: 'activities', text: 'High-capacity portable power bank with fast-charging cables', checked: false },
    { id: 'act_3', category: 'activities', text: 'Modest attire covering shoulders & knees for cultural & sacred sites', checked: false },
    { id: 'tip_1', category: 'tips', text: `Destination power plug adapter suitable for ${dest}`, checked: false },
    { id: 'tip_2', category: 'tips', text: 'Small cash amount in local currency for neighborhood street stalls', checked: false },
    { id: 'tip_3', category: 'tips', text: 'Offline city map downloaded in Google Maps or Maps.me', checked: false }
  ];
}

