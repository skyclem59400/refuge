-- Backfill retroactif des activity_logs pour le workflow CRA.
--
-- Contexte : le logging logActivity() sur cra-saisie.ts / cra-send.ts /
-- cra-astreintes.ts n'a ete ajoute qu'au commit 91995da (2026-05-26).
-- Toutes les saisies, soumissions, validations et envois anterieurs
-- n'apparaissent pas dans /etablissement/logs.
--
-- Cette migration reconstitue l'historique en lisant les tables sources
-- (cra_entries, cra_monthly_status, cra_change_requests, cra_astreintes)
-- qui ont conserve les timestamps + user_id de chaque transition.
--
-- Lignes ignorees : celles ou le user_id source est NULL (auteur non
-- identifie). activity_logs.user_id est NOT NULL + FK vers auth.users,
-- impossible d'inventer un fallback.
--
-- Idempotente : WHERE NOT EXISTS sur (entity_type, entity_id, transition)
-- Tag dans details->>'backfilled' = 'true' pour distinguer des logs natifs.

-- ============================================================
-- 1. cra_entries : 1 log create par entry historique
-- ============================================================
INSERT INTO activity_logs (
  establishment_id, user_id, action, entity_type, entity_id, entity_name,
  parent_type, parent_id, details, created_at
)
SELECT
  e.establishment_id,
  e.entered_by,
  'create',
  'cra_entry',
  e.id,
  'CRA ' || e.date::text,
  'establishment_member',
  e.member_id,
  jsonb_build_object(
    'backfilled', true,
    'date', e.date,
    'is_rest_day', e.is_rest_day,
    'start_am', e.start_am,
    'end_am', e.end_am,
    'start_pm', e.start_pm,
    'end_pm', e.end_pm
  ),
  e.entered_at
FROM cra_entries e
WHERE e.entered_by IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM activity_logs al
    WHERE al.entity_type = 'cra_entry'
      AND al.entity_id = e.id
  );

-- ============================================================
-- 2. cra_monthly_status : 1 log par transition
-- ============================================================

-- 2a. submitted
INSERT INTO activity_logs (
  establishment_id, user_id, action, entity_type, entity_id, entity_name,
  parent_type, parent_id, details, created_at
)
SELECT
  s.establishment_id,
  s.submitted_by,
  'update',
  'cra_status',
  s.id,
  'CRA ' || to_char(make_date(s.year, s.month, 1), 'TMMonth YYYY'),
  'establishment_member',
  s.member_id,
  jsonb_build_object(
    'backfilled', true,
    'status', jsonb_build_object('old', 'draft', 'new', 'submitted')
  ),
  s.submitted_at
FROM cra_monthly_status s
WHERE s.submitted_at IS NOT NULL
  AND s.submitted_by IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM activity_logs al
    WHERE al.entity_type = 'cra_status'
      AND al.entity_id = s.id
      AND al.details->'status'->>'new' = 'submitted'
  );

-- 2b. validated_by_member
INSERT INTO activity_logs (
  establishment_id, user_id, action, entity_type, entity_id, entity_name,
  parent_type, parent_id, details, created_at
)
SELECT
  s.establishment_id,
  s.validated_by,
  'update',
  'cra_status',
  s.id,
  'CRA ' || to_char(make_date(s.year, s.month, 1), 'TMMonth YYYY'),
  'establishment_member',
  s.member_id,
  jsonb_build_object(
    'backfilled', true,
    'status', jsonb_build_object('old', 'submitted', 'new', 'validated_by_member')
  ),
  s.validated_at
FROM cra_monthly_status s
WHERE s.validated_at IS NOT NULL
  AND s.validated_by IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM activity_logs al
    WHERE al.entity_type = 'cra_status'
      AND al.entity_id = s.id
      AND al.details->'status'->>'new' = 'validated_by_member'
  );

-- 2c. validated_by_admin
INSERT INTO activity_logs (
  establishment_id, user_id, action, entity_type, entity_id, entity_name,
  parent_type, parent_id, details, created_at
)
SELECT
  s.establishment_id,
  s.admin_validated_by,
  'update',
  'cra_status',
  s.id,
  'CRA ' || to_char(make_date(s.year, s.month, 1), 'TMMonth YYYY'),
  'establishment_member',
  s.member_id,
  jsonb_build_object(
    'backfilled', true,
    'status', jsonb_build_object('old', 'validated_by_member', 'new', 'validated_by_admin')
  ),
  s.admin_validated_at
