import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { GoogleGenAI } from '@google/genai';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { sql, initDb } from './db.js';

const app = express();
const port = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'tripmind_secret_jwt_key_2026_zen';
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
app.use(express.json());
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

function generateCuratedFallback({ destination, startDate, days, budget, travelers, interests }) {
  const tripDays = Number(days) || 3;
  const numTravelers = Number(travelers) || 1;
  const budgetMultiplier = budget === 'Budget-friendly' ? 45 : budget === 'Treat yourself' ? 220 : 105;
  const totalBudget = budgetMultiplier * tripDays * numTravelers;

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
    daysList.push({
      day: i,
      title: titles[(i - 1) % titles.length],
      activities: [
        { ...sampleActivities[0], time: '09:00' },
        { ...sampleActivities[(i % 4) + 1], time: '11:30' },
        { ...sampleActivities[2], time: '14:00' },
        { ...sampleActivities[((i + 2) % 4) + 1], time: '17:00' }
      ]
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

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    aiConfigured: Boolean(ai),
    databaseConfigured: Boolean(sql),
    models: CANDIDATE_MODELS,
    timestamp: new Date().toISOString()
  });
});

// Helper to format trip rows from Neon DB
function formatTripRow(row) {
  return {
    id: row.id,
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
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

// ---------------- Neon Auth Endpoints ----------------
app.post('/api/auth/register', async (req, res) => {
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
    const avatar = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(cleanName)}&backgroundColor=244a3a&textColor=ffffff`;
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

app.post('/api/auth/login', async (req, res) => {
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

app.post('/api/auth/google', async (req, res) => {
  try {
    const { name, email, avatar, initials } = req.body || {};
    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanName = (name || 'Explorer').trim();

    if (!cleanEmail) {
      return res.status(400).json({ error: 'Email is required for Google login.' });
    }

    if (!sql) {
      return res.status(503).json({ error: 'Neon database is not connected.' });
    }

    let rows = await sql`SELECT * FROM users WHERE email = ${cleanEmail} LIMIT 1`;
    let user;

    if (rows.length === 0) {
      const userId = `user_google_${Date.now()}`;
      const userInitials = initials || cleanName.slice(0, 2).toUpperCase();
      const userAvatar = avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(cleanName)}&backgroundColor=244a3a&textColor=ffffff`;
      const dummyHash = await bcrypt.hash(`oauth_${Date.now()}`, 10);

      await sql`
        INSERT INTO users (
          id, name, email, password_hash, avatar, initials, travel_vibe, default_budget, default_travelers, favorite_interests, auth_provider
        ) VALUES (
          ${userId}, ${cleanName}, ${cleanEmail}, ${dummyHash}, ${userAvatar}, ${userInitials}, 'Food & Culinary Explorer', 'Mid-range', 2, ${['Food & cafés', 'Culture & heritage']}, 'google'
        )
      `;
      const created = await sql`SELECT * FROM users WHERE id = ${userId} LIMIT 1`;
      user = created[0];
    } else {
      user = rows[0];
    }

    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '30d' });
    const session = {
      id: user.id,
      name: user.name,
      email: user.email,
      avatar: user.avatar,
      initials: user.initials,
      travelVibe: user.travel_vibe || 'Food & Culinary Explorer',
      defaultBudget: user.default_budget || 'Mid-range',
      defaultTravelers: user.default_travelers || 2,
      favoriteInterests: user.favorite_interests || ['Food & cafés'],
      authProvider: 'google',
      token,
      loggedInAt: new Date().toISOString()
    };

    return res.json({ user: session, token });
  } catch (err) {
    console.error('Google auth error:', err);
    return res.status(500).json({ error: 'Internal server error during Google auth.' });
  }
});

