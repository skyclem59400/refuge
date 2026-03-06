-- Add external description field for AI-generated public descriptions
ALTER TABLE animals ADD COLUMN IF NOT EXISTS description_external text;

-- Add compatibility fields for dogs
ALTER TABLE animals ADD COLUMN IF NOT EXISTS ok_cats boolean;
ALTER TABLE animals ADD COLUMN IF NOT EXISTS ok_males boolean;
ALTER TABLE animals ADD COLUMN IF NOT EXISTS ok_females boolean;
