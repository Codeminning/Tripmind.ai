import jwt from 'jsonwebtoken';
import { sql } from './db.js';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3001/api/calendar/google/callback';
const JWT_SECRET = process.env.JWT_SECRET || 'tripmind_secret_jwt_key_2026_zen';

// In-memory fallback if Neon is offline
const memoryUserTokens = new Map();

export function isGoogleCalendarConfigured() {
  return Boolean(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET);
}

const DESTINATION_TIMEZONES = {
  japan: 'Asia/Tokyo', kyoto: 'Asia/Tokyo', tokyo: 'Asia/Tokyo', osaka: 'Asia/Tokyo',
  bali: 'Asia/Makassar', ubud: 'Asia/Makassar', indonesia: 'Asia/Makassar',
  india: 'Asia/Kolkata', delhi: 'Asia/Kolkata', mumbai: 'Asia/Kolkata', madurai: 'Asia/Kolkata',
  thailand: 'Asia/Bangkok', bangkok: 'Asia/Bangkok', phuket: 'Asia/Bangkok',
  singapore: 'Asia/Singapore', seoul: 'Asia/Seoul', korea: 'Asia/Seoul', dubai: 'Asia/Dubai',
  paris: 'Europe/Paris', france: 'Europe/Paris', italy: 'Europe/Rome', amalfi: 'Europe/Rome',
  rome: 'Europe/Rome', london: 'Europe/London', uk: 'Europe/London', lisbon: 'Europe/Lisbon',
  portugal: 'Europe/Lisbon', spain: 'Europe/Madrid', barcelona: 'Europe/Madrid',
  reykjavik: 'Atlantic/Reykjavik', iceland: 'Atlantic/Reykjavik',
  newyork: 'America/New_York', 'new york': 'America/New_York', oaxaca: 'America/Mexico_City', mexico: 'America/Mexico_City'
};

function detectDestinationTz(dest) {
  if (!dest) return 'UTC';
  const clean = String(dest).toLowerCase().trim();
  for (const [key, tz] of Object.entries(DESTINATION_TIMEZONES)) {
    if (clean.includes(key)) return tz;
  }
  return 'UTC';
}

function parseTimeStr(timeStr, defaultHour = 9, defaultMinute = 0) {
  if (!timeStr || typeof timeStr !== 'string') {
    return { hour: defaultHour, minute: defaultMinute };
  }
  const clean = timeStr.trim().toLowerCase();
  const match12 = clean.match(/^(\d{1,2}):(\d{2})\s*(am|pm)$/);
  if (match12) {
    let hour = parseInt(match12[1], 10);
    const minute = parseInt(match12[2], 10);
    const meridian = match12[3];
    if (meridian === 'pm' && hour < 12) hour += 12;
    if (meridian === 'am' && hour === 12) hour = 0;
    return { hour, minute };
  }
  const match24 = clean.match(/^(\d{1,2}):(\d{2})$/);
  if (match24) {
    return { hour: parseInt(match24[1], 10), minute: parseInt(match24[2], 10) };
  }
  return { hour: defaultHour, minute: defaultMinute };
}

/**
 * Retrieves valid Google OAuth access token, refreshing if close to expiry.
 */
export async function getValidGoogleAccessToken(userId, tokenData) {
  let data = tokenData;
  if (!data && userId) {
    if (sql) {
      const rows = await sql`SELECT google_calendar_token FROM users WHERE id = ${userId} LIMIT 1`;
      data = rows[0]?.google_calendar_token;
    } else {
      data = memoryUserTokens.get(userId);
    }
  }

  if (!data || !data.access_token) return null;

  const now = Date.now();
  // If token is valid for at least another 60 seconds, return it
  if (data.expiry_date && data.expiry_date > now + 60000) {
    return data.access_token;
  }

  // Token expired or expiring soon, attempt refresh
  if (!data.refresh_token || !isGoogleCalendarConfigured()) {
    return data.access_token;
  }

  try {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        refresh_token: data.refresh_token,
        grant_type: 'refresh_token'
      })
    });

    if (!res.ok) {
      console.warn('Google token refresh returned non-ok:', res.status);
      return null;
    }

    const refreshed = await res.json();
    const updated = {
      ...data,
      access_token: refreshed.access_token,
      expiry_date: now + (refreshed.expires_in * 1000)
    };

    if (sql && userId) {
      await sql`
        UPDATE users
        SET google_calendar_token = ${JSON.stringify(updated)}::jsonb, updated_at = NOW()
        WHERE id = ${userId}
      `;
    }
    if (userId) memoryUserTokens.set(userId, updated);

    return updated.access_token;
  } catch (err) {
    console.warn('Error refreshing Google token:', err.message);
    return null;
  }
}

