-- Migration: Add hunimalis_id column to animals table
-- This allows syncing animals from the Hunimalis API

-- Add hunimalis_id column (nullable, unique when set)
ALTER TABLE animals ADD COLUMN IF NOT EXISTS hunimalis_id INTEGER UNIQUE;

-- Add photo_url column for Hunimalis picture URLs (avoids needing the animal_photos table for synced animals)
ALTER TABLE animals ADD COLUMN IF NOT EXISTS photo_url TEXT;

-- Add last_synced_at to track when animal was last synced from Hunimalis
ALTER TABLE animals ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ;

-- Create index for fast lookup by hunimalis_id
CREATE INDEX IF NOT EXISTS idx_animals_hunimalis_id ON animals (hunimalis_id) WHERE hunimalis_id IS NOT NULL;
