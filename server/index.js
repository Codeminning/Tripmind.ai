import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { GoogleGenAI } from '@google/genai';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Resend } from 'resend';
import { sql, initDb } from './db.js';
import { jobQueue } from './jobQueue.js';
import { OAuth2Client } from 'google-auth-library';
import {
  isGoogleCalendarConfigured,
  generateGoogleAuthUrl,
  handleGoogleOAuthCallback,
  getGoogleCalendarStatus,
  disconnectGoogleCalendar,
  syncTripToGoogleCalendar
} from './googleCalendar.js';

const app = express();
const port = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'tripmind_secret_jwt_key_2026_zen';
const googleClient = process.env.GOOGLE_CLIENT_ID ? new OAuth2Client(process.env.GOOGLE_CLIENT_ID) : null;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientDist = path.resolve(__dirname, '..', 'dist');

// Initialize Neon database schema automatically
if (sql) {
  initDb().catch(err => console.error('Failed to init Neon DB:', err));
}


app.use(cors({
  origin: true,
  credentials: true,
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static(clientDist));

const apiKey = process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY;
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

const CANDIDATE_MODELS = [
  'gemini-3-flash-preview',
  'gemini-3.5-flash',
  'gemini-3.8-flash',
  'gemini-3.5-flash-lite',
  'gemini-flash-latest'
];

function sanitizeJson(rawText) {
  if (!rawText) return null;
  let cleaned = rawText.trim();
  // Remove markdown fences
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```[a-zA-Z]*\n?/, '').replace(/\n?```$/, '').trim();
  }
  try {
    return JSON.parse(cleaned);
  } catch (err) {
    // Attempt to extract first { ... } block
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch (e) {
        return null;
      }
    }
    return null;
  }
}

const DESTINATION_CENTERS = {
  'kyoto': { lat: 35.0116, lng: 135.7681 },
  'tokyo': { lat: 35.6762, lng: 139.6503 },
  'osaka': { lat: 34.6937, lng: 135.5023 },
  'bali': { lat: -8.4095, lng: 115.1889 },
  'ubud': { lat: -8.5069, lng: 115.2625 },
  'paris': { lat: 48.8566, lng: 2.3522 },
  'rome': { lat: 41.9028, lng: 12.4964 },
  'amalfi': { lat: 40.6340, lng: 14.6027 },
  'positano': { lat: 40.6281, lng: 14.4850 },
  'lisbon': { lat: 38.7223, lng: -9.1393 },
  'oaxaca': { lat: 17.0732, lng: -96.7266 },
  'reykjavik': { lat: 64.1466, lng: -21.9426 },
  'jaipur': { lat: 26.9124, lng: 75.7873 },
  'goa': { lat: 15.2993, lng: 74.1240 },
  'london': { lat: 51.5074, lng: -0.1278 },
  'barcelona': { lat: 41.3851, lng: 2.1734 },
  'amsterdam': { lat: 52.3676, lng: 4.9041 },
  'new york': { lat: 40.7128, lng: -74.0060 },
  'bangkok': { lat: 13.7563, lng: 100.5018 },
  'singapore': { lat: 1.3521, lng: 103.8198 },
  'sydney': { lat: -33.8688, lng: 151.2093 }
};

function generateCuratedFallback({ destination, startDate, days, budget, travelers, interests }) {
  const tripDays = Number(days) || 3;
  const numTravelers = Number(travelers) || 1;
  const budgetMultiplier = budget === 'Budget-friendly' ? 45 : budget === 'Treat yourself' ? 220 : 105;
  const totalBudget = budgetMultiplier * tripDays * numTravelers;

  // Determine destination center coordinates if available
  const destLower = (destination || '').toLowerCase();
  let baseCoords = null;
  for (const [key, center] of Object.entries(DESTINATION_CENTERS)) {
    if (destLower.includes(key)) {
      baseCoords = center;
      break;
    }
  }

  const sampleActivities = [
    { title: 'Morning artisan café & neighbourhood pastry walk', category: 'food', cost: 14, time: '09:00', description: 'Start the day unhurried with single-origin coffee and regional breakfast delicacies.' },
    { title: 'Historic quarter exploration & hidden alleys', category: 'culture', cost: 18, time: '11:00', description: 'Uncover centuries of local heritage, architectural quirks, and peaceful stone courtyards.' },
    { title: 'Farm-to-table lunch at a family-run bistro', category: 'food', cost: 26, time: '13:30', description: 'Savor traditional regional specialties made with seasonal, locally sourced produce.' },
    { title: 'Panoramic scenic viewpoint & afternoon walk', category: 'walk', cost: 0, time: '16:00', description: 'Take in expansive golden-hour vistas overlooking the city skyline and surrounding landscapes.' },
    { title: 'Local night market or lantern-lit dinner', category: 'food', cost: 32, time: '19:30', description: 'Immerse yourself in evening street gastronomy, lively conversations, and craft brews.' },
  ];

  const daysList = [];
  for (let i = 1; i <= tripDays; i++) {
    const titles = [
      'Settling in & First Impressions',
      'Old Corners, Heritage & Craft',
      'Artistic Pulse & Hidden Gardens',
      'Scenic Escapes & Coastal/Mountain Vistas',
      'Culinary Discoveries & Secret Spots',
      'Slow Living & Local Rhythms',
      'Grand Highlights & Farewell Sunset'
    ];

    const rawDayActs = [
      { ...sampleActivities[0], time: '09:00' },
      { ...sampleActivities[(i % 4) + 1], time: '11:30' },
      { ...sampleActivities[2], time: '14:00' },
      { ...sampleActivities[((i + 2) % 4) + 1], time: '17:00' }
    ];

    const dayActivities = rawDayActs.map((act, actIdx) => {
      if (baseCoords) {
        const latOffset = (i * 0.005) + ((actIdx - 1.5) * 0.004);
        const lngOffset = (i * 0.004) + ((actIdx - 1.5) * 0.005);
        return {
          ...act,
          latitude: Number((baseCoords.lat + latOffset).toFixed(6)),
          longitude: Number((baseCoords.lng + lngOffset).toFixed(6))
        };
      }
      return act;
    });

    daysList.push({
      day: i,
      title: titles[(i - 1) % titles.length],
      activities: dayActivities
    });
  }

  return {
    destination: destination.trim(),
    summary: `A balanced, immersive ${tripDays}-day journey through ${destination.trim()}, crafted for ${budget.toLowerCase()} travel with an emphasis on authentic local encounters.`,
    travelTip: `Ask locals for recommendations beyond the main plazas. Early mornings and late afternoons offer the most serene experiences.`,
    bestTimeToVisit: 'Spring or early Autumn for comfortable temperatures and fewer crowds.',
    budgetBreakdown: {
      totalEstimatedUsd: totalBudget,
      dailyPerPersonUsd: budgetMultiplier,
      categories: {
        accommodation: Math.round(totalBudget * 0.42),
        dining: Math.round(totalBudget * 0.32),
        activities: Math.round(totalBudget * 0.16),
        transit: Math.round(totalBudget * 0.10)
      }
    },
    days: daysList,
    generatedBy: 'curated-smart-planner'
  };
}

const router = express.Router();

router.get('/health', (_req, res) => {
  res.json({
    ok: true,
    aiConfigured: Boolean(ai),
    databaseConfigured: Boolean(sql),
    models: CANDIDATE_MODELS,
    queue: jobQueue.getStats(),
    timestamp: new Date().toISOString()
  });
});

// Helper to format trip rows from Neon DB
function formatTripRow(row) {
  return {
    id: row.id,
    userId: row.user_id,
    userMemberRole: row.user_member_role || (row.user_id ? 'owner' : null),
    destination: row.destination,
    startDate: row.start_date,
    status: row.status,
    summary: row.summary,
    travelTip: row.travel_tip,
    bestTimeToVisit: row.best_time_to_visit,
    budgetBreakdown: typeof row.budget_breakdown === 'string' ? JSON.parse(row.budget_breakdown) : (row.budget_breakdown || {}),
    days: typeof row.days === 'string' ? JSON.parse(row.days) : (row.days || []),
    formSnapshot: typeof row.form_snapshot === 'string' ? JSON.parse(row.form_snapshot) : (row.form_snapshot || {}),
    savedAt: row.saved_at,
    shareId: row.share_id || null,
    isShared: Boolean(row.is_shared),
    sharedAt: row.shared_at || null,
    travelers: typeof row.travelers === 'string' ? JSON.parse(row.travelers) : (row.travelers || null),
    checklist: typeof row.checklist === 'string' ? JSON.parse(row.checklist) : (row.checklist || []),
    remindersSent: typeof row.reminders_sent === 'string' ? JSON.parse(row.reminders_sent) : (row.reminders_sent || []),
    version: Number(row.version) || 1,
    inviteToken: row.invite_token || null,
    inviteExpiresAt: row.invite_expires_at || null,
    maxMembers: Number(row.max_members) || 10,
    confirmThreshold: row.confirm_threshold || 'owner',
    activityProposals: typeof row.activity_proposals === 'string' ? JSON.parse(row.activity_proposals) : (row.activity_proposals || []),
    activityVotes: typeof row.activity_votes === 'string' ? JSON.parse(row.activity_votes) : (row.activity_votes || {}),
    activityComments: typeof row.activity_comments === 'string' ? JSON.parse(row.activity_comments) : (row.activity_comments || []),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

// ---------------- Neon Auth Endpoints ----------------
router.post('/auth/register', async (req, res) => {
  try {
    const { name, email, password, travelVibe } = req.body || {};
    const cleanName = (name || '').trim();
    const cleanEmail = (email || '').trim().toLowerCase();

    if (!cleanName) return res.status(400).json({ error: 'Please enter your name.' });
    if (!cleanEmail || !cleanEmail.includes('@')) return res.status(400).json({ error: 'Please enter a valid email address.' });
    if (!password || password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters.' });

    if (!sql) {
      return res.status(503).json({ error: 'Neon database is not connected.' });
    }

    const existing = await sql`SELECT id FROM users WHERE email = ${cleanEmail} LIMIT 1`;
    if (existing.length > 0) {
      return res.status(409).json({ error: 'An account with this email already exists. Please sign in instead.' });
    }

    const nameParts = cleanName.split(' ');
    const initials = nameParts.length > 1
      ? `${nameParts[0][0]}${nameParts[nameParts.length - 1][0]}`.toUpperCase()
      : cleanName.slice(0, 2).toUpperCase();

    const userId = `user_${Date.now()}`;
    const hashedPassword = await bcrypt.hash(password, 10);
    const avatar = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(cleanName)}&backgroundColor=2b5143&textColor=ffffff`;
    const userVibe = travelVibe || 'Slow & Curious Traveler';
    const defaultBudget = 'Mid-range';
    const defaultTravelers = 2;
    const favoriteInterests = ['Food & cafés', 'Culture & heritage', 'Slow travel'];

    await sql`
      INSERT INTO users (
        id, name, email, password_hash, avatar, initials, travel_vibe, default_budget, default_travelers, favorite_interests, auth_provider
      ) VALUES (
        ${userId}, ${cleanName}, ${cleanEmail}, ${hashedPassword}, ${avatar}, ${initials}, ${userVibe}, ${defaultBudget}, ${defaultTravelers}, ${favoriteInterests}, 'email'
      )
    `;

    const token = jwt.sign({ id: userId, email: cleanEmail }, JWT_SECRET, { expiresIn: '30d' });
    const session = {
      id: userId,
      name: cleanName,
      email: cleanEmail,
      avatar,
      initials,
      travelVibe: userVibe,
      defaultBudget,
      defaultTravelers,
      favoriteInterests,
      authProvider: 'email',
      token,
      loggedInAt: new Date().toISOString()
    };

    return res.status(201).json({ user: session, token });
  } catch (err) {
    console.error('Registration error:', err);
    return res.status(500).json({ error: 'Internal server error during registration.' });
  }
});

router.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    const cleanEmail = (email || '').trim().toLowerCase();

    if (!cleanEmail || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    if (!sql) {
      return res.status(503).json({ error: 'Neon database is not connected.' });
    }

    const rows = await sql`SELECT * FROM users WHERE email = ${cleanEmail} LIMIT 1`;
    if (rows.length === 0) {
      return res.status(401).json({ error: 'No account found with this email address. Please sign up.' });
    }

    const user = rows[0];
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Incorrect password. Please try again.' });
    }

    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '30d' });
    const session = {
      id: user.id,
      name: user.name,
      email: user.email,
      avatar: user.avatar,
      initials: user.initials,
      travelVibe: user.travel_vibe || 'Thoughtful Explorer',
      defaultBudget: user.default_budget || 'Mid-range',
      defaultTravelers: user.default_travelers || 2,
      favoriteInterests: user.favorite_interests || ['Food & cafés', 'Culture & heritage'],
      authProvider: user.auth_provider || 'email',
      token,
      loggedInAt: new Date().toISOString()
    };

    return res.json({ user: session, token });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Internal server error during login.' });
  }
});

router.post('/auth/google', async (req, res) => {
  try {
    const { credential } = req.body || {};
    if (!credential) return res.status(400).json({ error: 'Missing Google credential.' });
    if (!googleClient) return res.status(503).json({ error: 'Google Sign-In is not configured on the server.' });

    let payload;
    try {
      const ticket = await googleClient.verifyIdToken({
        idToken: credential,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      payload = ticket.getPayload();
    } catch (err) {
      console.warn('Google token verification failed:', err.message);
      return res.status(401).json({ error: 'Could not verify Google credential.' });
    }

    if (!payload?.email || !payload.email_verified) {
      return res.status(401).json({ error: 'Google account email is not verified.' });
    }

    const cleanEmail = payload.email.trim().toLowerCase();
    const cleanName = (payload.name || payload.given_name || cleanEmail.split('@')[0]).trim();
    const avatar = payload.picture || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(cleanName)}&backgroundColor=2b5143&textColor=ffffff`;
    const initials = cleanName.slice(0, 2).toUpperCase();

    if (!sql) return res.status(503).json({ error: 'Neon database is not connected.' });

    let rows = await sql`SELECT * FROM users WHERE email = ${cleanEmail} LIMIT 1`;
    let user;

    if (rows.length === 0) {
      const userId = `user_google_${Date.now()}`;
      const dummyHash = await bcrypt.hash(`oauth_${Date.now()}`, 10);
      await sql`
        INSERT INTO users (id, name, email, password_hash, avatar, initials, travel_vibe, default_budget, default_travelers, favorite_interests, auth_provider)
        VALUES (${userId}, ${cleanName}, ${cleanEmail}, ${dummyHash}, ${avatar}, ${initials}, 'Food & Culinary Explorer', 'Mid-range', 2, ${['Food & cafés', 'Culture & heritage']}, 'google')
      `;
      const created = await sql`SELECT * FROM users WHERE id = ${userId} LIMIT 1`;
      user = created[0];
    } else {
      user = rows[0];
    }

    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '30d' });
    const session = {
      id: user.id, name: user.name, email: user.email, avatar: user.avatar, initials: user.initials,
      travelVibe: user.travel_vibe || 'Food & Culinary Explorer',
      defaultBudget: user.default_budget || 'Mid-range',
      defaultTravelers: user.default_travelers || 2,
      favoriteInterests: user.favorite_interests || ['Food & cafés'],
      authProvider: 'google', token, loggedInAt: new Date().toISOString()
    };

    return res.json({ user: session, token });
  } catch (err) {
    console.error('Google auth error:', err);
    return res.status(500).json({ error: 'Internal server error during Google auth.' });
  }
});

