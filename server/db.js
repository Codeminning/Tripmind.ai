import 'dotenv/config';
import { neon } from '@neondatabase/serverless';
import bcrypt from 'bcryptjs';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.warn('⚠️ DATABASE_URL is not set. Database features will be unavailable.');
}

export const sql = connectionString ? neon(connectionString) : null;

// Initial Seed Users for Demo & Testing
const SEED_USERS = [
  {
    id: 'user_sophia',
    name: 'Sophia Chen',
    email: 'sophia@tripmind.ai',
    password: 'explorer123',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80',
    initials: 'SC',
    travelVibe: 'Slow & Cultural Wanderer',
    defaultBudget: 'Mid-range',
    defaultTravelers: 2,
    favoriteInterests: ['Food & cafés', 'Culture & heritage', 'Slow travel']
  },
  {
    id: 'user_liam',
    name: 'Liam Vance',
    email: 'liam@tripmind.ai',
    password: 'wanderer123',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=300&q=80',
    initials: 'LV',
    travelVibe: 'Gastronomy & Hidden Gems',
    defaultBudget: 'Treat yourself',
    defaultTravelers: 1,
    favoriteInterests: ['Food & cafés', 'Art & design', 'Hidden gems']
  }
];

const SOPHIA_SEED_TRIPS = [
  {
    id: 'trip_sophia_kyoto',
    destination: 'Kyoto, Japan',
    startDate: '2026-11-12',
    savedAt: 'Oct 18, 2026',
    status: 'Upcoming',
    summary: 'A serene 4-day autumn journey through tranquil bamboo groves, early-morning Zen temples, and hidden machiya cafés.',
    travelTip: 'Walk the philosopher’s path before 08:30 AM to catch the morning mist without any tour groups.',
    bestTimeToVisit: 'November for vibrant maple foliage and crisp morning breezes.',
    budgetBreakdown: {
      totalEstimatedUsd: 1100,
      dailyPerPersonUsd: 137,
      categories: { accommodation: 462, dining: 352, activities: 176, transit: 110 }
    },
    days: [
      {
        day: 1,
        title: 'Arashiyama Bamboo & Secret Zen Courtyards',
        activities: [
          { time: '08:30', title: 'Morning artisan matcha & pastry at Tenryu-ji approach', category: 'food', cost: 12, description: 'Single-origin green tea whisked tableside with chestnut wagashi.' },
          { time: '10:30', title: 'Okochi Sanso Villa gardens & panoramic valley overlook', category: 'walk', cost: 10, description: 'Quiet hillside gardens with tea pavilions away from the crowded riverbank.' },
          { time: '13:00', title: 'Handmade soba noodles in a 120-year-old wooden teahouse', category: 'food', cost: 22, description: 'Fresh buckwheat soba with local mountain vegetables.' },
          { time: '16:00', title: 'Saga-Toriimoto preserved preservation district walk', category: 'culture', cost: 0, description: 'Thatched-roof merchant cottages and stone statues lined with lanterns.' }
        ]
      },
      {
        day: 2,
        title: 'Historic Gion Alleys & Evening Lantern Strolls',
        activities: [
          { time: '09:00', title: 'Quiet morning walk through Shirakawa canal', category: 'walk', cost: 0, description: 'Willovers drooping over traditional canal bridges before shops open.' },
          { time: '11:00', title: 'Kennin-ji temple twin dragon ceiling & rock garden', category: 'culture', cost: 14, description: 'Oldest Zen temple in Kyoto, featuring dramatic twin dragon ink artwork.' },
          { time: '14:00', title: 'Obanzai multi-dish lunch in Pontocho', category: 'food', cost: 28, description: 'Traditional seasonal Kyoto home cooking served in handmade pottery.' },
          { time: '17:30', title: 'Golden hour at Kiyomizu-dera wooden stage', category: 'culture', cost: 8, description: 'Overlooking Kyoto valley as paper lanterns begin to illuminate.' }
        ]
      }
    ],
    formSnapshot: {
      destination: 'Kyoto, Japan',
      startDate: '2026-11-12',
      days: '4',
      budget: 'Mid-range',
      travelers: 2,
      interests: ['Food & cafés', 'Culture & heritage', 'Slow travel']
    }
  },
  {
    id: 'trip_sophia_amalfi',
    destination: 'Amalfi Coast, Italy',
    startDate: '2027-05-18',
    savedAt: 'Oct 22, 2026',
    status: 'Dream Wishlist',
    summary: 'Cliffside coastal dream across pastel villages, fragrant lemon groves, and quiet sea-view terraces.',
    travelTip: 'Take the local ferry between Positano and Amalfi for the most breathtaking views from the water.',
    bestTimeToVisit: 'May to June for warm swimming weather before peak summer crowds.',
    budgetBreakdown: {
      totalEstimatedUsd: 1850,
      dailyPerPersonUsd: 230,
      categories: { accommodation: 777, dining: 592, activities: 296, transit: 185 }
    },
    days: [
      {
        day: 1,
        title: 'Ravello Heights & Villa Cimbrone Vistas',
        activities: [
          { time: '09:30', title: 'Espresso & warm sfogliatella on Piazza Vescovado', category: 'food', cost: 8, description: 'Crisp pastry layered with sweet ricotta and candied citrus zest.' },
          { time: '11:00', title: 'Villa Cimbrone infinity terrace walk', category: 'walk', cost: 12, description: 'Panoramic cliffside view known as the Terrace of Infinity.' },
          { time: '14:00', title: 'Seafood paccheri lunch overlooking the Mediterranean', category: 'food', cost: 38, description: 'Fresh catch of the day cooked with cherry tomatoes and white wine.' }
        ]
      }
    ],
    formSnapshot: {
      destination: 'Amalfi Coast, Italy',
      startDate: '2027-05-18',
      days: '4',
      budget: 'Treat yourself',
      travelers: 2,
      interests: ['Food & cafés', 'Nature & outdoors', 'Slow travel']
    }
  }
];

