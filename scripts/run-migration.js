#!/usr/bin/env node

/**
 * Run SQL migration to add Hunimalis sync columns to animals table.
 *
 * Usage: node scripts/run-migration.js
 *
 * Requires DATABASE_URL in .env.local or as environment variable.
 * If DATABASE_URL is not set, prints the SQL to run manually in Supabase SQL Editor.
 */

const SQL = `
-- Migration: Add hunimalis_id column to animals table
ALTER TABLE animals ADD COLUMN IF NOT EXISTS hunimalis_id INTEGER UNIQUE;
ALTER TABLE animals ADD COLUMN IF NOT EXISTS photo_url TEXT;
ALTER TABLE animals ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_animals_hunimalis_id ON animals (hunimalis_id) WHERE hunimalis_id IS NOT NULL;
`;

console.log('=== Migration SQL for Hunimalis sync ===');
console.log('');
console.log('Please run the following SQL in the Supabase SQL Editor:');
console.log('https://supabase.com/dashboard/project/zzevrtrgtgnlxxuwbnge/sql/new');
console.log('');
console.log(SQL);
console.log('');
console.log('After running the SQL, you can start the app with: npm run dev');
