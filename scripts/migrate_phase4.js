import 'dotenv/config';
import { neon } from '@neondatabase/serverless';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('DATABASE_URL is not set. Please check your .env file.');
  process.exit(1);
}

const sql = neon(connectionString);

async function runPhase4Migration() {
  console.log('🔄 Running Phase 4 migration (Group Trip Planning schema)...');

  try {
    // 1. Add group collaboration columns to trips table
    await sql`ALTER TABLE trips ADD COLUMN IF NOT EXISTS version INT DEFAULT 1;`;
    await sql`ALTER TABLE trips ADD COLUMN IF NOT EXISTS invite_token VARCHAR(64);`;
    await sql`ALTER TABLE trips ADD COLUMN IF NOT EXISTS invite_expires_at TIMESTAMP WITH TIME ZONE;`;
    await sql`ALTER TABLE trips ADD COLUMN IF NOT EXISTS max_members INT DEFAULT 10;`;
    await sql`ALTER TABLE trips ADD COLUMN IF NOT EXISTS confirm_threshold VARCHAR(20) DEFAULT 'owner';`;
    await sql`ALTER TABLE trips ADD COLUMN IF NOT EXISTS activity_proposals JSONB DEFAULT '[]'::jsonb;`;
    await sql`ALTER TABLE trips ADD COLUMN IF NOT EXISTS activity_votes JSONB DEFAULT '{}'::jsonb;`;
    await sql`ALTER TABLE trips ADD COLUMN IF NOT EXISTS activity_comments JSONB DEFAULT '[]'::jsonb;`;
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_trips_invite_token ON trips(invite_token) WHERE invite_token IS NOT NULL;`;
    console.log('✅ trips table columns added for group collaboration');

    // 2. Create trip_members table
    await sql`
      CREATE TABLE IF NOT EXISTS trip_members (
        id VARCHAR(64) PRIMARY KEY,
        trip_id VARCHAR(64) NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
        user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role VARCHAR(20) NOT NULL DEFAULT 'member',
        joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(trip_id, user_id)
      );
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_trip_members_trip ON trip_members(trip_id);`;
    await sql`CREATE INDEX IF NOT EXISTS idx_trip_members_user ON trip_members(user_id);`;
    console.log('✅ trip_members table and indexes created');

    console.log('🎉 Phase 4 database migration completed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Phase 4 migration failed:', err);
    process.exit(1);
  }
}

runPhase4Migration();