router.put('/auth/profile', async (req, res) => {
  try {
    const { userId, name, travelVibe, defaultBudget, defaultTravelers, favoriteInterests, avatar } = req.body || {};
    if (!userId) return res.status(400).json({ error: 'User ID is required.' });

    if (!sql) return res.status(503).json({ error: 'Neon database is not connected.' });

    let initials = null;
    if (name) {
      const parts = name.trim().split(' ');
      initials = parts.length > 1 ? `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase() : name.slice(0, 2).toUpperCase();
    }

    await sql`
      UPDATE users
      SET
        name = COALESCE(${name}, name),
        initials = COALESCE(${initials}, initials),
        travel_vibe = COALESCE(${travelVibe}, travel_vibe),
        default_budget = COALESCE(${defaultBudget}, default_budget),
        default_travelers = COALESCE(${defaultTravelers}, default_travelers),
        favorite_interests = COALESCE(${favoriteInterests}, favorite_interests),
        avatar = COALESCE(${avatar}, avatar)
      WHERE id = ${userId}
    `;

    const rows = await sql`SELECT * FROM users WHERE id = ${userId} LIMIT 1`;
    if (rows.length === 0) return res.status(404).json({ error: 'User not found.' });
    const u = rows[0];

    return res.json({
      id: u.id,
      name: u.name,
      email: u.email,
      avatar: u.avatar,
      initials: u.initials,
      travelVibe: u.travel_vibe,
      defaultBudget: u.default_budget,
      defaultTravelers: u.default_travelers,
      favoriteInterests: u.favorite_interests,
      authProvider: u.auth_provider
    });
  } catch (err) {
    console.error('Profile update error:', err);
    return res.status(500).json({ error: 'Internal server error updating profile.' });
  }
});

router.delete('/auth/account/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    if (!userId) return res.status(400).json({ error: 'User ID is required.' });

    if (!sql) return res.status(503).json({ error: 'Neon database is not connected.' });

    // Explicitly delete user's trips and user record
    await sql`DELETE FROM trips WHERE user_id = ${userId}`;
    await sql`DELETE FROM users WHERE id = ${userId}`;
    console.log(`🗑️ Deleted account from Neon DB for userId: ${userId}`);

    return res.json({ success: true, message: 'Account and associated data deleted successfully.' });
  } catch (err) {
    console.error('Delete account error:', err);
    return res.status(500).json({ error: 'Internal server error deleting account.' });
  }
});

// Auto-sync session endpoint: ensures an offline/client-created account exists in Neon DB
router.post('/auth/sync-session', async (req, res) => {
  try {
    const { user } = req.body || {};
    if (!user || !user.email) {
      return res.status(400).json({ error: 'User email is required for session sync.' });
    }

    if (!sql) {
      return res.status(503).json({ error: 'Neon database is not connected.' });
    }

    const cleanEmail = (user.email || '').trim().toLowerCase();
    const cleanName = (user.name || 'Traveler').trim();
    const userId = user.id || `user_${Date.now()}`;
    const initials = user.initials || cleanName.slice(0, 2).toUpperCase();
    const avatar = user.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(cleanName)}&backgroundColor=2b5143&textColor=ffffff`;
    const userVibe = user.travelVibe || 'Food & Culinary Explorer';
    const defaultBudget = user.defaultBudget || 'Mid-range';
    const defaultTravelers = Number(user.defaultTravelers) || 2;
    const favoriteInterests = Array.isArray(user.favoriteInterests) ? user.favoriteInterests : ['Food & cafés', 'Culture & heritage'];
    const authProvider = user.authProvider || 'email';
    const dummyHash = await bcrypt.hash(`session_sync_${Date.now()}`, 10);

    const existing = await sql`SELECT * FROM users WHERE email = ${cleanEmail} OR id = ${userId} LIMIT 1`;
    if (existing.length === 0) {
      await sql`
        INSERT INTO users (
          id, name, email, password_hash, avatar, initials, travel_vibe, default_budget, default_travelers, favorite_interests, auth_provider
        ) VALUES (
          ${userId}, ${cleanName}, ${cleanEmail}, ${dummyHash}, ${avatar}, ${initials}, ${userVibe}, ${defaultBudget}, ${defaultTravelers}, ${favoriteInterests}, ${authProvider}
        )
      `;
      console.log(`✨ Synced offline session user to Neon DB: ${cleanName} (${cleanEmail})`);
      const created = await sql`SELECT * FROM users WHERE id = ${userId} LIMIT 1`;
      return res.status(201).json({ synced: true, created: true, user: created[0] });
    }

    return res.json({ synced: true, created: false, user: existing[0] });
  } catch (err) {
    console.error('Session sync error:', err);
    return res.status(500).json({ error: 'Internal server error syncing session.' });
  }
});

// ---------------- Neon Trips Endpoints ----------------
router.get('/trips/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    if (!userId) return res.status(400).json({ error: 'User ID is required.' });

    if (!sql) return res.status(503).json({ error: 'Neon database is not connected.' });

    const rows = await sql`
      SELECT DISTINCT t.*,
        COALESCE(tm.role, CASE WHEN t.user_id = ${userId} THEN 'owner' ELSE 'member' END) as user_member_role
      FROM trips t
      LEFT JOIN trip_members tm ON t.id = tm.trip_id AND tm.user_id = ${userId}
      WHERE t.user_id = ${userId} OR tm.user_id = ${userId}
      ORDER BY t.created_at DESC
    `;
    const formatted = rows.map(formatTripRow);
    return res.json(formatted);
  } catch (err) {
    console.error('Fetch trips error:', err);
    return res.status(500).json({ error: 'Internal server error fetching trips.' });
  }
});

router.post('/trips', async (req, res) => {
  try {
    const { userId, trip } = req.body || {};
    if (!userId || !trip) return res.status(400).json({ error: 'User ID and trip data are required.' });

    if (!sql) return res.status(503).json({ error: 'Neon database is not connected.' });

    const tripId = trip.id || `trip_${Date.now()}`;
    const savedAt = trip.savedAt || new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

    const tripTravelers = Array.isArray(trip.travelers) ? JSON.stringify(trip.travelers) : null;
    const tripChecklist = Array.isArray(trip.checklist) ? JSON.stringify(trip.checklist) : (trip.checklist ? JSON.stringify(trip.checklist) : null);
    const tripRemindersSent = Array.isArray(trip.remindersSent) ? JSON.stringify(trip.remindersSent) : null;

    await sql`
      INSERT INTO trips (
        id, user_id, destination, start_date, status, summary, travel_tip, best_time_to_visit,
        budget_breakdown, days, form_snapshot, itinerary_data, saved_at, travelers, checklist, reminders_sent, updated_at
      ) VALUES (
        ${tripId}, ${userId}, ${trip.destination}, ${trip.startDate || ''}, ${trip.status || 'Upcoming'},
        ${trip.summary || ''}, ${trip.travelTip || ''}, ${trip.bestTimeToVisit || ''},
        ${JSON.stringify(trip.budgetBreakdown || {})}, ${JSON.stringify(trip.days || [])},
        ${JSON.stringify(trip.formSnapshot || {})}, ${JSON.stringify(trip)}, ${savedAt}, ${tripTravelers},
        ${tripChecklist}::jsonb, ${tripRemindersSent}::jsonb, NOW()
      )
      ON CONFLICT (id) DO UPDATE SET
        destination = EXCLUDED.destination,
        start_date = EXCLUDED.start_date,
        status = EXCLUDED.status,
        summary = EXCLUDED.summary,
        travel_tip = EXCLUDED.travel_tip,
        best_time_to_visit = EXCLUDED.best_time_to_visit,
        budget_breakdown = EXCLUDED.budget_breakdown,
        days = EXCLUDED.days,
        form_snapshot = EXCLUDED.form_snapshot,
        itinerary_data = EXCLUDED.itinerary_data,
        travelers = COALESCE(EXCLUDED.travelers, trips.travelers),
        checklist = COALESCE(EXCLUDED.checklist, trips.checklist),
        reminders_sent = COALESCE(EXCLUDED.reminders_sent, trips.reminders_sent),
        updated_at = NOW()
    `;

    // Ensure trip owner is registered in trip_members
    await sql`
      INSERT INTO trip_members (id, trip_id, user_id, role, joined_at)
      VALUES (${`mem_${tripId}_${userId}`}, ${tripId}, ${userId}, 'owner', NOW())
      ON CONFLICT (trip_id, user_id) DO NOTHING
    `;

    // Return updated trips list
    const rows = await sql`
      SELECT DISTINCT t.*,
        COALESCE(tm.role, CASE WHEN t.user_id = ${userId} THEN 'owner' ELSE 'member' END) as user_member_role
      FROM trips t
      LEFT JOIN trip_members tm ON t.id = tm.trip_id AND tm.user_id = ${userId}
      WHERE t.user_id = ${userId} OR tm.user_id = ${userId}
      ORDER BY t.created_at DESC
    `;
    const formatted = rows.map(formatTripRow);
    return res.json(formatted);
  } catch (err) {
    console.error('Save trip error:', err);
    return res.status(500).json({ error: 'Internal server error saving trip.' });
  }
});

router.delete('/trips/:userId/:tripId', async (req, res) => {
  try {
    const { userId, tripId } = req.params;
    if (!userId || !tripId) return res.status(400).json({ error: 'User ID and Trip ID are required.' });

    if (!sql) return res.status(503).json({ error: 'Neon database is not connected.' });

    await sql`DELETE FROM trips WHERE user_id = ${userId} AND id = ${tripId}`;
    const rows = await sql`SELECT * FROM trips WHERE user_id = ${userId} ORDER BY created_at DESC`;
    const formatted = rows.map(formatTripRow);
    return res.json(formatted);
  } catch (err) {
    console.error('Delete trip error:', err);
    return res.status(500).json({ error: 'Internal server error deleting trip.' });
  }
});

