-- ============================================================
-- Script 3/3 : Creation de 40 factures + 1 avoir
-- Etablissement : "Test"
-- Prerequis : 01-seed-clients.sql execute
-- CA : Dec 2 075 EUR | Jan 2 808 EUR | Fev 2 435 EUR
-- ============================================================

DO $$
DECLARE
  est_id UUID;
  -- Client IDs
  c_dupont UUID;
  c_petit UUID;
  c_moreau UUID;
  c_simon UUID;
  c_fontaine UUID;
  c_legrand UUID;
  c_marchand UUID;
  c_dubois UUID;
  c_roux UUID;
  c_garnier UUID;
  c_chevalier UUID;
  c_carpentier UUID;
  c_leroy UUID;
  c_vasseur UUID;
  c_lemaire UUID;
  c_caron UUID;
  c_martin UUID;
  c_lefevre UUID;
  c_bernard UUID;
  c_robert UUID;
  c_durand UUID;
  c_laurents UUID;
  c_pasteur UUID;
  c_ehpad UUID;
  c_brasserie UUID;
  c_lomme UUID;
  c_montessori UUID;
  c_chezpaul UUID;
  c_mjc UUID;
  c_biocoop UUID;
  c_seniors UUID;
  c_vracbio UUID;
  c_auchan UUID;
  -- Pour l'avoir
  f_avoir_target UUID;
