-- ============================================================
-- Jeu de donnees de test pour l'etablissement "Test"
-- ~40 factures sur 3 mois, ~15 devis en cours, 1 avoir
-- ============================================================

DO $$
DECLARE
  est_id UUID;
  -- Client IDs
  c_dupont UUID;
  c_martin UUID;
  c_lefevre UUID;
  c_moreau UUID;
  c_bernard UUID;
  c_petit UUID;
  c_robert UUID;
  c_durand UUID;
  c_simon UUID;
  c_laurent UUID;
  -- Facture IDs (on en garde quelques-uns pour les relations)
  f_avoir_target UUID;
BEGIN

  -- ============================================================
  -- 1. Trouver l'etablissement "Test"
  -- ============================================================
  SELECT id INTO est_id FROM establishments WHERE name = 'Test';
  IF est_id IS NULL THEN
    RAISE EXCEPTION 'Etablissement "Test" introuvable. Creez-le d''abord.';
  END IF;

  -- ============================================================
  -- 2. Nettoyer les donnees existantes de cet etablissement
  -- ============================================================
  DELETE FROM documents WHERE establishment_id = est_id;
  DELETE FROM clients WHERE establishment_id = est_id;

  -- ============================================================
  -- 3. Creer 10 clients
  -- ============================================================
  c_dupont  := gen_random_uuid();
  c_martin  := gen_random_uuid();
  c_lefevre := gen_random_uuid();
  c_moreau  := gen_random_uuid();
  c_bernard := gen_random_uuid();
  c_petit   := gen_random_uuid();
  c_robert  := gen_random_uuid();
  c_durand  := gen_random_uuid();
  c_simon   := gen_random_uuid();
  c_laurent := gen_random_uuid();

  INSERT INTO clients (id, name, email, phone, address, postal_code, city, type, establishment_id) VALUES
    (c_dupont,  'Famille Dupont',       'dupont@email.fr',    '0612345678', '12 rue des Champs',    '59000', 'Lille',       'particulier', est_id),
    (c_martin,  'Restaurant Le Martin', 'contact@lemartin.fr','0320112233', '45 avenue Foch',       '59800', 'Lille',       'organisation', est_id),
    (c_lefevre, 'Ecole Lefevre',        'ecole@lefevre.fr',   '0320998877', '8 place de la Gare',   '59100', 'Roubaix',    'organisation', est_id),
    (c_moreau,  'Pierre Moreau',        'p.moreau@gmail.com', '0698765432', '3 impasse du Moulin',  '59491', 'Villeneuve-d''Ascq', 'particulier', est_id),
    (c_bernard, 'Comite Bernard',       'ce@bernard.fr',      '0320556677', '77 bd de la Liberte',  '59000', 'Lille',       'organisation', est_id),
    (c_petit,   'Marie Petit',          'm.petit@outlook.fr', '0645671234', '21 rue Nationale',     '59200', 'Tourcoing',   'particulier', est_id),
    (c_robert,  'Ferme Robert & Fils',  'ferme@robert.fr',    '0320334455', '1 chemin des Prairies','59246', 'Mons-en-Baroeul', 'organisation', est_id),
    (c_durand,  'Association Durand',   'asso@durand.org',    '0320776655', '55 rue de Douai',      '59000', 'Lille',       'organisation', est_id),
    (c_simon,   'Jacques Simon',        'j.simon@free.fr',    '0677889900', '9 allee des Tilleuls', '59650', 'Villeneuve-d''Ascq', 'particulier', est_id),
    (c_laurent, 'Creche Les Laurents',  'contact@laurents.fr','0320221133', '14 rue Colbert',       '59300', 'Valenciennes','organisation', est_id);

  -- ============================================================
  -- 3. Factures - Decembre 2025 (12 factures)
  --    CA progressif : debut modeste
  -- ============================================================
  f_avoir_target := gen_random_uuid();

  INSERT INTO documents (id, type, numero, date, client_id, client_name, client_email, client_address, client_postal_code, client_city, nb_adultes, prix_adulte, nb_enfants, prix_enfant, total, line_items, status, establishment_id, created_at) VALUES
    -- Semaine 1 dec
    (gen_random_uuid(), 'facture', 'F-2025-101', '2025-12-02', c_dupont,  'Famille Dupont',       'dupont@email.fr',    '12 rue des Champs',    '59000', 'Lille',      4, 12.00, 2, 8.00, 64.00,
      '[{"description":"Visite ferme adulte","quantity":4,"unit_price":12,"total":48},{"description":"Visite ferme enfant","quantity":2,"unit_price":8,"total":16}]'::jsonb,
      'paid', est_id, '2025-12-02 10:00:00+01'),
    (gen_random_uuid(), 'facture', 'F-2025-102', '2025-12-03', c_martin,  'Restaurant Le Martin', 'contact@lemartin.fr','45 avenue Foch',       '59800', 'Lille',      0, 0, 0, 0, 350.00,
      '[{"description":"Panier legumes bio x10","quantity":10,"unit_price":25,"total":250},{"description":"Oeufs fermiers x20 dz","quantity":20,"unit_price":5,"total":100}]'::jsonb,
      'paid', est_id, '2025-12-03 09:30:00+01'),
    (gen_random_uuid(), 'facture', 'F-2025-103', '2025-12-05', c_lefevre, 'Ecole Lefevre',        'ecole@lefevre.fr',   '8 place de la Gare',   '59100', 'Roubaix',    0, 0, 25, 6.00, 150.00,
      '[{"description":"Sortie scolaire - 25 enfants","quantity":25,"unit_price":6,"total":150}]'::jsonb,
      'paid', est_id, '2025-12-05 14:00:00+01'),

    -- Semaine 2 dec
    (gen_random_uuid(), 'facture', 'F-2025-104', '2025-12-09', c_moreau,  'Pierre Moreau',        'p.moreau@gmail.com', '3 impasse du Moulin',  '59491', 'Villeneuve-d''Ascq', 2, 12.00, 3, 8.00, 48.00,
      '[{"description":"Visite ferme adulte","quantity":2,"unit_price":12,"total":24},{"description":"Visite ferme enfant","quantity":3,"unit_price":8,"total":24}]'::jsonb,
      'paid', est_id, '2025-12-09 11:00:00+01'),
    (gen_random_uuid(), 'facture', 'F-2025-105', '2025-12-10', c_bernard, 'Comite Bernard',       'ce@bernard.fr',      '77 bd de la Liberte',  '59000', 'Lille',       20, 10.00, 15, 7.00, 305.00,
      '[{"description":"Animation CE adultes","quantity":20,"unit_price":10,"total":200},{"description":"Animation CE enfants","quantity":15,"unit_price":7,"total":105}]'::jsonb,
      'paid', est_id, '2025-12-10 10:00:00+01'),
    (gen_random_uuid(), 'facture', 'F-2025-106', '2025-12-12', c_robert,  'Ferme Robert & Fils',  'ferme@robert.fr',    '1 chemin des Prairies','59246', 'Mons-en-Baroeul', 0, 0, 0, 0, 420.00,
      '[{"description":"Foin bio 200kg","quantity":4,"unit_price":80,"total":320},{"description":"Grains bio 100kg","quantity":2,"unit_price":50,"total":100}]'::jsonb,
      'paid', est_id, '2025-12-12 08:00:00+01'),

    -- Semaine 3 dec
    (gen_random_uuid(), 'facture', 'F-2025-107', '2025-12-15', c_petit,   'Marie Petit',          'm.petit@outlook.fr', '21 rue Nationale',     '59200', 'Tourcoing',   2, 12.00, 1, 8.00, 32.00,
      '[{"description":"Visite ferme adulte","quantity":2,"unit_price":12,"total":24},{"description":"Visite ferme enfant","quantity":1,"unit_price":8,"total":8}]'::jsonb,
      'paid', est_id, '2025-12-15 15:00:00+01'),
    (f_avoir_target, 'facture', 'F-2025-108', '2025-12-16', c_durand,  'Association Durand',   'asso@durand.org',    '55 rue de Douai',      '59000', 'Lille',       15, 10.00, 10, 7.00, 220.00,
      '[{"description":"Atelier decouverte adultes","quantity":15,"unit_price":10,"total":150},{"description":"Atelier decouverte enfants","quantity":10,"unit_price":7,"total":70}]'::jsonb,
      'paid', est_id, '2025-12-16 10:00:00+01'),
    (gen_random_uuid(), 'facture', 'F-2025-109', '2025-12-18', c_simon,   'Jacques Simon',        'j.simon@free.fr',    '9 allee des Tilleuls', '59650', 'Villeneuve-d''Ascq', 1, 12.00, 0, 0, 12.00,
      '[{"description":"Visite ferme adulte","quantity":1,"unit_price":12,"total":12}]'::jsonb,
      'paid', est_id, '2025-12-18 16:00:00+01'),

    -- Semaine 4 dec (vacances de Noel - plus de monde)
    (gen_random_uuid(), 'facture', 'F-2025-110', '2025-12-22', c_laurent, 'Creche Les Laurents',  'contact@laurents.fr','14 rue Colbert',       '59300', 'Valenciennes', 5, 0, 18, 5.00, 90.00,
      '[{"description":"Sortie creche - 18 enfants","quantity":18,"unit_price":5,"total":90}]'::jsonb,
      'paid', est_id, '2025-12-22 09:30:00+01'),
    (gen_random_uuid(), 'facture', 'F-2025-111', '2025-12-23', c_dupont,  'Famille Dupont',       'dupont@email.fr',    '12 rue des Champs',    '59000', 'Lille',       6, 12.00, 4, 8.00, 104.00,
      '[{"description":"Visite Noel adulte","quantity":6,"unit_price":12,"total":72},{"description":"Visite Noel enfant","quantity":4,"unit_price":8,"total":32}]'::jsonb,
      'paid', est_id, '2025-12-23 10:00:00+01'),
    (gen_random_uuid(), 'facture', 'F-2025-112', '2025-12-27', c_martin,  'Restaurant Le Martin', 'contact@lemartin.fr','45 avenue Foch',       '59800', 'Lille',       0, 0, 0, 0, 280.00,
      '[{"description":"Panier legumes bio x8","quantity":8,"unit_price":25,"total":200},{"description":"Volailles fermières x4","quantity":4,"unit_price":20,"total":80}]'::jsonb,
      'paid', est_id, '2025-12-27 08:00:00+01');

  -- ============================================================
  -- 4. Factures - Janvier 2026 (15 factures)
  --    CA en hausse
  -- ============================================================
  INSERT INTO documents (type, numero, date, client_id, client_name, client_email, client_address, client_postal_code, client_city, nb_adultes, prix_adulte, nb_enfants, prix_enfant, total, line_items, status, establishment_id, created_at) VALUES
    ('facture', 'F-2026-101', '2026-01-06', c_lefevre, 'Ecole Lefevre',        'ecole@lefevre.fr',   '8 place de la Gare',   '59100', 'Roubaix',     0, 0, 28, 6.00, 168.00,
      '[{"description":"Sortie scolaire - 28 enfants","quantity":28,"unit_price":6,"total":168}]'::jsonb,
      'paid', est_id, '2026-01-06 14:00:00+01'),
    ('facture', 'F-2026-102', '2026-01-08', c_robert,  'Ferme Robert & Fils',  'ferme@robert.fr',    '1 chemin des Prairies','59246', 'Mons-en-Baroeul', 0, 0, 0, 0, 510.00,
      '[{"description":"Foin bio 200kg","quantity":5,"unit_price":80,"total":400},{"description":"Complements mineraux","quantity":2,"unit_price":55,"total":110}]'::jsonb,
      'paid', est_id, '2026-01-08 08:00:00+01'),
    ('facture', 'F-2026-103', '2026-01-10', c_bernard, 'Comite Bernard',       'ce@bernard.fr',      '77 bd de la Liberte',  '59000', 'Lille',        25, 10.00, 20, 7.00, 390.00,
      '[{"description":"Galette des Rois CE adultes","quantity":25,"unit_price":10,"total":250},{"description":"Galette des Rois CE enfants","quantity":20,"unit_price":7,"total":140}]'::jsonb,
      'paid', est_id, '2026-01-10 10:00:00+01'),
    ('facture', 'F-2026-104', '2026-01-13', c_moreau,  'Pierre Moreau',        'p.moreau@gmail.com', '3 impasse du Moulin',  '59491', 'Villeneuve-d''Ascq', 2, 12.00, 2, 8.00, 40.00,
      '[{"description":"Visite ferme adulte","quantity":2,"unit_price":12,"total":24},{"description":"Visite ferme enfant","quantity":2,"unit_price":8,"total":16}]'::jsonb,
      'paid', est_id, '2026-01-13 11:00:00+01'),
    ('facture', 'F-2026-105', '2026-01-15', c_martin,  'Restaurant Le Martin', 'contact@lemartin.fr','45 avenue Foch',       '59800', 'Lille',        0, 0, 0, 0, 425.00,
      '[{"description":"Panier legumes bio x12","quantity":12,"unit_price":25,"total":300},{"description":"Oeufs fermiers x25 dz","quantity":25,"unit_price":5,"total":125}]'::jsonb,
      'paid', est_id, '2026-01-15 09:00:00+01'),
    ('facture', 'F-2026-106', '2026-01-17', c_dupont,  'Famille Dupont',       'dupont@email.fr',    '12 rue des Champs',    '59000', 'Lille',        3, 12.00, 2, 8.00, 52.00,
      '[{"description":"Visite ferme adulte","quantity":3,"unit_price":12,"total":36},{"description":"Visite ferme enfant","quantity":2,"unit_price":8,"total":16}]'::jsonb,
      'paid', est_id, '2026-01-17 14:00:00+01'),
    ('facture', 'F-2026-107', '2026-01-20', c_laurent, 'Creche Les Laurents',  'contact@laurents.fr','14 rue Colbert',       '59300', 'Valenciennes', 4, 0, 20, 5.00, 100.00,
      '[{"description":"Sortie creche - 20 enfants","quantity":20,"unit_price":5,"total":100}]'::jsonb,
      'paid', est_id, '2026-01-20 09:30:00+01'),
    ('facture', 'F-2026-108', '2026-01-22', c_simon,   'Jacques Simon',        'j.simon@free.fr',    '9 allee des Tilleuls', '59650', 'Villeneuve-d''Ascq', 2, 12.00, 1, 8.00, 32.00,
      '[{"description":"Visite ferme adulte","quantity":2,"unit_price":12,"total":24},{"description":"Visite ferme enfant","quantity":1,"unit_price":8,"total":8}]'::jsonb,
      'paid', est_id, '2026-01-22 15:00:00+01'),
    ('facture', 'F-2026-109', '2026-01-24', c_petit,   'Marie Petit',          'm.petit@outlook.fr', '21 rue Nationale',     '59200', 'Tourcoing',    2, 12.00, 2, 8.00, 40.00,
      '[{"description":"Visite ferme adulte","quantity":2,"unit_price":12,"total":24},{"description":"Visite ferme enfant","quantity":2,"unit_price":8,"total":16}]'::jsonb,
      'paid', est_id, '2026-01-24 10:30:00+01'),
    ('facture', 'F-2026-110', '2026-01-27', c_durand,  'Association Durand',   'asso@durand.org',    '55 rue de Douai',      '59000', 'Lille',        12, 10.00, 8, 7.00, 176.00,
      '[{"description":"Atelier pedagogique adultes","quantity":12,"unit_price":10,"total":120},{"description":"Atelier pedagogique enfants","quantity":8,"unit_price":7,"total":56}]'::jsonb,
      'paid', est_id, '2026-01-27 10:00:00+01'),
    ('facture', 'F-2026-111', '2026-01-28', c_robert,  'Ferme Robert & Fils',  'ferme@robert.fr',    '1 chemin des Prairies','59246', 'Mons-en-Baroeul', 0, 0, 0, 0, 320.00,
      '[{"description":"Foin bio 200kg","quantity":3,"unit_price":80,"total":240},{"description":"Grains bio 80kg","quantity":2,"unit_price":40,"total":80}]'::jsonb,
      'paid', est_id, '2026-01-28 08:00:00+01'),
    ('facture', 'F-2026-012', '2026-01-29', c_lefevre, 'Ecole Lefevre',        'ecole@lefevre.fr',   '8 place de la Gare',   '59100', 'Roubaix',     0, 0, 30, 6.00, 180.00,
      '[{"description":"Sortie scolaire - 30 enfants","quantity":30,"unit_price":6,"total":180}]'::jsonb,
      'paid', est_id, '2026-01-29 14:00:00+01'),
    ('facture', 'F-2026-013', '2026-01-30', c_martin,  'Restaurant Le Martin', 'contact@lemartin.fr','45 avenue Foch',       '59800', 'Lille',        0, 0, 0, 0, 375.00,
      '[{"description":"Panier legumes bio x10","quantity":10,"unit_price":25,"total":250},{"description":"Volailles fermières x5","quantity":5,"unit_price":25,"total":125}]'::jsonb,
      'paid', est_id, '2026-01-30 09:00:00+01'),
    -- 2 factures envoyees (pas encore payees)
    ('facture', 'F-2026-014', '2026-01-30', c_bernard, 'Comite Bernard',       'ce@bernard.fr',      '77 bd de la Liberte',  '59000', 'Lille',        18, 10.00, 12, 7.00, 264.00,
      '[{"description":"Sortie team building adultes","quantity":18,"unit_price":10,"total":180},{"description":"Sortie team building enfants","quantity":12,"unit_price":7,"total":84}]'::jsonb,
      'sent', est_id, '2026-01-30 10:00:00+01'),
    ('facture', 'F-2026-015', '2026-01-31', c_dupont,  'Famille Dupont',       'dupont@email.fr',    '12 rue des Champs',    '59000', 'Lille',        5, 12.00, 3, 8.00, 84.00,
      '[{"description":"Visite ferme adulte","quantity":5,"unit_price":12,"total":60},{"description":"Visite ferme enfant","quantity":3,"unit_price":8,"total":24}]'::jsonb,
      'sent', est_id, '2026-01-31 14:00:00+01');

  -- ============================================================
  -- 5. Factures - Fevrier 2026 (13 factures)
  --    CA encore en hausse (approche du printemps)
  -- ============================================================
  INSERT INTO documents (type, numero, date, client_id, client_name, client_email, client_address, client_postal_code, client_city, nb_adultes, prix_adulte, nb_enfants, prix_enfant, total, line_items, status, establishment_id, created_at) VALUES
    ('facture', 'F-2026-016', '2026-02-03', c_lefevre, 'Ecole Lefevre',        'ecole@lefevre.fr',   '8 place de la Gare',   '59100', 'Roubaix',     0, 0, 32, 6.00, 192.00,
      '[{"description":"Sortie scolaire - 32 enfants","quantity":32,"unit_price":6,"total":192}]'::jsonb,
      'paid', est_id, '2026-02-03 14:00:00+01'),
    ('facture', 'F-2026-017', '2026-02-05', c_robert,  'Ferme Robert & Fils',  'ferme@robert.fr',    '1 chemin des Prairies','59246', 'Mons-en-Baroeul', 0, 0, 0, 0, 640.00,
      '[{"description":"Foin bio 200kg","quantity":6,"unit_price":80,"total":480},{"description":"Grains bio 100kg","quantity":2,"unit_price":50,"total":100},{"description":"Paille 100kg","quantity":2,"unit_price":30,"total":60}]'::jsonb,
      'paid', est_id, '2026-02-05 08:00:00+01'),
    ('facture', 'F-2026-018', '2026-02-07', c_martin,  'Restaurant Le Martin', 'contact@lemartin.fr','45 avenue Foch',       '59800', 'Lille',        0, 0, 0, 0, 500.00,
      '[{"description":"Panier legumes bio x14","quantity":14,"unit_price":25,"total":350},{"description":"Oeufs fermiers x30 dz","quantity":30,"unit_price":5,"total":150}]'::jsonb,
      'paid', est_id, '2026-02-07 09:00:00+01'),
    ('facture', 'F-2026-019', '2026-02-10', c_moreau,  'Pierre Moreau',        'p.moreau@gmail.com', '3 impasse du Moulin',  '59491', 'Villeneuve-d''Ascq', 4, 12.00, 3, 8.00, 72.00,
      '[{"description":"Visite ferme adulte","quantity":4,"unit_price":12,"total":48},{"description":"Visite ferme enfant","quantity":3,"unit_price":8,"total":24}]'::jsonb,
      'paid', est_id, '2026-02-10 11:00:00+01'),
    ('facture', 'F-2026-020', '2026-02-11', c_bernard, 'Comite Bernard',       'ce@bernard.fr',      '77 bd de la Liberte',  '59000', 'Lille',        30, 10.00, 20, 7.00, 440.00,
      '[{"description":"Journee CE adultes","quantity":30,"unit_price":10,"total":300},{"description":"Journee CE enfants","quantity":20,"unit_price":7,"total":140}]'::jsonb,
      'paid', est_id, '2026-02-11 10:00:00+01'),
    ('facture', 'F-2026-021', '2026-02-12', c_laurent, 'Creche Les Laurents',  'contact@laurents.fr','14 rue Colbert',       '59300', 'Valenciennes', 6, 0, 22, 5.00, 110.00,
      '[{"description":"Sortie creche - 22 enfants","quantity":22,"unit_price":5,"total":110}]'::jsonb,
      'paid', est_id, '2026-02-12 09:30:00+01'),
    ('facture', 'F-2026-022', '2026-02-13', c_simon,   'Jacques Simon',        'j.simon@free.fr',    '9 allee des Tilleuls', '59650', 'Villeneuve-d''Ascq', 3, 12.00, 2, 8.00, 52.00,
      '[{"description":"Visite ferme adulte","quantity":3,"unit_price":12,"total":36},{"description":"Visite ferme enfant","quantity":2,"unit_price":8,"total":16}]'::jsonb,
      'paid', est_id, '2026-02-13 15:00:00+01'),
    ('facture', 'F-2026-023', '2026-02-14', c_dupont,  'Famille Dupont',       'dupont@email.fr',    '12 rue des Champs',    '59000', 'Lille',        4, 12.00, 3, 8.00, 72.00,
      '[{"description":"Visite St-Valentin adulte","quantity":4,"unit_price":12,"total":48},{"description":"Visite St-Valentin enfant","quantity":3,"unit_price":8,"total":24}]'::jsonb,
      'paid', est_id, '2026-02-14 14:00:00+01'),
    ('facture', 'F-2026-024', '2026-02-17', c_petit,   'Marie Petit',          'm.petit@outlook.fr', '21 rue Nationale',     '59200', 'Tourcoing',    3, 12.00, 2, 8.00, 52.00,
      '[{"description":"Visite ferme adulte","quantity":3,"unit_price":12,"total":36},{"description":"Visite ferme enfant","quantity":2,"unit_price":8,"total":16}]'::jsonb,
      'paid', est_id, '2026-02-17 10:00:00+01'),
    ('facture', 'F-2026-025', '2026-02-18', c_durand,  'Association Durand',   'asso@durand.org',    '55 rue de Douai',      '59000', 'Lille',        20, 10.00, 15, 7.00, 305.00,
      '[{"description":"Atelier nature adultes","quantity":20,"unit_price":10,"total":200},{"description":"Atelier nature enfants","quantity":15,"unit_price":7,"total":105}]'::jsonb,
      'paid', est_id, '2026-02-18 10:00:00+01'),
    -- 3 factures envoyees (en attente de paiement)
    ('facture', 'F-2026-026', '2026-02-18', c_robert,  'Ferme Robert & Fils',  'ferme@robert.fr',    '1 chemin des Prairies','59246', 'Mons-en-Baroeul', 0, 0, 0, 0, 480.00,
      '[{"description":"Foin bio 200kg","quantity":4,"unit_price":80,"total":320},{"description":"Grains bio 100kg","quantity":2,"unit_price":50,"total":100},{"description":"Paille 100kg","quantity":2,"unit_price":30,"total":60}]'::jsonb,
      'sent', est_id, '2026-02-18 08:00:00+01'),
    ('facture', 'F-2026-027', '2026-02-19', c_lefevre, 'Ecole Lefevre',        'ecole@lefevre.fr',   '8 place de la Gare',   '59100', 'Roubaix',     0, 0, 35, 6.00, 210.00,
      '[{"description":"Sortie scolaire - 35 enfants","quantity":35,"unit_price":6,"total":210}]'::jsonb,
      'sent', est_id, '2026-02-19 14:00:00+01'),
    ('facture', 'F-2026-028', '2026-02-19', c_martin,  'Restaurant Le Martin', 'contact@lemartin.fr','45 avenue Foch',       '59800', 'Lille',        0, 0, 0, 0, 550.00,
      '[{"description":"Panier legumes bio x16","quantity":16,"unit_price":25,"total":400},{"description":"Volailles fermières x6","quantity":6,"unit_price":25,"total":150}]'::jsonb,
      'sent', est_id, '2026-02-19 09:00:00+01');

  -- ============================================================
  -- 6. Avoir sur la facture F-2025-008 (Association Durand)
  -- ============================================================
  INSERT INTO documents (id, type, numero, date, client_id, client_name, client_email, client_address, client_postal_code, client_city, nb_adultes, prix_adulte, nb_enfants, prix_enfant, total, line_items, status, cancelled_by_id, establishment_id, created_at) VALUES
    (gen_random_uuid(), 'avoir', 'A-2025-101', '2025-12-20', c_durand, 'Association Durand', 'asso@durand.org', '55 rue de Douai', '59000', 'Lille', 15, 10.00, 10, 7.00, 220.00,
      '[{"description":"Annulation atelier decouverte adultes","quantity":15,"unit_price":10,"total":150},{"description":"Annulation atelier decouverte enfants","quantity":10,"unit_price":7,"total":70}]'::jsonb,
      'validated', NULL, est_id, '2025-12-20 10:00:00+01');

  -- Lier l'avoir a la facture
  UPDATE documents SET cancelled_by_id = (SELECT id FROM documents WHERE numero = 'A-2025-101' AND establishment_id = est_id)
    WHERE id = f_avoir_target;
  UPDATE documents SET status = 'cancelled' WHERE id = f_avoir_target;

  -- ============================================================
  -- 7. Devis en cours (~15)
  -- ============================================================
  INSERT INTO documents (type, numero, date, client_id, client_name, client_email, client_address, client_postal_code, client_city, nb_adultes, prix_adulte, nb_enfants, prix_enfant, total, line_items, status, establishment_id, created_at) VALUES
    -- 5 devis draft
    ('devis', 'D-2026-101', '2026-02-10', c_bernard, 'Comite Bernard',       'ce@bernard.fr',      '77 bd de la Liberte',  '59000', 'Lille',        35, 10.00, 25, 7.00, 525.00,
      '[{"description":"Journee printemps CE adultes","quantity":35,"unit_price":10,"total":350},{"description":"Journee printemps CE enfants","quantity":25,"unit_price":7,"total":175}]'::jsonb,
      'draft', est_id, '2026-02-10 10:00:00+01'),
    ('devis', 'D-2026-102', '2026-02-11', c_lefevre, 'Ecole Lefevre',        'ecole@lefevre.fr',   '8 place de la Gare',   '59100', 'Roubaix',     0, 0, 40, 6.00, 240.00,
      '[{"description":"Sortie scolaire mars - 40 enfants","quantity":40,"unit_price":6,"total":240}]'::jsonb,
      'draft', est_id, '2026-02-11 14:00:00+01'),
    ('devis', 'D-2026-103', '2026-02-12', c_robert,  'Ferme Robert & Fils',  'ferme@robert.fr',    '1 chemin des Prairies','59246', 'Mons-en-Baroeul', 0, 0, 0, 0, 750.00,
      '[{"description":"Foin bio 200kg","quantity":7,"unit_price":80,"total":560},{"description":"Grains bio 100kg","quantity":2,"unit_price":50,"total":100},{"description":"Complements mineraux","quantity":2,"unit_price":45,"total":90}]'::jsonb,
      'draft', est_id, '2026-02-12 08:00:00+01'),
    ('devis', 'D-2026-104', '2026-02-13', c_dupont,  'Famille Dupont',       'dupont@email.fr',    '12 rue des Champs',    '59000', 'Lille',        8, 12.00, 6, 8.00, 144.00,
      '[{"description":"Anniversaire ferme adultes","quantity":8,"unit_price":12,"total":96},{"description":"Anniversaire ferme enfants","quantity":6,"unit_price":8,"total":48}]'::jsonb,
      'draft', est_id, '2026-02-13 11:00:00+01'),
    ('devis', 'D-2026-105', '2026-02-14', c_petit,   'Marie Petit',          'm.petit@outlook.fr', '21 rue Nationale',     '59200', 'Tourcoing',    4, 12.00, 3, 8.00, 72.00,
      '[{"description":"Visite ferme adulte","quantity":4,"unit_price":12,"total":48},{"description":"Visite ferme enfant","quantity":3,"unit_price":8,"total":24}]'::jsonb,
      'draft', est_id, '2026-02-14 15:00:00+01'),

    -- 6 devis envoyes (en attente de reponse)
    ('devis', 'D-2026-106', '2026-02-05', c_durand,  'Association Durand',   'asso@durand.org',    '55 rue de Douai',      '59000', 'Lille',        25, 10.00, 20, 7.00, 390.00,
      '[{"description":"Atelier printemps adultes","quantity":25,"unit_price":10,"total":250},{"description":"Atelier printemps enfants","quantity":20,"unit_price":7,"total":140}]'::jsonb,
      'sent', est_id, '2026-02-05 10:00:00+01'),
    ('devis', 'D-2026-107', '2026-02-06', c_laurent, 'Creche Les Laurents',  'contact@laurents.fr','14 rue Colbert',       '59300', 'Valenciennes', 8, 0, 25, 5.00, 125.00,
      '[{"description":"Sortie printemps creche - 25 enfants","quantity":25,"unit_price":5,"total":125}]'::jsonb,
      'sent', est_id, '2026-02-06 09:30:00+01'),
    ('devis', 'D-2026-108', '2026-02-07', c_simon,   'Jacques Simon',        'j.simon@free.fr',    '9 allee des Tilleuls', '59650', 'Villeneuve-d''Ascq', 6, 12.00, 4, 8.00, 104.00,
      '[{"description":"Visite groupe adulte","quantity":6,"unit_price":12,"total":72},{"description":"Visite groupe enfant","quantity":4,"unit_price":8,"total":32}]'::jsonb,
      'sent', est_id, '2026-02-07 16:00:00+01'),
    ('devis', 'D-2026-109', '2026-02-08', c_moreau,  'Pierre Moreau',        'p.moreau@gmail.com', '3 impasse du Moulin',  '59491', 'Villeneuve-d''Ascq', 10, 12.00, 8, 8.00, 184.00,
      '[{"description":"Fete familiale adultes","quantity":10,"unit_price":12,"total":120},{"description":"Fete familiale enfants","quantity":8,"unit_price":8,"total":64}]'::jsonb,
      'sent', est_id, '2026-02-08 11:00:00+01'),
    ('devis', 'D-2026-110', '2026-02-09', c_martin,  'Restaurant Le Martin', 'contact@lemartin.fr','45 avenue Foch',       '59800', 'Lille',        0, 0, 0, 0, 625.00,
      '[{"description":"Panier legumes bio x18","quantity":18,"unit_price":25,"total":450},{"description":"Volailles fermières x7","quantity":7,"unit_price":25,"total":175}]'::jsonb,
      'sent', est_id, '2026-02-09 09:00:00+01'),
    ('devis', 'D-2026-111', '2026-02-15', c_bernard, 'Comite Bernard',       'ce@bernard.fr',      '77 bd de la Liberte',  '59000', 'Lille',        40, 10.00, 30, 7.00, 610.00,
      '[{"description":"Journee Paques CE adultes","quantity":40,"unit_price":10,"total":400},{"description":"Journee Paques CE enfants","quantity":30,"unit_price":7,"total":210}]'::jsonb,
      'sent', est_id, '2026-02-15 10:00:00+01'),

    -- 4 devis annules (historique)
    ('devis', 'D-2026-112', '2026-01-15', c_petit,   'Marie Petit',          'm.petit@outlook.fr', '21 rue Nationale',     '59200', 'Tourcoing',    2, 12.00, 1, 8.00, 32.00,
      '[{"description":"Visite ferme adulte","quantity":2,"unit_price":12,"total":24},{"description":"Visite ferme enfant","quantity":1,"unit_price":8,"total":8}]'::jsonb,
      'cancelled', est_id, '2026-01-15 15:00:00+01'),
    ('devis', 'D-2026-113', '2026-01-20', c_simon,   'Jacques Simon',        'j.simon@free.fr',    '9 allee des Tilleuls', '59650', 'Villeneuve-d''Ascq', 3, 12.00, 2, 8.00, 52.00,
      '[{"description":"Visite ferme adulte","quantity":3,"unit_price":12,"total":36},{"description":"Visite ferme enfant","quantity":2,"unit_price":8,"total":16}]'::jsonb,
      'cancelled', est_id, '2026-01-20 16:00:00+01'),
    ('devis', 'D-2026-114', '2026-01-25', c_moreau,  'Pierre Moreau',        'p.moreau@gmail.com', '3 impasse du Moulin',  '59491', 'Villeneuve-d''Ascq', 5, 12.00, 4, 8.00, 92.00,
      '[{"description":"Visite groupe adulte","quantity":5,"unit_price":12,"total":60},{"description":"Visite groupe enfant","quantity":4,"unit_price":8,"total":32}]'::jsonb,
      'cancelled', est_id, '2026-01-25 10:00:00+01'),
    ('devis', 'D-2026-115', '2026-02-01', c_dupont,  'Famille Dupont',       'dupont@email.fr',    '12 rue des Champs',    '59000', 'Lille',        6, 12.00, 5, 8.00, 112.00,
      '[{"description":"Visite ferme adulte","quantity":6,"unit_price":12,"total":72},{"description":"Visite ferme enfant","quantity":5,"unit_price":8,"total":40}]'::jsonb,
      'cancelled', est_id, '2026-02-01 14:00:00+01');

  RAISE NOTICE '===================================================';
  RAISE NOTICE 'Donnees de test inserees avec succes !';
  RAISE NOTICE '===================================================';
  RAISE NOTICE '10 clients crees';
  RAISE NOTICE '40 factures (12 dec + 15 jan + 13 fev)';
  RAISE NOTICE '  - 33 payees, 5 envoyees, 1 annulee + avoir';
  RAISE NOTICE '15 devis (5 draft, 6 envoyes, 4 annules)';
  RAISE NOTICE '1 avoir (A-2025-001 sur F-2025-008)';
  RAISE NOTICE '---------------------------------------------------';
  RAISE NOTICE 'CA paye dec 2025 :  2 075.00 EUR';
  RAISE NOTICE 'CA paye jan 2026 :  2 808.00 EUR';
  RAISE NOTICE 'CA paye fev 2026 :  2 435.00 EUR';
  RAISE NOTICE 'CA en attente    :  1 588.00 EUR';
  RAISE NOTICE '===================================================';

END $$;