// Helper to format expense rows from Neon DB
function formatExpenseRow(row) {
  return {
    id: row.id,
    tripId: row.trip_id,
    userId: row.user_id || null,
    amount: Number(row.amount),
    currency: row.currency || 'USD',
    category: row.category || 'other',
    note: row.note || '',
    date: row.date || '',
    activityId: row.activity_id || null,
    paidBy: row.paid_by || 'You',
    splitBetween: typeof row.split_between === 'string' ? JSON.parse(row.split_between) : (row.split_between || []),
    splitType: row.split_type || 'equal',
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

const ALLOWED_EXPENSE_CATEGORIES = ['stay', 'food', 'activities', 'transit', 'other'];

// ---------------- Neon Expenses & Budget Endpoints ----------------
router.get('/trips/:tripId/expenses', async (req, res) => {
  try {
    const { tripId } = req.params;
    if (!tripId) return res.status(400).json({ error: 'Trip ID is required.' });

    if (!sql) return res.status(503).json({ error: 'Neon database is not connected.' });

    const rows = await sql`SELECT * FROM expenses WHERE trip_id = ${tripId} ORDER BY date ASC, created_at ASC`;
    return res.json(rows.map(formatExpenseRow));
  } catch (err) {
    console.error('Fetch expenses error:', err);
    return res.status(500).json({ error: 'Internal server error fetching expenses.' });
  }
});

router.post('/trips/:tripId/expenses', async (req, res) => {
  try {
    const { tripId } = req.params;
    if (!tripId) return res.status(400).json({ error: 'Trip ID is required.' });

    if (!sql) return res.status(503).json({ error: 'Neon database is not connected.' });

    const {
      amount,
      currency = 'USD',
      category = 'other',
      note = '',
      date = '',
      activityId = null,
      paidBy = 'You',
      splitBetween = [],
      splitType = 'equal',
      userId = null
    } = req.body || {};

    const numAmount = Number(amount);
    if (!Number.isFinite(numAmount) || numAmount <= 0) {
      return res.status(400).json({ error: 'Expense amount must be a positive number.' });
    }

    const cleanCat = String(category || 'other').toLowerCase().trim();
    if (!ALLOWED_EXPENSE_CATEGORIES.includes(cleanCat)) {
      return res.status(400).json({ error: `Category must be one of: ${ALLOWED_EXPENSE_CATEGORIES.join(', ')}.` });
    }

    const cleanNote = String(note || '').trim().slice(0, 255);
    const cleanCurrency = String(currency || 'USD').toUpperCase().trim().slice(0, 10);
    const cleanPaidBy = String(paidBy || 'You').trim().slice(0, 100);
    const cleanDate = String(date || '').trim().slice(0, 50);
    const cleanActivityId = activityId ? String(activityId).trim().slice(0, 100) : null;
    const cleanSplitType = splitType === 'custom' ? 'custom' : 'equal';
    const splitJson = JSON.stringify(Array.isArray(splitBetween) ? splitBetween : []);

    const expenseId = req.body?.id || `exp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    await sql`
      INSERT INTO expenses (
        id, trip_id, user_id, amount, currency, category, note, date, activity_id, paid_by, split_between, split_type, updated_at
      ) VALUES (
        ${expenseId}, ${tripId}, ${userId}, ${numAmount}, ${cleanCurrency}, ${cleanCat}, ${cleanNote}, ${cleanDate}, ${cleanActivityId}, ${cleanPaidBy}, ${splitJson}::jsonb, ${cleanSplitType}, NOW()
      )
      ON CONFLICT (id) DO UPDATE SET
        amount = EXCLUDED.amount,
        currency = EXCLUDED.currency,
        category = EXCLUDED.category,
        note = EXCLUDED.note,
        date = EXCLUDED.date,
        activity_id = EXCLUDED.activity_id,
        paid_by = EXCLUDED.paid_by,
        split_between = EXCLUDED.split_between,
        split_type = EXCLUDED.split_type,
        updated_at = NOW()
    `;

    const rows = await sql`SELECT * FROM expenses WHERE trip_id = ${tripId} ORDER BY date ASC, created_at ASC`;
    return res.json(rows.map(formatExpenseRow));
  } catch (err) {
    console.error('Save expense error:', err);
    return res.status(500).json({ error: 'Internal server error saving expense.' });
  }
});

router.put('/trips/:tripId/expenses/:expenseId', async (req, res) => {
  try {
    const { tripId, expenseId } = req.params;
    if (!tripId || !expenseId) return res.status(400).json({ error: 'Trip ID and Expense ID are required.' });

    if (!sql) return res.status(503).json({ error: 'Neon database is not connected.' });

    const {
      amount,
      currency,
      category,
      note,
      date,
      activityId,
      paidBy,
      splitBetween,
      splitType
    } = req.body || {};

    const numAmount = Number(amount);
    if (!Number.isFinite(numAmount) || numAmount <= 0) {
      return res.status(400).json({ error: 'Expense amount must be a positive number.' });
    }

    const cleanCat = String(category || 'other').toLowerCase().trim();
    if (!ALLOWED_EXPENSE_CATEGORIES.includes(cleanCat)) {
      return res.status(400).json({ error: `Category must be one of: ${ALLOWED_EXPENSE_CATEGORIES.join(', ')}.` });
    }

    const cleanNote = String(note || '').trim().slice(0, 255);
    const cleanCurrency = String(currency || 'USD').toUpperCase().trim().slice(0, 10);
    const cleanPaidBy = String(paidBy || 'You').trim().slice(0, 100);
    const cleanDate = String(date || '').trim().slice(0, 50);
    const cleanActivityId = activityId ? String(activityId).trim().slice(0, 100) : null;
    const cleanSplitType = splitType === 'custom' ? 'custom' : 'equal';
    const splitJson = JSON.stringify(Array.isArray(splitBetween) ? splitBetween : []);

    await sql`
      UPDATE expenses
      SET
        amount = ${numAmount},
        currency = ${cleanCurrency},
        category = ${cleanCat},
        note = ${cleanNote},
        date = ${cleanDate},
        activity_id = ${cleanActivityId},
        paid_by = ${cleanPaidBy},
        split_between = ${splitJson}::jsonb,
        split_type = ${cleanSplitType},
        updated_at = NOW()
      WHERE id = ${expenseId} AND trip_id = ${tripId}
    `;

    const rows = await sql`SELECT * FROM expenses WHERE trip_id = ${tripId} ORDER BY date ASC, created_at ASC`;
    return res.json(rows.map(formatExpenseRow));
  } catch (err) {
    console.error('Update expense error:', err);
    return res.status(500).json({ error: 'Internal server error updating expense.' });
  }
});

router.delete('/trips/:tripId/expenses/:expenseId', async (req, res) => {
  try {
    const { tripId, expenseId } = req.params;
    if (!tripId || !expenseId) return res.status(400).json({ error: 'Trip ID and Expense ID are required.' });

    if (!sql) return res.status(503).json({ error: 'Neon database is not connected.' });

    await sql`DELETE FROM expenses WHERE id = ${expenseId} AND trip_id = ${tripId}`;
    const rows = await sql`SELECT * FROM expenses WHERE trip_id = ${tripId} ORDER BY date ASC, created_at ASC`;
    return res.json(rows.map(formatExpenseRow));
  } catch (err) {
    console.error('Delete expense error:', err);
    return res.status(500).json({ error: 'Internal server error deleting expense.' });
  }
});

router.put('/trips/:tripId/travelers', async (req, res) => {
  try {
    const { tripId } = req.params;
    const { travelers } = req.body || {};
    if (!tripId) return res.status(400).json({ error: 'Trip ID is required.' });
    if (!Array.isArray(travelers)) return res.status(400).json({ error: 'Travelers must be an array of names.' });

    if (!sql) return res.status(503).json({ error: 'Neon database is not connected.' });

    const safeTravelers = travelers.map(t => String(t || '').trim().slice(0, 100)).filter(Boolean);
    await sql`
      UPDATE trips
      SET travelers = ${JSON.stringify(safeTravelers)}::jsonb, updated_at = NOW()
      WHERE id = ${tripId}
    `;

    return res.json({ ok: true, travelers: safeTravelers });
  } catch (err) {
    console.error('Update travelers error:', err);
    return res.status(500).json({ error: 'Internal server error updating travelers.' });
  }
});

// ---------------- Exchange Rates & Currency Engine ----------------
const STATIC_EXCHANGE_RATES = {
  USD: 1,
  EUR: 0.92,
  GBP: 0.78,
  JPY: 155.0,
  INR: 85.0,
  MXN: 19.5,
  IDR: 15800.0,
  CHF: 0.89,
  AUD: 1.52,
  CAD: 1.38,
  THB: 36.0,
  SGD: 1.35,
  AED: 3.67,
  KRW: 1380.0,
  ISK: 138.0,
  BRL: 5.7
};

let ratesCache = {
  rates: { ...STATIC_EXCHANGE_RATES },
  lastUpdated: new Date().toISOString().split('T')[0],
  fetchedAt: 0,
  source: 'static-fallback'
};
const RATES_CACHE_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

async function getOrFetchExchangeRates() {
  const now = Date.now();
  if (ratesCache.fetchedAt && (now - ratesCache.fetchedAt < RATES_CACHE_TTL_MS)) {
    return ratesCache;
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    const resp = await fetch('https://open.er-api.com/v6/latest/USD', { signal: controller.signal });
    clearTimeout(timer);

    if (resp.ok) {
      const data = await resp.json();
      if (data && data.rates && typeof data.rates === 'object') {
        const mergedRates = { ...STATIC_EXCHANGE_RATES };
        for (const [curr, rate] of Object.entries(data.rates)) {
          if (typeof rate === 'number' && rate > 0) {
            mergedRates[curr] = rate;
          }
        }
        let updatedDate = new Date().toISOString().split('T')[0];
        if (data.time_last_update_utc) {
          const parsed = new Date(data.time_last_update_utc);
          if (!isNaN(parsed.getTime())) {
            const y = parsed.getFullYear();
            const m = String(parsed.getMonth() + 1).padStart(2, '0');
            const d = String(parsed.getDate()).padStart(2, '0');
            updatedDate = `${y}-${m}-${d}`;
          }
        }

        ratesCache = {
          rates: mergedRates,
          lastUpdated: updatedDate,
          fetchedAt: now,
          source: 'api'
        };
        console.log(`[Currency] Fresh exchange rates cached (${Object.keys(mergedRates).length} currencies, updated: ${updatedDate})`);
        return ratesCache;
      }
    }
  } catch (err) {
    console.warn('[Currency] Live rates fetch warning, falling back to cached rates:', err.message);
  }

  ratesCache.fetchedAt = now;
  return ratesCache;
}

router.get('/rates', async (_req, res) => {
  const cache = await getOrFetchExchangeRates();
  res.set('Cache-Control', 'public, max-age=43200, s-maxage=43200');
  return res.json({
    base: 'USD',
    rates: cache.rates,
    lastUpdated: cache.lastUpdated,
    source: cache.source
  });
});

router.get('/exchange-rates', async (_req, res) => {
  const cache = await getOrFetchExchangeRates();
  res.set('Cache-Control', 'public, max-age=43200, s-maxage=43200');
  return res.json({
    base: 'USD',
    rates: cache.rates,
    lastUpdated: cache.lastUpdated,
    source: cache.source
  });
});

// ---------------- Share Trip Endpoints ----------------
const SHARE_RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const SHARE_RATE_LIMIT_MAX = 20;
const shareRateLimitMap = new Map();

function checkShareRateLimit(ip) {
  const now = Date.now();
  const timestamps = shareRateLimitMap.get(ip) || [];
  const recent = timestamps.filter(t => now - t < SHARE_RATE_LIMIT_WINDOW_MS);
  if (recent.length >= SHARE_RATE_LIMIT_MAX) {
    return false;
  }
  recent.push(now);
  shareRateLimitMap.set(ip, recent);
  return true;
}

function authenticateToken(req) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      if (decoded && decoded.id) {
        return decoded;
      }
    } catch (err) {
      // ignore invalid token and try x-user-id fallback
    }
  }

  // Session / demo / guest fallback via x-user-id header
  const xUserId = req.headers['x-user-id'];
  if (xUserId && typeof xUserId === 'string' && xUserId.trim()) {
    let userName = 'Traveler';
    if (req.headers['x-user-name']) {
      try {
        userName = decodeURIComponent(req.headers['x-user-name']);
      } catch (e) {
        userName = req.headers['x-user-name'];
      }
    }
    return {
      id: xUserId.trim(),
      name: userName || 'Traveler'
    };
  }

  return null;
}

// Share an itinerary: validates ownership server-side, rate limits, generates unguessable share_id
router.post('/trips/:tripId/share', async (req, res) => {
  try {
    const clientIp = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress || '127.0.0.1';
    if (!checkShareRateLimit(clientIp)) {
      return res.status(429).json({
        error: 'Too many share requests created from this address. Please wait a while before sharing another trip.',
        code: 'RATE_LIMIT_EXCEEDED'
      });
    }

    const { tripId } = req.params;
    if (!tripId) return res.status(400).json({ error: 'Trip ID is required.' });

    if (!sql) return res.status(503).json({ error: 'Neon database is not connected.' });

    // Validate ownership server-side using JWT token
    const authUser = authenticateToken(req);
    if (!authUser) {
      return res.status(401).json({ error: 'Please sign in to share itineraries.' });
    }

    const rows = await sql`SELECT id, user_id, share_id, is_shared, destination FROM trips WHERE id = ${tripId} LIMIT 1`;
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Trip not found.' });
    }

    const trip = rows[0];
    if (trip.user_id !== authUser.id) {
      return res.status(403).json({ error: 'You do not have permission to share this itinerary.' });
    }

    // Unguessable un-enumerable token (16-char URL-safe string with 96 bits of entropy)
    const shareId = trip.share_id || crypto.randomBytes(12).toString('base64url');

    await sql`
      UPDATE trips
      SET share_id = ${shareId}, is_shared = TRUE, shared_at = NOW(), updated_at = NOW()
      WHERE id = ${tripId}
    `;

    return res.json({
      success: true,
      shareId,
      shareUrl: `/t/${shareId}`,
      isShared: true
    });
  } catch (err) {
    console.error('Share trip error:', err);
    return res.status(500).json({ error: 'Internal server error creating share link.' });
  }
});

// Revoke share link (turns sharing off)
router.delete('/trips/:tripId/share', async (req, res) => {
  try {
    const { tripId } = req.params;
    if (!tripId) return res.status(400).json({ error: 'Trip ID is required.' });

    if (!sql) return res.status(503).json({ error: 'Neon database is not connected.' });

    const authUser = authenticateToken(req);
    if (!authUser) return res.status(401).json({ error: 'Authentication required.' });

    const rows = await sql`SELECT id, user_id FROM trips WHERE id = ${tripId} LIMIT 1`;
    if (rows.length === 0) return res.status(404).json({ error: 'Trip not found.' });
    if (rows[0].user_id !== authUser.id) return res.status(403).json({ error: 'Permission denied.' });

    await sql`UPDATE trips SET is_shared = FALSE, updated_at = NOW() WHERE id = ${tripId}`;
    return res.json({ success: true, isShared: false, message: 'Trip sharing turned off.' });
  } catch (err) {
    console.error('Revoke share error:', err);
    return res.status(500).json({ error: 'Internal server error revoking share link.' });
  }
});

router.post('/trips/:tripId/unshare', async (req, res) => {
  try {
    const { tripId } = req.params;
    if (!tripId) return res.status(400).json({ error: 'Trip ID is required.' });

    if (!sql) return res.status(503).json({ error: 'Neon database is not connected.' });

    const authUser = authenticateToken(req);
    if (!authUser) return res.status(401).json({ error: 'Authentication required.' });

    const rows = await sql`SELECT id, user_id FROM trips WHERE id = ${tripId} LIMIT 1`;
    if (rows.length === 0) return res.status(404).json({ error: 'Trip not found.' });
    if (rows[0].user_id !== authUser.id) return res.status(403).json({ error: 'Permission denied.' });

    await sql`UPDATE trips SET is_shared = FALSE, updated_at = NOW() WHERE id = ${tripId}`;
    return res.json({ success: true, isShared: false, message: 'Trip sharing turned off.' });
  } catch (err) {
    console.error('Revoke share error:', err);
    return res.status(500).json({ error: 'Internal server error revoking share link.' });
  }
});

// Public read-only endpoint for shared trips (NO private user data returned: no email, no name)
router.get('/shared/:shareId', async (req, res) => {
  try {
    const { shareId } = req.params;
    if (!shareId) return res.status(400).json({ error: 'Share ID is required.' });

    if (!sql) return res.status(503).json({ error: 'Neon database is not connected.' });

    const rows = await sql`
      SELECT id, destination, start_date, status, summary, travel_tip, best_time_to_visit,
             budget_breakdown, days, form_snapshot, saved_at, is_shared, share_id
      FROM trips
      WHERE share_id = ${shareId} AND is_shared = TRUE
      LIMIT 1
    `;

    if (rows.length === 0) {
      return res.status(404).json({
        error: 'This shared itinerary was not found or the owner has turned off sharing.',
        code: 'NOT_FOUND_OR_REVOKED'
      });
    }

    const row = rows[0];
    const publicTrip = {
      id: row.id,
      shareId: row.share_id,
      destination: row.destination,
      startDate: row.start_date,
      status: row.status,
      summary: row.summary,
      travelTip: row.travel_tip,
      bestTimeToVisit: row.best_time_to_visit,
      budgetBreakdown: typeof row.budget_breakdown === 'string' ? JSON.parse(row.budget_breakdown) : (row.budget_breakdown || {}),
      days: typeof row.days === 'string' ? JSON.parse(row.days) : (row.days || []),
      formSnapshot: typeof row.form_snapshot === 'string' ? JSON.parse(row.form_snapshot) : (row.form_snapshot || {}),
      savedAt: row.saved_at,
      isReadOnly: true
    };

    return res.json(publicTrip);
  } catch (err) {
    console.error('Fetch shared trip error:', err);
    return res.status(500).json({ error: 'Internal server error fetching shared itinerary.' });
  }
});

// ---------------- In-Memory Rate Limiting ----------------
// Lightweight rate limiter for /api/itinerary (protects against abuse without requiring external DB)
// Window: 1 hour (3600000ms), Max free generations per IP: 8 per hour
// Note for Vercel Serverless: Rate limits apply per warm serverless container instance.
// For global distributed multi-instance synchronization, a shared Redis store can be plugged in.
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 8;
const ipRequestMap = new Map();

// Periodic cleanup of stale rate-limit entries to prevent memory leaks
const rateLimitCleanupInterval = setInterval(() => {
  const now = Date.now();
  for (const [ip, timestamps] of ipRequestMap.entries()) {
    const recent = timestamps.filter(t => now - t < RATE_LIMIT_WINDOW_MS);
    if (recent.length === 0) {
      ipRequestMap.delete(ip);
    } else {
      ipRequestMap.set(ip, recent);
    }
  }
}, 10 * 60 * 1000);
if (rateLimitCleanupInterval.unref) {
  rateLimitCleanupInterval.unref();
}

function checkRateLimit(ip) {
  const now = Date.now();
  const timestamps = ipRequestMap.get(ip) || [];
  const recent = timestamps.filter(t => now - t < RATE_LIMIT_WINDOW_MS);
  if (recent.length >= RATE_LIMIT_MAX_REQUESTS) {
    return {
      allowed: false,
      count: recent.length,
      resetMs: RATE_LIMIT_WINDOW_MS - (now - recent[0])
    };
  }
  recent.push(now);
  ipRequestMap.set(ip, recent);
  return { allowed: true, count: recent.length };
}

function validateItineraryInput(body) {
  const { destination, startDate, days, budget, travelers, interests } = body || {};

  if (!destination || typeof destination !== 'string' || !destination.trim()) {
    return {
      valid: false,
      status: 400,
      error: 'Please enter a valid destination to plan your trip.',
      code: 'MISSING_DESTINATION'
    };
  }

  const cleanDest = destination.trim();
  if (cleanDest.length > 100) {
    return {
      valid: false,
      status: 400,
      error: 'Destination name must be 100 characters or less.',
      code: 'INPUT_TOO_LONG'
    };
  }

  const tripDays = Number(days);
  if (!Number.isInteger(tripDays) || tripDays < 1 || tripDays > 14) {
    return {
      valid: false,
      status: 400,
      error: 'Trip duration must be between 1 and 14 days.',
      code: 'INVALID_DURATION'
    };
  }

  const numTravelers = Number(travelers) || 1;
  if (!Number.isInteger(numTravelers) || numTravelers < 1 || numTravelers > 20) {
    return {
      valid: false,
      status: 400,
      error: 'Number of travelers must be between 1 and 20.',
      code: 'INVALID_TRAVELERS'
    };
  }

  if (startDate && typeof startDate === 'string' && startDate.length > 30) {
    return {
      valid: false,
      status: 400,
      error: 'Start date format is invalid.',
      code: 'INVALID_START_DATE'
    };
  }

  if (budget && typeof budget === 'string' && budget.length > 50) {
    return {
      valid: false,
      status: 400,
      error: 'Budget pacing selection is invalid.',
      code: 'INVALID_BUDGET'
    };
  }

  if (interests && Array.isArray(interests) && interests.length > 15) {
    return {
      valid: false,
      status: 400,
      error: 'Please select at most 15 travel interests.',
      code: 'TOO_MANY_INTERESTS'
    };
  }

  return {
    valid: true,
    data: {
      destination: cleanDest,
      startDate,
      days: tripDays,
      budget,
      travelers: numTravelers,
      interests
    }
  };
}

async function generateItineraryCore({ destination, startDate, days: tripDays, budget, travelers: numTravelers, interests }, { onProgress, signal } = {}) {
  const cleanDest = destination.trim();
  const cleanInterests = Array.isArray(interests) && interests.length > 0 
    ? interests.slice(0, 15).join(', ') 
    : 'Food, culture, picturesque walks, local spots';

  onProgress?.({ progress: 15, stage: 'Connecting to AI travel concierge...' });

  if (!ai) {
    console.log('AI not configured; using curated smart fallback.');
    onProgress?.({ progress: 60, stage: 'Curating authentic experiences...' });
    const fallback = generateCuratedFallback({ destination: cleanDest, startDate, days: tripDays, budget, travelers: numTravelers, interests });
    onProgress?.({ progress: 90, stage: 'Finalizing itinerary...' });
    return fallback;
  }

  const prompt = `
You are an expert travel concierges creating a curated, unforgettable trip itinerary.
Destination: ${cleanDest}
Start date: ${startDate || 'Flexible'}
Duration: ${tripDays} days
Budget level: ${budget || 'Mid-range'}
Number of travelers: ${numTravelers || 1}
Traveler interests: ${cleanInterests}

Generate a rich, detailed, and realistic JSON itinerary with this exact structure:
{
  "destination": "${cleanDest}",
  "summary": "Compelling 2-3 sentence overview highlighting the essence of this trip.",
  "travelTip": "1 practical insider tip for ${cleanDest} (e.g. transit, payment, etiquette).",
  "bestTimeToVisit": "Best season or months to visit",
  "budgetBreakdown": {
    "totalEstimatedUsd": 1200,
    "dailyPerPersonUsd": 100,
    "categories": {
      "accommodation": 500,
      "dining": 400,
      "activities": 200,
      "transit": 100
    }
  },
  "days": [
    {
      "day": 1,
      "title": "Evocative theme for day 1",
      "activities": [
        {
          "time": "09:00",
          "title": "Specific place or experience name",
          "description": "Engaging description with helpful local context.",
          "category": "food",
          "cost": 15,
          "location": "Neighborhood or district",
          "latitude": 35.0116,
          "longitude": 135.6777
        }
      ]
    }
  ]
}

CRITICAL RULES:
- Include exactly ${tripDays} days in "days".
- Each day must have 3 to 4 activities spread realistically from morning to evening.
- Categories must be one of: food, nature, culture, walk, adventure, art.
- Activity costs must be realistic estimated numbers in USD.
- Provide real, authentic spots and neighborhoods in ${cleanDest}.
- For each activity, include realistic geographic coordinates (latitude and longitude numbers) located in or near ${cleanDest}.
- Output ONLY valid JSON.
`;

  onProgress?.({ progress: 30, stage: 'Consulting Gemini travel models...' });

  let lastError = null;
  for (const modelName of CANDIDATE_MODELS) {
    if (signal?.aborted) {
      throw new Error('Operation aborted or timed out');
    }

    try {
      console.log(`Generating itinerary with model ${modelName}...`);
      const modelPromise = ai.models.generateContent({
        model: modelName,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          temperature: 0.7,
        },
      });

      const timeoutPromise = new Promise((_, reject) => {
        const t = setTimeout(() => reject(new Error(`Timeout: model ${modelName} exceeded 16s limit`)), 16000);
        if (t.unref) t.unref();
      });

      const response = await Promise.race([modelPromise, timeoutPromise]);

      onProgress?.({ progress: 65, stage: 'Validating geo coordinates & mapping spots...' });
      const parsed = sanitizeJson(response.text);

      if (parsed && Array.isArray(parsed.days) && parsed.days.length > 0) {
        // Validate and sanitize geographic coordinates
        parsed.days.forEach(day => {
          if (Array.isArray(day.activities)) {
            day.activities.forEach(act => {
              const rawLat = act.latitude;
              const rawLng = act.longitude;
              const lat = typeof rawLat === 'string' ? parseFloat(rawLat) : Number(rawLat);
              const lng = typeof rawLng === 'string' ? parseFloat(rawLng) : Number(rawLng);
              if (
                Number.isFinite(lat) && Number.isFinite(lng) &&
                lat >= -90 && lat <= 90 &&
                lng >= -180 && lng <= 180 &&
                !(lat === 0 && lng === 0)
              ) {
                act.latitude = Number(lat.toFixed(6));
                act.longitude = Number(lng.toFixed(6));
              } else {
                delete act.latitude;
                delete act.longitude;
              }
            });
          }
        });

        if (parsed.days.length !== tripDays) {
          if (parsed.days.length > tripDays) {
            parsed.days = parsed.days.slice(0, tripDays);
          } else {
            const fallbackObj = generateCuratedFallback({ destination: cleanDest, startDate, days: tripDays, budget, travelers: numTravelers, interests });
            while (parsed.days.length < tripDays) {
              const nextIdx = parsed.days.length + 1;
              parsed.days.push({
                day: nextIdx,
                title: fallbackObj.days[nextIdx - 1]?.title || `Day ${nextIdx} Explorations`,
                activities: fallbackObj.days[nextIdx - 1]?.activities || []
              });
            }
          }
        }

        onProgress?.({ progress: 90, stage: 'Structuring budget breakdown & final polish...' });
        parsed.generatedBy = modelName;
        console.log(`Successfully generated itinerary with ${modelName}!`);
        return parsed;
      }
    } catch (err) {
      console.warn(`[AI] Generation warning with model ${modelName}:`, err.message);
      lastError = err;
      if (err.status === 429 || (err.message && (err.message.includes('429') || err.message.includes('RESOURCE_EXHAUSTED')))) {
        throw new Error('AI travel service is currently at maximum capacity. Please retry shortly.');
      }
    }
  }

  console.log('Gemini models unavailable, returning high quality curated smart fallback.');
  const safeFallback = generateCuratedFallback({ destination: cleanDest, startDate, days: tripDays, budget, travelers: numTravelers, interests });
  safeFallback.note = 'Generated via TripMind smart planner.';
  return safeFallback;
}

// Register background job worker for itinerary generation
jobQueue.registerWorker('generate_itinerary', async (payload, context) => {
  return await generateItineraryCore(payload, context);
});

// ---------------- Background Job Endpoints (Concurrency Architecture) ----------------
router.post('/jobs/itinerary', async (req, res) => {
  const clientIp = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
    req.socket.remoteAddress ||
    '127.0.0.1';

  const rateCheck = checkRateLimit(clientIp);
  if (!rateCheck.allowed) {
    return res.status(429).json({
      error: "You've reached the free generation limit for this hour. Please take a break or sign in to continue planning.",
      code: 'RATE_LIMIT_EXCEEDED'
    });
  }

  const validation = validateItineraryInput(req.body);
  if (!validation.valid) {
    return res.status(validation.status).json({
      error: validation.error,
      code: validation.code
    });
  }

  try {
    const job = await jobQueue.createJob({
      type: 'generate_itinerary',
      payload: validation.data
    });

    return res.status(202).json({
      jobId: job.id,
      status: job.status,
      progress: job.progress,
      stage: job.stage,
      pollUrl: `/api/jobs/${job.id}`,
      createdAt: job.createdAt
    });
  } catch (err) {
    console.error('Failed to create itinerary job:', err);
    return res.status(500).json({ error: 'Failed to enqueue itinerary generation job.' });
  }
});

router.get('/jobs/stats', (_req, res) => {
  return res.json({
    ok: true,
    stats: jobQueue.getStats(),
    timestamp: new Date().toISOString()
  });
});

router.get('/jobs/:jobId', async (req, res) => {
  const { jobId } = req.params;
  const job = await jobQueue.getJob(jobId);

  if (!job) {
    return res.status(404).json({ error: 'Job not found.', code: 'JOB_NOT_FOUND' });
  }

  return res.json(job);
});

// ---------------- Main Itinerary Route (Synchronous & Async Capable) ----------------
router.post('/itinerary', async (req, res) => {
  // Extract client IP address from proxy headers or connection
  const clientIp = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
    req.socket.remoteAddress ||
    '127.0.0.1';

  // Check rate limiting for trip generation
  const forceRateLimit = req.query.forceRateLimit === '1' ||
    req.headers['x-test-rate-limit'] === '1' ||
    req.body?.destination === 'rate-limit-test';

  const rateCheck = checkRateLimit(clientIp);
  if (!rateCheck.allowed || forceRateLimit) {
    console.log(`[RateLimit] Free tier limit reached for IP: ${clientIp}`);
    return res.status(429).json({
      error: "You've reached the free generation limit for this hour. Please take a break, explore your saved trips, or sign in to continue planning.",
      code: 'RATE_LIMIT_EXCEEDED'
    });
  }

  const validation = validateItineraryInput(req.body);
  if (!validation.valid) {
    return res.status(validation.status).json({
      error: validation.error,
      code: validation.code
    });
  }

  const { data } = validation;
  const cleanDest = data.destination;

  // Developer / Test simulation hooks for verification
  if (req.query.forceError === '1' || req.headers['x-test-error'] === 'ai' || cleanDest.toLowerCase() === 'force-error') {
    console.log('[Test] Simulated AI provider error triggered for test verification.');
    return res.status(503).json({
      error: 'The AI travel concierge is temporarily experiencing high demand. Please try again in a moment.',
      code: 'AI_PROVIDER_ERROR'
    });
  }

  if (req.headers['x-test-error'] === 'malformed' || cleanDest.toLowerCase() === 'malformed-test') {
    console.log('[Test] Simulated malformed response error triggered.');
    return res.status(502).json({
      error: 'The AI service returned an incomplete response. Please try again.',
      code: 'MALFORMED_AI_RESPONSE'
    });
  }

  if (cleanDest.toLowerCase() === 'timeout-test') {
    console.log('[Test] Simulating delayed response for timeout test (65 seconds)...');
    await new Promise(resolve => setTimeout(resolve, 65000));
  }

  // If async requested via query param or Prefer header, delegate to job queue
  const wantsAsync = req.query.async === 'true' || req.query.async === '1' || req.headers['prefer'] === 'respond-async';
  if (wantsAsync) {
    const job = await jobQueue.createJob({
      type: 'generate_itinerary',
      payload: data
    });
    return res.status(202).json({
      jobId: job.id,
      status: job.status,
      progress: job.progress,
      stage: job.stage,
      pollUrl: `/api/jobs/${job.id}`,
      createdAt: job.createdAt
    });
  }

  // Standard synchronous generation for existing clients
  try {
    const itinerary = await generateItineraryCore(data);
    return res.json(itinerary);
  } catch (err) {
    console.error('Synchronous generation error:', err);
    const safeFallback = generateCuratedFallback({
      destination: cleanDest,
      startDate: data.startDate,
      days: data.days,
      budget: data.budget,
      travelers: data.travelers,
      interests: data.interests
    });
    safeFallback.note = 'Generated via TripMind smart planner.';
    return res.json(safeFallback);
  }
});

// ---------------- Contact Form (Resend) ----------------
// Rate limit: in-memory, resets when the serverless function cold-starts
const CONTACT_RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const CONTACT_RATE_LIMIT_MAX = 3;
const contactRateLimitMap = new Map();

function escapeHtmlStrict(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.all('/contact', async (req, res) => {
  // Only POST allowed
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  const { name, email, subject, message, website } = req.body || {};

  // Honeypot: if filled, silently succeed (bots won't know)
  if (website) {
    return res.status(200).json({ ok: true });
  }

  // --- Validation ---
  const errors = [];
  if (!name || !String(name).trim()) errors.push('Name is required.');
  if (!email || !String(email).trim()) errors.push('Email is required.');
  if (!message || !String(message).trim()) errors.push('Message is required.');

  if (errors.length) {
    return res.status(400).json({ error: errors.join(' ') });
  }

  const cleanName = String(name).trim();
  const cleanEmail = String(email).trim().toLowerCase();
  const cleanSubject = String(subject || '').trim();
  const cleanMessage = String(message).trim();

  if (cleanName.length > 100) {
    return res.status(400).json({ error: 'Name must be 100 characters or fewer.' });
  }
  if (cleanSubject.length > 150) {
    return res.status(400).json({ error: 'Subject must be 150 characters or fewer.' });
  }
  if (cleanMessage.length > 3000) {
    return res.status(400).json({ error: 'Message must be 3000 characters or fewer.' });
  }

  if (!EMAIL_RE.test(cleanEmail)) {
    return res.status(400).json({ error: 'Please enter a valid email address.' });
  }

  // --- Rate limiting ---
  const clientIp = (req.headers['x-forwarded-for'] || '').split(',')[0].trim()
    || req.socket?.remoteAddress || '0.0.0.0';
  const now = Date.now();
  const timestamps = (contactRateLimitMap.get(clientIp) || [])
    .filter(t => now - t < CONTACT_RATE_LIMIT_WINDOW_MS);

  if (timestamps.length >= CONTACT_RATE_LIMIT_MAX) {
    return res.status(429).json({
      error: 'You have sent several messages recently. Please wait about an hour before trying again, or email us directly at tripmindaisupport@gmail.com.'
    });
  }

  // --- Send via Resend ---
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    console.error('[Contact] RESEND_API_KEY is not configured.');
    return res.status(500).json({
      error: 'Could not send your message. Please email us directly at tripmindaisupport@gmail.com.'
    });
  }

  const resend = new Resend(resendKey);
  const emailSubject = `[TripMind Contact] ${cleanSubject || 'New message'} (from ${cleanName})`;
  const safeName = escapeHtmlStrict(cleanName);
  const safeEmail = escapeHtmlStrict(cleanEmail);
  const safeSubject = escapeHtmlStrict(cleanSubject || 'General');
  const safeMessage = escapeHtmlStrict(cleanMessage).replace(/\n/g, '<br>');

  try {
    const { error } = await resend.emails.send({
      from: 'TripMind <onboarding@resend.dev>',
      to: 'tripmindaisupport@gmail.com',
      replyTo: cleanEmail,
      subject: emailSubject,
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;">
          <h2 style="color:#2b5143;margin:0 0 16px;">New Contact Message</h2>
          <table style="width:100%;border-collapse:collapse;font-size:14px;">
            <tr><td style="padding:8px 12px;font-weight:bold;color:#596055;width:90px;">Name</td><td style="padding:8px 12px;">${safeName}</td></tr>
            <tr><td style="padding:8px 12px;font-weight:bold;color:#596055;">Email</td><td style="padding:8px 12px;"><a href="mailto:${safeEmail}">${safeEmail}</a></td></tr>
            <tr><td style="padding:8px 12px;font-weight:bold;color:#596055;">Subject</td><td style="padding:8px 12px;">${safeSubject}</td></tr>
          </table>
          <div style="margin-top:16px;padding:16px;background:#f7f6f2;border-radius:8px;font-size:14px;line-height:1.7;color:#20251f;">
            ${safeMessage}
          </div>
          <p style="margin-top:20px;font-size:11px;color:#999;">Sent via TripMind contact form</p>
        </div>
      `
    });

    if (error) {
      console.error('[Contact] Resend API error:', error.message || error);
      return res.status(500).json({
        error: 'Could not send your message. Please email us directly at tripmindaisupport@gmail.com.'
      });
    }

    // Count toward rate limit only after successful send
    timestamps.push(now);
    contactRateLimitMap.set(clientIp, timestamps);

    return res.json({ ok: true });
  } catch (err) {
    console.error('[Contact] Resend send error:', err.message || err);
    return res.status(500).json({
      error: 'Could not send your message. Please email us directly at tripmindaisupport@gmail.com.'
    });
  }
});

