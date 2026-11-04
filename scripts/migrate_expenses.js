import 'dotenv/config';
import { neon } from '@neondatabase/serverless';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('❌ DATABASE_URL is not set in environment or .env file.');
  process.exit(1);
}

const sql = neon(connectionString);

async function runMigration() {
  console.log('🔄 Running migration: Creating expenses table and trip travelers support...');

  try {
    // 1. Add travelers column to trips table if missing
    await sql`ALTER TABLE trips ADD COLUMN IF NOT EXISTS travelers JSONB;`;
    console.log('✅ trips.travelers column verified/added.');

    // 2. Create expenses table
    await sql`
      CREATE TABLE IF NOT EXISTS expenses (
        id VARCHAR(64) PRIMARY KEY,
        trip_id VARCHAR(64) NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
        user_id VARCHAR(64),
        amount NUMERIC(12, 2) NOT NULL,
        currency VARCHAR(10) NOT NULL DEFAULT 'USD',
        category VARCHAR(50) NOT NULL,
        note VARCHAR(255),
        date VARCHAR(50),
        activity_id VARCHAR(100),
        paid_by VARCHAR(100) NOT NULL DEFAULT 'You',
        split_between JSONB NOT NULL DEFAULT '[]'::jsonb,
        split_type VARCHAR(20) DEFAULT 'equal',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `;
    console.log('✅ expenses table created or verified.');

    // 3. Create index on trip_id for fast queries
    await sql`
      CREATE INDEX IF NOT EXISTS idx_expenses_trip_id ON expenses(trip_id);
    `;
    console.log('✅ idx_expenses_trip_id index created.');

    console.log('🎉 Migration completed successfully!');
  } catch (err) {
    console.error('❌ Migration error:', err.message || err);
    process.exit(1);
  }
}

runMigration();