const LIAM_SEED_TRIPS = [
  {
    id: 'trip_liam_oaxaca',
    destination: 'Oaxaca, Mexico',
    startDate: '2026-12-05',
    savedAt: 'Oct 20, 2026',
    status: 'Upcoming',
    summary: 'A 4-day culinary and artisan odyssey uncovering rich moles, family-owned mezcalerias, and vibrant indigenous craft markets.',
    travelTip: 'Visit the morning food market Mercado 20 de Noviembre hungry for tlayudas and hot chocolate with pan de yema.',
    bestTimeToVisit: 'October through March for clear sunny skies and festival season.',
    budgetBreakdown: {
      totalEstimatedUsd: 740,
      dailyPerPersonUsd: 92,
      categories: { accommodation: 310, dining: 236, activities: 118, transit: 74 }
    },
    days: [
      {
        day: 1,
        title: 'Historic Center, Smoky Markets & Artisan Mezcal',
        activities: [
          { time: '09:00', title: 'Hot chocolate & pan de yema at Mercado 20 de Noviembre', category: 'food', cost: 6, description: 'Frothy artisanal cinnamon chocolate prepared in clay pots.' },
          { time: '11:00', title: 'Santo Domingo church & ethnobotanical garden stroll', category: 'culture', cost: 12, description: 'Stunning cacti collection and baroque gold-leaf church interior.' },
          { time: '14:00', title: 'Black mole tasting & handcrafted tortillas lunch', category: 'food', cost: 18, description: 'Complex 30-ingredient mole negro simmered for over 12 hours.' },
          { time: '18:00', title: 'Evening mezcal tasting flights in a candlelit courtyard', category: 'food', cost: 24, description: 'Wild agave varieties paired with spiced orange slices and sal de gusano.' }
        ]
      }
    ],
    formSnapshot: {
      destination: 'Oaxaca, Mexico',
      startDate: '2026-12-05',
      days: '4',
      budget: 'Budget-friendly',
      travelers: 1,
      interests: ['Food & cafés', 'Culture & heritage', 'Art & design']
    }
  }
];