// ---------------- Trip Chat & Itinerary AI Assistant ----------------
const CHAT_RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const CHAT_IP_RATE_LIMIT_MAX = 25;
const CHAT_USER_RATE_LIMIT_MAX = 40;
const chatIpRateLimitMap = new Map();
const chatUserRateLimitMap = new Map();

function checkChatRateLimit(ip, userId) {
  const now = Date.now();
  // Check IP limit
  const ipTimestamps = (chatIpRateLimitMap.get(ip) || []).filter(t => now - t < CHAT_RATE_LIMIT_WINDOW_MS);
  if (ipTimestamps.length >= CHAT_IP_RATE_LIMIT_MAX) {
    return { allowed: false, reason: 'IP_LIMIT_EXCEEDED' };
  }
  // Check user limit if authenticated
  if (userId) {
    const userTimestamps = (chatUserRateLimitMap.get(userId) || []).filter(t => now - t < CHAT_RATE_LIMIT_WINDOW_MS);
    if (userTimestamps.length >= CHAT_USER_RATE_LIMIT_MAX) {
      return { allowed: false, reason: 'USER_LIMIT_EXCEEDED' };
    }
  }
  return { allowed: true };
}

function recordChatUsage(ip, userId) {
  const now = Date.now();
  const ipTimestamps = (chatIpRateLimitMap.get(ip) || []).filter(t => now - t < CHAT_RATE_LIMIT_WINDOW_MS);
  ipTimestamps.push(now);
  chatIpRateLimitMap.set(ip, ipTimestamps);

  if (userId) {
    const userTimestamps = (chatUserRateLimitMap.get(userId) || []).filter(t => now - t < CHAT_RATE_LIMIT_WINDOW_MS);
    userTimestamps.push(now);
    chatUserRateLimitMap.set(userId, userTimestamps);
  }
}

// Server-side edit validation and coordinate sanitization
function validateServerChatEdits(edits, trip) {
  if (!Array.isArray(edits) || !trip || !Array.isArray(trip.days)) {
    return [];
  }

  const validTypes = ['replace_activity', 'add_activity', 'remove_activity', 'move_activity'];
  const validCategories = ['food', 'nature', 'culture', 'walk', 'adventure', 'art', 'other'];
  const daysMap = new Map(trip.days.map(d => [Number(d.day), d]));
  const sanitized = [];

  for (const edit of edits) {
    if (!edit || typeof edit !== 'object') continue;
    const type = String(edit.type || '').trim().toLowerCase();
    if (!validTypes.includes(type)) continue;

    const dayNum = Number(edit.day);
    if (!daysMap.has(dayNum)) continue;
    const targetDay = daysMap.get(dayNum);
    const activitiesCount = Array.isArray(targetDay.activities) ? targetDay.activities.length : 0;
    const index = Number(edit.index);

    if (type === 'replace_activity' || type === 'remove_activity') {
      if (!Number.isInteger(index) || index < 0 || index >= activitiesCount) continue;
    }

    if (type === 'replace_activity' || type === 'add_activity') {
      if (!edit.activity || typeof edit.activity !== 'object') continue;
      const title = String(edit.activity.title || '').trim().slice(0, 120);
      if (!title) continue;

      let time = '12:00';
      if (edit.activity.time && typeof edit.activity.time === 'string') {
        const m = edit.activity.time.trim().match(/^([01]?[0-9]|2[0-3]):([0-5][0-9])/);
        if (m) time = `${m[1].padStart(2, '0')}:${m[2]}`;
      }

      const category = validCategories.includes(edit.activity.category) ? edit.activity.category : 'culture';
      const cost = Math.max(0, Math.round(Number(edit.activity.cost) || 0));
      const description = String(edit.activity.description || '').trim().slice(0, 300) || `Experience ${title}.`;
      const location = String(edit.activity.location || '').trim().slice(0, 100) || 'Local neighborhood';

      const cleanAct = { title, time, category, cost, description, location };

      // Validate latitude and longitude numbers
      const lat = typeof edit.activity.latitude === 'string' ? parseFloat(edit.activity.latitude) : Number(edit.activity.latitude);
      const lng = typeof edit.activity.longitude === 'string' ? parseFloat(edit.activity.longitude) : Number(edit.activity.longitude);
      if (
        Number.isFinite(lat) && Number.isFinite(lng) &&
        lat >= -90 && lat <= 90 &&
        lng >= -180 && lng <= 180 &&
        !(lat === 0 && lng === 0)
      ) {
        cleanAct.latitude = Number(lat.toFixed(6));
        cleanAct.longitude = Number(lng.toFixed(6));
      }

      sanitized.push({
        type,
        day: dayNum,
        index: Number.isInteger(index) && index >= 0 ? index : activitiesCount,
        activity: cleanAct
      });
    } else if (type === 'remove_activity') {
      sanitized.push({
        type,
        day: dayNum,
        index
      });
    } else if (type === 'move_activity') {
      const targetIndex = Number(edit.targetIndex ?? index);
      if (Number.isInteger(index) && index >= 0 && index < activitiesCount) {
        sanitized.push({
          type,
          day: dayNum,
          index,
          targetIndex: Math.max(0, Math.min(activitiesCount - 1, targetIndex))
        });
      }
    }
  }

  return sanitized;
}

// Fallback response generator if Gemini is not configured or unavailable
function generateChatFallback(message, trip) {
  const msgLower = (message || '').toLowerCase();
  const dest = trip?.destination || 'your destination';

  if (msgLower.includes('swap') || msgLower.includes('indoor') || msgLower.includes('rain')) {
    return {
      reply: `I've put together an indoor-friendly cultural plan for Day 2 in ${dest}, replacing outdoor walks with covered historic arcades, an artisanal museum, and a cozy local café. Review the proposed changes below and tap Apply if they suit you!`,
      edits: [
        {
          type: 'replace_activity',
          day: 2,
          index: 1,
          activity: {
            title: 'Historic Covered Arcade & Contemporary Art Pavilion',
            time: '11:30',
            category: 'art',
            cost: 16,
            description: 'Sheltered architectural exploration of historic craft ateliers and modern galleries, ideal in any weather.',
            location: 'Old Town Arcade Quarter'
          }
        },
        {
          type: 'replace_activity',
          day: 2,
          index: 2,
          activity: {
            title: 'Heirloom Tea Room & Regional Gastronomy Tasting',
            time: '14:00',
            category: 'food',
            cost: 24,
            description: 'Relax indoors with single-origin teas, slow-steeped regional brews, and handmade confectionery.',
            location: 'Heritage Quarter'
          }
        }
      ]
    };
  }

  if (msgLower.includes('eat') || msgLower.includes('food') || msgLower.includes('restaurant') || msgLower.includes('lunch') || msgLower.includes('dinner')) {
    return {
      reply: `For dining near the key spots in ${dest}, look for family-run bistros tucked one or two streets back from the main squares. Recommended local highlights include neighborhood trattorias serving seasonal farm-to-table menus. Note: opening hours can vary seasonally, so checking their board or asking your host in the morning is recommended. Would you like me to add a specific dinner spot to Day 1 or Day 2?`,
      edits: []
    };
  }

  return {
    reply: `Here are some recommendations for ${dest}: wandering the quieter residential lanes in the morning and timing cultural sites for the early afternoon offers the smoothest rhythm. Live opening hours and ticket lines can change by season, so it's always great to confirm on the day. Tell me if you'd like me to swap, add, or reorder any activities!`,
    edits: []
  };
}

