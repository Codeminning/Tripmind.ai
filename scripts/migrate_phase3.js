import 'dotenv/config';
import { neon } from '@neondatabase/serverless';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('DATABASE_URL is not set. Please check your .env file.');
  process.exit(1);
}

const sql = neon(connectionString);

async function runPhase3Migration() {
  console.log('🔄 Running Phase 3 migration (Checklist, Reminders, Weather schema)...');

  try {
    // 1. Add checklist and reminders_sent columns to trips table
    await sql`ALTER TABLE trips ADD COLUMN IF NOT EXISTS checklist JSONB DEFAULT '[]'::jsonb;`;
    await sql`ALTER TABLE trips ADD COLUMN IF NOT EXISTS reminders_sent JSONB DEFAULT '[]'::jsonb;`;
    console.log('✅ trips table columns added (checklist, reminders_sent)');

    // 2. Add reminder settings and notifications columns to users table
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS reminder_days INT[] DEFAULT '{7, 3, 1}';`;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS email_reminders_enabled BOOLEAN DEFAULT FALSE;`;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS notifications JSONB DEFAULT '[]'::jsonb;`;
    console.log('✅ users table columns added (reminder_days, email_reminders_enabled, notifications)');

    console.log('🎉 Phase 3 database migration completed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Phase 3 migration failed:', err);
    process.exit(1);
  }
}

runPhase3Migration();

