-- ============================================================
-- SDA Refuge -- Pseudo-based Authentication
-- Migration: 20260302_pseudo_auth
-- Adds pseudo login support for salaries and benevoles
-- Execute in Supabase Dashboard -> SQL Editor
-- ============================================================

-- 1. Add new columns to establishment_members
ALTER TABLE establishment_members
  ADD COLUMN IF NOT EXISTS pseudo TEXT,
  ADD COLUMN IF NOT EXISTS role_type TEXT DEFAULT 'admin' CHECK (role_type IN ('admin', 'salarie', 'benevole')),
  ADD COLUMN IF NOT EXISTS is_pseudo_user BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS password_set BOOLEAN NOT NULL DEFAULT false;

-- 2. Unique constraint: (pseudo, role_type, establishment_id) for pseudo users
-- This prevents two "Marie" salaries in the same establishment
CREATE UNIQUE INDEX IF NOT EXISTS idx_pseudo_unique
  ON establishment_members (pseudo, role_type, establishment_id)
  WHERE pseudo IS NOT NULL;

-- 3. Index for pseudo lookups on the login API
CREATE INDEX IF NOT EXISTS idx_members_pseudo_role
  ON establishment_members (pseudo, role_type)
  WHERE is_pseudo_user = true;