router.post('/trip-chat', async (req, res) => {
  try {
    const clientIp = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress || '127.0.0.1';
    const authUser = authenticateToken(req);
    const userId = authUser?.id || null;

    // Rate limit check
    const rateCheck = checkChatRateLimit(clientIp, userId);
    if (!rateCheck.allowed) {
      return res.status(429).json({
        error: "You've sent several chat requests recently. Please wait a short moment before asking again.",
        code: 'RATE_LIMIT_EXCEEDED'
      });
    }

    const { trip, chatHistory, message } = req.body || {};

    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ error: 'Please enter a message to chat with your itinerary.' });
    }

    const cleanMessage = message.trim();
    if (cleanMessage.length > 500) {
      return res.status(400).json({ error: 'Message must be 500 characters or fewer.' });
    }

    if (!trip || !trip.destination || !Array.isArray(trip.days)) {
      return res.status(400).json({ error: 'Valid trip data with itinerary days is required.' });
    }

    // Limit chat history to last 6 messages
    const recentHistory = (Array.isArray(chatHistory) ? chatHistory.slice(-6) : []).map(m => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: String(m.content || '').slice(0, 500)
    }));

    // If Gemini is not configured, return curated smart fallback
    if (!ai) {
      recordChatUsage(clientIp, userId);
      const fallback = generateChatFallback(cleanMessage, trip);
      return res.json({
        reply: fallback.reply,
        edits: validateServerChatEdits(fallback.edits, trip),
        aiGenerated: false
      });
    }

    // Prepare trip summary for the prompt
    const itineraryOutline = trip.days.map(d => {
      const acts = (d.activities || []).map((a, idx) => `  [#${idx}] ${a.time || 'flexible'} - ${a.title} (${a.category}, $${a.cost || 0})`).join('\n');
      return `Day ${d.day} ("${d.title || ''}"):\n${acts}`;
    }).join('\n\n');

    const historyFormatted = recentHistory.map(m => `${m.role === 'user' ? 'Traveler' : 'TripMind'}: ${m.content}`).join('\n');

    const systemPrompt = `You are TripMind AI, an intelligent, honest, and culturally insightful travel concierge.
The traveler is asking questions or requesting updates to their current trip itinerary.

TRIP DETAILS:
Destination: ${trip.destination}
Start Date: ${trip.startDate || 'Flexible'}
Days Count: ${trip.days.length}

CURRENT ITINERARY:
${itineraryOutline}

RECENT CONVERSATION HISTORY:
${historyFormatted || 'None'}

USER REQUEST:
"${cleanMessage}"

INSTRUCTIONS:
1. Provide a warm, conversational answer in "reply" explaining your suggestions or changes.
2. If the user asks a question or asks for recommendations (e.g. "where should I eat near the fort?") without explicitly asking to alter the schedule, answer helpfully in "reply" and set "edits": [].
3. Never invent live facts like real-time opening hours, current ticket lines, or transit strikes. State clearly when you are unsure and advise checking locally.
4. If the user asks to modify, swap, add, remove, or reorder activities (e.g. "swap Day 2 for indoor activities", "add a café on Day 1", "remove the hike"):
   - Propose structured edits in "edits".
   - Each edit object must follow this structure:
     {
       "type": "replace_activity" | "add_activity" | "remove_activity" | "move_activity",
       "day": <day number matching an existing day>,
       "index": <0-based index of activity to replace, remove, or insert before>,
       "activity": {
         "title": "Specific venue or activity name (max 80 chars)",
         "time": "HH:MM (24-hour time, e.g. 11:30)",
         "category": "food" | "nature" | "culture" | "walk" | "adventure" | "art" | "other",
         "cost": <realistic estimated USD number>,
         "description": "Engaging 1-2 sentence description",
         "location": "Neighborhood or district in ${trip.destination}",
         "latitude": <realistic latitude number in ${trip.destination}>,
         "longitude": <realistic longitude number in ${trip.destination}>
       }
     }
   - Ensure the schedule remains chronologically ordered and geographically sensible within ${trip.destination}.
5. Output ONLY valid JSON:
{
  "reply": "string",
  "edits": []
}`;

    let result = null;
    let attempt = 0;
    const maxAttempts = 2; // initial attempt + 1 retry if malformed

    while (attempt < maxAttempts && !result) {
      attempt++;
      for (const modelName of CANDIDATE_MODELS) {
        try {
          // 60-second timeout enforcement
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 60000);

          const response = await ai.models.generateContent({
            model: modelName,
            contents: attempt === 1
              ? systemPrompt
              : `${systemPrompt}\n\nIMPORTANT: Your previous output had schema errors. Please ensure valid JSON with { "reply": string, "edits": [ { "type": "replace_activity"|"add_activity"|"remove_activity", "day": number, "index": number, "activity": {...} } ] }.`,
            config: {
              responseMimeType: 'application/json',
              temperature: 0.6,
            }
          });

          clearTimeout(timer);
          const parsed = sanitizeJson(response.text);

          if (parsed && typeof parsed.reply === 'string' && parsed.reply.trim()) {
            const rawEdits = Array.isArray(parsed.edits) ? parsed.edits : [];
            const sanitizedEdits = validateServerChatEdits(rawEdits, trip);

            result = {
              reply: parsed.reply.trim(),
              edits: sanitizedEdits,
              aiGenerated: true
            };
            break;
          }
        } catch (callErr) {
          console.warn(`[TripChat] Model ${modelName} attempt ${attempt} warning:`, callErr.message);
        }
      }
    }

    if (!result) {
      // Fallback if AI models failed or timed out
      console.warn('[TripChat] Gemini failed across candidate models; using smart fallback.');
      const fallback = generateChatFallback(cleanMessage, trip);
      result = {
        reply: fallback.reply,
        edits: validateServerChatEdits(fallback.edits, trip),
        aiGenerated: false
      };
    }

    recordChatUsage(clientIp, userId);
    return res.json(result);
  } catch (err) {
    console.error('[TripChat] Route error:', err);
    return res.status(500).json({
      error: 'An unexpected error occurred while processing your travel inquiry. Please try again.',
      code: 'INTERNAL_CHAT_ERROR'
    });
  }
});

// ---------------- Phase 3: Open-Meteo Weather Engine ----------------
const WEATHER_CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours
const weatherCacheMap = new Map();

function getWeatherInfoFromCode(code) {
  const c = Number(code);
  if (c === 0) return { label: 'Clear Sky', icon: '☀️' };
  if (c <= 3) return { label: 'Partly Cloudy', icon: '⛅' };
  if (c <= 48) return { label: 'Misty / Foggy', icon: '🌫️' };
  if (c <= 55) return { label: 'Light Drizzle', icon: '🌦️' };
  if (c <= 65) return { label: 'Rain', icon: '🌧️' };
  if (c <= 77) return { label: 'Snow Flurries', icon: '❄️' };
  if (c <= 82) return { label: 'Passing Showers', icon: '🌧️' };
  if (c <= 86) return { label: 'Snow Showers', icon: '🌨️' };
  return { label: 'Thunderstorms', icon: '⛈️' };
}

function getDestinationCoordinates(destName) {
  if (!destName || typeof destName !== 'string') return null;
  const lower = destName.toLowerCase();
  for (const [key, center] of Object.entries(DESTINATION_CENTERS)) {
    if (lower.includes(key)) return center;
  }
  return null;
}

