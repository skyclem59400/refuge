-- Corrige les RLS policies de box_zones : la version précédente écrivait
-- "establishment_id IN (SELECT id FROM user_establishment_ids())".
-- user_establishment_ids() retourne SETOF uuid (pas de colonne 'id'), si bien
-- que Postgres réécrivait l'expression en "establishment_id IN (SELECT box_zones.id ...)"
-- — la policy n'a jamais matché et tous les writes via createClient() étaient bloqués.

DROP POLICY IF EXISTS "box_zones_member_read" ON box_zones;
CREATE POLICY "box_zones_member_read" ON box_zones
  FOR SELECT TO authenticated
  USING (establishment_id IN (SELECT user_establishment_ids()));

DROP POLICY IF EXISTS "box_zones_member_write" ON box_zones;
CREATE POLICY "box_zones_member_write" ON box_zones
  FOR ALL TO authenticated
  USING (establishment_id IN (SELECT user_establishment_ids()))
  WITH CHECK (establishment_id IN (SELECT user_establishment_ids()));
