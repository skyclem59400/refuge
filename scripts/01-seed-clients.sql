-- ============================================================
-- Script 1/3 : Nettoyage + Creation de 40 clients
-- Etablissement : "Test"
-- ============================================================

DO $$
DECLARE
  est_id UUID;
BEGIN

  SELECT id INTO est_id FROM establishments WHERE name = 'Test';
  IF est_id IS NULL THEN
    RAISE EXCEPTION 'Etablissement "Test" introuvable. Creez-le d''abord.';
  END IF;

  -- Nettoyage complet de l'etablissement Test
  DELETE FROM documents WHERE establishment_id = est_id;
  DELETE FROM clients WHERE establishment_id = est_id;

  -- 40 clients (mix particuliers / organisations, region Nord)
  INSERT INTO clients (id, name, email, phone, address, postal_code, city, type, notes, establishment_id) VALUES
    -- Particuliers (20)
    (gen_random_uuid(), 'Famille Dupont',        'dupont@email.fr',         '0612345678', '12 rue des Champs',         '59000', 'Lille',              'particulier', NULL, est_id),
    (gen_random_uuid(), 'Marie Petit',           'm.petit@outlook.fr',      '0645671234', '21 rue Nationale',          '59200', 'Tourcoing',          'particulier', NULL, est_id),
    (gen_random_uuid(), 'Pierre Moreau',         'p.moreau@gmail.com',      '0698765432', '3 impasse du Moulin',       '59491', 'Villeneuve-d''Ascq', 'particulier', NULL, est_id),
    (gen_random_uuid(), 'Jacques Simon',         'j.simon@free.fr',         '0677889900', '9 allee des Tilleuls',      '59650', 'Villeneuve-d''Ascq', 'particulier', NULL, est_id),
    (gen_random_uuid(), 'Claire Fontaine',       'c.fontaine@gmail.com',    '0634567890', '15 rue Victor Hugo',        '59000', 'Lille',              'particulier', NULL, est_id),
    (gen_random_uuid(), 'Thomas Legrand',        't.legrand@hotmail.fr',    '0623456789', '27 rue de Bethune',         '59000', 'Lille',              'particulier', NULL, est_id),
    (gen_random_uuid(), 'Sophie Marchand',       's.marchand@yahoo.fr',     '0656789012', '5 place du Theatre',        '59800', 'Lille',              'particulier', NULL, est_id),
    (gen_random_uuid(), 'Antoine Dubois',        'a.dubois@orange.fr',      '0667890123', '42 rue Gambetta',           '59100', 'Roubaix',            'particulier', NULL, est_id),
    (gen_random_uuid(), 'Nathalie Roux',         'n.roux@gmail.com',        '0678901234', '8 rue Jean Jaures',         '59300', 'Valenciennes',       'particulier', NULL, est_id),
    (gen_random_uuid(), 'Julien Garnier',        'j.garnier@laposte.net',   '0689012345', '18 boulevard Vauban',       '59000', 'Lille',              'particulier', NULL, est_id),
    (gen_random_uuid(), 'Isabelle Chevalier',    'i.chevalier@free.fr',     '0690123456', '33 rue Solferino',          '59000', 'Lille',              'particulier', NULL, est_id),
    (gen_random_uuid(), 'Famille Carpentier',    'carpentier@email.fr',     '0601234567', '7 rue des Postes',          '59000', 'Lille',              'particulier', NULL, est_id),
    (gen_random_uuid(), 'Marc Leroy',            'm.leroy@gmail.com',       '0612340987', '14 rue d''Angleterre',      '59000', 'Lille',              'particulier', NULL, est_id),
    (gen_random_uuid(), 'Emilie Vasseur',        'e.vasseur@outlook.fr',    '0654321098', '22 rue des Arts',           '59100', 'Roubaix',            'particulier', NULL, est_id),
    (gen_random_uuid(), 'Famille Lemaire',       'lemaire.famille@free.fr', '0665432109', '6 rue de Paris',            '59200', 'Tourcoing',          'particulier', NULL, est_id),
    (gen_random_uuid(), 'David Caron',           'd.caron@gmail.com',       '0676543210', '31 rue Faidherbe',          '59000', 'Lille',              'particulier', NULL, est_id),
    (gen_random_uuid(), 'Aurelie Dufour',        'a.dufour@hotmail.fr',     '0687654321', '11 rue de la Monnaie',      '59000', 'Lille',              'particulier', NULL, est_id),
    (gen_random_uuid(), 'Famille Vanderberghe',  'vanderberghe@email.fr',   '0698760543', '4 rue du Cure Saint-Etienne','59000','Lille',              'particulier', NULL, est_id),
    (gen_random_uuid(), 'Christine Poulain',     'c.poulain@yahoo.fr',      '0609876543', '19 avenue du Peuple Belge', '59000', 'Lille',              'particulier', NULL, est_id),
    (gen_random_uuid(), 'Famille Delcourt',      'delcourt@email.fr',       '0621098765', '25 rue Esquermoise',        '59000', 'Lille',              'particulier', 'Famille avec 4 enfants', est_id),

    -- Organisations (20)
    (gen_random_uuid(), 'Restaurant Le Martin',  'contact@lemartin.fr',     '0320112233', '45 avenue Foch',            '59800', 'Lille',              'organisation', 'Client regulier paniers bio', est_id),
    (gen_random_uuid(), 'Ecole Lefevre',         'ecole@lefevre.fr',        '0320998877', '8 place de la Gare',        '59100', 'Roubaix',            'organisation', 'Sorties scolaires trimestrielles', est_id),
    (gen_random_uuid(), 'Comite Bernard CE',     'ce@bernard.fr',           '0320556677', '77 bd de la Liberte',       '59000', 'Lille',              'organisation', NULL, est_id),
    (gen_random_uuid(), 'Ferme Robert & Fils',   'ferme@robert.fr',         '0320334455', '1 chemin des Prairies',     '59246', 'Mons-en-Baroeul',    'organisation', 'Fournisseur foin et grains', est_id),
    (gen_random_uuid(), 'Association Durand',    'asso@durand.org',         '0320776655', '55 rue de Douai',           '59000', 'Lille',              'organisation', NULL, est_id),
    (gen_random_uuid(), 'Creche Les Laurents',   'contact@laurents.fr',     '0320221133', '14 rue Colbert',            '59300', 'Valenciennes',       'organisation', NULL, est_id),
    (gen_random_uuid(), 'Lycee Pasteur',         'secretariat@pasteur59.fr','0320445566', '1 rue des Urbanistes',      '59000', 'Lille',              'organisation', NULL, est_id),
    (gen_random_uuid(), 'EHPAD Les Jardins',     'direction@ehpad-jardins.fr','0320667788','12 rue des Fleurs',         '59491', 'Villeneuve-d''Ascq', 'organisation', 'Ateliers therapeutiques', est_id),
    (gen_random_uuid(), 'Brasserie du Nord',     'commandes@brasserienord.fr','0320889900','28 rue de Gand',            '59000', 'Lille',              'organisation', 'Client regulier legumes', est_id),
    (gen_random_uuid(), 'Mairie de Lomme',       'animations@mairie-lomme.fr','0320101010','2 place de la Mairie',      '59160', 'Lomme',              'organisation', NULL, est_id),
    (gen_random_uuid(), 'Centre Social Moulins', 'contact@cs-moulins.fr',   '0320202020', '5 place Delcourt',          '59000', 'Lille',              'organisation', NULL, est_id),
    (gen_random_uuid(), 'Ecole Montessori Nord', 'info@montessori-nord.fr', '0320303030', '17 rue Colbert',            '59000', 'Lille',              'organisation', 'Visites mensuelles', est_id),
    (gen_random_uuid(), 'Restaurant Chez Paul',  'reservation@chezpaul.fr', '0320404040', '10 rue de la Barre',        '59000', 'Lille',              'organisation', NULL, est_id),
    (gen_random_uuid(), 'Camping Les Peupliers', 'accueil@peupliers59.fr',  '0320505050', 'route de Seclin',           '59113', 'Seclin',             'organisation', 'Animations ete', est_id),
    (gen_random_uuid(), 'MJC Jean Mace',         'direction@mjc-mace.fr',   '0320606060', '30 rue Jean Mace',          '59100', 'Roubaix',            'organisation', NULL, est_id),
    (gen_random_uuid(), 'IME Les Tilleuls',      'contact@ime-tilleuls.fr', '0320707070', '8 avenue de Flandre',       '59200', 'Tourcoing',          'organisation', 'Public handicap', est_id),
    (gen_random_uuid(), 'Biocoop Wazemmes',      'magasin@biocoop-waz.fr',  '0320808080', '45 rue Gambetta',           '59000', 'Lille',              'organisation', 'Revente paniers', est_id),
    (gen_random_uuid(), 'Club Seniors Fives',    'club@seniors-fives.fr',   '0320909090', '3 place de Fives',          '59800', 'Lille',              'organisation', NULL, est_id),
    (gen_random_uuid(), 'Epicerie Vrac & Bio',   'contact@vrac-bio.fr',     '0321010101', '22 rue Masena',             '59000', 'Lille',              'organisation', 'Commandes hebdomadaires', est_id),
    (gen_random_uuid(), 'Comite Entreprise Auchan','ce@auchan-nord.fr',     '0321111111', '200 rue de la Recherche',   '59650', 'Villeneuve-d''Ascq', 'organisation', 'Gros volume', est_id);

  RAISE NOTICE '40 clients crees avec succes pour l''etablissement Test';

END $$;