export async function initDb() {
  if (!sql) {
    console.warn('⚡ Skipping Neon DB initialization: No DATABASE_URL provided.');
    return false;
  }

  try {
    console.log('🔄 Initializing Neon Postgres schema...');

    // 1. Users Table
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(64) PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        avatar TEXT,
        initials VARCHAR(4),
        travel_vibe VARCHAR(100),
        default_budget VARCHAR(50),
        default_travelers INT DEFAULT 1,
        favorite_interests TEXT[],
        auth_provider VARCHAR(50) DEFAULT 'email',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `;

    // Ensure all columns exist even if table was created previously without them
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS initials VARCHAR(4);`;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS travel_vibe VARCHAR(100);`;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS default_budget VARCHAR(50);`;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS default_travelers INT DEFAULT 1;`;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS favorite_interests TEXT[];`;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_provider VARCHAR(50) DEFAULT 'email';`;


    // 2. Trips Table
    await sql`
      CREATE TABLE IF NOT EXISTS trips (
        id VARCHAR(64) PRIMARY KEY,
        user_id VARCHAR(64) REFERENCES users(id) ON DELETE CASCADE,
        destination VARCHAR(255) NOT NULL,
        start_date VARCHAR(50),
        status VARCHAR(50) DEFAULT 'Upcoming',
        summary TEXT,
        travel_tip TEXT,
        best_time_to_visit TEXT,
        budget_breakdown JSONB,
        days JSONB,
        form_snapshot JSONB,
        itinerary_data JSONB,
        saved_at VARCHAR(50),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `;

    // Ensure all trips columns exist
    await sql`ALTER TABLE trips ADD COLUMN IF NOT EXISTS itinerary_data JSONB;`;
    await sql`ALTER TABLE trips ADD COLUMN IF NOT EXISTS travel_tip TEXT;`;
    await sql`ALTER TABLE trips ADD COLUMN IF NOT EXISTS best_time_to_visit TEXT;`;
    await sql`ALTER TABLE trips ADD COLUMN IF NOT EXISTS budget_breakdown JSONB;`;
    await sql`ALTER TABLE trips ADD COLUMN IF NOT EXISTS days JSONB;`;
    await sql`ALTER TABLE trips ADD COLUMN IF NOT EXISTS form_snapshot JSONB;`;
    await sql`ALTER TABLE trips ADD COLUMN IF NOT EXISTS saved_at VARCHAR(50);`;

    await sql`
      CREATE INDEX IF NOT EXISTS idx_trips_user_id ON trips(user_id);
    `;

    // 3. Seed demo accounts if empty
    for (const seedUser of SEED_USERS) {
      const existing = await sql`SELECT id FROM users WHERE email = ${seedUser.email.toLowerCase()} LIMIT 1`;
      if (existing.length === 0) {
        const hashedPassword = await bcrypt.hash(seedUser.password, 10);
        await sql`
          INSERT INTO users (
            id, name, email, password_hash, avatar, initials, travel_vibe, default_budget, default_travelers, favorite_interests, auth_provider
          ) VALUES (
            ${seedUser.id}, ${seedUser.name}, ${seedUser.email.toLowerCase()}, ${hashedPassword}, ${seedUser.avatar},
            ${seedUser.initials}, ${seedUser.travelVibe}, ${seedUser.defaultBudget}, ${seedUser.defaultTravelers},
            ${seedUser.favoriteInterests}, 'email'
          )
        `;
        console.log(`✨ Seed user created in Neon: ${seedUser.name} (${seedUser.email})`);

        // Seed corresponding trips
        const tripsToSeed = seedUser.id === 'user_sophia' ? SOPHIA_SEED_TRIPS : LIAM_SEED_TRIPS;
        for (const trip of tripsToSeed) {
          await sql`
            INSERT INTO trips (
              id, user_id, destination, start_date, status, summary, travel_tip, best_time_to_visit,
              budget_breakdown, days, form_snapshot, itinerary_data, saved_at
            ) VALUES (
              ${trip.id}, ${seedUser.id}, ${trip.destination}, ${trip.startDate}, ${trip.status},
              ${trip.summary}, ${trip.travelTip}, ${trip.bestTimeToVisit},
              ${JSON.stringify(trip.budgetBreakdown)}, ${JSON.stringify(trip.days)},
              ${JSON.stringify(trip.formSnapshot)}, ${JSON.stringify(trip)}, ${trip.savedAt}
            )
            ON CONFLICT (id) DO NOTHING
          `;
        }
      }
    }


    console.log('✅ Neon Postgres database schema is ready and verified!');
    return true;
  } catch (err) {
    console.error('❌ Neon database initialization error:', err);
    return false;
  }
}
