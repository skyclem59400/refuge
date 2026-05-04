# Optimus — Récap développement

> Logiciel de gestion pour **La Ferme Ô 4 Vents** (refuge / ferme pédagogique) et **SDA d'Estourmel** (refuge animalier, fourrière intercommunale).
> Nom interne : **Optimus**. URL prod : <https://sda.optimus-services.fr> (anciennement `crm.skyclem.fr`).

## Vue d'ensemble

- **Stack** : Next.js 16 (App Router) + TypeScript + Tailwind CSS v4 + Supabase (PostgreSQL, Auth, Storage) + Puppeteer (PDF) + Recharts (graphiques) + Remotion (vidéos sociales)
- **Déploiement** : Docker multi-stage via Coolify sur VPS, auto-deploy sur push `main`
- **Repo** : <https://github.com/skyclem59400/refuge.git>
- **Admin principal** : `clement.scailteux@gmail.com`
- **Supabase** : `https://zzevrtrgtgnlxxuwbnge.supabase.co`

## Modules / Features implémentés

### Authentification & multi-établissement
- ✅ Auth email/mdp + Google SSO ; nouveaux utilisateurs Google passent par `/setup`
- ✅ Multi-établissement avec switcher
- ✅ Permissions granulaires via groupes (`permission_groups` + `member_groups`)
  - Permissions : `manage_establishment`, `manage_documents`, `manage_clients`, `manage_animals`, `view_animals`, `manage_health`, `manage_movements`, `manage_boxes`, `manage_posts`, `manage_donations`, `manage_outings`, `manage_outing_assignments`, `manage_adoptions`, `manage_planning`, `view_pound`, `view_statistics`, `manage_leaves`, `view_own_leaves`, `manage_payslips`, `manage_veterinarians`

