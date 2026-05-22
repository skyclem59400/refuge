-- ============================================================
-- Optimus — Documents administratifs par collaborateur
-- ============================================================
-- Stocke les documents RH/contractuels d'un salarie : contrat de travail,
-- avenants, attestations, certificats. Pattern calque sur la table payslips,
-- mais generique pour accueillir n'importe quel type de document salarial
-- non recurrent.

CREATE TABLE IF NOT EXISTS member_documents (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id  UUID NOT NULL REFERENCES establishments(id) ON DELETE CASCADE,
  member_id         UUID NOT NULL REFERENCES establishment_members(id) ON DELETE CASCADE,
  kind              TEXT NOT NULL CHECK (kind IN ('contract', 'amendment', 'certificate', 'other')),
  label             TEXT NOT NULL,
  signed_date       DATE,
  file_path         TEXT NOT NULL,
  file_url          TEXT NOT NULL,
  file_size         INTEGER,
  uploaded_by       UUID NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_member_docs_member ON member_documents(member_id, kind);
CREATE INDEX IF NOT EXISTS idx_member_docs_establishment ON member_documents(establishment_id);

-- RLS : un membre voit ses propres docs ; les RH (manage_payslips) voient tout
ALTER TABLE member_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mdoc_select" ON member_documents FOR SELECT TO authenticated
USING (
  member_id IN (SELECT id FROM establishment_members WHERE user_id = auth.uid())
  OR user_has_permission(establishment_id, 'manage_payslips')
);

-- Pas de policy INSERT/UPDATE/DELETE : les ecritures passent par les server
-- actions (createAdminClient bypass RLS + requirePermission cote code).

-- Bucket Storage prive pour les fichiers binaires
INSERT INTO storage.buckets (id, name, public)
VALUES ('employment-docs', 'employment-docs', false)
ON CONFLICT (id) DO NOTHING;

-- Politiques storage : lecture pour les membres concernes + admins RH
CREATE POLICY "emp_docs_select_member"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'employment-docs'
    AND (
      EXISTS (
        SELECT 1 FROM member_documents md
        JOIN establishment_members em ON em.id = md.member_id
        WHERE md.file_path = storage.objects.name
          AND em.user_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM member_documents md
        WHERE md.file_path = storage.objects.name
          AND user_has_permission(md.establishment_id, 'manage_payslips')
      )
    )
  );
