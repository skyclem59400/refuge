-- ============================================================
-- Script 2/3 : Creation de 15 devis
-- Etablissement : "Test"
-- Prerequis : 01-seed-clients.sql execute
-- ============================================================

DO $$
DECLARE
  est_id UUID;
  -- Client IDs (lookup par nom)
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
  c_auchan UUID;
BEGIN

  SELECT id INTO est_id FROM establishments WHERE name = 'Test';
  IF est_id IS NULL THEN
    RAISE EXCEPTION 'Etablissement "Test" introuvable.';
  END IF;

  -- Lookup clients par nom
  SELECT id INTO c_dupont    FROM clients WHERE name = 'Famille Dupont'         AND establishment_id = est_id;
  SELECT id INTO c_petit     FROM clients WHERE name = 'Marie Petit'            AND establishment_id = est_id;
  SELECT id INTO c_moreau    FROM clients WHERE name = 'Pierre Moreau'          AND establishment_id = est_id;
  SELECT id INTO c_simon     FROM clients WHERE name = 'Jacques Simon'          AND establishment_id = est_id;
  SELECT id INTO c_fontaine  FROM clients WHERE name = 'Claire Fontaine'        AND establishment_id = est_id;
  SELECT id INTO c_legrand   FROM clients WHERE name = 'Thomas Legrand'         AND establishment_id = est_id;
  SELECT id INTO c_marchand  FROM clients WHERE name = 'Sophie Marchand'        AND establishment_id = est_id;
  SELECT id INTO c_dubois    FROM clients WHERE name = 'Antoine Dubois'         AND establishment_id = est_id;
  SELECT id INTO c_roux      FROM clients WHERE name = 'Nathalie Roux'          AND establishment_id = est_id;
  SELECT id INTO c_garnier   FROM clients WHERE name = 'Julien Garnier'         AND establishment_id = est_id;
  SELECT id INTO c_martin    FROM clients WHERE name = 'Restaurant Le Martin'   AND establishment_id = est_id;
  SELECT id INTO c_lefevre   FROM clients WHERE name = 'Ecole Lefevre'          AND establishment_id = est_id;
  SELECT id INTO c_bernard   FROM clients WHERE name = 'Comite Bernard CE'      AND establishment_id = est_id;
  SELECT id INTO c_robert    FROM clients WHERE name = 'Ferme Robert & Fils'    AND establishment_id = est_id;
  SELECT id INTO c_durand    FROM clients WHERE name = 'Association Durand'     AND establishment_id = est_id;
  SELECT id INTO c_laurents  FROM clients WHERE name = 'Creche Les Laurents'    AND establishment_id = est_id;
  SELECT id INTO c_pasteur   FROM clients WHERE name = 'Lycee Pasteur'          AND establishment_id = est_id;
  SELECT id INTO c_ehpad     FROM clients WHERE name = 'EHPAD Les Jardins'      AND establishment_id = est_id;
  SELECT id INTO c_brasserie FROM clients WHERE name = 'Brasserie du Nord'      AND establishment_id = est_id;
  SELECT id INTO c_lomme     FROM clients WHERE name = 'Mairie de Lomme'        AND establishment_id = est_id;
  SELECT id INTO c_montessori FROM clients WHERE name = 'Ecole Montessori Nord' AND establishment_id = est_id;
  SELECT id INTO c_auchan    FROM clients WHERE name = 'Comite Entreprise Auchan' AND establishment_id = est_id;

  -- ============================================================
  -- 15 devis : 5 draft, 6 sent, 4 cancelled
  -- Numerotation 101+ pour eviter les conflits
  -- ============================================================
  INSERT INTO documents (type, numero, date, client_id, client_name, client_email, client_address, client_postal_code, client_city, nb_adultes, prix_adulte, nb_enfants, prix_enfant, total, line_items, status, establishment_id, created_at) VALUES

    -- ========== 5 devis brouillon (draft) ==========
    ('devis', 'D-2026-101', '2026-02-10', c_bernard, 'Comite Bernard CE', 'ce@bernard.fr', '77 bd de la Liberte', '59000', 'Lille',
      35, 10.00, 25, 7.00, 525.00,
      '[{"description":"Journee printemps CE adultes","quantity":35,"unit_price":10,"total":350},{"description":"Journee printemps CE enfants","quantity":25,"unit_price":7,"total":175}]'::jsonb,
      'draft', est_id, '2026-02-10 10:00:00+01'),

    ('devis', 'D-2026-102', '2026-02-11', c_lefevre, 'Ecole Lefevre', 'ecole@lefevre.fr', '8 place de la Gare', '59100', 'Roubaix',
      0, 0, 40, 6.00, 240.00,
      '[{"description":"Sortie scolaire mars - 40 enfants","quantity":40,"unit_price":6,"total":240}]'::jsonb,
      'draft', est_id, '2026-02-11 14:00:00+01'),

    ('devis', 'D-2026-103', '2026-02-12', c_robert, 'Ferme Robert & Fils', 'ferme@robert.fr', '1 chemin des Prairies', '59246', 'Mons-en-Baroeul',
      0, 0, 0, 0, 750.00,
      '[{"description":"Foin bio 200kg","quantity":7,"unit_price":80,"total":560},{"description":"Grains bio 100kg","quantity":2,"unit_price":50,"total":100},{"description":"Complements mineraux","quantity":2,"unit_price":45,"total":90}]'::jsonb,
      'draft', est_id, '2026-02-12 08:00:00+01'),

    ('devis', 'D-2026-104', '2026-02-13', c_dupont, 'Famille Dupont', 'dupont@email.fr', '12 rue des Champs', '59000', 'Lille',
      8, 12.00, 6, 8.00, 144.00,
      '[{"description":"Anniversaire ferme adultes","quantity":8,"unit_price":12,"total":96},{"description":"Anniversaire ferme enfants","quantity":6,"unit_price":8,"total":48}]'::jsonb,
      'draft', est_id, '2026-02-13 11:00:00+01'),

    ('devis', 'D-2026-105', '2026-02-14', c_auchan, 'Comite Entreprise Auchan', 'ce@auchan-nord.fr', '200 rue de la Recherche', '59650', 'Villeneuve-d''Ascq',
      60, 10.00, 40, 7.00, 880.00,
      '[{"description":"Journee decouverte CE adultes","quantity":60,"unit_price":10,"total":600},{"description":"Journee decouverte CE enfants","quantity":40,"unit_price":7,"total":280}]'::jsonb,
      'draft', est_id, '2026-02-14 15:00:00+01'),

    -- ========== 6 devis envoyes (sent) ==========
    ('devis', 'D-2026-106', '2026-02-05', c_durand, 'Association Durand', 'asso@durand.org', '55 rue de Douai', '59000', 'Lille',
      25, 10.00, 20, 7.00, 390.00,
      '[{"description":"Atelier printemps adultes","quantity":25,"unit_price":10,"total":250},{"description":"Atelier printemps enfants","quantity":20,"unit_price":7,"total":140}]'::jsonb,
      'sent', est_id, '2026-02-05 10:00:00+01'),

    ('devis', 'D-2026-107', '2026-02-06', c_laurents, 'Creche Les Laurents', 'contact@laurents.fr', '14 rue Colbert', '59300', 'Valenciennes',
      8, 0, 25, 5.00, 125.00,
      '[{"description":"Sortie printemps creche - 25 enfants","quantity":25,"unit_price":5,"total":125}]'::jsonb,
      'sent', est_id, '2026-02-06 09:30:00+01'),

    ('devis', 'D-2026-108', '2026-02-07', c_pasteur, 'Lycee Pasteur', 'secretariat@pasteur59.fr', '1 rue des Urbanistes', '59000', 'Lille',
      0, 0, 35, 6.00, 210.00,
      '[{"description":"Sortie pedagogique lycee - 35 eleves","quantity":35,"unit_price":6,"total":210}]'::jsonb,
      'sent', est_id, '2026-02-07 16:00:00+01'),

    ('devis', 'D-2026-109', '2026-02-08', c_lomme, 'Mairie de Lomme', 'animations@mairie-lomme.fr', '2 place de la Mairie', '59160', 'Lomme',
      50, 10.00, 80, 7.00, 1060.00,
      '[{"description":"Fete communale adultes","quantity":50,"unit_price":10,"total":500},{"description":"Fete communale enfants","quantity":80,"unit_price":7,"total":560}]'::jsonb,
      'sent', est_id, '2026-02-08 11:00:00+01'),

    ('devis', 'D-2026-110', '2026-02-09', c_martin, 'Restaurant Le Martin', 'contact@lemartin.fr', '45 avenue Foch', '59800', 'Lille',
      0, 0, 0, 0, 625.00,
      '[{"description":"Panier legumes bio x18","quantity":18,"unit_price":25,"total":450},{"description":"Volailles fermieres x7","quantity":7,"unit_price":25,"total":175}]'::jsonb,
      'sent', est_id, '2026-02-09 09:00:00+01'),

    ('devis', 'D-2026-111', '2026-02-15', c_ehpad, 'EHPAD Les Jardins', 'direction@ehpad-jardins.fr', '12 rue des Fleurs', '59491', 'Villeneuve-d''Ascq',
      30, 8.00, 0, 0, 240.00,
      '[{"description":"Atelier therapeutique seniors","quantity":30,"unit_price":8,"total":240}]'::jsonb,
      'sent', est_id, '2026-02-15 10:00:00+01'),

    -- ========== 4 devis annules (cancelled) ==========
    ('devis', 'D-2026-112', '2026-01-15', c_petit, 'Marie Petit', 'm.petit@outlook.fr', '21 rue Nationale', '59200', 'Tourcoing',
      2, 12.00, 1, 8.00, 32.00,
      '[{"description":"Visite ferme adulte","quantity":2,"unit_price":12,"total":24},{"description":"Visite ferme enfant","quantity":1,"unit_price":8,"total":8}]'::jsonb,
      'cancelled', est_id, '2026-01-15 15:00:00+01'),

    ('devis', 'D-2026-113', '2026-01-20', c_simon, 'Jacques Simon', 'j.simon@free.fr', '9 allee des Tilleuls', '59650', 'Villeneuve-d''Ascq',
      3, 12.00, 2, 8.00, 52.00,
      '[{"description":"Visite ferme adulte","quantity":3,"unit_price":12,"total":36},{"description":"Visite ferme enfant","quantity":2,"unit_price":8,"total":16}]'::jsonb,
      'cancelled', est_id, '2026-01-20 16:00:00+01'),

    ('devis', 'D-2026-114', '2026-01-25', c_moreau, 'Pierre Moreau', 'p.moreau@gmail.com', '3 impasse du Moulin', '59491', 'Villeneuve-d''Ascq',
      5, 12.00, 4, 8.00, 92.00,
      '[{"description":"Visite groupe adulte","quantity":5,"unit_price":12,"total":60},{"description":"Visite groupe enfant","quantity":4,"unit_price":8,"total":32}]'::jsonb,
      'cancelled', est_id, '2026-01-25 10:00:00+01'),

    ('devis', 'D-2026-115', '2026-02-01', c_fontaine, 'Claire Fontaine', 'c.fontaine@gmail.com', '15 rue Victor Hugo', '59000', 'Lille',
      4, 12.00, 3, 8.00, 72.00,
      '[{"description":"Visite ferme adulte","quantity":4,"unit_price":12,"total":48},{"description":"Visite ferme enfant","quantity":3,"unit_price":8,"total":24}]'::jsonb,
      'cancelled', est_id, '2026-02-01 14:00:00+01');

  RAISE NOTICE '15 devis crees : 5 draft, 6 envoyes, 4 annules';

END $$;
