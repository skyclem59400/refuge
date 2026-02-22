-- =============================================
-- Auto-generation du numero de medaille
-- =============================================

-- Function: get_next_medal_number
-- Returns the next incremental medal number for an establishment
CREATE OR REPLACE FUNCTION get_next_medal_number(est_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  next_number INTEGER;
BEGIN
  SELECT COALESCE(MAX(medal_number::INTEGER), 0) + 1
  INTO next_number
  FROM animals
  WHERE establishment_id = est_id
    AND medal_number IS NOT NULL
    AND medal_number ~ '^\d+$';

  RETURN next_number;
END;
$$;
