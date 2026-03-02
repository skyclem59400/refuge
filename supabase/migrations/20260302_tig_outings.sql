-- ============================================================
-- SDA Refuge — Sorties TIG (Travaux d'Interet General)
-- Migration: 20260302_tig_outings
-- Permet aux managers/admins d'enregistrer des sorties
-- effectuees par des TIG sans compte utilisateur
-- ============================================================

-- 1. Colonne is_tig sur animal_outings
ALTER TABLE animal_outings
  ADD COLUMN IF NOT EXISTS is_tig BOOLEAN NOT NULL DEFAULT false;

-- 2. Nom optionnel du TIG
ALTER TABLE animal_outings
  ADD COLUMN IF NOT EXISTS tig_walker_name TEXT;

-- ============================================================
-- DONE! TIG outing fields ready.
-- ============================================================