FROM cra_monthly_status s
WHERE s.admin_validated_at IS NOT NULL
  AND s.admin_validated_by IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM activity_logs al
    WHERE al.entity_type = 'cra_status'
      AND al.entity_id = s.id
      AND al.details->'status'->>'new' = 'validated_by_admin'
  );

-- 2d. sent (au comptable ou au president pour les externes)
INSERT INTO activity_logs (
  establishment_id, user_id, action, entity_type, entity_id, entity_name,
  parent_type, parent_id, details, created_at
)
SELECT
  s.establishment_id,
  s.sent_by,
  'update',
  'cra_status',
  s.id,
  'CRA ' || to_char(make_date(s.year, s.month, 1), 'TMMonth YYYY'),
  'establishment_member',
  s.member_id,
  jsonb_build_object(
    'backfilled', true,
    'status', jsonb_build_object('old', 'validated_by_admin', 'new', 'sent'),
    'sent_to', s.sent_to
  ),
  s.sent_at
FROM cra_monthly_status s
WHERE s.sent_at IS NOT NULL
  AND s.sent_by IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM activity_logs al
    WHERE al.entity_type = 'cra_status'
      AND al.entity_id = s.id
      AND al.details->'status'->>'new' = 'sent'
  );

-- ============================================================
-- 3. cra_change_requests : demande + resolution
-- ============================================================

-- 3a. demande de modification
INSERT INTO activity_logs (
  establishment_id, user_id, action, entity_type, entity_id, entity_name,
  parent_type, parent_id, details, created_at
)
SELECT
  cr.establishment_id,
  cr.requested_by,
  'update',
  'cra_status',
  cr.cra_status_id,
  'CRA — demande modif',
  'establishment_member',
  cr.member_id,
  jsonb_build_object(
    'backfilled', true,
    'status', jsonb_build_object('old', 'submitted', 'new', 'change_requested'),
    'comment', LEFT(COALESCE(cr.comment, ''), 200)
  ),
  cr.requested_at
FROM cra_change_requests cr
WHERE cr.requested_by IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM activity_logs al
    WHERE al.entity_type = 'cra_status'
      AND al.entity_id = cr.cra_status_id
      AND al.details->'status'->>'new' = 'change_requested'
      AND ABS(EXTRACT(EPOCH FROM (al.created_at - cr.requested_at))) < 5
  );

-- 3b. resolution (retour en draft pour modification)
INSERT INTO activity_logs (
  establishment_id, user_id, action, entity_type, entity_id, entity_name,
  parent_type, parent_id, details, created_at
)
SELECT
  cr.establishment_id,
  cr.resolved_by,
  'update',
  'cra_status',
  cr.cra_status_id,
  'CRA — résolution demande',
  'establishment_member',
  cr.member_id,
  jsonb_build_object(
    'backfilled', true,
    'status', jsonb_build_object('old', 'change_requested', 'new', 'draft'),
    'resolution_notes', LEFT(COALESCE(cr.resolution_notes, ''), 200)
  ),
  cr.resolved_at
FROM cra_change_requests cr
WHERE cr.resolved_at IS NOT NULL
  AND cr.resolved_by IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM activity_logs al
    WHERE al.entity_type = 'cra_status'
      AND al.entity_id = cr.cra_status_id
      AND al.details->'status'->>'new' = 'draft'
      AND ABS(EXTRACT(EPOCH FROM (al.created_at - cr.resolved_at))) < 5
  );

-- ============================================================
-- 4. cra_astreintes : 1 log create par astreinte historique
-- ============================================================
INSERT INTO activity_logs (
  establishment_id, user_id, action, entity_type, entity_id, entity_name,
  parent_type, parent_id, details, created_at
)
SELECT
  a.establishment_id,
  a.created_by,
  'create',
  'cra_astreinte',
  a.id,
  'Astreinte ' || a.week_start_monday::text,
  'establishment_member',
  a.member_id,
  jsonb_build_object(
    'backfilled', true,
    'week_start_monday', a.week_start_monday
  ),
  a.created_at
FROM cra_astreintes a
WHERE a.created_by IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM activity_logs al
    WHERE al.entity_type = 'cra_astreinte'
      AND al.entity_id = a.id
  );
