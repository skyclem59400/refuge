-- Add rating system to animal outings
-- Rating 1-10 (1=worst, 10=best)
-- Comment mandatory for ratings 1-5, optional for 6-10

ALTER TABLE animal_outings
  ADD COLUMN IF NOT EXISTS rating INTEGER CHECK (rating >= 1 AND rating <= 10),
  ADD COLUMN IF NOT EXISTS rating_comment TEXT;
