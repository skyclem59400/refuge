-- Add SIRET column to establishments table
alter table establishments add column if not exists siret text;
