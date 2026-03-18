-- ============================================
-- Migration: Ajout methode de paiement sur documents
-- Permet de tracer comment une facture a ete payee
-- ============================================

ALTER TABLE documents ADD COLUMN IF NOT EXISTS payment_method TEXT;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS payment_date DATE;
