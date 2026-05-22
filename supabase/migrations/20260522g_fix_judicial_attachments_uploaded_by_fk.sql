-- ============================================================
-- Fix: judicial_attachments.uploaded_by FK alignment
-- ============================================================
-- La FK pointait par erreur vers establishment_members(id) dans la
-- migration initiale 20260520a_judicial_extension.sql, mais le code
-- (src/lib/actions/judicial-attachments.ts ligne ~111) insère un
-- auth.users(id) comme dans TOUTES les autres tables :
--   - payslips.uploaded_by
--   - member_documents.uploaded_by
--   - cra_entries.entered_by
--   - cra_monthly_status.submitted_by
--   - satisfaction_surveys.resolved_by
--
-- Conséquence avant fix : toute tentative d'upload de PV/réquisition/etc.
-- échouait avec "judicial_attachments_uploaded_by_fkey violates foreign
-- key constraint". On corrige en pointant la FK vers auth.users(id).
-- Pas de migration de données : la table était vide (le bug empêchait
-- toute insertion).

ALTER TABLE judicial_attachments
  DROP CONSTRAINT IF EXISTS judicial_attachments_uploaded_by_fkey;

ALTER TABLE judicial_attachments
  ADD CONSTRAINT judicial_attachments_uploaded_by_fkey
  FOREIGN KEY (uploaded_by) REFERENCES auth.users(id) ON DELETE SET NULL;