app.put('/api/auth/profile', async (req, res) => {
  try {
    const { userId, name, travelVibe, defaultBudget, defaultTravelers, favoriteInterests, avatar } = req.body || {};
    if (!userId) return res.status(400).json({ error: 'User ID is required.' });

    if (!sql) return res.status(503).json({ error: 'Neon database is not connected.' });

    await sql`
      UPDATE users
      SET
        name = COALESCE(${name}, name),
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

// ---------------- Neon Trips Endpoints ----------------
app.get('/api/trips/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    if (!userId) return res.status(400).json({ error: 'User ID is required.' });

    if (!sql) return res.status(503).json({ error: 'Neon database is not connected.' });

    const rows = await sql`SELECT * FROM trips WHERE user_id = ${userId} ORDER BY created_at DESC`;
    const formatted = rows.map(formatTripRow);
    return res.json(formatted);
  } catch (err) {
    console.error('Fetch trips error:', err);
    return res.status(500).json({ error: 'Internal server error fetching trips.' });
  }
});

app.post('/api/trips', async (req, res) => {
  try {
    const { userId, trip } = req.body || {};
    if (!userId || !trip) return res.status(400).json({ error: 'User ID and trip data are required.' });

    if (!sql) return res.status(503).json({ error: 'Neon database is not connected.' });

    const tripId = trip.id || `trip_${Date.now()}`;
    const savedAt = trip.savedAt || new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

    await sql`
      INSERT INTO trips (
        id, user_id, destination, start_date, status, summary, travel_tip, best_time_to_visit,
        budget_breakdown, days, form_snapshot, itinerary_data, saved_at, updated_at
      ) VALUES (
        ${tripId}, ${userId}, ${trip.destination}, ${trip.startDate || ''}, ${trip.status || 'Upcoming'},
        ${trip.summary || ''}, ${trip.travelTip || ''}, ${trip.bestTimeToVisit || ''},
        ${JSON.stringify(trip.budgetBreakdown || {})}, ${JSON.stringify(trip.days || [])},
        ${JSON.stringify(trip.formSnapshot || {})}, ${JSON.stringify(trip)}, ${savedAt}, NOW()
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
        updated_at = NOW()
    `;

    // Return updated trips list
    const rows = await sql`SELECT * FROM trips WHERE user_id = ${userId} ORDER BY created_at DESC`;
    const formatted = rows.map(formatTripRow);
    return res.json(formatted);
  } catch (err) {
    console.error('Save trip error:', err);
    return res.status(500).json({ error: 'Internal server error saving trip.' });
  }
});

app.delete('/api/trips/:userId/:tripId', async (req, res) => {
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


app.post('/api/itinerary', async (req, res) => {
  const { destination, startDate, days, budget, travelers, interests } = req.body || {};

  if (!destination || typeof destination !== 'string' || !destination.trim()) {
    return res.status(400).json({ error: 'Please enter a valid destination.' });
  }

  const tripDays = Number(days);
  if (!Number.isInteger(tripDays) || tripDays < 1 || tripDays > 14) {
    return res.status(400).json({
      error: 'Trip duration must be between 1 and 14 days.',
    });
  }

  const cleanInterests = Array.isArray(interests) && interests.length > 0 
    ? interests.join(', ') 
    : 'Food, culture, picturesque walks, local spots';

  // If no AI key configured, use curated generator
  if (!ai) {
    console.log('AI not configured; using curated smart fallback.');
    const fallback = generateCuratedFallback({ destination, startDate, days: tripDays, budget, travelers, interests });
    return res.json(fallback);
  }

  const prompt = `
You are an expert travel concierges creating a curated, unforgettable trip itinerary.
Destination: ${destination}
Start date: ${startDate || 'Flexible'}
Duration: ${tripDays} days
Budget level: ${budget || 'Mid-range'}
Number of travelers: ${travelers || 1}
Traveler interests: ${cleanInterests}

Generate a rich, detailed, and realistic JSON itinerary with this exact structure:
{
  "destination": "${destination}",
  "summary": "Compelling 2-3 sentence overview highlighting the essence of this trip.",
  "travelTip": "1 practical insider tip for ${destination} (e.g. transit, payment, etiquette).",
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
          "location": "Neighborhood or district"
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
- Provide real, authentic spots and neighborhoods in ${destination}.
- Output ONLY valid JSON.
`;

  let lastError = null;

  for (const modelName of CANDIDATE_MODELS) {
    try {
      console.log(`Generating itinerary with model ${modelName}...`);
      const response = await ai.models.generateContent({
        model: modelName,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          temperature: 0.7,
        },
      });

      const parsed = sanitizeJson(response.text);

      if (parsed && Array.isArray(parsed.days) && parsed.days.length > 0) {
        // Ensure day count matches requested tripDays
        if (parsed.days.length !== tripDays) {
          // If the model returned slightly different day count, pad or slice
          if (parsed.days.length > tripDays) {
            parsed.days = parsed.days.slice(0, tripDays);
          } else {
            const fallbackObj = generateCuratedFallback({ destination, startDate, days: tripDays, budget, travelers, interests });
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

        // Add model badge
        parsed.generatedBy = modelName;
        console.log(`Successfully generated itinerary with ${modelName}!`);
        return res.json(parsed);
      } else {
        console.warn(`Model ${modelName} returned unparseable or empty days structure. Trying next model...`);
      }
    } catch (err) {
      console.warn(`Error generating with model ${modelName}:`, err.message);
      lastError = err;
      // If error is high demand / 503 / 404, loop continues to next model
    }
  }

  // If all Gemini models failed, fallback gracefully so user has a working itinerary
  console.log('Gemini models unavailable, returning high quality curated fallback.');
  const safeFallback = generateCuratedFallback({ destination, startDate, days: tripDays, budget, travelers, interests });
  safeFallback.note = 'Generated via TripMind smart planner (AI service temporarily high demand).';
  return res.json(safeFallback);
});

app.get('*', (_req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'));
});

if (!process.env.VERCEL) {
  app.listen(port, () => {
    console.log(`TripMind API running at http://localhost:${port}`);
  });
}

export default app;
