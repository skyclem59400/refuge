-- Make date/time fields optional for custom appointment types
-- Standard types (adoption, veterinary) still require them via app validation

ALTER TABLE appointments ALTER COLUMN date DROP NOT NULL;
ALTER TABLE appointments ALTER COLUMN start_time DROP NOT NULL;
ALTER TABLE appointments ALTER COLUMN end_time DROP NOT NULL;