### Animaux (refuge / fourrière)
- ✅ CRUD complet ([animals/](src/app/(app)/animals/), [animals/[id]](src/app/(app)/animals/[id]/page.tsx))
- ✅ Champs : identité, identification (puce, tatouage, médaille, LOOF, passeport, date d'identification, vétérinaire identifiant), comportement, compatibilité (chiens), description publique avec génération IA
- ✅ Champ **`arrived_sterilized`** distinct du flag d'état actuel (utile pour distinguer "déjà stérilisé en arrivant" vs "stérilisé chez nous")
- ✅ Photos (bucket `animal-photos`) — **upload direct browser → Supabase Storage** (bypass Server Actions pour ne pas être limité par la taille de body Next.js), conversion automatique HEIC/HEIF → JPEG côté client via `heic2any` (les iPhones envoient du HEIC que Chrome/Firefox ne savent pas afficher), policies RLS qui autorisent l'authentified user à uploader/modifier/supprimer dans le dossier `{son_establishment_id}/...`
- ✅ Mouvements (entrée fourrière, transfert, adoption, retour, transfert sortant, décès, euthanasie, **réservation** + réservation annulée)
- ✅ **Mouvement FA / adoption indissociable d'un contrat signé** : le formulaire mouvement crée en une fois le mouvement + le contrat + l'envoi Documenso. Le mouvement reste en `signature_status='pending'` et le statut animal n'est pas changé tant que le webhook n'a pas reçu la signature. Email contact obligatoire (sauf mode dégradé "signature papier" avec upload du PDF scanné). Boutons inline sur la timeline : Renvoyer email, Sync Documenso, Signature papier (avec upload), Annuler — et lien vers le contrat signé une fois finalisé
- ✅ Adoption directe possible depuis la fourrière (utile pour les chats — pas de délai légal de 8 jours)
- ✅ **Placement en famille d'accueil** disponible depuis fourrière, refuge et pension (pas seulement refuge)
- ✅ **Client picker autocomplete** dans le formulaire mouvement et le changeur de statut : pour adoption / placement FA / restitution propriétaire, recherche dans la table `clients` filtrée par catégorie (`client` pour adoption, `foster_family` pour FA), bouton « créer un nouveau contact » inline si pas trouvé. Le mouvement enregistre `related_client_id` (FK clients) en plus du snapshot text `person_name` / `person_contact`.
- ✅ **Timeline mouvements visuelle** ([movements-timeline.tsx](src/components/animals/movements-timeline.tsx)) qui remplace le tableau austère : cercle coloré + icône par type, ligne verticale entre items, badge type pillulé bordé, carte avec date + heure + durée écoulée auto-calculée, bloc personne liée avec avatar à initiales, contacts cliquables (mailto / téléphone), notes en italique, footer "Saisi par <user>"
- ✅ Séparation claire **Personne liée** (adoptant/FA/propriétaire) **vs Saisi par** (utilisateur du logiciel) — plus de confusion entre l'auteur de la saisie et la personne du mouvement
- ✅ Sorties (promenade) + assignations
- ✅ Sync Hunimalis (intégration externe) — **merge intelligent** : Hunimalis n'écrase plus jamais une donnée locale (puce, race, date naissance, couleur…) si Hunimalis renvoie null/vide
- ✅ Onglets fiche : Infos, Photos, Santé, Mouvements, Famille d'accueil, **Documents** (PDF), Sorties, Publications, I-CAD, Activité (admin)
- ✅ **Anti-doublon** à la création : avertit si même nom créé < 24h
- ✅ **Procédure judiciaire** : marquage + champs (n° dossier, juridiction, date saisine, propriétaire mis en cause, destinataire facturation, notes), badge sur fiche & liste, filtre, alerte automatique sur acte santé

### Santé
- ✅ 11 types d'actes : vaccination, stérilisation, antiparasitaire, consultation, chirurgie, médicament, bilan comportemental, **identification**, **radio**, **prise de sang**, **cession véto**
- ✅ Acte d'identification → **report automatique** du n° de puce, date et vétérinaire identifiant sur la fiche animal
- ✅ Protocoles de soins ([health/protocols](src/app/(app)/health/protocols/page.tsx)) avec étapes et rappels automatiques
- ✅ Carte d'identification animal accessible aux vétérinaires/soigneurs
- ✅ Traitements en cours (administration journalière)
- ✅ Sur acte santé d'un animal en procédure : alerte facture nominative + champs `judicial_procedure`, `billed_to`, `invoice_reference`

### Planning vétérinaire (tableaux quotidiens)
- ✅ Module dédié ([planning-veto](src/app/(app)/planning-veto/page.tsx)) — tables `vet_visits` + `vet_visit_lines`
- ✅ **Tableau jour style Google Sheet** : un passage = date + créneau + lieu (SV/TQ) + véto, avec autant de lignes que d'animaux à voir
- ✅ Colonnes d'actes cochables : PUCE, CESSION, VACCIN CHIEN, VISITE DIVERS, IMPORTATION, VACCIN CHAT, TEST LEUCOSE, CONSULTATION, STÉRILISATION, ANTIPARAS, RADIO
- ✅ Champs N° puce, observations, complément libre (CRAINTIF, ARRIVE CASTRE…)
- ✅ **Bouton « Valider »** par ligne → crée automatiquement les fiches santé correspondantes sur l'animal (puce reportée, sterilized basculé si stérilisation cochée, poids reporté si saisi, observations en notes)
- ✅ Annulation de validation (sans suppression des actes santé déjà créés — sécurité)

### Praticiens / Cabinets vétérinaires
- ✅ Gestion cabinets ([etablissement/veterinaires](src/app/(app)/etablissement/veterinaires/page.tsx)) — table `veterinary_clinics` + `veterinarians`
- ✅ Permission dédiée `manage_veterinarians` (cochable en groupe)
- ✅ **Quick-add** : popup d'ajout cabinet+praticien depuis n'importe quel sélecteur véto sans quitter l'écran ([quick-add-veterinarian-dialog.tsx](src/components/health/quick-add-veterinarian-dialog.tsx))

### Passages vétérinaires
- ✅ Page consolidée ([passages-veto](src/app/(app)/passages-veto/page.tsx)) : liste multi-animaux des actes vétérinaires
- ✅ Filtres : période, cabinet, vétérinaire, type d'acte, "procédure uniquement"
- ✅ Stats : nombre, coût total, ventilation par véto
- ✅ Export CSV (Excel-compatible) + PDF paysage prêt pour partage avec les cabinets

### Règlements (saisie de paiements)
- ✅ Module dédié ([reglements](src/app/(app)/reglements/page.tsx)) — table `payment_entries`
- ✅ Champs : montant, date, mode (chèque/virement/espèces/CB/prélèvement/HelloAsso/autre), type (pension/adoption/don/fourrière/autre), acompte/solde/total
- ✅ Lien optionnel vers contact, animal, document (facture/devis), don
- ✅ Stats annuelles : total reçu, par mode, par type
- ✅ Filtres par année / type / mode

### Documents (devis / factures / avoirs)
- ✅ CRUD ([documents/](src/app/(app)/documents/))
- ✅ Numérotation auto (séquence par établissement et type)
- ✅ Conversion devis → facture
- ✅ Annulation facture → création avoir auto
- ✅ Génération PDF Puppeteer
- ✅ Méthode de paiement + date de paiement

### Box
- ✅ CRUD ([boxes/](src/app/(app)/boxes/page.tsx))
- ✅ Affichage espèce, capacité, occupants, taux de remplissage
- ✅ **PDF fiche box** : par box (animaux hébergés, photo, race, n° puce)
- ✅ **PDF liste consolidée** des box (stats, taux d'occupation)

### Certificats vétérinaires (PDF)
- ✅ Fiche de suivi médical ([medical-followup](src/app/api/pdf/animal/[id]/medical-followup/route.ts))
- ✅ Certificat de stérilisation ([sterilization](src/app/api/pdf/animal/[id]/sterilization/route.ts))
- ✅ Certificat avant cession Code rural L.214-8 ([cession](src/app/api/pdf/animal/[id]/cession/route.ts))
- ✅ Tous pré-remplis avec animal + cabinet + véto par défaut

### Procédure judiciaire — Dossier tribunal
- ✅ PDF ([judicial/[animalId]](src/app/api/pdf/judicial/[animalId]/route.ts)) regroupant identité animal + infos procédure + tableau récap des frais engagés (uniquement actes marqués `judicial_procedure`) + total + cadre signature
- ✅ Bouton dédié sur fiche animal (visible si animal en procédure)

### Pièces jointes animal
- ✅ Bucket Supabase Storage `animal-documents`
- ✅ Table `animal_attachments`
- ✅ Composant upload/liste/suppression ([animal-attachments-section.tsx](src/components/animals/animal-attachments-section.tsx)) accessible via onglet **Documents** sur la fiche animal
- ✅ PDF ou images, max 15 Mo

### Famille d'accueil
- ✅ Convention de placement ([foster_contracts](src/components/foster-contracts/)) avec génération PDF
- ✅ Signature électronique via **Documenso** (signature.optimus-services.fr)
- ✅ Suivi statut signature (not_sent, pending, viewed, signed, rejected, failed)
- ✅ **Email Documenso multi-tenant** : sujet et corps personnalisés selon l'établissement actif (nom + email contact dynamiques)
- ✅ **PDF refondu visuellement** : bandeau primary teal en gradient + photo de l'animal embarquée + sections numérotées avec pastilles + clauses en cards à checkmark

### Adoption (contrats avec signature électronique)
- ✅ Convention d'adoption ([adoption_contracts](src/components/adoption-contracts/)) avec génération PDF
- ✅ Numérotation auto **`CA-YYYY-NNN`** par établissement (RPC `get_next_adoption_contract_number`)
- ✅ Champs : adoptant, date d'adoption, frais d'adoption (montant variable), clauses opt-in (stérilisation obligatoire avec deadline + caution, non-cession, reprise refuge, droit de visite, accord du foyer)
- ✅ Signature électronique via **Documenso** (mêmes statuts que FA)
- ✅ **Email Documenso multi-tenant** : subject `Contrat d'adoption — [Animal] | [Établissement]`, message custom prénom + nom de l'animal + contact établissement
- ✅ Onglet **Adoption** sur la fiche animal (icône Heart) avec form + tableau + boutons envoi/sync/aperçu/signé/édition/suppression
- ✅ PDF visuellement riche (bandeau primary, photo animal, box frais en gradient, clauses graphiques, signatures stylées)
- ✅ Webhook Documenso commun aux 2 types de contrats (route via préfixe `externalId="adoption_…"`, dispatch sur la bonne table et le bon bucket storage)

### Dons & CERFA
- ✅ CRUD dons ([donations/](src/app/(app)/donations/page.tsx))
- ✅ Génération CERFA fiscal automatique (PDF Puppeteer)
- ✅ Intégration HelloAsso (webhook + sync OAuth)

### I-CAD
- ✅ Déclarations animales ([icad/](src/app/(app)/icad/page.tsx)) : entrée fourrière, transfert, adoption, restitution, transfert sortant, décès, euthanasie, identification, changement propriétaire/adresse

### Publications réseaux sociaux
- ✅ Génération posts IA ([publications/](src/app/(app)/publications/))
- ✅ Multi-plateforme (Facebook + Instagram via Meta connection)
- ✅ Vidéos générées avec Remotion (rendu côté serveur)
- ✅ Programmation + statuts (draft, scheduled, publishing, published, failed, archived)

### Conges / Bulletins de paie / Espace collaborateur
- ✅ Demandes de congés ([espace-collaborateur/conges](src/app/(app)/espace-collaborateur/conges/))
- ✅ Validation par admins ([admin/conges](src/app/(app)/admin/conges/))
- ✅ Bulletins de paie (upload + accès collaborateur)

### Téléphonie & appels
- ✅ Appels Ringover ([appels/](src/app/(app)/appels/page.tsx)) avec transcription & analyse IA
- ✅ Agent IA téléphonique LiveKit
- ✅ Appels entrants : sentiment, action items, callback tracking

### Statistiques
- ✅ Dashboard ([dashboard/](src/app/(app)/dashboard/page.tsx)) : KPIs, CA, courbes
- ✅ Page stats détaillée ([statistiques/](src/app/(app)/statistiques/page.tsx))

## Routes API (génération PDF)

| Path | Description |
|------|-------------|
| `/api/pdf/[documentId]` | Devis / facture / avoir |
| `/api/pdf/cerfa/[donationId]` | Reçu fiscal CERFA |
| `/api/pdf/foster-contract/[id]` | Convention famille d'accueil |
| `/api/pdf/adoption-contract/[id]` | Contrat d'adoption |
| `/api/pdf/box/[id]` | Fiche box (animaux hébergés) |
| `/api/pdf/box-list` | Liste consolidée des box |
| `/api/pdf/animal/[id]/medical-followup` | Fiche suivi médical |
| `/api/pdf/animal/[id]/sterilization` | Certificat stérilisation |
| `/api/pdf/animal/[id]/cession` | Certificat avant cession L.214-8 |
| `/api/pdf/judicial/[animalId]` | Dossier procédure tribunal |
| `/api/pdf/passages-veto` | Liste passages vétérinaires (filtres dans query string) |

## Base de données — tables principales

| Table | Description |
|-------|-------------|
| `establishments` | Établissements (nom, raison sociale, adresse, IBAN, BIC, logo, type farm/shelter/both) |
| `establishment_members` | user ↔ établissement + rôle + flags is_owner/is_pseudo |
| `permission_groups` | Groupes de permissions (1 admin système par établissement) |
| `member_groups` | member ↔ permission_group |
| `clients` | Contacts (clients, adhérents, bénévoles, CA, FA, vétos) |
| `documents` | Devis / factures / avoirs |
| `animals` | Animaux refuge/fourrière + procédure judiciaire |
| `animal_photos`, `animal_movements`, `animal_outings`, `outing_assignments`, `animal_attachments` | Sous-objets animaux |
| `animal_health_records` | Actes vétérinaires (avec champs `judicial_procedure`, `billed_to`, `invoice_reference`) |
| `health_protocols`, `health_protocol_steps`, `animal_protocol_instances` | Protocoles de soins |
| `animal_treatments`, `treatment_administrations` | Traitements quotidiens |
| `boxes` | Box du refuge |
| `veterinary_clinics`, `veterinarians` | Cabinets et praticiens |
| `foster_contracts` | Conventions FA + workflow signature Documenso |
| `adoption_contracts` | Contrats d'adoption + workflow signature Documenso (numérotation `CA-YYYY-NNN`) |
| `payment_entries` | Saisies de règlement |
| `donations`, `helloasso_connections` | Dons et intégration HelloAsso |
| `icad_declarations` | Déclarations I-CAD |
| `social_posts`, `meta_connections` | Publications réseaux sociaux |
| `pound_interventions` | Interventions fourrière |
| `appointments`, `staff_schedules` | Planning RDV / créneaux |
| `vet_visits`, `vet_visit_lines` | Planning véto (tableaux quotidiens style Google Sheet) — `acts` JSONB pour les actes cochés, `validated_at` pour le moment où les fiches santé sont créées sur l'animal |
| `call_logs`, `call_transcripts`, `call_categories`, `agent_sessions` | Téléphonie IA |
| `ringover_call_records`, `ringover_connections` | Téléphonie Ringover |
| `leave_types`, `leave_balances`, `leave_requests` | Congés |
| `payslips` | Bulletins de paie |
| `notifications`, `notification_preferences` | Notifications + push web |
| `activity_logs` | Audit log |

## Storage (buckets Supabase)

| Bucket | Public ? | Description |
|--------|----------|-------------|
| `logos` | oui | Logos établissements |
| `avatars` | oui | Avatars utilisateurs |
| `animal-photos` | oui | Photos animaux |
| `animal-documents` | oui | PDF/images attachés aux dossiers animaux |
| `foster-contracts` | oui | PDF contrats FA signés |
| `adoption-contracts` | oui | PDF contrats d'adoption signés |
| `social-media` | oui | Médias publications |
| `payslips` | non | Bulletins de paie (privé) |

## Migrations SQL appliquées

- `MIGRATION_TO_RUN_2026_04_27.sql` — Foster contracts + Health protocols + Veterinary clinics
- `supabase/migrations/20260430_features.sql` — Avril 2026 features :
  - Types santé : identification, radio, blood_test
  - Permission `manage_veterinarians`
  - Tables `animal_attachments` + `payment_entries`
  - Bucket `animal-documents`
- `2026_04_30_judicial_procedure` (appliquée via MCP) :
  - Champs `judicial_*` sur `animals`
  - Champs `judicial_procedure`, `billed_to`, `invoice_reference` sur `animal_health_records`
  - Champ `judicial_procedure` sur `payment_entries`
- `2026_05_02_cession_type_and_reservation` (appliquée via MCP) :
  - Type `cession` ajouté à l'enum `health_record_type` (animal_health_records + health_protocol_steps)
  - Mouvements `reservation` et `reservation_cancelled` ajoutés à l'enum `animal_movements.type`
  - Colonne `arrived_sterilized boolean NOT NULL DEFAULT false` sur `animals`
- `2026_05_02_vet_visits_planning` (appliquée via MCP) :
  - Tables `vet_visits` (visite globale : date + créneau + lieu + véto) et `vet_visit_lines` (1 ligne par animal avec acts JSONB + validation)
  - RLS multi-établissement sur les 2 tables, triggers `updated_at`
- `20260503_animal_movements_related_client` ([fichier](supabase/migrations/20260503_animal_movements_related_client.sql), appliquée via MCP) :
  - Colonne `related_client_id` UUID FK vers `clients` sur `animal_movements` (ON DELETE SET NULL — l'historique mouvement persiste même si le contact est supprimé)
- `animal_photos_storage_policies` (appliquée via MCP) :
  - Policies RLS sur `storage.objects` pour le bucket `animal-photos` : INSERT / UPDATE / DELETE autorisés à `authenticated` si le 1er segment du path correspond à un `establishment_id` dont l'user est membre
- `20260503_adoption_contracts` ([fichier](supabase/migrations/20260503_adoption_contracts.sql), appliquée via MCP) :
  - Table `adoption_contracts` : adopter_client_id, adoption_date, adoption_fee, clauses booléennes (sterilization_required + deadline + deposit, visit_right, non_resale, shelter_return, household_acknowledgment), conditions, signatures, champs Documenso complets
  - RPC `get_next_adoption_contract_number(est_id)` → format `CA-YYYY-NNN`
  - Trigger `tr_adoption_contracts_updated`, RLS multi-établissement
  - Bucket storage `adoption-contracts` (10 MB, PDF only)
- `20260504_animal_movements_signature` ([fichier](supabase/migrations/20260504_animal_movements_signature.sql), appliquée via MCP) :
  - Colonne `signature_status` (`not_required` / `pending` / `signed` / `rejected` / `cancelled`) sur `animal_movements`
  - Colonnes `related_contract_id` UUID + `related_contract_type` (`foster` / `adoption`)
  - Backfill : tous les mouvements existants passent à `not_required` (comportement actuel préservé)
  - Index sur `signature_status` et `(related_contract_id, related_contract_type)`

## Infrastructure & Déploiement

- **Coolify** sur VPS — auto-deploy sur push `main`
- **Dockerfile** 3 stages (deps Alpine → builder Alpine → runner Slim avec Google Chrome pour Puppeteer)
- **Variables d'environnement** : `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, `DOCUMENSO_*`, `HUNIMALIS_*`, `TRIGGER_SECRET_KEY`, `JAMENDO_CLIENT_ID`
- **Trigger.dev** : sync auto Ringover (cron)
- **LiveKit Agents** : agent IA téléphonique (dossier `livekit-agents/`)

## Historique des sessions

| Date | Travail | Fichiers principaux |
|------|---------|---------------------|
| 2026-04-30 (matin) | **Avril features** : 3 nouveaux types santé + Indéfini croisement + permission `manage_veterinarians` + QuickAdd dialog véto + 4 PDFs (box+3 certificats) + pièces jointes animal + module règlements | commit `4f67248` (33 fichiers, +2836 lignes) |
| 2026-04-30 (mi-matin) | **Bug Nicoletta** : doublon résolu (fusion 2679→2680), prévention anti-doublon ajoutée à `createAnimal` (avertissement si même nom < 24h) | `src/lib/actions/animals.ts`, `src/components/animals/animal-form.tsx` |
| 2026-04-30 (après-midi) | **Tableau passages véto + procédure judiciaire** : page `/passages-veto` (filtres + CSV + PDF), champs `judicial_*` sur animals/health_records/payments, badge fiche+liste, filtre liste, alerte facture nominative, PDF dossier tribunal | commit `d1a3182` (17 fichiers, +1208 lignes) |
| 2026-04-30 (fin) | **Pose de puce auto-fill + URL prod** : acte d'identification → report puce/date/véto sur fiche animal ; documentation URL prod migrée vers `sda.optimus-services.fr` (ancienne `crm.skyclem.fr` retirée du Coolify) | commit `2d5f51a` |
| 2026-04-30 (soir) | **Fix UX permissions** : freeze 30s lors d'un toggle de permission corrigé. Suppression du `revalidatePath('/etablissement')` qui déclenchait un re-fetch complet, et passage à un pending tracké par toggle individuel (le toggle en cours pulse, les autres restent cliquables) | commit `46f0954` |
| 2026-05-02 | **Planning véto + cession + RESERVATION + fix sync Hunimalis** : module `/planning-veto` (tableaux quotidiens style Google Sheet, actes cochables avec validation qui crée auto les fiches santé), nouveau type d'acte `cession`, mouvements `reservation` / `reservation_cancelled`, adoption directe depuis fourrière, champ `arrived_sterilized`. **Fix critique** : la sync Hunimalis n'écrase plus jamais les données locales (puces, dates, couleurs saisies par les soigneurs) si Hunimalis renvoie null/vide. **Backfill** des données perdues pour Abby, Sweet, Cléo, Izel. | commit `6ea5cd8` (21 fichiers, +1202 lignes) |
| 2026-05-03 | **Documenso multi-tenant + Contrats d'adoption + Refonte UX** : <ul><li>Email Documenso personnalisé par établissement (subject + corps), commit `506e7ff`</li><li>Fix upload photos animaux : bypass Server Actions via upload direct browser → Supabase Storage avec policies RLS, fallback compression + conversion HEIC/HEIF→JPEG via heic2any, commits `44e19e7` `99e3a7b` `0d94c3b`</li><li>Client picker autocomplete dans MovementForm + AnimalStatusChanger (catégorie filtrée selon le type de mouvement, création rapide inline), migration `related_client_id` sur `animal_movements`, commit `e707fe8` `5953aec`</li><li>Foster placement ajouté dans le changeur de statut + picker FA dédié, commit `79ec9a0`</li><li>Séparation visuelle « Personne liée » vs « Saisi par » dans la liste des mouvements, commit `7dc0e37`</li><li>**Contrats d'adoption complets** (migration + types + CRUD + signature Documenso + webhook étendu + PDF Puppeteer + UI nouvel onglet « Adoption » avec icône Heart), commit `1f6544f`</li><li>**Refonte design** : timeline mouvements visuelle (cercles colorés par type + avatars + durées écoulées + contacts cliquables) et PDFs entièrement repensés (bandeau primary teal en gradient avec liseré scalloped, photo animal embarquée en base64, sections numérotées avec pastilles, box frais en gradient, clauses graphiques avec ✓/○), commit `e796976`</li></ul> | 8 commits sur la session |
| 2026-05-04 | **Picker conversion catégorie + workflow signature obligatoire** : <ul><li>ClientSearch et MovementForm : recherche désormais dans tous les contacts (pas filtrée par catégorie). Au clic sur un contact d'une autre catégorie (ex. un client à mettre en FA), conversion automatique via `updateClientAction` + toast. Évite la friction "il faut d'abord changer la catégorie dans le répertoire", commits `fde3a2a` `de0fe88`</li><li>**Mouvement FA / adoption indissociable du contrat** : nouvelle architecture où le formulaire mouvement crée en une transaction le mouvement + le contrat + l'envoi Documenso. Le mouvement reste `signature_status='pending'` et le statut animal n'est pas appliqué tant que la signature n'est pas reçue. Email obligatoire sur le contact, sauf en mode dégradé "signature papier" avec upload du PDF scanné. Webhook Documenso propage signed/rejected au mouvement et finalise le statut animal différé. Timeline avec badge en attente + actions inline (renvoyer email, sync, signature papier, annuler), commit `baafcbb`</li></ul> | 3 commits sur la session |

## Problèmes connus / Dette technique

- ⚠️ Branch git locale `feature/avril-2026-features` pas supprimée après merge dans `main`
- ⚠️ Modifications non commitées en cours sur d'autres chantiers : module `contacts-entrants` (page + actions + composants), `lib/actions/leaves.ts`, mises à jour `README.md` — laissées dans le working tree, à finaliser plus tard
- ⚠️ Avertissement build Next.js : `metadataBase` non défini (cosmétique)
- ⚠️ Lien sidebar `/contacts-entrants` réservé aux owners mais la route n'est pas encore committée → 404 pour Clément
- ⚠️ `MIGRATION_TO_RUN_2026_04_27.sql` à la racine : déjà appliqué en prod, à archiver dans `supabase/migrations/`
- ⚠️ **Branding global Documenso reporté** : la création d'organisation dans l'admin Documenso self-hosted (image `:latest`) plante sur un appel Stripe absent en self-hosted. Solution acceptée : contournement via UI/SQL direct quand le besoin sera prioritaire. En attendant, la personnalisation passe par le sujet + le corps de l'email (déjà customisés par établissement). Logo SDA disponible sur https://sda.optimus-services.fr/logo-sda.png pour quand on s'y attaquera.
- ⚠️ Fichier orphelin HEIC dans le bucket `animal-photos` (`fbf2ebf8-…/167c7f2b-….heic`) — la ligne DB a été supprimée mais Supabase bloque le DELETE direct sur `storage.objects` (sécurité). Suppression à faire via l'API Storage si on veut faire le ménage

## Prochaines étapes (TODO V2 demandées par l'équipe)

**Demandes Céline / Maryline / Franck** (non encore traitées) :
- Contrat FA Tupac (départ vendredi) : corriger les accents partout dans le contrat + ajouter le numéro de téléphone de Céline pour les personnes
- Filtre / groupe **« Panier retraite »** dans le répertoire (Céline) — pour communication ciblée renouvellement adhésion janvier + sollicitations dons (vivier de contacts identifié)
- **Agenda RDV** (Franck) — vue calendrier des rendez-vous (probablement utiliser table `appointments` existante)
- Permissions « Répertoire » à activer sur les groupes de **Carole** et **Marina** (à faire en UI Établissement → Groupes)
- « Loulous adoptés en accueil » — sera résolu progressivement par les nouvelles syncs Hunimalis (le fix protège, mais il faut quand même que les statuts d'adoption soient remontés correctement par Hunimalis)

**Maintenance**
- Finaliser et committer le module `contacts-entrants`
- Marquer rétroactivement les animaux SDA en procédure (Nicoletta, etc.)
- Ajouter un export PDF « frais engagés global SDA » tous animaux en procédure confondus
- Notifications quand un animal en procédure approche d'une échéance (audience, etc.)
- Documenter la procédure pour Maryline / Céline / Caroline (mode d'emploi rapide)
