-- Granular leave entries (hourly), file attachments (sick notes),
-- and storage bucket for CRA generation.

-- 1. Granularity + time fields on leave_requests
ALTER TABLE leave_requests
  ADD COLUMN IF NOT EXISTS granularity TEXT NOT NULL DEFAULT 'full_day';

ALTER TABLE leave_requests
  DROP CONSTRAINT IF EXISTS leave_requests_granularity_check;
ALTER TABLE leave_requests
  ADD CONSTRAINT leave_requests_granularity_check
    CHECK (granularity IN ('full_day', 'half_day', 'hourly'));

ALTER TABLE leave_requests
  ADD COLUMN IF NOT EXISTS start_time TIME,
  ADD COLUMN IF NOT EXISTS end_time   TIME,
  ADD COLUMN IF NOT EXISTS duration_hours NUMERIC(5,2);

ALTER TABLE leave_requests
  DROP CONSTRAINT IF EXISTS leave_requests_hourly_consistency;
ALTER TABLE leave_requests
  ADD CONSTRAINT leave_requests_hourly_consistency
    CHECK (
      granularity <> 'hourly'
      OR (start_time IS NOT NULL AND end_time IS NOT NULL AND end_time > start_time)
    );

COMMENT ON COLUMN leave_requests.granularity
  IS 'full_day (jours entiers, days_count), half_day (1/2 jours), hourly (heures, start_time/end_time/duration_hours)';

-- 2. Backfill existing rows: half_day_start/end imply half_day, else full_day
UPDATE leave_requests
SET granularity = 'half_day'
WHERE granularity = 'full_day'
  AND (half_day_start OR half_day_end);

-- 3. Attachments (sick notes, supporting docs)
CREATE TABLE IF NOT EXISTS leave_attachments (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id UUID NOT NULL REFERENCES establishments(id) ON DELETE CASCADE,
  member_id        UUID NOT NULL REFERENCES establishment_members(id) ON DELETE CASCADE,
  leave_request_id UUID REFERENCES leave_requests(id) ON DELETE CASCADE,
  kind             TEXT NOT NULL DEFAULT 'sick_note',
  storage_path     TEXT NOT NULL,
  file_name        TEXT,
  mime_type        TEXT,
  size_bytes       BIGINT,
  notes            TEXT,
  uploaded_by      UUID REFERENCES establishment_members(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE leave_attachments
  DROP CONSTRAINT IF EXISTS leave_attachments_kind_check;
ALTER TABLE leave_attachments
  ADD CONSTRAINT leave_attachments_kind_check
    CHECK (kind IN ('sick_note', 'extended_leave_proof', 'other'));

CREATE INDEX IF NOT EXISTS idx_leave_attachments_member
  ON leave_attachments(member_id);
CREATE INDEX IF NOT EXISTS idx_leave_attachments_request
  ON leave_attachments(leave_request_id);
CREATE INDEX IF NOT EXISTS idx_leave_attachments_establishment
  ON leave_attachments(establishment_id);

-- 4. RLS for leave_attachments
ALTER TABLE leave_attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS leave_attachments_select ON leave_attachments;
CREATE POLICY leave_attachments_select ON leave_attachments
  FOR SELECT USING (
    establishment_id IN (SELECT user_establishment_ids())
  );

DROP POLICY IF EXISTS leave_attachments_modify ON leave_attachments;
CREATE POLICY leave_attachments_modify ON leave_attachments
  FOR ALL USING (
    establishment_id IN (SELECT user_establishment_ids())
  ) WITH CHECK (
    establishment_id IN (SELECT user_establishment_ids())
  );

-- 5. Storage bucket (private)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'leave-attachments',
  'leave-attachments',
  false,
  10485760,   -- 10 MB
  ARRAY['application/pdf','image/png','image/jpeg','image/webp','image/heic']
)
ON CONFLICT (id) DO UPDATE
  SET file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 6. Storage RLS — anyone in the establishment with manage_leaves can read/write
--    (object name is prefixed with <establishment_id>/<member_id>/<file>)
DROP POLICY IF EXISTS leave_attachments_storage_select ON storage.objects;
CREATE POLICY leave_attachments_storage_select ON storage.objects
  FOR SELECT USING (
    bucket_id = 'leave-attachments'
    AND (
      SUBSTRING(name FROM '^([0-9a-f-]{36})/')::uuid
        IN (SELECT user_establishment_ids())
    )
  );

DROP POLICY IF EXISTS leave_attachments_storage_insert ON storage.objects;
CREATE POLICY leave_attachments_storage_insert ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'leave-attachments'
    AND (
      SUBSTRING(name FROM '^([0-9a-f-]{36})/')::uuid
        IN (SELECT user_establishment_ids())
    )
  );

DROP POLICY IF EXISTS leave_attachments_storage_delete ON storage.objects;
CREATE POLICY leave_attachments_storage_delete ON storage.objects
  FOR DELETE USING (
    bucket_id = 'leave-attachments'
    AND (
      SUBSTRING(name FROM '^([0-9a-f-]{36})/')::uuid
        IN (SELECT user_establishment_ids())
    )
  );