/**
 * Generates OAuth authorization URL with user signed in state.
 */
export function generateGoogleAuthUrl(userId) {
  if (!isGoogleCalendarConfigured()) return null;

  const state = jwt.sign(
    { userId, purpose: 'google_calendar_oauth', ts: Date.now() },
    JWT_SECRET,
    { expiresIn: '15m' }
  );

  const scopes = [
    'https://www.googleapis.com/auth/calendar.events',
    'https://www.googleapis.com/auth/userinfo.email'
  ].join(' ');

  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: GOOGLE_REDIRECT_URI,
    response_type: 'code',
    scope: scopes,
    access_type: 'offline',
    prompt: 'consent',
    state
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

/**
 * Exchange OAuth callback code for tokens and save to user profile.
 */
export async function handleGoogleOAuthCallback(code, state) {
  if (!code || !state) {
    throw new Error('Missing code or state parameter.');
  }

  let decoded;
  try {
    decoded = jwt.verify(state, JWT_SECRET);
  } catch (err) {
    throw new Error('Invalid or expired OAuth state token.');
  }

  const { userId } = decoded;
  if (!userId) {
    throw new Error('State missing user context.');
  }

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      redirect_uri: GOOGLE_REDIRECT_URI,
      grant_type: 'authorization_code'
    })
  });

  if (!tokenRes.ok) {
    const errorText = await tokenRes.text();
    throw new Error(`Google OAuth exchange failed: ${errorText}`);
  }

  const tokens = await tokenRes.json();
  let userEmail = null;

  try {
    const infoRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` }
    });
    if (infoRes.ok) {
      const userInfo = await infoRes.json();
      userEmail = userInfo.email || null;
    }
  } catch (e) {
    // Ignore userinfo failure; email is optional cosmetic
  }

  const tokenRecord = {
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token || null,
    expiry_date: Date.now() + (tokens.expires_in * 1000),
    email: userEmail,
    connected_at: new Date().toISOString()
  };

  if (sql && userId) {
    await sql`
      UPDATE users
      SET google_calendar_token = ${JSON.stringify(tokenRecord)}::jsonb, updated_at = NOW()
      WHERE id = ${userId}
    `;
  }
  memoryUserTokens.set(userId, tokenRecord);

  return { userId, email: userEmail };
}

/**
 * Get status of user's Google Calendar connection.
 */
export async function getGoogleCalendarStatus(userId) {
  const configured = isGoogleCalendarConfigured();
  if (!userId) {
    return { configured, connected: false, email: null };
  }

  let tokenData = null;
  if (sql) {
    const rows = await sql`SELECT google_calendar_token FROM users WHERE id = ${userId} LIMIT 1`;
    tokenData = rows[0]?.google_calendar_token;
  } else {
    tokenData = memoryUserTokens.get(userId);
  }

  const connected = Boolean(tokenData && tokenData.access_token);
  return {
    configured,
    connected,
    email: tokenData?.email || null,
    connectedAt: tokenData?.connected_at || null
  };
}

/**
 * Disconnect Google Calendar for a user.
 */
export async function disconnectGoogleCalendar(userId) {
  if (sql && userId) {
    await sql`
      UPDATE users
      SET google_calendar_token = NULL, updated_at = NOW()
      WHERE id = ${userId}
    `;
  }
  if (userId) memoryUserTokens.delete(userId);
  return true;
}

/**
 * Format events for Google Calendar v3 API
 */
export function buildGoogleTripEvents(trip) {
  if (!trip) return [];

  const tzId = detectDestinationTz(trip.destination);
  let baseDate = new Date();
  if (trip.startDate) {
    const parsed = new Date(trip.startDate);
    if (!isNaN(parsed.getTime())) baseDate = parsed;
  }

  const daysCount = Array.isArray(trip.days) && trip.days.length > 0 ? trip.days.length : 3;

  const y = baseDate.getFullYear();
  const m = String(baseDate.getMonth() + 1).padStart(2, '0');
  const d = String(baseDate.getDate()).padStart(2, '0');
  const startIso = `${y}-${m}-${d}`;

  const endD = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate() + daysCount);
  const endIso = `${endD.getFullYear()}-${String(endD.getMonth() + 1).padStart(2, '0')}-${String(endD.getDate()).padStart(2, '0')}`;

  const events = [];

  // 1. Overview event
  events.push({
    key: `overview_${trip.id || 'main'}`,
    payload: {
      summary: `✈️ Trip to ${trip.destination || 'Destination'}`,
      description: `${trip.summary || `Personalized trip to ${trip.destination}`}\n\n${trip.travelTip ? `Local Tip: ${trip.travelTip}\n` : ''}Planned with Planora`,
      location: trip.destination || '',
      start: { date: startIso },
      end: { date: endIso },
      transparency: 'transparent'
    }
  });

  // 2. Day activities
  if (Array.isArray(trip.days)) {
    trip.days.forEach(dayObj => {
      const dayNum = Number(dayObj.day) || 1;
      const actDate = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate() + (dayNum - 1));
      const dayDateIso = `${actDate.getFullYear()}-${String(actDate.getMonth() + 1).padStart(2, '0')}-${String(actDate.getDate()).padStart(2, '0')}`;

      const activities = Array.isArray(dayObj.activities) ? dayObj.activities : [];
      activities.forEach((act, actIdx) => {
        const time = parseTimeStr(act.time, 9 + actIdx * 2, 0);
        let endH = time.hour + 1;
        let endM = time.minute + 30;
        if (endM >= 60) {
          endH += 1;
          endM -= 60;
        }
        if (endH >= 24) endH = 23;

        const startDt = `${dayDateIso}T${String(time.hour).padStart(2, '0')}:${String(time.minute).padStart(2, '0')}:00`;
        const endDt = `${dayDateIso}T${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}:00`;

        let desc = act.description || '';
        if (act.category) desc += `\nCategory: ${act.category}`;
        if (act.cost !== undefined && act.cost > 0) desc += `\nEstimated Cost: $${act.cost} USD`;
        if (trip.travelTip && actIdx === 0) desc += `\nInsider Tip: ${trip.travelTip}`;

        events.push({
          key: `act_${trip.id || 'trip'}_d${dayNum}_a${actIdx}`,
          payload: {
            summary: act.title || `Day ${dayNum} Activity`,
            description: desc,
            location: act.location ? `${act.location}, ${trip.destination}` : (trip.destination || ''),
            start: { dateTime: startDt, timeZone: tzId },
            end: { dateTime: endDt, timeZone: tzId }
          }
        });
      });
    });
  }

  return events;
}

/**
 * Idempotently syncs a trip and its daily activities to Google Calendar.
 * Uses eventMap so re-syncing updates existing events without duplicating.
 */
export async function syncTripToGoogleCalendar(trip, userId) {
  if (!trip) throw new Error('Trip not found.');

  const accessToken = await getValidGoogleAccessToken(userId);
  if (!accessToken) {
    throw new Error('Google Calendar is not connected or token expired. Please connect your account first.');
  }

  const events = buildGoogleTripEvents(trip);
  const existingSync = trip.google_calendar_sync || {};
  const currentEventMap = existingSync.eventMap || {};
  const updatedEventMap = { ...currentEventMap };

  let syncedCount = 0;

  for (const item of events) {
    const existingGoogleId = currentEventMap[item.key];
    let success = false;

    // 1. Try updating existing event if we have its Google ID
    if (existingGoogleId) {
      try {
        const updateRes = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(existingGoogleId)}`,
          {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${accessToken}`
            },
            body: JSON.stringify(item.payload)
          }
        );

        if (updateRes.ok) {
          const updatedEvent = await updateRes.json();
          updatedEventMap[item.key] = updatedEvent.id;
          syncedCount++;
          success = true;
        } else if (updateRes.status !== 404) {
          console.warn(`Update event ${item.key} returned ${updateRes.status}`);
        }
      } catch (err) {
        console.warn(`Error updating event ${item.key}:`, err.message);
      }
    }

    // 2. If new or previous event was deleted on Google Calendar, create new
    if (!success) {
      try {
        const createRes = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`
          },
          body: JSON.stringify(item.payload)
        });

        if (createRes.ok) {
          const created = await createRes.json();
          updatedEventMap[item.key] = created.id;
          syncedCount++;
        } else {
          const errText = await createRes.text();
          console.warn(`Failed to insert calendar event ${item.key}:`, errText);
        }
      } catch (err) {
        console.warn(`Error inserting event ${item.key}:`, err.message);
      }
    }
  }

  const syncPayload = {
    lastSyncedAt: new Date().toISOString(),
    syncedBy: userId,
    eventMap: updatedEventMap,
    totalEvents: syncedCount
  };

  if (sql && trip.id) {
    try {
      await sql`
        UPDATE trips
        SET google_calendar_sync = ${JSON.stringify(syncPayload)}::jsonb, updated_at = NOW()
        WHERE id = ${trip.id}
      `;
    } catch (e) {
      console.warn('Could not update trips.google_calendar_sync in DB:', e.message);
    }
  }

  return {
    success: true,
    syncedCount,
    lastSyncedAt: syncPayload.lastSyncedAt
  };
}