BEGIN

  SELECT id INTO est_id FROM establishments WHERE name = 'Test';
  IF est_id IS NULL THEN
    RAISE EXCEPTION 'Etablissement "Test" introuvable.';
  END IF;

  -- Lookup clients
  SELECT id INTO c_dupont     FROM clients WHERE name = 'Famille Dupont'          AND establishment_id = est_id;
  SELECT id INTO c_petit      FROM clients WHERE name = 'Marie Petit'             AND establishment_id = est_id;
  SELECT id INTO c_moreau     FROM clients WHERE name = 'Pierre Moreau'           AND establishment_id = est_id;
  SELECT id INTO c_simon      FROM clients WHERE name = 'Jacques Simon'           AND establishment_id = est_id;
  SELECT id INTO c_fontaine   FROM clients WHERE name = 'Claire Fontaine'         AND establishment_id = est_id;
  SELECT id INTO c_legrand    FROM clients WHERE name = 'Thomas Legrand'          AND establishment_id = est_id;
  SELECT id INTO c_marchand   FROM clients WHERE name = 'Sophie Marchand'         AND establishment_id = est_id;
  SELECT id INTO c_dubois     FROM clients WHERE name = 'Antoine Dubois'          AND establishment_id = est_id;
  SELECT id INTO c_roux       FROM clients WHERE name = 'Nathalie Roux'           AND establishment_id = est_id;
  SELECT id INTO c_garnier    FROM clients WHERE name = 'Julien Garnier'          AND establishment_id = est_id;
  SELECT id INTO c_chevalier  FROM clients WHERE name = 'Isabelle Chevalier'      AND establishment_id = est_id;
  SELECT id INTO c_carpentier FROM clients WHERE name = 'Famille Carpentier'      AND establishment_id = est_id;
  SELECT id INTO c_leroy      FROM clients WHERE name = 'Marc Leroy'              AND establishment_id = est_id;
  SELECT id INTO c_vasseur    FROM clients WHERE name = 'Emilie Vasseur'          AND establishment_id = est_id;
  SELECT id INTO c_lemaire    FROM clients WHERE name = 'Famille Lemaire'         AND establishment_id = est_id;
  SELECT id INTO c_caron      FROM clients WHERE name = 'David Caron'             AND establishment_id = est_id;
  SELECT id INTO c_martin     FROM clients WHERE name = 'Restaurant Le Martin'    AND establishment_id = est_id;
  SELECT id INTO c_lefevre    FROM clients WHERE name = 'Ecole Lefevre'           AND establishment_id = est_id;
  SELECT id INTO c_bernard    FROM clients WHERE name = 'Comite Bernard CE'       AND establishment_id = est_id;
  SELECT id INTO c_robert     FROM clients WHERE name = 'Ferme Robert & Fils'     AND establishment_id = est_id;
  SELECT id INTO c_durand     FROM clients WHERE name = 'Association Durand'      AND establishment_id = est_id;
  SELECT id INTO c_laurents   FROM clients WHERE name = 'Creche Les Laurents'     AND establishment_id = est_id;
  SELECT id INTO c_pasteur    FROM clients WHERE name = 'Lycee Pasteur'           AND establishment_id = est_id;
  SELECT id INTO c_ehpad      FROM clients WHERE name = 'EHPAD Les Jardins'       AND establishment_id = est_id;
  SELECT id INTO c_brasserie  FROM clients WHERE name = 'Brasserie du Nord'       AND establishment_id = est_id;
  SELECT id INTO c_lomme      FROM clients WHERE name = 'Mairie de Lomme'         AND establishment_id = est_id;
  SELECT id INTO c_montessori FROM clients WHERE name = 'Ecole Montessori Nord'   AND establishment_id = est_id;
  SELECT id INTO c_chezpaul   FROM clients WHERE name = 'Restaurant Chez Paul'    AND establishment_id = est_id;
  SELECT id INTO c_mjc        FROM clients WHERE name = 'MJC Jean Mace'           AND establishment_id = est_id;
  SELECT id INTO c_biocoop    FROM clients WHERE name = 'Biocoop Wazemmes'        AND establishment_id = est_id;
  SELECT id INTO c_seniors    FROM clients WHERE name = 'Club Seniors Fives'      AND establishment_id = est_id;
  SELECT id INTO c_vracbio    FROM clients WHERE name = 'Epicerie Vrac & Bio'     AND establishment_id = est_id;
  SELECT id INTO c_auchan     FROM clients WHERE name = 'Comite Entreprise Auchan' AND establishment_id = est_id;

  -- ============================================================
  -- DECEMBRE 2025 - 12 factures (toutes payees)
  -- CA paye : 2 075 EUR
  -- ============================================================
  f_avoir_target := gen_random_uuid();

  INSERT INTO documents (id, type, numero, date, client_id, client_name, client_email, client_address, client_postal_code, client_city, nb_adultes, prix_adulte, nb_enfants, prix_enfant, total, line_items, status, establishment_id, created_at) VALUES

    (gen_random_uuid(), 'facture', 'F-2025-101', '2025-12-02', c_dupont, 'Famille Dupont', 'dupont@email.fr', '12 rue des Champs', '59000', 'Lille',
      4, 12.00, 2, 8.00, 64.00,
      '[{"description":"Visite ferme adulte","quantity":4,"unit_price":12,"total":48},{"description":"Visite ferme enfant","quantity":2,"unit_price":8,"total":16}]'::jsonb,
      'paid', est_id, '2025-12-02 10:00:00+01'),

    (gen_random_uuid(), 'facture', 'F-2025-102', '2025-12-03', c_martin, 'Restaurant Le Martin', 'contact@lemartin.fr', '45 avenue Foch', '59800', 'Lille',
      0, 0, 0, 0, 350.00,
      '[{"description":"Panier legumes bio x10","quantity":10,"unit_price":25,"total":250},{"description":"Oeufs fermiers x20 dz","quantity":20,"unit_price":5,"total":100}]'::jsonb,
      'paid', est_id, '2025-12-03 09:30:00+01'),

    (gen_random_uuid(), 'facture', 'F-2025-103', '2025-12-05', c_lefevre, 'Ecole Lefevre', 'ecole@lefevre.fr', '8 place de la Gare', '59100', 'Roubaix',
      0, 0, 25, 6.00, 150.00,
      '[{"description":"Sortie scolaire - 25 enfants","quantity":25,"unit_price":6,"total":150}]'::jsonb,
      'paid', est_id, '2025-12-05 14:00:00+01'),

    (gen_random_uuid(), 'facture', 'F-2025-104', '2025-12-09', c_moreau, 'Pierre Moreau', 'p.moreau@gmail.com', '3 impasse du Moulin', '59491', 'Villeneuve-d''Ascq',
      2, 12.00, 3, 8.00, 48.00,
      '[{"description":"Visite ferme adulte","quantity":2,"unit_price":12,"total":24},{"description":"Visite ferme enfant","quantity":3,"unit_price":8,"total":24}]'::jsonb,
      'paid', est_id, '2025-12-09 11:00:00+01'),

    (gen_random_uuid(), 'facture', 'F-2025-105', '2025-12-10', c_bernard, 'Comite Bernard CE', 'ce@bernard.fr', '77 bd de la Liberte', '59000', 'Lille',
      20, 10.00, 15, 7.00, 305.00,
      '[{"description":"Animation CE adultes","quantity":20,"unit_price":10,"total":200},{"description":"Animation CE enfants","quantity":15,"unit_price":7,"total":105}]'::jsonb,
      'paid', est_id, '2025-12-10 10:00:00+01'),

    (gen_random_uuid(), 'facture', 'F-2025-106', '2025-12-12', c_robert, 'Ferme Robert & Fils', 'ferme@robert.fr', '1 chemin des Prairies', '59246', 'Mons-en-Baroeul',
      0, 0, 0, 0, 420.00,
      '[{"description":"Foin bio 200kg","quantity":4,"unit_price":80,"total":320},{"description":"Grains bio 100kg","quantity":2,"unit_price":50,"total":100}]'::jsonb,
      'paid', est_id, '2025-12-12 08:00:00+01'),

    (gen_random_uuid(), 'facture', 'F-2025-107', '2025-12-15', c_petit, 'Marie Petit', 'm.petit@outlook.fr', '21 rue Nationale', '59200', 'Tourcoing',
      2, 12.00, 1, 8.00, 32.00,
      '[{"description":"Visite ferme adulte","quantity":2,"unit_price":12,"total":24},{"description":"Visite ferme enfant","quantity":1,"unit_price":8,"total":8}]'::jsonb,
      'paid', est_id, '2025-12-15 15:00:00+01'),

    (f_avoir_target, 'facture', 'F-2025-108', '2025-12-16', c_durand, 'Association Durand', 'asso@durand.org', '55 rue de Douai', '59000', 'Lille',
      15, 10.00, 10, 7.00, 220.00,
      '[{"description":"Atelier decouverte adultes","quantity":15,"unit_price":10,"total":150},{"description":"Atelier decouverte enfants","quantity":10,"unit_price":7,"total":70}]'::jsonb,
      'paid', est_id, '2025-12-16 10:00:00+01'),

    (gen_random_uuid(), 'facture', 'F-2025-109', '2025-12-18', c_simon, 'Jacques Simon', 'j.simon@free.fr', '9 allee des Tilleuls', '59650', 'Villeneuve-d''Ascq',
      1, 12.00, 0, 0, 12.00,
      '[{"description":"Visite ferme adulte","quantity":1,"unit_price":12,"total":12}]'::jsonb,
      'paid', est_id, '2025-12-18 16:00:00+01'),

    (gen_random_uuid(), 'facture', 'F-2025-110', '2025-12-22', c_laurents, 'Creche Les Laurents', 'contact@laurents.fr', '14 rue Colbert', '59300', 'Valenciennes',
      5, 0, 18, 5.00, 90.00,
      '[{"description":"Sortie creche - 18 enfants","quantity":18,"unit_price":5,"total":90}]'::jsonb,
      'paid', est_id, '2025-12-22 09:30:00+01'),

    (gen_random_uuid(), 'facture', 'F-2025-111', '2025-12-23', c_fontaine, 'Claire Fontaine', 'c.fontaine@gmail.com', '15 rue Victor Hugo', '59000', 'Lille',
      6, 12.00, 4, 8.00, 104.00,
      '[{"description":"Visite Noel adulte","quantity":6,"unit_price":12,"total":72},{"description":"Visite Noel enfant","quantity":4,"unit_price":8,"total":32}]'::jsonb,
      'paid', est_id, '2025-12-23 10:00:00+01'),

    (gen_random_uuid(), 'facture', 'F-2025-112', '2025-12-27', c_brasserie, 'Brasserie du Nord', 'commandes@brasserienord.fr', '28 rue de Gand', '59000', 'Lille',
      0, 0, 0, 0, 280.00,
      '[{"description":"Panier legumes bio x8","quantity":8,"unit_price":25,"total":200},{"description":"Volailles fermieres x4","quantity":4,"unit_price":20,"total":80}]'::jsonb,
      'paid', est_id, '2025-12-27 08:00:00+01');

  -- ============================================================
  -- JANVIER 2026 - 15 factures (13 payees, 2 envoyees)
  -- CA paye : 2 808 EUR | CA en attente : 348 EUR
  -- ============================================================
  INSERT INTO documents (type, numero, date, client_id, client_name, client_email, client_address, client_postal_code, client_city, nb_adultes, prix_adulte, nb_enfants, prix_enfant, total, line_items, status, establishment_id, created_at) VALUES

    ('facture', 'F-2026-101', '2026-01-06', c_lefevre, 'Ecole Lefevre', 'ecole@lefevre.fr', '8 place de la Gare', '59100', 'Roubaix',
      0, 0, 28, 6.00, 168.00,
      '[{"description":"Sortie scolaire - 28 enfants","quantity":28,"unit_price":6,"total":168}]'::jsonb,
      'paid', est_id, '2026-01-06 14:00:00+01'),

    ('facture', 'F-2026-102', '2026-01-08', c_robert, 'Ferme Robert & Fils', 'ferme@robert.fr', '1 chemin des Prairies', '59246', 'Mons-en-Baroeul',
      0, 0, 0, 0, 510.00,
      '[{"description":"Foin bio 200kg","quantity":5,"unit_price":80,"total":400},{"description":"Complements mineraux","quantity":2,"unit_price":55,"total":110}]'::jsonb,
      'paid', est_id, '2026-01-08 08:00:00+01'),

    ('facture', 'F-2026-103', '2026-01-10', c_bernard, 'Comite Bernard CE', 'ce@bernard.fr', '77 bd de la Liberte', '59000', 'Lille',
      25, 10.00, 20, 7.00, 390.00,
      '[{"description":"Galette des Rois CE adultes","quantity":25,"unit_price":10,"total":250},{"description":"Galette des Rois CE enfants","quantity":20,"unit_price":7,"total":140}]'::jsonb,
      'paid', est_id, '2026-01-10 10:00:00+01'),

    ('facture', 'F-2026-104', '2026-01-13', c_moreau, 'Pierre Moreau', 'p.moreau@gmail.com', '3 impasse du Moulin', '59491', 'Villeneuve-d''Ascq',
      2, 12.00, 2, 8.00, 40.00,
      '[{"description":"Visite ferme adulte","quantity":2,"unit_price":12,"total":24},{"description":"Visite ferme enfant","quantity":2,"unit_price":8,"total":16}]'::jsonb,
      'paid', est_id, '2026-01-13 11:00:00+01'),

    ('facture', 'F-2026-105', '2026-01-15', c_martin, 'Restaurant Le Martin', 'contact@lemartin.fr', '45 avenue Foch', '59800', 'Lille',
      0, 0, 0, 0, 425.00,
      '[{"description":"Panier legumes bio x12","quantity":12,"unit_price":25,"total":300},{"description":"Oeufs fermiers x25 dz","quantity":25,"unit_price":5,"total":125}]'::jsonb,
      'paid', est_id, '2026-01-15 09:00:00+01'),

    ('facture', 'F-2026-106', '2026-01-17', c_legrand, 'Thomas Legrand', 't.legrand@hotmail.fr', '27 rue de Bethune', '59000', 'Lille',
      3, 12.00, 2, 8.00, 52.00,
      '[{"description":"Visite ferme adulte","quantity":3,"unit_price":12,"total":36},{"description":"Visite ferme enfant","quantity":2,"unit_price":8,"total":16}]'::jsonb,
      'paid', est_id, '2026-01-17 14:00:00+01'),

    ('facture', 'F-2026-107', '2026-01-20', c_laurents, 'Creche Les Laurents', 'contact@laurents.fr', '14 rue Colbert', '59300', 'Valenciennes',
      4, 0, 20, 5.00, 100.00,
      '[{"description":"Sortie creche - 20 enfants","quantity":20,"unit_price":5,"total":100}]'::jsonb,
      'paid', est_id, '2026-01-20 09:30:00+01'),

    ('facture', 'F-2026-108', '2026-01-22', c_ehpad, 'EHPAD Les Jardins', 'direction@ehpad-jardins.fr', '12 rue des Fleurs', '59491', 'Villeneuve-d''Ascq',
      20, 8.00, 0, 0, 160.00,
      '[{"description":"Atelier therapeutique seniors","quantity":20,"unit_price":8,"total":160}]'::jsonb,
      'paid', est_id, '2026-01-22 15:00:00+01'),

    ('facture', 'F-2026-109', '2026-01-24', c_petit, 'Marie Petit', 'm.petit@outlook.fr', '21 rue Nationale', '59200', 'Tourcoing',
      2, 12.00, 2, 8.00, 40.00,
      '[{"description":"Visite ferme adulte","quantity":2,"unit_price":12,"total":24},{"description":"Visite ferme enfant","quantity":2,"unit_price":8,"total":16}]'::jsonb,
      'paid', est_id, '2026-01-24 10:30:00+01'),

    ('facture', 'F-2026-110', '2026-01-27', c_durand, 'Association Durand', 'asso@durand.org', '55 rue de Douai', '59000', 'Lille',
      12, 10.00, 8, 7.00, 176.00,
      '[{"description":"Atelier pedagogique adultes","quantity":12,"unit_price":10,"total":120},{"description":"Atelier pedagogique enfants","quantity":8,"unit_price":7,"total":56}]'::jsonb,
      'paid', est_id, '2026-01-27 10:00:00+01'),

    ('facture', 'F-2026-111', '2026-01-28', c_biocoop, 'Biocoop Wazemmes', 'magasin@biocoop-waz.fr', '45 rue Gambetta', '59000', 'Lille',
      0, 0, 0, 0, 320.00,
      '[{"description":"Paniers legumes bio x8","quantity":8,"unit_price":25,"total":200},{"description":"Oeufs fermiers x12 dz","quantity":12,"unit_price":5,"total":60},{"description":"Confitures artisanales x12","quantity":12,"unit_price":5,"total":60}]'::jsonb,
      'paid', est_id, '2026-01-28 08:00:00+01'),

    ('facture', 'F-2026-112', '2026-01-29', c_montessori, 'Ecole Montessori Nord', 'info@montessori-nord.fr', '17 rue Colbert', '59000', 'Lille',
      0, 0, 18, 6.00, 108.00,
      '[{"description":"Visite pedagogique - 18 enfants","quantity":18,"unit_price":6,"total":108}]'::jsonb,
      'paid', est_id, '2026-01-29 14:00:00+01'),

    ('facture', 'F-2026-113', '2026-01-30', c_vracbio, 'Epicerie Vrac & Bio', 'contact@vrac-bio.fr', '22 rue Masena', '59000', 'Lille',
      0, 0, 0, 0, 319.00,
      '[{"description":"Legumes bio assortis 30kg","quantity":30,"unit_price":4,"total":120},{"description":"Oeufs fermiers x15 dz","quantity":15,"unit_price":5,"total":75},{"description":"Fromages fermiers x8","quantity":8,"unit_price":8,"total":64},{"description":"Miel artisanal x6","quantity":6,"unit_price":10,"total":60}]'::jsonb,
      'paid', est_id, '2026-01-30 09:00:00+01'),

    -- 2 factures envoyees (pas encore payees)
    ('facture', 'F-2026-114', '2026-01-30', c_auchan, 'Comite Entreprise Auchan', 'ce@auchan-nord.fr', '200 rue de la Recherche', '59650', 'Villeneuve-d''Ascq',
      18, 10.00, 12, 7.00, 264.00,
      '[{"description":"Sortie team building adultes","quantity":18,"unit_price":10,"total":180},{"description":"Sortie team building enfants","quantity":12,"unit_price":7,"total":84}]'::jsonb,
      'sent', est_id, '2026-01-30 10:00:00+01'),

    ('facture', 'F-2026-115', '2026-01-31', c_carpentier, 'Famille Carpentier', 'carpentier@email.fr', '7 rue des Postes', '59000', 'Lille',
      5, 12.00, 3, 8.00, 84.00,
      '[{"description":"Visite ferme adulte","quantity":5,"unit_price":12,"total":60},{"description":"Visite ferme enfant","quantity":3,"unit_price":8,"total":24}]'::jsonb,
      'sent', est_id, '2026-01-31 14:00:00+01');

  -- ============================================================
  -- FEVRIER 2026 - 13 factures (10 payees, 3 envoyees)
  -- CA paye : 2 435 EUR | CA en attente : 1 240 EUR
  -- ============================================================
  INSERT INTO documents (type, numero, date, client_id, client_name, client_email, client_address, client_postal_code, client_city, nb_adultes, prix_adulte, nb_enfants, prix_enfant, total, line_items, status, establishment_id, created_at) VALUES

    ('facture', 'F-2026-116', '2026-02-03', c_lefevre, 'Ecole Lefevre', 'ecole@lefevre.fr', '8 place de la Gare', '59100', 'Roubaix',
      0, 0, 32, 6.00, 192.00,
      '[{"description":"Sortie scolaire - 32 enfants","quantity":32,"unit_price":6,"total":192}]'::jsonb,
      'paid', est_id, '2026-02-03 14:00:00+01'),

    ('facture', 'F-2026-117', '2026-02-05', c_robert, 'Ferme Robert & Fils', 'ferme@robert.fr', '1 chemin des Prairies', '59246', 'Mons-en-Baroeul',
      0, 0, 0, 0, 640.00,
      '[{"description":"Foin bio 200kg","quantity":6,"unit_price":80,"total":480},{"description":"Grains bio 100kg","quantity":2,"unit_price":50,"total":100},{"description":"Paille 100kg","quantity":2,"unit_price":30,"total":60}]'::jsonb,
      'paid', est_id, '2026-02-05 08:00:00+01'),

    ('facture', 'F-2026-118', '2026-02-07', c_chezpaul, 'Restaurant Chez Paul', 'reservation@chezpaul.fr', '10 rue de la Barre', '59000', 'Lille',
      0, 0, 0, 0, 375.00,
      '[{"description":"Panier legumes bio x10","quantity":10,"unit_price":25,"total":250},{"description":"Oeufs fermiers x25 dz","quantity":25,"unit_price":5,"total":125}]'::jsonb,
      'paid', est_id, '2026-02-07 09:00:00+01'),

    ('facture', 'F-2026-119', '2026-02-10', c_dubois, 'Antoine Dubois', 'a.dubois@orange.fr', '42 rue Gambetta', '59100', 'Roubaix',
      4, 12.00, 3, 8.00, 72.00,
      '[{"description":"Visite ferme adulte","quantity":4,"unit_price":12,"total":48},{"description":"Visite ferme enfant","quantity":3,"unit_price":8,"total":24}]'::jsonb,
      'paid', est_id, '2026-02-10 11:00:00+01'),

    ('facture', 'F-2026-120', '2026-02-11', c_mjc, 'MJC Jean Mace', 'direction@mjc-mace.fr', '30 rue Jean Mace', '59100', 'Roubaix',
      15, 10.00, 20, 7.00, 290.00,
      '[{"description":"Atelier decouverte adultes","quantity":15,"unit_price":10,"total":150},{"description":"Atelier decouverte enfants","quantity":20,"unit_price":7,"total":140}]'::jsonb,
      'paid', est_id, '2026-02-11 10:00:00+01'),

    ('facture', 'F-2026-121', '2026-02-12', c_laurents, 'Creche Les Laurents', 'contact@laurents.fr', '14 rue Colbert', '59300', 'Valenciennes',
      6, 0, 22, 5.00, 110.00,
      '[{"description":"Sortie creche - 22 enfants","quantity":22,"unit_price":5,"total":110}]'::jsonb,
      'paid', est_id, '2026-02-12 09:30:00+01'),

    ('facture', 'F-2026-122', '2026-02-13', c_garnier, 'Julien Garnier', 'j.garnier@laposte.net', '18 boulevard Vauban', '59000', 'Lille',
      3, 12.00, 2, 8.00, 52.00,
      '[{"description":"Visite ferme adulte","quantity":3,"unit_price":12,"total":36},{"description":"Visite ferme enfant","quantity":2,"unit_price":8,"total":16}]'::jsonb,
      'paid', est_id, '2026-02-13 15:00:00+01'),

    ('facture', 'F-2026-123', '2026-02-14', c_marchand, 'Sophie Marchand', 's.marchand@yahoo.fr', '5 place du Theatre', '59800', 'Lille',
      4, 12.00, 3, 8.00, 72.00,
      '[{"description":"Visite St-Valentin adulte","quantity":4,"unit_price":12,"total":48},{"description":"Visite St-Valentin enfant","quantity":3,"unit_price":8,"total":24}]'::jsonb,
      'paid', est_id, '2026-02-14 14:00:00+01'),

    ('facture', 'F-2026-124', '2026-02-17', c_seniors, 'Club Seniors Fives', 'club@seniors-fives.fr', '3 place de Fives', '59800', 'Lille',
      25, 8.00, 0, 0, 200.00,
      '[{"description":"Visite ferme seniors","quantity":25,"unit_price":8,"total":200}]'::jsonb,
      'paid', est_id, '2026-02-17 10:00:00+01'),

    ('facture', 'F-2026-125', '2026-02-18', c_vracbio, 'Epicerie Vrac & Bio', 'contact@vrac-bio.fr', '22 rue Masena', '59000', 'Lille',
      0, 0, 0, 0, 432.00,
      '[{"description":"Legumes bio assortis 40kg","quantity":40,"unit_price":4,"total":160},{"description":"Oeufs fermiers x20 dz","quantity":20,"unit_price":5,"total":100},{"description":"Fromages fermiers x12","quantity":12,"unit_price":8,"total":96},{"description":"Miel artisanal x4","quantity":4,"unit_price":10,"total":40},{"description":"Jus de pomme x12","quantity":12,"unit_price":3,"total":36}]'::jsonb,
      'paid', est_id, '2026-02-18 10:00:00+01'),

    -- 3 factures envoyees (en attente de paiement)
    ('facture', 'F-2026-126', '2026-02-18', c_robert, 'Ferme Robert & Fils', 'ferme@robert.fr', '1 chemin des Prairies', '59246', 'Mons-en-Baroeul',
      0, 0, 0, 0, 480.00,
      '[{"description":"Foin bio 200kg","quantity":4,"unit_price":80,"total":320},{"description":"Grains bio 100kg","quantity":2,"unit_price":50,"total":100},{"description":"Paille 100kg","quantity":2,"unit_price":30,"total":60}]'::jsonb,
      'sent', est_id, '2026-02-18 08:00:00+01'),

    ('facture', 'F-2026-127', '2026-02-19', c_lomme, 'Mairie de Lomme', 'animations@mairie-lomme.fr', '2 place de la Mairie', '59160', 'Lomme',
      30, 10.00, 40, 7.00, 580.00,
      '[{"description":"Animation carnaval adultes","quantity":30,"unit_price":10,"total":300},{"description":"Animation carnaval enfants","quantity":40,"unit_price":7,"total":280}]'::jsonb,
      'sent', est_id, '2026-02-19 14:00:00+01'),

    ('facture', 'F-2026-128', '2026-02-19', c_martin, 'Restaurant Le Martin', 'contact@lemartin.fr', '45 avenue Foch', '59800', 'Lille',
      0, 0, 0, 0, 180.00,
      '[{"description":"Panier legumes bio x5","quantity":5,"unit_price":25,"total":125},{"description":"Oeufs fermiers x11 dz","quantity":11,"unit_price":5,"total":55}]'::jsonb,
      'sent', est_id, '2026-02-19 09:00:00+01');

  -- ============================================================
  -- AVOIR sur F-2025-108 (Association Durand)
  -- ============================================================
  INSERT INTO documents (id, type, numero, date, client_id, client_name, client_email, client_address, client_postal_code, client_city, nb_adultes, prix_adulte, nb_enfants, prix_enfant, total, line_items, status, cancelled_by_id, establishment_id, created_at) VALUES
    (gen_random_uuid(), 'avoir', 'A-2025-101', '2025-12-20', c_durand, 'Association Durand', 'asso@durand.org', '55 rue de Douai', '59000', 'Lille',
      15, 10.00, 10, 7.00, 220.00,
      '[{"description":"Annulation atelier decouverte adultes","quantity":15,"unit_price":10,"total":150},{"description":"Annulation atelier decouverte enfants","quantity":10,"unit_price":7,"total":70}]'::jsonb,
      'validated', NULL, est_id, '2025-12-20 10:00:00+01');

  -- Lier l'avoir a la facture F-2025-108
  UPDATE documents SET cancelled_by_id = (SELECT id FROM documents WHERE numero = 'A-2025-101' AND establishment_id = est_id)
    WHERE id = f_avoir_target;
  UPDATE documents SET status = 'cancelled' WHERE id = f_avoir_target;

  RAISE NOTICE '================================================';
  RAISE NOTICE 'Factures et avoir crees avec succes !';
  RAISE NOTICE '================================================';
  RAISE NOTICE '40 factures (12 dec + 15 jan + 13 fev)';
  RAISE NOTICE '  - 33 payees, 5 envoyees, 1 annulee + avoir';
  RAISE NOTICE '1 avoir (A-2025-101 sur F-2025-108)';
  RAISE NOTICE '------------------------------------------------';
  RAISE NOTICE 'CA paye dec 2025 :  2 075 EUR';
  RAISE NOTICE 'CA paye jan 2026 :  2 808 EUR';
  RAISE NOTICE 'CA paye fev 2026 :  2 435 EUR';
  RAISE NOTICE 'CA en attente    :  1 588 EUR';
  RAISE NOTICE '================================================';

END $$;