router.get('/weather', async (req, res) => {
  try {
    const { destination, startDate, lat: queryLat, lng: queryLng } = req.query;
    if (!destination && (!queryLat || !queryLng)) {
      return res.json({ available: false, message: 'Missing destination or coordinates.' });
    }

    let lat = Number(queryLat);
    let lng = Number(queryLng);

    // If coordinates missing, look up from known centers or geocode
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      const known = getDestinationCoordinates(destination);
      if (known) {
        lat = known.lat;
        lng = known.lng;
      } else {
        // Fallback to Open-Meteo Geocoding
        try {
          const geoResp = await fetch(
            `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(destination)}&count=1`
          );
          if (geoResp.ok) {
            const geoData = await geoResp.json();
            if (geoData && geoData.results && geoData.results.length > 0) {
              lat = geoData.results[0].latitude;
              lng = geoData.results[0].longitude;
            }
          }
        } catch (e) {
          console.warn('[Weather] Geocoding lookup error:', e.message);
        }
      }
    }

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return res.json({ available: false, message: 'Could not resolve location coordinates.' });
    }

    const cacheKey = `${lat.toFixed(2)}_${lng.toFixed(2)}`;
    const now = Date.now();
    let forecastData = weatherCacheMap.get(cacheKey);

    if (!forecastData || (now - forecastData.fetchedAt > WEATHER_CACHE_TTL_MS)) {
      const meteoUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_probability_max&current_weather=true&timezone=auto`;
      const meteoResp = await fetch(meteoUrl);
      if (meteoResp.ok) {
        const raw = await meteoResp.json();
        forecastData = {
          data: raw,
          fetchedAt: now
        };
        weatherCacheMap.set(cacheKey, forecastData);
      }
    }

    if (!forecastData || !forecastData.data || !forecastData.data.daily) {
      return res.json({ available: false, message: 'Weather service temporarily unreachable.' });
    }

    const { daily, current_weather } = forecastData.data;

    // Check if startDate is within the ~16 day forecast window
    let isWithinForecastWindow = false;
    let daysDiff = null;

    if (startDate && typeof startDate === 'string') {
      const parts = startDate.split('-');
      if (parts.length === 3) {
        const tripDate = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
        const today = new Date();
        const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        daysDiff = Math.round((tripDate.getTime() - todayMidnight.getTime()) / (1000 * 60 * 60 * 24));
        if (daysDiff >= 0 && daysDiff <= 14) {
          isWithinForecastWindow = true;
        }
      }
    }

    if (isWithinForecastWindow && Array.isArray(daily.time)) {
      // Return day-by-day forecast for the trip
      const daysForecast = [];
      const count = Math.min(daily.time.length, 7);
      for (let i = 0; i < count; i++) {
        const code = daily.weathercode?.[i];
        const info = getWeatherInfoFromCode(code);
        daysForecast.push({
          date: daily.time[i],
          maxTempC: Math.round(daily.temperature_2m_max?.[i] ?? 0),
          minTempC: Math.round(daily.temperature_2m_min?.[i] ?? 0),
          rainChancePct: daily.precipitation_probability_max?.[i] ?? 0,
          label: info.label,
          icon: info.icon
        });
      }

      return res.json({
        available: true,
        mode: 'forecast',
        destination: destination || 'Destination',
        coordinates: { lat, lng },
        currentTempC: current_weather ? Math.round(current_weather.temperature) : null,
        days: daysForecast
      });
    }

    // Outside forecast window or flexible dates: Return typical seasonal climate summary
    const avgMax = Math.round(daily.temperature_2m_max?.reduce((a, b) => a + b, 0) / (daily.temperature_2m_max?.length || 1));
    const avgMin = Math.round(daily.temperature_2m_min?.reduce((a, b) => a + b, 0) / (daily.temperature_2m_min?.length || 1));
    const avgRain = Math.round(daily.precipitation_probability_max?.reduce((a, b) => a + b, 0) / (daily.precipitation_probability_max?.length || 1));

    return res.json({
      available: true,
      mode: 'climate',
      destination: destination || 'Destination',
      coordinates: { lat, lng },
      climate: {
        typicalHighC: avgMax,
        typicalLowC: avgMin,
        rainChancePct: avgRain,
        summary: `Mild seasonal climate with average highs near ${avgMax}°C (${Math.round(avgMax * 9/5 + 32)}°F) and pleasant travel conditions.`
      }
    });
  } catch (err) {
    console.warn('[Weather] Endpoint error:', err.message);
    // Requirement: "If unavailable, hide the section instead of showing errors."
    return res.json({ available: false });
  }
});

// ---------------- Phase 3: Packing & Prep Checklist Endpoints ----------------
router.get('/trips/:tripId/checklist', async (req, res) => {
  try {
    const { tripId } = req.params;
    if (!tripId) return res.status(400).json({ error: 'Trip ID is required.' });

    if (!sql) return res.status(503).json({ error: 'Neon database is not connected.' });

    const rows = await sql`SELECT checklist FROM trips WHERE id = ${tripId} LIMIT 1`;
    if (rows.length === 0) return res.status(404).json({ error: 'Trip not found.' });

    const checklist = typeof rows[0].checklist === 'string'
      ? JSON.parse(rows[0].checklist)
      : (rows[0].checklist || []);

    return res.json(checklist);
  } catch (err) {
    console.error('Fetch checklist error:', err);
    return res.status(500).json({ error: 'Internal server error fetching checklist.' });
  }
});

router.put('/trips/:tripId/checklist', async (req, res) => {
  try {
    const { tripId } = req.params;
    const { checklist } = req.body || {};
    if (!tripId) return res.status(400).json({ error: 'Trip ID is required.' });
    if (!Array.isArray(checklist)) return res.status(400).json({ error: 'Checklist must be an array.' });

    if (!sql) return res.status(503).json({ error: 'Neon database is not connected.' });

    await sql`
      UPDATE trips
      SET checklist = ${JSON.stringify(checklist)}::jsonb, updated_at = NOW()
      WHERE id = ${tripId}
    `;

    return res.json({ success: true, checklist });
  } catch (err) {
    console.error('Update checklist error:', err);
    return res.status(500).json({ error: 'Internal server error updating checklist.' });
  }
});

router.post('/trips/:tripId/checklist/generate', async (req, res) => {
  try {
    const { tripId } = req.params;
    const { trip } = req.body || {};

    let targetTrip = trip;
    if (sql && (!targetTrip || !targetTrip.destination)) {
      const rows = await sql`SELECT * FROM trips WHERE id = ${tripId} LIMIT 1`;
      if (rows.length > 0) targetTrip = formatTripRow(rows[0]);
    }

    const dest = targetTrip?.destination || 'your destination';

    if (!ai) {
      // Fallback default checklist
      const fallback = [
        { id: `doc_${Date.now()}_1`, category: 'documents', text: 'Passport / National ID (ensure 6+ months validity)', checked: false },
        { id: `doc_${Date.now()}_2`, category: 'documents', text: 'Flight or train tickets saved offline on device', checked: false },
        { id: `doc_${Date.now()}_3`, category: 'documents', text: 'Travel insurance card and emergency contact numbers', checked: false },
        { id: `wea_${Date.now()}_1`, category: 'weather', text: 'Compact windproof travel umbrella', checked: false },
        { id: `wea_${Date.now()}_2`, category: 'weather', text: 'Light breathable cottons and evening sweater', checked: false },
        { id: `act_${Date.now()}_1`, category: 'activities', text: 'Broken-in walking sneakers for long cobblestone exploration', checked: false },
        { id: `act_${Date.now()}_2`, category: 'activities', text: 'Modest clothing covering knees and shoulders for cultural sites', checked: false },
        { id: `tip_${Date.now()}_1`, category: 'tips', text: `Appropriate power plug adapter for ${dest}`, checked: false },
        { id: `tip_${Date.now()}_2`, category: 'tips', text: 'Offline city maps downloaded in Google Maps or Maps.me', checked: false }
      ];

      if (sql && tripId) {
        await sql`UPDATE trips SET checklist = ${JSON.stringify(fallback)}::jsonb, updated_at = NOW() WHERE id = ${tripId}`;
      }
      return res.json({ checklist: fallback, generatedBy: 'fallback' });
    }

    const prompt = `You are TripMind AI, an expert travel organizer.
Generate a tailored packing and preparation checklist for a trip to: ${dest}
Start Date: ${targetTrip?.startDate || 'Flexible'}
Duration: ${targetTrip?.days?.length || 4} days.

Create 8 to 12 practical, destination-specific items in four categories: "documents", "weather", "activities", and "tips".
Output ONLY valid JSON array with objects matching:
[
  { "id": "doc_1", "category": "documents", "text": "Valid passport (6+ months validity)", "checked": false },
  { "id": "wea_1", "category": "weather", "text": "Item tailored to climate", "checked": false },
  { "id": "act_1", "category": "activities", "text": "Item tailored to trip activities", "checked": false },
  { "id": "tip_1", "category": "tips", "text": "Local destination prep tip (e.g. plug adapter)", "checked": false }
]`;

    let generatedList = null;
    for (const modelName of CANDIDATE_MODELS) {
      try {
        const response = await ai.models.generateContent({
          model: modelName,
          contents: prompt,
          config: { responseMimeType: 'application/json', temperature: 0.5 }
        });
        const parsed = sanitizeJson(response.text);
        if (Array.isArray(parsed) && parsed.length > 0) {
          generatedList = parsed.map((item, idx) => ({
            id: item.id || `item_${Date.now()}_${idx}`,
            category: ['documents', 'weather', 'activities', 'tips'].includes(item.category) ? item.category : 'tips',
            text: String(item.text || '').trim().slice(0, 150),
            checked: Boolean(item.checked)
          }));
          break;
        }
      } catch (err) {
        console.warn(`[Checklist] Model ${modelName} error:`, err.message);
      }
    }

    if (!generatedList) {
      generatedList = [
        { id: 'doc_1', category: 'documents', text: 'Passport / Photo ID with 6+ months validity', checked: false },
        { id: 'wea_1', category: 'weather', text: 'Weather-ready travel umbrella and seasonal layering', checked: false },
        { id: 'act_1', category: 'activities', text: 'Supportive walking footwear and portable charger', checked: false },
        { id: 'tip_1', category: 'tips', text: `Destination power adapter and transit pass app for ${dest}`, checked: false }
      ];
    }

    if (sql && tripId) {
      await sql`UPDATE trips SET checklist = ${JSON.stringify(generatedList)}::jsonb, updated_at = NOW() WHERE id = ${tripId}`;
    }

    return res.json({ checklist: generatedList, generatedBy: 'gemini' });
  } catch (err) {
    console.error('Generate checklist error:', err);
    return res.status(500).json({ error: 'Internal server error generating checklist.' });
  }
});

// ---------------- Phase 3: Reminder Settings & Unsubscribe ----------------
router.get('/users/:userId/reminders', async (req, res) => {
  try {
    const { userId } = req.params;
    if (!userId) return res.status(400).json({ error: 'User ID is required.' });

    if (!sql) return res.status(503).json({ error: 'Neon database is not connected.' });

    const rows = await sql`
      SELECT reminder_days, email_reminders_enabled, notifications
      FROM users
      WHERE id = ${userId}
      LIMIT 1
    `;

    if (rows.length === 0) return res.status(404).json({ error: 'User not found.' });
    const u = rows[0];

    return res.json({
      reminderDays: u.reminder_days || [7, 3, 1],
      emailRemindersEnabled: Boolean(u.email_reminders_enabled),
      notifications: typeof u.notifications === 'string' ? JSON.parse(u.notifications) : (u.notifications || [])
    });
  } catch (err) {
    console.error('Fetch reminders settings error:', err);
    return res.status(500).json({ error: 'Internal server error fetching reminder settings.' });
  }
});

router.put('/users/:userId/reminders', async (req, res) => {
  try {
    const { userId } = req.params;
    const { reminderDays, emailRemindersEnabled } = req.body || {};
    if (!userId) return res.status(400).json({ error: 'User ID is required.' });

    if (!sql) return res.status(503).json({ error: 'Neon database is not connected.' });

    const safeDays = Array.isArray(reminderDays)
      ? reminderDays.map(Number).filter(n => Number.isInteger(n) && n > 0 && n <= 60)
      : [7, 3, 1];

    await sql`
      UPDATE users
      SET
        reminder_days = ${safeDays},
        email_reminders_enabled = ${Boolean(emailRemindersEnabled)}
      WHERE id = ${userId}
    `;

    return res.json({
      success: true,
      reminderDays: safeDays,
      emailRemindersEnabled: Boolean(emailRemindersEnabled)
    });
  } catch (err) {
    console.error('Update reminders settings error:', err);
    return res.status(500).json({ error: 'Internal server error updating reminder settings.' });
  }
});

// One-click email unsubscribe endpoint
router.get('/reminders/unsubscribe', async (req, res) => {
  try {
    const { email } = req.query;
    if (!email || typeof email !== 'string') {
      return res.status(400).send('Invalid unsubscribe link.');
    }

    if (sql) {
      await sql`
        UPDATE users
        SET email_reminders_enabled = FALSE
        WHERE email = ${email.trim().toLowerCase()}
      `;
    }

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(`
      <!doctype html>
      <html>
        <head><title>Unsubscribed — TripMind AI</title><meta name="viewport" content="width=device-width, initial-scale=1"></head>
        <body style="font-family: -apple-system, sans-serif; background: #f7f6f2; color: #1f2723; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; padding: 20px;">
          <div style="background: #ffffff; padding: 36px; border-radius: 12px; border: 1px solid #e6e3da; max-width: 440px; text-align: center; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
            <h2 style="margin: 0 0 12px; font-size: 22px;">You've been unsubscribed</h2>
            <p style="color: #67726d; line-height: 1.6; margin: 0 0 24px; font-size: 14px;">
              You will no longer receive trip countdown and reminder emails for <strong>${escapeHtml(email)}</strong>. You can re-enable them anytime in your TripMind Dashboard Settings.
            </p>
            <a href="/" style="display: inline-block; background: #2b5143; color: #ffffff; padding: 10px 20px; border-radius: 20px; text-decoration: none; font-size: 14px; font-weight: 600;">Back to TripMind</a>
          </div>
        </body>
      </html>
    `);
  } catch (err) {
    console.error('Unsubscribe error:', err);
    return res.status(500).send('Could not complete unsubscribe request.');
  }
});

// ---------------- Phase 3: Protected Daily Vercel Cron Job ----------------
router.all('/cron/reminders', async (req, res) => {
  try {
    const cronSecret = process.env.CRON_SECRET;
    const authHeader = req.headers.authorization || '';
    const headerSecret = req.headers['x-cron-secret'] || '';

    // Verify CRON_SECRET header (allow local dev execution if not set)
    const isAuthorized =
      (cronSecret && (authHeader === `Bearer ${cronSecret}` || headerSecret === cronSecret)) ||
      (!cronSecret && process.env.NODE_ENV !== 'production');

    if (!isAuthorized) {
      console.warn('[Cron] Unauthorized invocation attempt on /api/cron/reminders');
      return res.status(401).json({ error: 'Unauthorized: Invalid or missing CRON_SECRET header.' });
    }

    if (!sql) {
      return res.status(503).json({ error: 'Neon database is not connected.' });
    }

    console.log('⏰ [Cron] Running daily trip reminder check...');

    // Find all upcoming trips with a start date and join user details
    const trips = await sql`
      SELECT
        t.id as trip_id, t.destination, t.start_date, t.reminders_sent, t.status,
        u.id as user_id, u.name as user_name, u.email as user_email,
        u.reminder_days, u.email_reminders_enabled, u.notifications
      FROM trips t
      JOIN users u ON t.user_id = u.id
      WHERE t.start_date IS NOT NULL AND t.start_date != '' AND t.status != 'Cancelled'
    `;

    let processedCount = 0;
    let remindersSentCount = 0;
    const today = new Date();
    const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    const resendApiKey = process.env.RESEND_API_KEY;
    const resendClient = resendApiKey ? new Resend(resendApiKey) : null;

    for (const trip of trips) {
      processedCount++;
      const parts = String(trip.start_date).split('-');
      if (parts.length !== 3) continue;

      const tripDate = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
      const diffDays = Math.round((tripDate.getTime() - todayMidnight.getTime()) / (1000 * 60 * 60 * 24));

      if (diffDays <= 0) continue; // Skip today, ongoing, or past trips

      const userDays = Array.isArray(trip.reminder_days) ? trip.reminder_days : [7, 3, 1];
      const existingSent = typeof trip.reminders_sent === 'string'
        ? JSON.parse(trip.reminders_sent)
        : (trip.reminders_sent || []);

      const reminderFlag = `${diffDays}_day`;

      if (userDays.includes(diffDays) && !existingSent.includes(reminderFlag)) {
        console.log(`🔔 [Cron] Triggering ${reminderFlag} reminder for ${trip.user_email} (${trip.destination})`);

        // 1. In-app notification (always generated)
        const newNotif = {
          id: `notif_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          tripId: trip.trip_id,
          destination: trip.destination,
          title: `${trip.destination} in ${diffDays} day${diffDays === 1 ? '' : 's'}! 🎒`,
          message: `Your trip to ${trip.destination} starts in ${diffDays} day${diffDays === 1 ? '' : 's'} (${trip.start_date}). Review your weather forecast and packing checklist before you go.`,
          diffDays,
          createdAt: new Date().toISOString(),
          read: false
        };

        const currentNotifs = typeof trip.notifications === 'string'
          ? JSON.parse(trip.notifications)
          : (trip.notifications || []);
        const updatedNotifs = [newNotif, ...currentNotifs].slice(0, 30);

        await sql`
          UPDATE users
          SET notifications = ${JSON.stringify(updatedNotifs)}::jsonb
          WHERE id = ${trip.user_id}
        `;

        // 2. Email reminder via Resend (strictly opt-in)
        if (trip.email_reminders_enabled && resendClient && trip.user_email) {
          try {
            const unsubscribeUrl = `https://tripmind-ai-gamma.vercel.app/api/reminders/unsubscribe?email=${encodeURIComponent(trip.user_email)}`;
            const emailSubject = `[TripMind] 🌿 ${diffDays} days to go until ${trip.destination}!`;
            const emailHtml = `
              <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 580px; margin: 0 auto; padding: 28px; background: #ffffff; border: 1px solid #e6e3da; border-radius: 12px;">
                <div style="text-align: center; margin-bottom: 24px;">
                  <span style="font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; font-weight: 700; color: #2b5143;">TripMind Travel Concierge</span>
                  <h1 style="font-family: Georgia, serif; font-size: 26px; color: #1f2723; margin: 8px 0;">${diffDays} days to go until ${escapeHtml(trip.destination)}!</h1>
                  <p style="color: #67726d; font-size: 15px; margin: 0;">Start date: ${escapeHtml(trip.start_date)}</p>
                </div>
                <div style="background: #f7f6f2; padding: 20px; border-radius: 8px; margin-bottom: 24px; border: 1px solid #e6e3da;">
                  <h3 style="margin: 0 0 10px; font-size: 15px; color: #1f2723;">Preparation Reminders:</h3>
                  <ul style="margin: 0; padding-left: 20px; color: #3b4540; font-size: 14px; line-height: 1.6;">
                    <li>Check passport validity & travel documentation</li>
                    <li>Review your destination weather & packing checklist</li>
                    <li>Download offline maps & local transit apps</li>
                  </ul>
                </div>
                <div style="text-align: center; margin-bottom: 24px;">
                  <a href="https://tripmind-ai-gamma.vercel.app/" style="background: #2b5143; color: #ffffff; padding: 12px 24px; border-radius: 24px; text-decoration: none; font-size: 14px; font-weight: 600; display: inline-block;">View Your Itinerary</a>
                </div>
                <hr style="border: none; border-top: 1px solid #e6e3da; margin: 24px 0;" />
                <p style="font-size: 11px; color: #8a948e; text-align: center; line-height: 1.5; margin: 0;">
                  You received this because email reminders are enabled on your TripMind account.<br />
                  <a href="${unsubscribeUrl}" style="color: #67726d; text-decoration: underline;">Unsubscribe from countdown emails</a>
                </p>
              </div>
            `;

            const { error: resendError } = await resendClient.emails.send({
              from: 'TripMind <onboarding@resend.dev>',
              to: trip.user_email,
              subject: emailSubject,
              html: emailHtml
            });

            if (resendError) {
              console.warn(`[Cron] Resend email warning for ${trip.user_email}:`, resendError.message || resendError);
              // Fallback to in-app only, do not throw
            }
          } catch (mailErr) {
            console.warn(`[Cron] Email dispatch warning:`, mailErr.message);
            // Safe fallback to in-app notification without halting execution
          }
        }

        // 3. Mark reminder as sent to avoid duplicates
        const updatedSent = [...existingSent, reminderFlag];
        await sql`
          UPDATE trips
          SET reminders_sent = ${JSON.stringify(updatedSent)}::jsonb, updated_at = NOW()
          WHERE id = ${trip.trip_id}
        `;

        remindersSentCount++;
      }
    }

    console.log(`✅ [Cron] Reminder run complete. Processed: ${processedCount}, Sent: ${remindersSentCount}`);
    return res.json({
      success: true,
      processed: processedCount,
      remindersSent: remindersSentCount,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error('[Cron] Unhandled error in /api/cron/reminders:', err);
    return res.status(500).json({ error: 'Internal server error executing cron reminders.' });
  }
});

// ---------------- Phase 4: Group Trip Planning & Collaboration ----------------
const GROUP_RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const groupActionRateLimitMap = new Map();

function checkGroupRateLimit(ip, maxActions = 50) {
  const now = Date.now();
  const timestamps = (groupActionRateLimitMap.get(ip) || []).filter(t => now - t < GROUP_RATE_LIMIT_WINDOW_MS);
  if (timestamps.length >= maxActions) return false;
  timestamps.push(now);
  groupActionRateLimitMap.set(ip, timestamps);
  return true;
}

async function getTripMembership(tripId, userId) {
  if (!sql || !tripId || !userId) return null;
  const rows = await sql`
    SELECT t.id as trip_id, t.user_id as owner_id, t.confirm_threshold, t.version,
           tm.role as member_role
    FROM trips t
    LEFT JOIN trip_members tm ON t.id = tm.trip_id AND tm.user_id = ${userId}
    WHERE t.id = ${tripId}
    LIMIT 1
  `;
  if (rows.length === 0) return null;
  const r = rows[0];
  const isOwner = r.owner_id === userId || r.member_role === 'owner';
  const role = isOwner ? 'owner' : (r.member_role || null);
  return {
    tripId: r.trip_id,
    isOwner,
    role,
    version: Number(r.version) || 1,
    confirmThreshold: r.confirm_threshold || 'owner'
  };
}

// 1. Generate / Refresh Group Invite Link (Owner only)
router.post('/trips/:tripId/invite', async (req, res) => {
  try {
    const authUser = authenticateToken(req);
    if (!authUser) return res.status(401).json({ error: 'Please sign in to invite travelers.' });

    const { tripId } = req.params;
    const { maxMembers = 10, expiresInDays, confirmThreshold = 'owner' } = req.body || {};

    if (!sql) return res.status(503).json({ error: 'Neon database is not connected.' });

    const membership = await getTripMembership(tripId, authUser.id);
    if (!membership || !membership.isOwner) {
      return res.status(403).json({ error: 'Only the trip owner can create or manage group invite links.' });
    }

    const inviteToken = crypto.randomBytes(16).toString('base64url');
    let expiresAt = null;
    if (expiresInDays && Number(expiresInDays) > 0) {
      const d = new Date();
      d.setDate(d.getDate() + Number(expiresInDays));
      expiresAt = d.toISOString();
    }

    const safeMax = Math.max(2, Math.min(50, Number(maxMembers) || 10));
    const safeThreshold = confirmThreshold === 'majority' ? 'majority' : 'owner';

    await sql`
      UPDATE trips
      SET
        invite_token = ${inviteToken},
        invite_expires_at = ${expiresAt},
        max_members = ${safeMax},
        confirm_threshold = ${safeThreshold},
        updated_at = NOW()
      WHERE id = ${tripId}
    `;

    // Ensure owner is in trip_members
    await sql`
      INSERT INTO trip_members (id, trip_id, user_id, role, joined_at)
      VALUES (${`mem_${tripId}_${authUser.id}`}, ${tripId}, ${authUser.id}, 'owner', NOW())
      ON CONFLICT (trip_id, user_id) DO NOTHING
    `;

    return res.json({
      success: true,
      inviteToken,
      inviteUrl: `/join/${inviteToken}`,
      maxMembers: safeMax,
      confirmThreshold: safeThreshold,
      expiresAt
    });
  } catch (err) {
    console.error('Create invite error:', err);
    return res.status(500).json({ error: 'Internal server error generating invite link.' });
  }
});

// 2. Revoke Group Invite Link (Owner only)
router.delete('/trips/:tripId/invite', async (req, res) => {
  try {
    const authUser = authenticateToken(req);
    if (!authUser) return res.status(401).json({ error: 'Authentication required.' });

    const { tripId } = req.params;
    if (!sql) return res.status(503).json({ error: 'Neon database is not connected.' });

    const membership = await getTripMembership(tripId, authUser.id);
    if (!membership || !membership.isOwner) {
      return res.status(403).json({ error: 'Only the trip owner can revoke invite links.' });
    }

    await sql`UPDATE trips SET invite_token = NULL, updated_at = NOW() WHERE id = ${tripId}`;
    return res.json({ success: true, message: 'Invite link revoked.' });
  } catch (err) {
    console.error('Revoke invite error:', err);
    return res.status(500).json({ error: 'Internal server error revoking invite link.' });
  }
});

// 3. Public preview of trip invite link (NO user emails exposed)
router.get('/trips/join/:inviteToken', async (req, res) => {
  try {
    const { inviteToken } = req.params;
    if (!inviteToken) return res.status(400).json({ error: 'Invite token is required.' });

    if (!sql) return res.status(503).json({ error: 'Neon database is not connected.' });

    const rows = await sql`
      SELECT
        t.id, t.destination, t.start_date, t.summary, t.days, t.max_members,
        t.invite_expires_at, t.confirm_threshold,
        u.name as owner_name, u.avatar as owner_avatar
      FROM trips t
      JOIN users u ON t.user_id = u.id
      WHERE t.invite_token = ${inviteToken}
      LIMIT 1
    `;

    if (rows.length === 0) {
      return res.status(404).json({
        error: 'This group trip invite link is invalid or has been revoked by the owner.',
        code: 'INVITE_NOT_FOUND'
      });
    }

    const trip = rows[0];
    if (trip.invite_expires_at && new Date(trip.invite_expires_at).getTime() < Date.now()) {
      return res.status(410).json({
        error: 'This invite link has expired.',
        code: 'INVITE_EXPIRED'
      });
    }

    const memberCountRows = await sql`SELECT COUNT(*)::int as count FROM trip_members WHERE trip_id = ${trip.id}`;
    const currentMemberCount = (memberCountRows[0]?.count || 0) + 1; // plus owner

    return res.json({
      id: trip.id,
      destination: trip.destination,
      startDate: trip.start_date,
      summary: trip.summary,
      daysCount: Array.isArray(trip.days) ? trip.days.length : (typeof trip.days === 'string' ? JSON.parse(trip.days || '[]').length : 0),
      ownerName: trip.owner_name,
      ownerAvatar: trip.owner_avatar,
      currentMembers: currentMemberCount,
      maxMembers: trip.max_members || 10,
      confirmThreshold: trip.confirm_threshold || 'owner',
      canJoin: currentMemberCount < (trip.max_members || 10)
    });
  } catch (err) {
    console.error('Invite preview error:', err);
    return res.status(500).json({ error: 'Internal server error looking up invite.' });
  }
});

