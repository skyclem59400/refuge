-- Add manage_planning permission to permission_groups table
-- This allows fine-grained control over who can manage the planning module
-- Note: RLS policies for staff_schedule and appointments will be added when those tables are created

-- Add manage_planning column to permission_groups
ALTER TABLE permission_groups
ADD COLUMN IF NOT EXISTS manage_planning BOOLEAN NOT NULL DEFAULT false;

-- Grant permission to system admin group by default
UPDATE permission_groups
SET manage_planning = true
WHERE is_system = true AND name = 'Administrateur';

-- Update user_has_permission function to handle manage_planning
CREATE OR REPLACE FUNCTION user_has_permission(est_id UUID, perm_name TEXT)
RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM establishment_members em
    JOIN member_groups mg ON mg.member_id = em.id
    JOIN permission_groups pg ON pg.id = mg.group_id
    WHERE em.user_id = auth.uid()
      AND em.establishment_id = est_id
      AND (
        CASE perm_name
          WHEN 'manage_documents'     THEN pg.manage_documents
          WHEN 'manage_clients'       THEN pg.manage_clients
          WHEN 'manage_establishment' THEN pg.manage_establishment
          WHEN 'manage_animals'       THEN pg.manage_animals
          WHEN 'view_animals'         THEN pg.view_animals
          WHEN 'manage_health'        THEN pg.manage_health
          WHEN 'manage_movements'     THEN pg.manage_movements
          WHEN 'manage_boxes'         THEN pg.manage_boxes
          WHEN 'manage_posts'         THEN pg.manage_posts
          WHEN 'manage_donations'     THEN pg.manage_donations
          WHEN 'manage_outings'       THEN pg.manage_outings
          WHEN 'manage_planning'      THEN pg.manage_planning
          WHEN 'view_pound'           THEN pg.view_pound
          WHEN 'view_statistics'      THEN pg.view_statistics
          ELSE false
        END
      )
  );
$$;
