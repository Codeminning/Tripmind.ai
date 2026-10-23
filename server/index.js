import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { GoogleGenAI } from '@google/genai';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const app = express();
const port = process.env.PORT || 3001;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientDist = path.resolve(__dirname, '..', 'dist');

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
    models: CANDIDATE_MODELS,
    timestamp: new Date().toISOString()
  });
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