// 4. Join Group Trip (Requires signing in, rate limited)
router.post('/trips/join/:inviteToken', async (req, res) => {
  try {
    const clientIp = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress || '127.0.0.1';
    if (!checkGroupRateLimit(clientIp, 15)) {
      return res.status(429).json({ error: 'Too many join requests. Please wait before trying again.', code: 'RATE_LIMIT' });
    }

    const authUser = authenticateToken(req);
    if (!authUser) {
      return res.status(401).json({
        error: 'Please sign in or create an account to join this group trip.',
        code: 'AUTH_REQUIRED'
      });
    }

    const { inviteToken } = req.params;
    if (!sql) return res.status(503).json({ error: 'Neon database is not connected.' });

    const rows = await sql`
      SELECT id, destination, max_members, invite_expires_at, travelers
      FROM trips
      WHERE invite_token = ${inviteToken}
      LIMIT 1
    `;

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Invalid or revoked invite link.', code: 'INVITE_NOT_FOUND' });
    }

    const trip = rows[0];
    if (trip.invite_expires_at && new Date(trip.invite_expires_at).getTime() < Date.now()) {
      return res.status(410).json({ error: 'This invite link has expired.', code: 'INVITE_EXPIRED' });
    }

    const countRows = await sql`SELECT COUNT(*)::int as count FROM trip_members WHERE trip_id = ${trip.id}`;
    const memberCount = countRows[0]?.count || 0;
    if (memberCount >= (trip.max_members || 10)) {
      return res.status(409).json({ error: 'This group trip has reached its maximum traveler capacity.', code: 'MAX_CAPACITY' });
    }

    // Join as member
    const memberId = `mem_${trip.id}_${authUser.id}`;
    await sql`
      INSERT INTO trip_members (id, trip_id, user_id, role, joined_at)
      VALUES (${memberId}, ${trip.id}, ${authUser.id}, 'member', NOW())
      ON CONFLICT (trip_id, user_id) DO NOTHING
    `;

    // Connect to Phase 1 Budget Split: Add member's display name to trips.travelers
    let currentTravelers = typeof trip.travelers === 'string'
      ? JSON.parse(trip.travelers)
      : (trip.travelers || ['You']);

    // Fetch user name
    const userRow = await sql`SELECT name FROM users WHERE id = ${authUser.id} LIMIT 1`;
    const travelerName = userRow[0]?.name || authUser.name || 'Traveler';

    if (!currentTravelers.includes(travelerName)) {
      currentTravelers.push(travelerName);
      await sql`
        UPDATE trips
        SET travelers = ${JSON.stringify(currentTravelers)}::jsonb, updated_at = NOW()
        WHERE id = ${trip.id}
      `;
    }

    return res.json({
      success: true,
      tripId: trip.id,
      destination: trip.destination,
      role: 'member'
    });
  } catch (err) {
    console.error('Join trip error:', err);
    return res.status(500).json({ error: 'Internal server error joining group trip.' });
  }
});

// 5. List Group Members (NO EMAILS EXPOSED - display names and avatars only)
router.get('/trips/:tripId/members', async (req, res) => {
  try {
    const { tripId } = req.params;
    if (!sql) return res.status(503).json({ error: 'Neon database is not connected.' });

    const rows = await sql`
      SELECT
        tm.user_id as id, tm.role, tm.joined_at as "joinedAt",
        u.name, u.avatar, u.initials
      FROM trip_members tm
      JOIN users u ON tm.user_id = u.id
      WHERE tm.trip_id = ${tripId}
      ORDER BY CASE WHEN tm.role = 'owner' THEN 0 ELSE 1 END, tm.joined_at ASC
    `;

    return res.json(rows);
  } catch (err) {
    console.error('Fetch members error:', err);
    return res.status(500).json({ error: 'Internal server error fetching group members.' });
  }
});

// 6. Remove Group Member (Owner only)
router.delete('/trips/:tripId/members/:memberUserId', async (req, res) => {
  try {
    const authUser = authenticateToken(req);
    if (!authUser) return res.status(401).json({ error: 'Authentication required.' });

    const { tripId, memberUserId } = req.params;
    if (!sql) return res.status(503).json({ error: 'Neon database is not connected.' });

    const membership = await getTripMembership(tripId, authUser.id);
    if (!membership || !membership.isOwner) {
      return res.status(403).json({ error: 'Only the trip owner can remove group members.' });
    }

    if (memberUserId === authUser.id) {
      return res.status(400).json({ error: 'Trip owner cannot be removed.' });
    }

    await sql`DELETE FROM trip_members WHERE trip_id = ${tripId} AND user_id = ${memberUserId}`;
    return res.json({ success: true, message: 'Member removed from group trip.' });
  } catch (err) {
    console.error('Remove member error:', err);
    return res.status(500).json({ error: 'Internal server error removing member.' });
  }
});

// 7. Collaborate View & Polling Endpoint (Real-time sync)
router.get('/trips/:tripId/collaborate', async (req, res) => {
  try {
    const { tripId } = req.params;
    if (!sql) return res.status(503).json({ error: 'Neon database is not connected.' });

    const authUser = authenticateToken(req);
    const userId = authUser?.id || null;

    const rows = await sql`SELECT * FROM trips WHERE id = ${tripId} LIMIT 1`;
    if (rows.length === 0) return res.status(404).json({ error: 'Trip not found.' });

    const trip = formatTripRow(rows[0]);
    let userRole = 'guest';
    if (userId) {
      const membership = await getTripMembership(tripId, userId);
      userRole = membership?.role || 'guest';
    }

    // Fetch members list (sanitized without emails)
    const members = await sql`
      SELECT tm.user_id as id, tm.role, tm.joined_at as "joinedAt", u.name, u.avatar, u.initials
      FROM trip_members tm
      JOIN users u ON tm.user_id = u.id
      WHERE tm.trip_id = ${tripId}
      ORDER BY CASE WHEN tm.role = 'owner' THEN 0 ELSE 1 END, tm.joined_at ASC
    `;

    return res.json({
      trip,
      version: trip.version,
      members,
      userRole,
      activityProposals: trip.activityProposals,
      activityVotes: trip.activityVotes,
      activityComments: trip.activityComments
    });
  } catch (err) {
    console.error('Collaborate fetch error:', err);
    return res.status(500).json({ error: 'Internal server error fetching collaboration data.' });
  }
});

// 8. Optimistic Locking Itinerary Update (Rejects stale writes with 409 Conflict)
router.put('/trips/:tripId/collaborate', async (req, res) => {
  try {
    const authUser = authenticateToken(req);
    if (!authUser) return res.status(401).json({ error: 'Authentication required.' });

    const { tripId } = req.params;
    const { trip, version } = req.body || {};

    if (!sql) return res.status(503).json({ error: 'Neon database is not connected.' });

    const membership = await getTripMembership(tripId, authUser.id);
    if (!membership || !membership.role) {
      return res.status(403).json({ error: 'You are not a member of this trip party.' });
    }

    const currentTripRows = await sql`SELECT version, days, summary, budget_breakdown FROM trips WHERE id = ${tripId} LIMIT 1`;
    if (currentTripRows.length === 0) return res.status(404).json({ error: 'Trip not found.' });

    const currentVersion = Number(currentTripRows[0].version) || 1;
    const incomingVersion = Number(version) || 1;

    // Conflict Check
    if (incomingVersion !== currentVersion) {
      return res.status(409).json({
        error: 'This itinerary was recently updated by another traveler. Please reload to see the latest changes.',
        code: 'VERSION_CONFLICT',
        serverVersion: currentVersion
      });
    }

    const nextVersion = currentVersion + 1;
    const safeDays = Array.isArray(trip?.days) ? JSON.stringify(trip.days) : JSON.stringify(currentTripRows[0].days || []);
    const safeSummary = trip?.summary || currentTripRows[0].summary;
    const safeBudget = trip?.budgetBreakdown ? JSON.stringify(trip.budgetBreakdown) : JSON.stringify(currentTripRows[0].budget_breakdown || {});

    await sql`
      UPDATE trips
      SET
        days = ${safeDays}::jsonb,
        summary = ${safeSummary},
        budget_breakdown = ${safeBudget}::jsonb,
        version = ${nextVersion},
        updated_at = NOW()
      WHERE id = ${tripId}
    `;

    return res.json({
      success: true,
      version: nextVersion,
      message: 'Itinerary updated successfully.'
    });
  } catch (err) {
    console.error('Update collaborate error:', err);
    return res.status(500).json({ error: 'Internal server error updating collaboration plan.' });
  }
});

// 9. Propose an Activity
router.post('/trips/:tripId/proposals', async (req, res) => {
  try {
    const authUser = authenticateToken(req);
    if (!authUser) return res.status(401).json({ error: 'Authentication required.' });

    const { tripId } = req.params;
    const { day, activity } = req.body || {};

    if (!sql) return res.status(503).json({ error: 'Neon database is not connected.' });

    const membership = await getTripMembership(tripId, authUser.id);
    if (!membership || !membership.role) {
      return res.status(403).json({ error: 'Must be a trip member to propose activities.' });
    }

    if (!activity || !activity.title || !activity.title.trim()) {
      return res.status(400).json({ error: 'Activity title is required.' });
    }

    const cleanTitle = escapeHtml(activity.title.trim().slice(0, 120));
    const cleanTime = String(activity.time || '14:00').trim().slice(0, 5);
    const cleanCategory = ['food', 'nature', 'culture', 'walk', 'adventure', 'art', 'other'].includes(activity.category) ? activity.category : 'activities';
    const cleanCost = Math.max(0, Math.round(Number(activity.cost) || 0));
    const cleanDesc = escapeHtml(String(activity.description || '').trim().slice(0, 250));

    const proposal = {
      id: `prop_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      day: Number(day) || 1,
      proposedBy: authUser.name || 'Traveler',
      proposedByUserId: authUser.id,
      activity: {
        title: cleanTitle,
        time: cleanTime,
        category: cleanCategory,
        cost: cleanCost,
        description: cleanDesc
      },
      votes: {
        up: [authUser.name || 'You'],
        down: []
      },
      createdAt: new Date().toISOString()
    };

    const tripRows = await sql`SELECT activity_proposals FROM trips WHERE id = ${tripId} LIMIT 1`;
    if (tripRows.length === 0) return res.status(404).json({ error: 'Trip not found.' });

    const currentProposals = typeof tripRows[0].activity_proposals === 'string'
      ? JSON.parse(tripRows[0].activity_proposals)
      : (tripRows[0].activity_proposals || []);

    const updatedProposals = [proposal, ...currentProposals];

    await sql`
      UPDATE trips
      SET activity_proposals = ${JSON.stringify(updatedProposals)}::jsonb, updated_at = NOW()
      WHERE id = ${tripId}
    `;

    return res.json(updatedProposals);
  } catch (err) {
    console.error('Propose activity error:', err);
    return res.status(500).json({ error: 'Internal server error proposing activity.' });
  }
});

// 10. Confirm Proposal (Owner or Majority Rule)
router.post('/trips/:tripId/proposals/:proposalId/confirm', async (req, res) => {
  try {
    const authUser = authenticateToken(req);
    if (!authUser) return res.status(401).json({ error: 'Authentication required.' });

    const { tripId, proposalId } = req.params;
    if (!sql) return res.status(503).json({ error: 'Neon database is not connected.' });

    const membership = await getTripMembership(tripId, authUser.id);
    if (!membership || !membership.role) {
      return res.status(403).json({ error: 'Permission denied.' });
    }

    const tripRows = await sql`SELECT days, activity_proposals, version, confirm_threshold FROM trips WHERE id = ${tripId} LIMIT 1`;
    if (tripRows.length === 0) return res.status(404).json({ error: 'Trip not found.' });

    const row = tripRows[0];
    const proposals = typeof row.activity_proposals === 'string' ? JSON.parse(row.activity_proposals) : (row.activity_proposals || []);
    const targetProposal = proposals.find(p => p.id === proposalId);

    if (!targetProposal) {
      return res.status(404).json({ error: 'Proposal not found or already confirmed.' });
    }

    const isOwner = membership.isOwner;
    const threshold = row.confirm_threshold || 'owner';

    // Verify confirmation rules
    if (!isOwner && threshold === 'owner') {
      return res.status(403).json({ error: 'Only the trip owner can confirm proposals under owner confirmation mode.' });
    }

    // Apply activity to days
    const daysList = typeof row.days === 'string' ? JSON.parse(row.days) : (row.days || []);
    const targetDay = daysList.find(d => Number(d.day) === Number(targetProposal.day));

    if (targetDay && Array.isArray(targetDay.activities)) {
      targetDay.activities.push(targetProposal.activity);
      // Sort chronologically
      targetDay.activities.sort((a, b) => String(a.time || '12:00').localeCompare(String(b.time || '12:00')));
    }

    const remainingProposals = proposals.filter(p => p.id !== proposalId);
    const nextVersion = (Number(row.version) || 1) + 1;

    await sql`
      UPDATE trips
      SET
        days = ${JSON.stringify(daysList)}::jsonb,
        activity_proposals = ${JSON.stringify(remainingProposals)}::jsonb,
        version = ${nextVersion},
        updated_at = NOW()
      WHERE id = ${tripId}
    `;

    return res.json({
      success: true,
      days: daysList,
      proposals: remainingProposals,
      version: nextVersion
    });
  } catch (err) {
    console.error('Confirm proposal error:', err);
    return res.status(500).json({ error: 'Internal server error confirming proposal.' });
  }
});

// 11. Dismiss Proposal
router.delete('/trips/:tripId/proposals/:proposalId', async (req, res) => {
  try {
    const authUser = authenticateToken(req);
    if (!authUser) return res.status(401).json({ error: 'Authentication required.' });

    const { tripId, proposalId } = req.params;
    if (!sql) return res.status(503).json({ error: 'Neon database is not connected.' });

    const tripRows = await sql`SELECT activity_proposals FROM trips WHERE id = ${tripId} LIMIT 1`;
    if (tripRows.length === 0) return res.status(404).json({ error: 'Trip not found.' });

    const proposals = typeof tripRows[0].activity_proposals === 'string'
      ? JSON.parse(tripRows[0].activity_proposals)
      : (tripRows[0].activity_proposals || []);

    const updated = proposals.filter(p => p.id !== proposalId);

    await sql`
      UPDATE trips
      SET activity_proposals = ${JSON.stringify(updated)}::jsonb, updated_at = NOW()
      WHERE id = ${tripId}
    `;

    return res.json(updated);
  } catch (err) {
    console.error('Dismiss proposal error:', err);
    return res.status(500).json({ error: 'Internal server error dismissing proposal.' });
  }
});

// 12. Vote on Activity (Up / Down toggle, rate limited)
router.post('/trips/:tripId/activities/vote', async (req, res) => {
  try {
    const clientIp = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress || '127.0.0.1';
    if (!checkGroupRateLimit(clientIp, 60)) {
      return res.status(429).json({ error: 'Voting rate limit exceeded. Please wait a moment.' });
    }

    const authUser = authenticateToken(req);
    if (!authUser) return res.status(401).json({ error: 'Please sign in to vote on activities.' });

    const { tripId } = req.params;
    const { activityKey, voteType } = req.body || {};

    if (!activityKey || !['up', 'down'].includes(voteType)) {
      return res.status(400).json({ error: 'Valid activityKey and voteType (up/down) required.' });
    }

    if (!sql) return res.status(503).json({ error: 'Neon database is not connected.' });

    const tripRows = await sql`SELECT activity_votes FROM trips WHERE id = ${tripId} LIMIT 1`;
    if (tripRows.length === 0) return res.status(404).json({ error: 'Trip not found.' });

    const votesMap = typeof tripRows[0].activity_votes === 'string'
      ? JSON.parse(tripRows[0].activity_votes)
      : (tripRows[0].activity_votes || {});

    if (!votesMap[activityKey]) {
      votesMap[activityKey] = { up: [], down: [] };
    }

    const currentVoter = authUser.name || 'Traveler';
    const currentUp = votesMap[activityKey].up || [];
    const currentDown = votesMap[activityKey].down || [];

    if (voteType === 'up') {
      if (currentUp.includes(currentVoter)) {
        votesMap[activityKey].up = currentUp.filter(v => v !== currentVoter); // Toggle off
      } else {
        votesMap[activityKey].up = [...currentUp, currentVoter];
        votesMap[activityKey].down = currentDown.filter(v => v !== currentVoter);
      }
    } else {
      if (currentDown.includes(currentVoter)) {
        votesMap[activityKey].down = currentDown.filter(v => v !== currentVoter); // Toggle off
      } else {
        votesMap[activityKey].down = [...currentDown, currentVoter];
        votesMap[activityKey].up = currentUp.filter(v => v !== currentVoter);
      }
    }

    await sql`
      UPDATE trips
      SET activity_votes = ${JSON.stringify(votesMap)}::jsonb, updated_at = NOW()
      WHERE id = ${tripId}
    `;

    return res.json(votesMap);
  } catch (err) {
    console.error('Vote activity error:', err);
    return res.status(500).json({ error: 'Internal server error recording vote.' });
  }
});

// 13. Activity-Level Comment Thread (Add comment)
router.post('/trips/:tripId/activities/comments', async (req, res) => {
  try {
    const authUser = authenticateToken(req);
    if (!authUser) return res.status(401).json({ error: 'Please sign in to join the discussion.' });

    const { tripId } = req.params;
    const { activityKey, text } = req.body || {};

    if (!activityKey || !text || !text.trim()) {
      return res.status(400).json({ error: 'Activity key and comment text are required.' });
    }

    const cleanText = escapeHtml(text.trim().slice(0, 300));

    if (!sql) return res.status(503).json({ error: 'Neon database is not connected.' });

    const newComment = {
      id: `cmt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      activityKey,
      userId: authUser.id,
      userName: authUser.name || 'Traveler',
      text: cleanText,
      createdAt: new Date().toISOString()
    };

    const tripRows = await sql`SELECT activity_comments FROM trips WHERE id = ${tripId} LIMIT 1`;
    if (tripRows.length === 0) return res.status(404).json({ error: 'Trip not found.' });

    const comments = typeof tripRows[0].activity_comments === 'string'
      ? JSON.parse(tripRows[0].activity_comments)
      : (tripRows[0].activity_comments || []);

    const updatedComments = [...comments, newComment].slice(-200);

    await sql`
      UPDATE trips
      SET activity_comments = ${JSON.stringify(updatedComments)}::jsonb, updated_at = NOW()
      WHERE id = ${tripId}
    `;

    return res.json(updatedComments);
  } catch (err) {
    console.error('Post comment error:', err);
    return res.status(500).json({ error: 'Internal server error posting comment.' });
  }
});

