-- Make client fields optional for veterinary appointments
-- Client information is only required for adoption appointments

ALTER TABLE appointments
ALTER COLUMN client_name DROP NOT NULL;

COMMENT ON COLUMN appointments.client_name IS 'Client name (required for adoption, optional for veterinary)';