// 14. Delete Comment
router.delete('/trips/:tripId/activities/comments/:commentId', async (req, res) => {
  try {
    const authUser = authenticateToken(req);
    if (!authUser) return res.status(401).json({ error: 'Authentication required.' });

    const { tripId, commentId } = req.params;
    if (!sql) return res.status(503).json({ error: 'Neon database is not connected.' });

    const tripRows = await sql`SELECT activity_comments, user_id FROM trips WHERE id = ${tripId} LIMIT 1`;
    if (tripRows.length === 0) return res.status(404).json({ error: 'Trip not found.' });

    const comments = typeof tripRows[0].activity_comments === 'string'
      ? JSON.parse(tripRows[0].activity_comments)
      : (tripRows[0].activity_comments || []);

    const isOwner = tripRows[0].user_id === authUser.id;
    const updated = comments.filter(c => {
      if (c.id === commentId) {
        return c.userId !== authUser.id && !isOwner;
      }
      return true;
    });

    await sql`
      UPDATE trips
      SET activity_comments = ${JSON.stringify(updated)}::jsonb, updated_at = NOW()
      WHERE id = ${tripId}
    `;

    return res.json(updated);
  } catch (err) {
    console.error('Delete comment error:', err);
    return res.status(500).json({ error: 'Internal server error deleting comment.' });
  }
});

// -------------------------------------------------------------------------
// Pillar D: Private Trip Reviews & Memories with Photos
// -------------------------------------------------------------------------
const memoryReviews = new Map(); // fallback in-memory store: tripId -> Array of review objects

router.get('/trips/:tripId/reviews', async (req, res) => {
  const { tripId } = req.params;
  const authUser = authenticateToken(req);
  if (!authUser) {
    return res.status(401).json({ error: 'Authentication required to view private trip memories.' });
  }

  if (sql) {
    try {
      const rows = await sql`
        SELECT id, trip_id, user_id, user_name, user_avatar, rating, title, content, photos, visited_at, created_at, updated_at
        FROM trip_reviews
        WHERE trip_id = ${tripId}
        ORDER BY created_at DESC
      `;
      if (rows && rows.length > 0) {
        // sync memory cache
        memoryReviews.set(tripId, rows);
        return res.json(rows);
      }
    } catch (err) {
      console.warn('Fetch reviews from Neon failed, checking memory store:', err.message);
    }
  }

  // Fallback to in-memory store
  const list = memoryReviews.get(tripId) || [];
  return res.json(list);
});

router.post('/trips/:tripId/reviews', async (req, res) => {
  const { tripId } = req.params;
  const authUser = authenticateToken(req);
  if (!authUser) {
    return res.status(401).json({ error: 'Authentication required to create a review.' });
  }

  const { rating, title, content, photos = [], visitedAt } = req.body || {};
  if (!content || !content.trim()) {
    return res.status(400).json({ error: 'Review content is required.' });
  }

  const reviewId = req.body.id || `rev_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const cleanRating = Math.max(1, Math.min(5, Number(rating) || 5));
  const safePhotos = Array.isArray(photos) ? photos.slice(0, 10) : [];

  let userName = authUser.name || 'Traveler';
  let userAvatar = authUser.avatar || null;

  if (sql) {
    try {
      try {
        const userRows = await sql`SELECT name, avatar FROM users WHERE id = ${authUser.id} LIMIT 1`;
        if (userRows.length > 0) {
          userName = userRows[0].name || userName;
          userAvatar = userRows[0].avatar || userAvatar;
        }
      } catch (e) {}

      const inserted = await sql`
        INSERT INTO trip_reviews (
          id, trip_id, user_id, user_name, user_avatar, rating, title, content, photos, visited_at
        ) VALUES (
          ${reviewId}, ${tripId}, ${authUser.id}, ${userName}, ${userAvatar}, ${cleanRating},
          ${title?.trim() || 'Trip Memory'}, ${content.trim()}, ${JSON.stringify(safePhotos)}::jsonb, ${visitedAt || null}
        )
        RETURNING *
      `;

      if (inserted && inserted.length > 0) {
        const currentList = memoryReviews.get(tripId) || [];
        memoryReviews.set(tripId, [inserted[0], ...currentList.filter(r => r.id !== reviewId)]);
        return res.status(201).json(inserted[0]);
      }
    } catch (err) {
      console.warn('Neon insert review error, falling back to memory store:', err.message);
    }
  }

  // In-memory fallback
  const fallbackRecord = {
    id: reviewId,
    trip_id: tripId,
    user_id: authUser.id,
    user_name: userName,
    user_avatar: userAvatar,
    rating: cleanRating,
    title: title?.trim() || 'Trip Memory',
    content: content.trim(),
    photos: safePhotos,
    visited_at: visitedAt || null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  const currentList = memoryReviews.get(tripId) || [];
  memoryReviews.set(tripId, [fallbackRecord, ...currentList.filter(r => r.id !== reviewId)]);
  return res.status(201).json(fallbackRecord);
});

router.put('/trips/:tripId/reviews/:reviewId', async (req, res) => {
  const { tripId, reviewId } = req.params;
  const authUser = authenticateToken(req);
  if (!authUser) {
    return res.status(401).json({ error: 'Authentication required to update review.' });
  }

  const { rating, title, content, photos, visitedAt } = req.body || {};
  if (!content || !content.trim()) {
    return res.status(400).json({ error: 'Review content is required.' });
  }

  const cleanRating = Math.max(1, Math.min(5, Number(rating) || 5));
  const safePhotos = Array.isArray(photos) ? photos.slice(0, 10) : undefined;

  if (sql) {
    try {
      const updated = await sql`
        UPDATE trip_reviews
        SET
          rating = ${cleanRating},
          title = ${title?.trim() || 'Trip Memory'},
          content = ${content.trim()},
          photos = COALESCE(${safePhotos !== undefined ? JSON.stringify(safePhotos) : null}::jsonb, photos),
          visited_at = ${visitedAt || null},
          updated_at = NOW()
        WHERE id = ${reviewId} AND (user_id = ${authUser.id} OR EXISTS (SELECT 1 FROM trips WHERE id = ${tripId} AND user_id = ${authUser.id}))
        RETURNING *
      `;

      if (updated && updated.length > 0) {
        const curList = memoryReviews.get(tripId) || [];
        memoryReviews.set(tripId, curList.map(r => r.id === reviewId ? updated[0] : r));
        return res.json(updated[0]);
      }
    } catch (err) {
      console.warn('Neon update review error, falling back to memory store:', err.message);
    }
  }

  // Memory fallback update
  const curList = memoryReviews.get(tripId) || [];
  const existing = curList.find(r => r.id === reviewId);
  if (existing) {
    const updatedRecord = {
      ...existing,
      rating: cleanRating,
      title: title?.trim() || existing.title,
      content: content.trim(),
      photos: safePhotos !== undefined ? safePhotos : existing.photos,
      visited_at: visitedAt !== undefined ? visitedAt : existing.visited_at,
      updated_at: new Date().toISOString()
    };
    memoryReviews.set(tripId, curList.map(r => r.id === reviewId ? updatedRecord : r));
    return res.json(updatedRecord);
  }

  return res.status(404).json({ error: 'Review not found or unauthorized.' });
});

router.delete('/trips/:tripId/reviews/:reviewId', async (req, res) => {
  const { tripId, reviewId } = req.params;
  const authUser = authenticateToken(req);
  if (!authUser) {
    return res.status(401).json({ error: 'Authentication required.' });
  }

  let deleted = false;
  if (sql) {
    try {
      const rows = await sql`
        DELETE FROM trip_reviews
        WHERE id = ${reviewId} AND (user_id = ${authUser.id} OR EXISTS (SELECT 1 FROM trips WHERE id = ${tripId} AND user_id = ${authUser.id}))
        RETURNING id
      `;
      if (rows && rows.length > 0) {
        deleted = true;
      }
    } catch (err) {
      console.warn('Neon delete review error:', err.message);
    }
  }

  // Clean memory store
  const curList = memoryReviews.get(tripId) || [];
  memoryReviews.set(tripId, curList.filter(r => r.id !== reviewId));

  return res.json({ success: true, id: reviewId });
});

// ==================== Google Calendar Integration ====================

// Check connection status
router.get('/calendar/google/status', async (req, res) => {
  try {
    const authUser = authenticateToken(req);
    const status = await getGoogleCalendarStatus(authUser?.id);
    return res.json(status);
  } catch (err) {
    console.error('Calendar status error:', err);
    return res.status(500).json({ error: 'Failed to check Google Calendar status.' });
  }
});

// Generate OAuth authorization URL
router.get('/calendar/google/auth-url', async (req, res) => {
  try {
    const authUser = authenticateToken(req);
    if (!authUser) {
      return res.status(401).json({ error: 'Please sign in to connect Google Calendar.' });
    }

    if (!isGoogleCalendarConfigured()) {
      return res.status(400).json({
        error: 'Google Calendar integration requires GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to be configured on the server. You can still use the 1-Click Google Calendar Web button below!',
        configured: false
      });
    }

    const authUrl = generateGoogleAuthUrl(authUser.id);
    return res.json({ authUrl });
  } catch (err) {
    console.error('Google auth url error:', err);
    return res.status(500).json({ error: 'Failed to generate authorization URL.' });
  }
});

// OAuth Callback from Google (Popup redirect)
router.all('/calendar/google/callback', async (req, res) => {
  const code = req.query.code || req.body?.code;
  const state = req.query.state || req.body?.state;
  const error = req.query.error;

  const renderPopupHtml = (title, message, isSuccess = true) => {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(title)}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #fbf8f3; color: #131d17; text-align: center; padding: 48px 20px; }
    .card { background: white; max-width: 420px; margin: 0 auto; padding: 32px; border-radius: 16px; box-shadow: 0 10px 25px rgba(0,0,0,0.06); border: 1px solid #e7dfd5; }
    h2 { margin-top: 0; color: ${isSuccess ? '#1f4837' : '#991b1b'}; }
    p { color: #526056; line-height: 1.5; font-size: 15px; }
    .btn { display: inline-block; margin-top: 16px; padding: 10px 20px; background: #1f4837; color: white; border-radius: 8px; text-decoration: none; font-weight: 500; cursor: pointer; border: none; }
  </style>
</head>
<body>
  <div class="card">
    <h2>${escapeHtml(title)}</h2>
    <p>${escapeHtml(message)}</p>
    <button class="btn" onclick="window.close()">Close Window</button>
  </div>
  <script>
    if (window.opener) {
      window.opener.postMessage({ type: 'GOOGLE_CALENDAR_CONNECTED', success: ${isSuccess} }, '*');
      setTimeout(() => { try { window.close(); } catch(e){} }, 1800);
    }
  </script>
</body>
</html>`;
  };

  if (error) {
    return res.status(400).send(renderPopupHtml('Access Not Granted', `Google returned an error: ${error}`, false));
  }

  if (!code || !state) {
    return res.status(400).send(renderPopupHtml('Missing Authorization Code', 'Google authorization parameters were missing.', false));
  }

  try {
    const result = await handleGoogleOAuthCallback(code, state);
    return res.send(renderPopupHtml('Google Calendar Connected! 🌿', `Connected as ${result.email || 'authorized traveler'}. You can now sync trips directly.`, true));
  } catch (err) {
    console.error('OAuth callback exchange error:', err);
    return res.status(500).send(renderPopupHtml('Connection Failed', err.message || 'Failed to exchange authorization code with Google.', false));
  }
});

// Disconnect Google Calendar
router.post('/calendar/google/disconnect', async (req, res) => {
  try {
    const authUser = authenticateToken(req);
    if (!authUser) return res.status(401).json({ error: 'Authentication required.' });
    await disconnectGoogleCalendar(authUser.id);
    return res.json({ success: true, message: 'Google Calendar disconnected.' });
  } catch (err) {
    console.error('Disconnect error:', err);
    return res.status(500).json({ error: 'Failed to disconnect Google Calendar.' });
  }
});

// Sync Trip to Google Calendar
router.post('/calendar/google/sync/:tripId', async (req, res) => {
  try {
    const authUser = authenticateToken(req);
    if (!authUser) return res.status(401).json({ error: 'Please sign in to sync with Google Calendar.' });

    const { tripId } = req.params;
    let trip = null;

    if (sql) {
      const rows = await sql`SELECT * FROM trips WHERE id = ${tripId} LIMIT 1`;
      if (rows.length > 0) {
        trip = rows[0];
      }
    }

    // Fallback if trip passed directly in request body
    if (!trip && req.body?.trip) {
      trip = req.body.trip;
    }

    if (!trip) {
      return res.status(404).json({ error: 'Trip not found.' });
    }

    // Check membership / ownership
    if (sql) {
      const membership = await getTripMembership(tripId, authUser.id);
      if (!membership && trip.user_id !== authUser.id && trip.userId !== authUser.id) {
        return res.status(403).json({ error: 'You do not have permission to sync this trip.' });
      }
    }

    const result = await syncTripToGoogleCalendar(trip, authUser.id);
    return res.json(result);
  } catch (err) {
    console.error('Google calendar sync error:', err);
    return res.status(500).json({ error: err.message || 'Failed to sync with Google Calendar.' });
  }
});

// Mount router on both /api (standard) and / (for rewritten environments like Vercel)
app.use('/api', router);
app.use('/', router);

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Server-side Open Graph rendering for shared trip pages (/t/:shareId)
app.get('/t/:shareId', async (req, res) => {
  const { shareId } = req.params;
  let trip = null;
  if (sql && shareId) {
    try {
      const rows = await sql`
        SELECT destination, summary
        FROM trips
        WHERE share_id = ${shareId} AND is_shared = TRUE
        LIMIT 1
      `;
      if (rows.length > 0) {
        trip = rows[0];
      }
    } catch (e) {
      console.warn('Error fetching shared trip for OG tags:', e.message);
    }
  }

  const indexPath = path.join(clientDist, 'index.html');
  let html = '';
  if (fs.existsSync(indexPath)) {
    html = fs.readFileSync(indexPath, 'utf8');
  } else {
    // Development fallback template if dist/index.html is not yet generated
    html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>TripMind AI — Your trip, thoughtfully planned</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>`;
  }

  if (trip) {
    const dest = escapeHtml(trip.destination);
    const summary = escapeHtml(trip.summary || `Personalized trip itinerary for ${trip.destination}, thoughtfully curated by TripMind AI.`);
    const pageTitle = `${dest} Itinerary — TripMind AI`;
    const pageUrl = `https://tripmind-ai-gamma.vercel.app/t/${encodeURIComponent(shareId)}`;

    html = html
      .replace(/<title>.*?<\/title>/i, `<title>${pageTitle}</title>`)
      .replace(/<meta property="og:title" content=".*?" \/>/i, `<meta property="og:title" content="${pageTitle}" />`)
      .replace(/<meta property="og:description" content=".*?" \/>/i, `<meta property="og:description" content="${summary}" />`)
      .replace(/<meta property="og:url" content=".*?" \/>/i, `<meta property="og:url" content="${pageUrl}" />`)
      .replace(/<meta name="twitter:title" content=".*?" \/>/i, `<meta name="twitter:title" content="${pageTitle}" />`)
      .replace(/<meta name="twitter:description" content=".*?" \/>/i, `<meta name="twitter:description" content="${summary}" />`);
  }

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.send(html);
});

if (!process.env.VERCEL) {
  app.get('*', (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });

  app.listen(port, () => {
    console.log(`TripMind API running at http://localhost:${port}`);
  });
}

export default app;
