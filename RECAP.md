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
- ✅ **Workflow unifié (mai 2026)** : la création d'un contrat FA passe **exclusivement** par l'onglet *Mouvements* → *Placement FA*. L'onglet *Famille d'accueil* est en lecture seule (édition d'un contrat existant possible, pas de création) — voir [foster-contracts-tab.tsx](src/components/foster-contracts/foster-contracts-tab.tsx)

### Adoption (contrats avec signature électronique)
- ✅ Convention d'adoption ([adoption_contracts](src/components/adoption-contracts/)) avec génération PDF
- ✅ Numérotation auto **`CA-YYYY-NNN`** par établissement (RPC `get_next_adoption_contract_number`)
- ✅ Champs : adoptant, date d'adoption, frais d'adoption (montant variable), clauses opt-in (stérilisation obligatoire avec deadline + caution, non-cession, reprise refuge, droit de visite, accord du foyer)
- ✅ Signature électronique via **Documenso** (mêmes statuts que FA)
- ✅ **Email Documenso multi-tenant** : subject `Contrat d'adoption — [Animal] | [Établissement]`, message custom prénom + nom de l'animal + contact établissement
- ✅ Onglet **Adoption** sur la fiche animal (icône Heart) en **lecture seule** (consultation, envoi/sync signature, édition, suppression — plus de création depuis cet onglet)
- ✅ PDF visuellement riche (bandeau primary, photo animal, box frais en gradient, clauses graphiques, signatures stylées)
- ✅ Webhook Documenso commun aux 2 types de contrats (route via préfixe `externalId="adoption_…"`, dispatch sur la bonne table et le bon bucket storage)
- ✅ **Workflow unifié (mai 2026)** : la création d'un contrat d'adoption passe **exclusivement** par l'onglet *Mouvements* → *Adoption*. À la signature, `finalizeAdoption` (étiquetage adoptant + 30 € adhésion + facture + CERFA) se déclenche automatiquement. **Règle de codebase** : `createAdoptionContract` / `createFosterContract` sont annotées `@internal` et appelées uniquement depuis [movement-with-contract.ts](src/lib/actions/movement-with-contract.ts).

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

### Parrainage d'animaux
- ✅ Table `sponsorships` : un animal peut avoir N parrains, un parrain N filleuls
- ✅ 3 kinds : `financial_monthly` (engagement récurrent), `financial_punctual` (don fléché), `symbolic` (lien moral sans flux financier)
- ✅ Champs RGPD : `public_alias` + `show_publicly` (consentement affichage public sur portail)
- ✅ Trigger DB `close_sponsorships_on_animal_exit` : ferme automatiquement les parrainages quand l'animal sort, avec raison adaptée (animal_adopted / animal_deceased / animal_transferred / animal_returned)
- ✅ Dons fléchés via `donations.sponsorship_id` (cumul automatique par parrainage)
- ✅ UI fiche animal : onglet « Parrains » avec compteur + résumé €/mois + modal create/edit/end
- ✅ UI fiche client : section « Parrainages » avec grille filleuls + statut animal en cours + lien « Proposer un autre filleul » sur ended

### Archive Hunimalis (contacts historiques)
- ✅ Table `legacy_contacts` séparée de `clients` pour ne pas polluer le répertoire actif
- ✅ Recherche fuzzy via `pg_trgm` GIN trigram index sur `full_name_normalized`
- ✅ 28 306 contacts importés depuis l'XLSX Hunimalis (script Python réutilisable `scripts/import_legacy_contacts.py`)
- ✅ Onglet « Archive Hunimalis » sur `/clients` avec recherche / pagination / filtre converti
- ✅ Bouton « Convertir en client » avec détection automatique des doublons (phone OR nom+ville) → propose de lier au client existant plutôt que créer un doublon
- ✅ Source flag `hunimalis_2026` pour purge/migration future
- ✅ Heuristique Person vs Organization à la conversion (marqueurs ASSOCIATION/SOCIETE/MAIRIE/VETERINAIRE...)

### Visuels réseaux sociaux animaux (poster + nouvelles)
- ✅ **Poster fourrière / adoption** : format 1080×1350 (ratio 4:5, Facebook + Insta fil), photo plein cadre + gradient sombre overlay, badge AVIS pastille terracotta haut-droit, logo en cercle blanc avec halo, typo **Baloo 2** + Inter. Titre adaptatif : `AVIS · CHERCHONS PROPRIÉTAIRE` si origine `found`/`divagation`, sinon `À L'ADOPTION`. Bouton « Visuel » sur la fiche animal → `/api/pdf/animal-poster/[id]` (PNG défaut, PDF via `?format=pdf`, HTML preview via `?format=html`).
- ✅ **Visuel Nouvelles solo** : format 1080×1350, eyebrow « Adopté il y a X mois » (calculé auto depuis `exit_date`), headline « Quoi de neuf, NomAnimal ? », citation italique border-left teal, footer SDA + handle réseaux.
- ✅ **Visuel Nouvelles mosaïque** : grille 2×2 (2-4 animaux) ou 2×3 (5-6) sur fond paper, bandeau « QUELQUES NOUVELLES DE NOS ANCIENS », footer « Adoptez vous aussi → sda-nord.com ».
- ✅ Helper `renderHtmlToImage()` dans `lib/pdf/render.ts` (Puppeteer custom-sized PNG/PDF).

### Rubrique Nouvelles (post-adoption / FA)
- ✅ Table `animal_news` : photos JSONB + texte + source (ex. « FA Mme Dupont ») + dates
- ✅ Permission dédiée `view_animal_news` (off par défaut, activable membre par membre dans `/etablissement`) — bénévoles « promeneurs » n'y ont pas accès
- ✅ Page `/nouvelles` : Inbox (non publiées) + Publié, multi-sélection pour publier en mosaïque
- ✅ Storage : préfixe `news/` dans bucket `animal-photos` existant (pas de nouveau bucket)
- ✅ **Synchronisation auto avec fiche animal** : photos insérées également dans `animal_photos` avec `source_news_id` (`is_primary=false` toujours) → apparaissent dans le tab Photos même pour animaux sortis. `ON DELETE CASCADE` garantit cleanup auto.
- ✅ Éligibles : animaux avec status ∈ {adopted, foster_family, transferred, returned}

### Certificat d'engagement (loi 30 nov 2021)
- ✅ Premier document à signer avant adoption, délai légal 7 jours calendaires
- ✅ Table `engagement_certificates` + colonne `pre_reservation_client_id` sur `animals` (badge « Pré-réservé » au lieu de « Réservé »)
- ✅ Workflow : bouton « Pré-réserver pour adoption » sur fiche animal → envoi Documenso → bandeau d'état avec compteur J/7 (sent → signed J+X → ✓ prêt à finaliser à J+7) → bouton « Finaliser l'adoption »
- ✅ PDF officiel Puppeteer (4 sections + délai 7j mis en avant, charte SDA)
- ✅ Email branded SDA via Brevo (pas Documenso générique)
- ✅ Webhook Documenso routé sur prefix `engagement_*` pour mise à jour `signed_at` + calcul `can_finalize_at`
- ✅ Bouton « Annuler la pré-réservation » remet l'animal disponible

### Partenaires externes pour sorties (Akéla)
- ✅ Table `outing_partners` (5 kinds : educator, club, walker, foster_pro, other) avec label par défaut (ex. « Canicross ») et contact
- ✅ `outing_assignments.assigned_to` nullable + `partner_id` nullable, CHECK exactement-un-des-deux
- ✅ Modal d'assignation refondu en 2 sections « Partenaires » + « Équipe »
- ✅ Seed Akéla pour SDA Estourmel (éducatrice canine partenaire, label `Canicross`)
- ✅ Unique partielle : un animal peut être assigné à un partenaire ET un membre le même jour

### Workflow adoption portail public (contact.sda-nord.com)
- ✅ 5 endpoints REST publics avec CORS allowlist + Cloudflare Turnstile anti-bot + auth Bearer Supabase
- ✅ Table `adoption_inquiries` avec workflow CRM 7 statuts (pending → contacted → rdv_confirmed → rdv_completed → accepted / refused / cancelled)
- ✅ Page CRM `/adoptions` avec onglets par statut + actions inline (valider, refuser, ajouter note, replanifier RDV)
- ✅ 3 templates email Brevo (confirmation, validation, refus)
- ✅ Moteur de créneaux RDV : slots alignés 45 min, horaires configurables, J+2 minimum, exclusion jours fériés FR, table `adoption_appointment_settings` jsonb sur `establishments`
- ✅ Page admin `/etablissement/adoption-rdv` pour configurer horaires & durée

### UX globale — DatePicker partout
- ✅ Composant `<DatePicker>` (popover + react-day-picker v9 + date-fns) déployé sur **tous** les forms (22 fichiers migrés depuis `<input type="date">` natif)
- ✅ Navigation rapide année + mois en dropdowns (captionLayout="dropdown") avec bornes -30 ans / +5 ans
- ✅ Recherche debounce 300 ms + recherche fuzzy partout où c'est pertinent

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
| `/api/pdf/animal-poster/[id]` | Affiche animal (`?format=html\|pdf` — PNG ratio 4:5 social) |
| `/api/pdf/engagement-certificate/[id]` | Certificat d'engagement L214 |
| `/api/visuels/animal-news/[newsId]` | Visuel solo « Quoi de neuf, X ? » (1080×1350, png/pdf/html) |
| `/api/visuels/animal-news/mosaic` | Visuel mosaïque 2×2 ou 2×3 (`?ids=uuid1,uuid2,...`) |
| `/api/public/adoption/animals` | Liste animaux adoptables (portail public) |
| `/api/public/adoption/animals/[id]` | Détail animal (portail public) |
| `/api/public/adoption/slots` | Créneaux RDV disponibles (portail public) |
| `/api/public/adoption/inquiry` | Création demande adoption (portail public, CORS + Turnstile) |
| `/api/public/adoption/my-inquiries` | Mes demandes (Bearer Supabase, portail public) |

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
| `adoption_inquiries` | Demandes d'adoption depuis portail public (workflow CRM 7 statuts) |
| `adoption_contracts`, `foster_contracts`, `abandonment_contracts` | Contrats signés via Documenso |
| `engagement_certificates` | Certificat d'engagement L214 (pré-adoption, délai 7j) |
| `sponsorships` | Parrainage animal ↔ client (financier mensuel/ponctuel ou symbolique) |
| `legacy_contacts` | Archive ancien logiciel Hunimalis (28 306 contacts, recherche trigram) |
| `animal_news`, `animal_news_mosaics` | Nouvelles post-adoption (photos + texte, génération visuels social) |
| `outing_partners` | Partenaires externes pour sorties (éducateurs canins type Akéla) |
| `appointments`, `vet_visits`, `vet_visit_lines` | Agenda RDV + passages véto quotidiens |
| `donations` (avec `sponsorship_id`, `adoption_contract_id`) | Dons + CERFA, fléchage parrainage / adoption |
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
- `20260513_extend_species_for_farm` ([fichier](supabase/migrations/20260513_extend_species_for_farm.sql), appliquée via MCP) :
  - CHECK constraints étendus sur `animals.species`, `boxes.species_type`, `health_protocols.applicable_species`, `astreinte_tickets.animal_species` → support des 23 espèces (chien, chat, lapin, cochon d'Inde, hamster, rat, furet, chinchilla, chèvre, mouton, cochon, vache, cheval, âne, poney, poule, canard, oie, perruche, perroquet, canari, tortue, other)
  - Nouvelles colonnes sur `animals` : `sire_number` (équidés), `ede_number` (bovins/ovins/caprins/porcins), `ring_number` (oiseaux)
  - Nouvelles valeurs `farm` (mixte ferme) et `other` sur `boxes.species_type`
- `20260516a_adoption_appointment_settings` ([fichier](supabase/migrations/20260516a_adoption_appointment_settings.sql)) — JSONB `adoption_appointment_settings` sur `establishments` + status `pending_validation` sur `appointments` + colonne `source`
- `20260517a_adoption_inquiries` ([fichier](supabase/migrations/20260517a_adoption_inquiries.sql)) — table `adoption_inquiries` (workflow CRM demandes adoption avec 7 statuts)
- `20260517b_animals_box_invariant` ([fichier](supabase/migrations/20260517b_animals_box_invariant.sql)) — trigger `enforce_animals_box_invariant` qui force `box_id=NULL` pour tout animal hors statuts shelter/pound/boarding
- `20260517c_legacy_contacts` ([fichier](supabase/migrations/20260517c_legacy_contacts.sql)) — table `legacy_contacts` (archive Hunimalis) + extension `pg_trgm` + GIN trigram index sur `full_name_normalized`
- `20260517d_sponsorships` ([fichier](supabase/migrations/20260517d_sponsorships.sql)) — table `sponsorships` (animal ↔ client) + trigger `close_sponsorships_on_animal_exit` + colonne `donations.sponsorship_id`
- `20260519a_outing_partners` ([fichier](supabase/migrations/20260519a_outing_partners.sql)) — table `outing_partners` (Akéla & co) + `outing_assignments.assigned_to` nullable + `partner_id` + CHECK exactly-one-of
- `20260519b_engagement_certificates` ([fichier](supabase/migrations/20260519b_engagement_certificates.sql)) — table `engagement_certificates` (loi 30 nov 2021) + colonne `pre_reservation_client_id` sur `animals` + bucket `engagement-certificates`
- `20260519c_animal_news` ([fichier](supabase/migrations/20260519c_animal_news.sql)) — tables `animal_news` + `animal_news_mosaics` + permission `view_animal_news` sur `permission_groups`
- `20260519d_animal_photos_source_news` ([fichier](supabase/migrations/20260519d_animal_photos_source_news.sql)) — colonne `source_news_id` sur `animal_photos` (FK animal_news, ON DELETE CASCADE)

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
| 2026-05-10 | **Workflow contrat unifié — suppression du double path** : <ul><li>Audit base : 11 contrats orphelins sur 14 (78 %), créés via l'onglet *Contrat* sans mouvement associé → désync animal/contrat (CLIFORD adopté avec contrat draft, SIMBA contrat actif en fourrière, etc.). **Aucun document/CERFA généré** sur ces orphelins → pas de risque comptable. Les 11 contrats existants sont laissés intacts (décision Clément).</li><li>Suppression du chemin de création depuis les onglets `AdoptionContractsTab` / `FosterContractsTab` : retrait du bouton « Nouveau contrat », bannière `<Info />` qui redirige vers l'onglet *Mouvements*. Édition d'un contrat existant conservée.</li><li>`createAdoptionContract` / `createFosterContract` annotées `@internal` + alignement permission sur `manage_movements` (était `manage_animals`). Forms `<AdoptionContractForm>` / `<FosterContractForm>` simplifiés : prop `contract` désormais obligatoire, branche `else` de création supprimée du `handleSubmit`.</li><li>Une seule porte d'entrée pour tout nouveau contrat : timeline mouvement → adoption ou placement FA.</li></ul> | en cours |
| 2026-05-14 (suite) | **Envoi du reçu fiscal CERFA par email** : nouvelle action `sendCerfaEmailAction(donationId)` qui regénère le PDF via Puppeteer et l'envoie au donateur via Brevo SMTP. Expéditeur dédié `noreply@sda-nord.com` (Reply-To `contact@sda-nord.com`), template HTML SDA propre (couleurs marine/teal/orange, mention article 200 CGI + réduction d'impôt 66 %). Helper PDF extrait dans `lib/pdf/cerfa-pdf.ts` (réutilisable côté action ET route HTTP). Nouvelles colonnes `cerfa_sent_at` + `cerfa_sent_to` sur `donations` pour tracer l'envoi. Bouton dédié dans la liste des dons (Mail vs MailCheck selon état). Validation : envoi bloqué si CERFA pas encore généré. Pré-requis prod : variables `BREVO_SMTP_USER` et `BREVO_SMTP_KEY` déjà setup dans Coolify (réutilisées du flow astreinte + Documenso). | TS check ✅ + build ✅ |
| 2026-05-14 | **Scission nom/prénom + distinction personne/organisation** : table `clients` étendue avec `kind` (`person`/`organization`), `first_name`, `contact_person`. Formulaire client refondu avec toggle Particulier/Organisation (champs adaptés : Nom + Prénom obligatoires pour les particuliers, Nom de l'organisation + Personne référente optionnelle pour les organisations). Helper `getClientDisplayName()` centralisé (rend "NOM Prénom" pour les particuliers, raison sociale seule pour les orgas). Migration data : 73 lignes mises à jour — 33 personnes splittées manuellement (16 SDA, 2 réels Prénom Nom, 15 seed Test) + 39 organisations détectées (12 Ferme, 2 Dr.clean, 25 seed Test). Modals création rapide adoption/foster mises à jour avec champs Nom + Prénom séparés. Snapshots `client_name` dans documents/donations passent par le display name complet. | TS check ✅ + build ✅ |
| 2026-05-13 | **Extension espèces ferme + NAC** : drop-down passé de 2 (chien/chat) à 23 espèces (chèvres, moutons, cochons, vaches, chevaux, ânes, poneys, poules, canards, oies, lapins, cochons d'Inde, hamsters, rats, furets, chinchillas, perruches, perroquets, canaris, tortues + `other`). Migration SQL applique les CHECK constraints étendus + 3 nouvelles colonnes d'identification : `sire_number` (équidés), `ede_number` (bovins/ovins/caprins/porcins), `ring_number` (oiseaux). Formulaire animal affiche les champs d'identification adaptés selon l'espèce (transpondeur SIRE + passeport SIRE pour équidés, n° EDE + boucle d'oreille pour bovins/ovins/caprins, n° de bague pour oiseaux…). Sélecteur de box étendu avec valeurs `farm` (mixte ferme) et `other`. Helper `lib/species.ts` centralise labels, emojis, helpers conditionnels (`getIdentificationFieldsForSpecies`, `supportsCompatibility`, `isIcadEligible`, etc.). | commit `9047ce5` (33 fichiers, +714 −202 lignes) |
| 2026-05-15 | **Retours Franck + finition contrat abandon** : ajustements UX sur les contrats d'abandon suite revue terrain (Franck), corrections wording / clauses. | commit `7329722` |
| 2026-05-16 | **Moteur de créneaux pour RDV adoption (lot 0)** : algorithme de calcul des slots disponibles pour les rendez-vous d'adoption sur 1 mois glissant. Slots alignés 45 min, horaires configurables, J+2 minimum, exclusion auto des jours fériés FR. Table `adoption_appointment_settings` jsonb sur `establishments` (avec `DEFAULT_ADOPTION_APPOINTMENT_SETTINGS`). Status `pending_validation` ajouté à `appointments`. Page admin `/etablissement/adoption-rdv` pour configurer horaires & durée. | commit `7897297` |
| 2026-05-17 (matin) | **Tri naturel des box + 2 lignes affichage** : SQL backfill 178 box avec `sort_order` calculé via regex sur le nom (numéros d'abord par valeur, puis lettres). Layout grille passe de `flex overflow-x-auto snap-x` à 2 lignes séparées : numériques en haut (Box 1-11), alphabétiques en dessous (Box A-M). `createBox()` auto-calcule désormais `sort_order = MAX(zone) + 10`. | commit `bd401e2` |
| 2026-05-17 (matin) | **Onglets Présents / Sortis sur la liste animaux** : la liste `/animals` ne montre plus tous les animaux pêle-mêle (>600). Onglet par défaut `Présents` (statuts shelter/pound/foster_family/boarding) + onglet `Sortis` (adopted/returned/transferred/deceased/euthanized). Compteurs stables indépendants de la recherche. Sur `Sortis` : tri DESC par `exit_date`, masque les filtres adoption (adoptable/réservé/retraite/procédure), affiche la date de sortie, photo grisée à 35 %. Empty state propose de basculer sur l'autre onglet quand recherche ne donne rien. | commit `4e39c54` |
| 2026-05-17 (midi) | **Trigger DB invariant box_id** : `close_sponsorships_on_animal_exit` n'existait pas encore, mais on a posé `enforce_animals_box_invariant` qui force `box_id = NULL` pour tout animal dont le statut sort de {shelter, pound, boarding}. Couvre tous les chemins d'écriture (server actions, SQL direct, futurs composants) — invariant garanti au niveau base, pas au niveau code. Backfill : 0 ligne à corriger sur SDA (la donnée était propre). | migration `20260517b_animals_box_invariant`, commit `b8f75e6` |
| 2026-05-17 (midi) | **Retrait du bouton Hunimalis sync** : la sync était devenue inutile (les animaux sortis ne devaient pas revenir, et le code l'imposait déjà). Bouton + composant `HunimalisSyncButton` + action `hunimalis-sync.ts` + client API supprimés (515 lignes). Champs `hunimalis_id` et `last_synced_at` conservés en base pour l'historique ; les références `url.includes('hunimalis.com')` dans les composants photo restent pour les vieilles URLs déjà en base. | commit `59c0ef3` |
| 2026-05-17 (après-midi) | **Archive Hunimalis — import 28 306 contacts** : table `legacy_contacts` dédiée (séparée de `clients` pour ne pas polluer le répertoire actif). Recherche fuzzy via extension `pg_trgm` (GIN trigram index sur `full_name_normalized`), phone normalisé en E.164 français, dédup intra-fichier sur (nom, phone, CP). Script Python réutilisable `scripts/import_legacy_contacts.py` qui parse XLSX → normalise → batch INSERT API REST (28 306 lignes en 19 s, 0 échec). 12 Mo en base. Source flag `hunimalis_2026` pour purge/migration future. | commits `413c64e` (import) + `f43a499` (UI archive) |
| 2026-05-17 (après-midi) | **Onglet Archive Hunimalis + conversion en client** : onglet sur `/clients` (visible si `legacyCount > 0`), recherche débouncée 300 ms (nom via trigram, ville, téléphone), pagination 50/page, filtre « Inclure déjà convertis ». Bouton « Convertir » → modal qui détecte automatiquement les doublons existants (par phone OR nom+ville) — si match, propose de **lier** au client existant plutôt que de créer un doublon. Sinon, formulaire de création pré-rempli (heuristique Person vs Organization sur marqueurs ASSOCIATION/SOCIETE/MAIRIE…). Marque `legacy_contacts.converted_to_client_id` + `converted_by` après conversion (la ligne reste pour traçabilité). | commit `f43a499` |
| 2026-05-17 (après-midi) | **API publique pour portail contact.sda-nord.com** : 5 endpoints REST publics (`/api/public/adoption/animals`, `/animals/[id]`, `/slots`, `/inquiry`, `/my-inquiries`) avec CORS allowlist + Cloudflare Turnstile anti-bot + auth Bearer Supabase. Middleware whitelist `/api/public/` et `/api/webhooks/`. Email Brevo SMTP `signature@sda-nord.com` / `noreply@sda-nord.com` pour confirmation des demandes. | commit `360ba07` |
| 2026-05-17 (après-midi) | **Workflow CRM adoption + emails** : nouvelle table `adoption_inquiries` (statuts `pending`/`contacted`/`rdv_confirmed`/`rdv_completed`/`accepted`/`refused`/`cancelled`), page `/adoptions` avec onglets par statut + actions inline (valider, refuser, ajouter note, changer date RDV), 3 templates email (confirmation, validation, refus) via Brevo. Formulaire admin `/etablissement/adoption-rdv` pour configurer horaires/durée. | commit `2354b26` |
| 2026-05-17 (soir) | **Système de parrainage d'animaux** : table `sponsorships` (un animal peut avoir N parrains), 3 types `financial_monthly`/`financial_punctual`/`symbolic`, champs RGPD (`public_alias` + `show_publicly`). Trigger DB `close_sponsorships_on_animal_exit` qui ferme automatiquement les parrainages quand l'animal sort (statut → `ended` + `ended_reason` adaptée). Ajout `donations.sponsorship_id` pour flécher les dons. UI : nouvel onglet « Parrains » sur fiche animal avec modal create/edit (sélecteur client + création à la volée + 3 kinds visuels + RGPD), section « Parrainages » sur fiche client (grille filleuls avec photo + statut + ancienneté + bouton « Proposer un autre filleul » sur ended). | commit `833b8b6` |
| 2026-05-17 (soir) | **Visuel PDF poster animal (V1)** : génération via Puppeteer d'une affiche A4 portrait « magazine éditorial » pour entrée fourrière / adoption. Adapte le titre selon contexte (`AVIS · CHERCHONS PROPRIÉTAIRE` si origine `found`/`divagation`, sinon `À L'ADOPTION`). Photo, méta (espèce/sexe/âge), race/couleur/identification, lieu/circonstances de capture, CTA téléphone. Route GET `/api/pdf/animal-poster/[id]?format=html\|pdf` (HTML preview pour itérer le design rapidement). | commit `6410194` |
| 2026-05-17 (soir) | **Visuel V2 — direction photo immersive 1080×1350** : refonte du poster en ratio 4:5 social-ready (Facebook/Insta fil). Photo plein cadre + gradient sombre overlay pour lisibilité, badge AVIS en pastille terracotta haut-droit. Helper `renderHtmlToImage()` ajouté dans `lib/pdf/render.ts` (Puppeteer custom-sized PNG/PDF). Lecture phone/email depuis `establishments` table (fallback email avec icône enveloppe si phone vide — plus aucun hardcode). | commit `78b9610` |
| 2026-05-17 (soir) | **Visuel V3 — simplification + logo rond** : retrait des 3 boutons redondants (Visuel/PDF/aperçu), un seul bouton « Visuel » qui ouvre le PNG (le PDF reste accessible via `?format=pdf` sur l'URL). Logo établissement passe en cercle blanc avec halo subtil (border-radius 50% + padding 10px) pour ressortir sur la photo plein cadre. | commit `4d3dd16` |
| 2026-05-18 | **Petits fixes** : README précise « Ferme Ô 4 Vents » (accent), `deleteLeaveRequest` utilise désormais adminClient + scoping `establishment_id` (bug RLS qui empêchait la suppression silencieusement). Suppression du résidu `MIGRATION_TO_RUN_2026_04_27.sql` à la racine (déjà appliqué en base). | commits `fcbc2c1` (fixes) + `c9a3c94` (404 bandeau fourrière `/animaux/` → `/animals/`) |
| 2026-05-18 | **Assigner une sortie depuis un box** : nouveau bouton « Sortie » (icône `Footprints`) sur chaque ligne d'animal dans le drawer de détail d'un box. Modal léger avec photo + nom de rappel, picker membres équipe (recherche débouncée), date par défaut aujourd'hui, note libre optionnelle. Réutilise `createAssignment` existante. Visible uniquement pour chiens en statut shelter/pound/boarding. Gain : ~30 s par assignation depuis le workflow quotidien. | commit `9ba2cdc` |
| 2026-05-19 (matin) | **Affinage visuel poster** : badge « AVIS · CHERCHONS PROPRIÉTAIRE » agrandi (font-size +37 %, padding +60 %, halo blanc 4px), gradient overlay un peu plus marqué pour lisibilité sur chiens à robe claire (transition démarre à 32 % au lieu de 40 %), text-shadow ajouté partout. Typo passe de Fraunces à **Baloo 2** (utilisée par la SDA pour ses supports). | commit `0fe0f98` |
| 2026-05-19 (matin) | **Fixes modal sortie** : z-index passé de `z-50` à `z-[200]` pour passer au-dessus du drawer box ; robustesse chargement équipe (flag `cancelled` anti-setState après unmount, catch erreurs réseau, toast explicite) ; propagation clic stoppée sur overlay + contenu (close uniquement si target = currentTarget). | commits `298fb61` + `1996518` (Clément depuis autre poste) |
| 2026-05-19 (après-midi) | **3 chantiers parallèles** dispatchés en agents : <ul><li>**Akéla (partenaires externes)** : nouvelle table `outing_partners` (educator/club/walker/foster_pro/other), `outing_assignments.assigned_to` nullable + colonne `partner_id`, CHECK constraint exactement-un-des-deux. Modal d'assignation refondu avec 2 sections « Équipe » + « Partenaires ». Seed Akéla pour SDA Estourmel (label « Canicross »). Migration `20260519a_outing_partners`.</li><li>**Certificat d'engagement** (loi 30 nov 2021, arrêté 30 mai 2022) : nouvelle table `engagement_certificates` + colonne `pre_reservation_client_id` sur `animals`. PDF officiel généré via Puppeteer (4 sections + délai 7j mis en avant, charte SDA). Workflow : bouton « Pré-réserver pour adoption » → envoi Documenso (email branded SDA via Brevo) → badge « Pré-réservé » + bandeau compteur J/7 → bouton « Finaliser » à J+7. Webhook Documenso routé sur prefix `engagement_*`. Migration `20260519b_engagement_certificates`.</li><li>**Rubrique Nouvelles** (cf. ligne dédiée).</li></ul> | commit `be1f6a1` (28 fichiers, +4340 lignes) |
| 2026-05-19 (après-midi) | **Sync photos Nouvelles → fiche animal** : colonne `source_news_id UUID REFERENCES animal_news(id) ON DELETE CASCADE` sur `animal_photos`. À chaque création de nouvelle, les photos sont aussi insérées dans `animal_photos` (avec `is_primary=false` toujours) pour apparaître dans le tab Photos de la fiche animal — y compris sortis/adoptés. ON DELETE CASCADE garantit le cleanup auto. Backfill 1 photo migrée. Migration `20260519d_animal_photos_source_news`. | commit `755a55e` |
| 2026-05-19 (soir) | **DatePicker partout — navigation année/mois rapide** : composant `ui/calendar.tsx` activé en `captionLayout="dropdown"` (dropdowns mois + année dans le header), bornes par défaut -30 ans / +5 ans (couvre date de naissance d'animaux âgés + RDV futurs). 22 fichiers migrés de `<input type="date">` natif vers `<DatePicker>` du design system via 5 agents en parallèle (~35 inputs date remplacés). UX uniforme partout, plus de fallback navigateur, dropdowns rapides pour les dates anciennes (date de naissance). | commits `e1543a3` (calendar) + `d9eab2d` (22 fichiers) |
| 2026-05-19 | **Rubrique Nouvelles (FA + adoptants)** : nouveau module pour archiver les photos et messages reçus des familles après adoption / placement FA, puis générer des visuels publi-ready (solo ou mosaïque). <ul><li>Migration `20260519c_animal_news` (appliquée via MCP) : tables `animal_news` (photos JSONB + texte + source) et `animal_news_mosaics` (regroupement de N nouvelles), permission `view_animal_news` ajoutée à `permission_groups` (désactivée par défaut sauf groupe Administrateur), RLS multi-établissement.</li><li>Storage : préfixe `news/` dans le bucket `animal-photos` existant — pas de nouveau bucket, les policies existantes (paths préfixés par `establishmentId`) sont réutilisées.</li><li>Page `/nouvelles` : onglets Inbox / Publiées, multi-sélection, CTAs « Publier en solo » (1 sélection) / « Publier en mosaïque » (2-6 sélections). Modal d'ajout avec picker animal (filtré sur statuts adopted / foster_family / transferred / returned), upload multi-photos direct browser → Storage avec conversion HEIC + compression.</li><li>Visuels : format social 1080×1350, typo Baloo 2 + Inter, charte SDA (navy / teal / terracotta). Solo : photo plein cadre + eyebrow « Adopté il y a X mois » + headline « Quoi de neuf, NomAnimal ? » + citation italique en border-left teal. Mosaïque : grille 2×2 (2-4 animaux) ou 2×3 (5-6) sur fond paper, bandeau « QUELQUES NOUVELLES DE NOS ANCIENS », footer « Adoptez vous aussi → sda-nord.com ».</li><li>Routes API : `/api/visuels/animal-news/[newsId]?format=png\|pdf\|html` (solo) et `/api/visuels/animal-news/mosaic?ids=uuid1,uuid2&format=png` (mosaïque).</li><li>Server actions : `addAnimalNews`, `getAnimalNewsInbox`, `getAnimalNewsHistory`, `getAnimalNewsForAnimal`, `getEligibleAnimalsForNews`, `markNewsAsPosted`, `deleteAnimalNews` — toutes scopées par `view_animal_news`.</li><li>Sidebar : nouvel item « Nouvelles » (icône `Sparkles`) dans la section Communication, visible uniquement si `canViewAnimalNews`. Bénévoles « promeneurs » sans la perm n'y ont donc pas accès.</li><li>Tab « Nouvelles » sur la fiche animal volontairement non câblé en V1 (scope tab-system multi-props lourd) — accessible via `/nouvelles` global.</li></ul> | TS check ✅ + build ✅ |

## Problèmes connus / Dette technique

- ⚠️ Branch git locale `feature/avril-2026-features` pas supprimée après merge dans `main`
- ⚠️ Modifications non commitées en cours sur d'autres chantiers : module `contacts-entrants` (page + actions + composants — sans doute en cours sur l'autre poste de Clément), laissées dans le working tree
- ⚠️ Avertissement build Next.js : `metadataBase` non défini (cosmétique)
- ⚠️ Lien sidebar `/contacts-entrants` réservé aux owners mais la route n'est pas encore committée → 404 pour Clément (à committer depuis l'autre poste)
- ⚠️ **Branding global Documenso reporté** : la création d'organisation dans l'admin Documenso self-hosted (image `:latest`) plante sur un appel Stripe absent en self-hosted. Solution acceptée : contournement via UI/SQL direct quand le besoin sera prioritaire. En attendant, la personnalisation passe par le sujet + le corps de l'email (déjà customisés par établissement). Logo SDA disponible sur https://sda.optimus-services.fr/logo-sda.png pour quand on s'y attaquera.
- ⚠️ Fichier orphelin HEIC dans le bucket `animal-photos` (`fbf2ebf8-…/167c7f2b-….heic`) — la ligne DB a été supprimée mais Supabase bloque le DELETE direct sur `storage.objects` (sécurité). Suppression à faire via l'API Storage si on veut faire le ménage
- ⚠️ **11 contrats orphelins en base** (CA-2026-001/002, CFA-2026-001 à 009) créés avant la suppression du double workflow le 2026-05-10 : pas de mouvement associé, donc invisibles dans la timeline mais visibles dans l'onglet *Contrat*. Régularisation au cas par cas reportée. Aucun document/CERFA généré → pas de risque comptable.
- ⚠️ **Doublon de numéro de contrat** : 2 contrats portent `CFA-2026-002` en base (un pour Tupac, un pour un autre animal). Bug de séquençage de numérotation, à investiguer dans `lib/actions/foster-contracts.ts`.
- ⚠️ **Téléphone SDA non renseigné en base** : l'établissement SDA a un `phone` vide → le visuel poster animal affiche l'email `accueil@sda-nord.com` à la place. À renseigner dans `/etablissement`.
- ⚠️ **Tab « Nouvelles » sur fiche animal pas câblé en V1** : la rubrique Nouvelles est accessible globalement via `/nouvelles`, mais pas comme onglet sur la fiche individuelle d'un animal sorti. À ajouter en V2 si pertinent (la donnée est là via `getAnimalNewsForAnimal`).
- ⚠️ **Postiz / publication directe réseaux sociaux** : reporté. Décision : utiliser Postiz cloud (≈$3-9/mois) quand le besoin se présente, plutôt que self-host (overkill : 5 services Docker dont Elasticsearch) ou Meta Graph API direct (App Review 2-4 semaines).

## Prochaines étapes (TODO V2 demandées par l'équipe)

**Demandes Céline / Maryline / Franck** (non encore traitées) :
- Contrat FA Tupac (départ vendredi) : corriger les accents partout dans le contrat + ajouter le numéro de téléphone de Céline pour les personnes
- Filtre / groupe **« Panier retraite »** dans le répertoire (Céline) — pour communication ciblée renouvellement adhésion janvier + sollicitations dons (vivier de contacts identifié)
- **Agenda RDV** (Franck) — vue calendrier des rendez-vous (probablement utiliser table `appointments` existante)
- Permissions « Répertoire » à activer sur les groupes de **Carole** et **Marina** (à faire en UI Établissement → Groupes)
- « Loulous adoptés en accueil » — sera résolu progressivement par les nouvelles syncs Hunimalis (le fix protège, mais il faut quand même que les statuts d'adoption soient remontés correctement par Hunimalis)

**Parrainages V2** :
- Page publique de parrainage sur `contact.sda-nord.com` (liste animaux à parrainer + formulaire)
- CERFA cumulé annuel pour les parrains financiers (article 200 CGI)
- Emails périodiques aux parrains (newsletter trimestrielle avec photos partagées)
- Notifications « parrains orphelins à recontacter » suite à sortie animal

**Nouvelles V2** :
- Onglet « Nouvelles » sur la fiche animal individuelle (déjà câblé côté action `getAnimalNewsForAnimal`, manque juste l'intégration UI dans `animal-detail-tabs.tsx`)
- Notifications « X jours qu'on n'a pas eu de nouvelles de Médor » (suggestion de relance FA/adoptant)
- Édition des nouvelles déjà publiées
- Intégration Postiz pour publication directe depuis l'inbox

**Visuels** :
- Format Story 9:16 (1080×1920) en plus du carré 4:5 pour publications stories Insta/FB
- QR code vers la fiche animal publique (quand portail `contact.sda-nord.com` aura les pages animal)
- Préréglage « Photo de profil » qui utilise une photo de nouvelle comme nouvelle photo principale (actuellement `is_primary` reste sur la photo d'arrivée)

**Maintenance**
- Finaliser et committer le module `contacts-entrants` (depuis l'autre poste de Clément)
- Marquer rétroactivement les animaux SDA en procédure (Nicoletta, etc.)
- Ajouter un export PDF « frais engagés global SDA » tous animaux en procédure confondus
- Notifications quand un animal en procédure approche d'une échéance (audience, etc.)
- Documenter la procédure pour Maryline / Céline / Caroline (mode d'emploi rapide)
- Résoudre le doublon `CFA-2026-002` + auditer la fonction de séquençage des numéros de contrat

---

## Session 2026-05-20

Sept chantiers en parallèle livrés sur main (Coolify auto-deploy) + une régression critique corrigée. Toutes les migrations Supabase appliquées en production sur `zzevrtrgtgnlxxuwbnge`.

### 1. Couverture des congés (`feature/leave-coverage` — merged)

Nouveau onglet **Couverture** dans `/admin/conges` (gated `manage_leaves`) :
- Calendrier mensuel heatmap vert/orange/rouge selon effectif salarié dispo
- Toggle "inclure les demandes en attente"
- Drill-down par jour avec badges salarié/auto-entrepreneur/bénévole
- Seuil `min_daily_staff` par établissement (défaut 3)

Modèle DB enrichi (migration `leave_coverage`) :
- `establishment_members.contract_type` (`salarie`/`auto_entrepreneur`/`benevole`/`autre`)
- `establishment_members.availability_status` (`active`/`on_extended_leave`) + `extended_leave_from`/`until`/`reason`
- `establishments.min_daily_staff`

Validation des demandes : `approveLeaveRequest` refuse si l'approbation ferait passer l'effectif salarié sous le seuil. Bouton "Forcer la validation" pour les admins avec motif obligatoire (taggé `[Validation forcee]` dans le commentaire).

**Bugfix delete leave** : `deleteLeaveRequest` retournait un faux succès. Le DELETE cookie-based était silencieusement bloqué par RLS. Passage à `adminClient` (route déjà gardée par `requirePermission('manage_leaves')`) + check `count` pour détecter une suppression silencieuse.

Effectif SDA configuré :
- 5 salariés actifs : Carole, Franck, Marina, Mary, Yann
- Eric : créé en pseudo-user, `on_extended_leave` jusqu'au 2026-12-31
- Matthieu : `auto_entrepreneur` (existait déjà en admin)
- Clément + Céline : `autre` (dirigeants associatifs, pas comptés dans l'effectif salarié)

### 2. CRA mensuel + arrêts horaires + upload arrêts (`feature/leave-cra` — merged)

Étend `feature/leave-coverage` avec :
- **Granularité arrêts** : `leave_requests.granularity` (`full_day`/`half_day`/`hourly`) + `start_time`/`end_time`/`duration_hours`. Backfill : demi-jours existants passent en `half_day`.
- **Admin saisie directe** : nouveau bouton "Saisir un arrêt/congé" dans l'onglet Demandes. `adminCreateLeaveRequest` accepte un `member_id` quelconque, auto-approuve par défaut, tag `[Saisie admin]`.
- **Upload arrêts maladie** : table `leave_attachments` + bucket privé `leave-attachments` (10 Mo). Kinds : `sick_note`, `extended_leave_proof`, `other`. Panneau intégré dans la modale de validation.
- **CRA mensuel PDF** : nouvel onglet "CRA mensuel" avec sélecteur collaborateur + mois + année. Route `/api/pdf/cra/[memberId]/[year]/[month]` génère un A4 paysage avec calendrier mensuel (travaillé / WE / férié / congé / demi / horaire), KPI cards, ventilation par type d'absence, blocs signature.

### 3. Retour adoption pendant période d'accueil (`feature/adoption-trial-return` — merged)

Modèle (migration `adoption_trial_return`) :
- `establishments.default_trial_period_days` (default 15)
- `adoption_contracts.trial_period_days` (override) / `trial_period_ends_at` / `non_refundable_amount` (default 60) / `returned_at` / `refunded_amount` / `refunded_at` / `refund_payment_method` / `return_reason`
- Statut étendu : ajout de `trial_returned` et `finalized`
- Colonnes signature Documenso pour l'avenant d'annulation

Workflow 260€ → 200€ remboursés :
1. Adoption signée → contrat `active`
2. Pendant période d'accueil, bouton ↺ orange sur la fiche → modale `AdoptionReturnModal` : date retour, mode remboursement, montant pré-rempli (= adoption_fee - non_refundable), motif. Validation crée le mouvement shelter, marque le contrat `trial_returned`, trace le remboursement.
3. PDF avenant d'annulation disponible immédiatement (template SDA A4 : contexte, règlement financier, motif, blocs signature)
4. Bouton "Envoyer pour signature" → Documenso pipeline complet (externalId préfixé `adoption_cancellation_<uuid>`, email branded SDA via Brevo, webhook met à jour `cancellation_signature_status` + stocke le PDF signé)

### 4. Procédure judiciaire — extension (`feature/judicial-documents` — merged)

Animaux en réquisition disposent maintenant d'un onglet dédié **Procédure** (visible uniquement si `judicial_procedure=true`).

Champs ajoutés sur `animals` (migration `judicial_extension`) :
- `judicial_pickup_location` (puis remplacé par le champ générique pickup, cf section 6)
- `judicial_hearing_date` / `judicial_decision_date` / `judicial_appeal_deadline`
- `judicial_lawyer_name` / `judicial_lawyer_contact`

Documents uploadés : table `judicial_attachments` + bucket privé `judicial-documents` (20 Mo). Kinds : `seizure_pv`, `requisition_order`, `court_decision`, `vet_report`, `photo_evidence`, `invoice`, `other`. Composant `JudicialDocumentsSection` avec sélecteur kind + date document + notes + upload + liste avec icônes contextuelles + ouverture signed URL + suppression.

Onglet Procédure affiche : encadré rouge avec récap complet du dossier (toutes les dates, l'avocat, le propriétaire mis en cause, la facturation, les notes) + lien PDF "Dossier procédure" + section documents + (cf section 7) section frais médicaux.

### 5. Bugfix modal Sortie animal (2 commits)

Régression sur le modal "Sortie pour [animal]" depuis le drawer Box :
1. **Premier fix (z-index)** : le modal était à `z-50`, sous le backdrop du drawer (`z-[99]`). Les clics tombaient sur le backdrop du drawer → drawer fermé. Passage à `z-[200]`.
2. **Deuxième fix** : malgré le z-index, les clics fermaient encore le drawer (propagation des events React via portails vers la React-tree ancestor). Ajout de `e.stopPropagation()` sur le backdrop + panel interne. ET ajout de `.catch()` sur `getEstablishmentMembers()` qui rejetait silencieusement → liste membres restait "Chargement…" à l'infini.

### 6. Lieu de récupération générique avec autocomplete BAN (`feature/animal-pickup-address` — merged)

Pour TOUS les animaux (pas seulement en procédure). Composant réutilisable `ui/address-autocomplete.tsx` qui appelle l'API gratuite [api-adresse.data.gouv.fr](https://api-adresse.data.gouv.fr) (Base Adresse Nationale) :
- Recherche live à partir de 3 caractères, debounce 250ms, AbortController
- L'utilisateur DOIT cliquer un résultat (warning visuel si saisie libre, restauration au blur)
- Icône check verte quand valide, bouton clear, bouton ouvrir

Champs DB (migration `animal_pickup_address`) :
- `pickup_address_label` (label complet du BAN, source de vérité)
- `pickup_postcode` / `pickup_city` / `pickup_lat` / `pickup_lng` / `pickup_ban_id`
- Backfill : hydrate depuis `capture_location` existant
- Index partiels sur `pickup_city` et `pickup_postcode`

Le champ `judicial_pickup_location` ajouté la veille est laissé en DB (rétrocompat) mais retiré de l'UI au profit du nouveau champ générique. La section "Lieu de récupération" est désormais toujours visible (création + édition), placée juste après l'identité.

### 7. Factures médicales + recap frais (`feature/medical-invoices` — merged)

Upload des factures cliniques sur les actes de santé, recap PDF pour le tribunal.

Migration `medical_invoices` :
- `animal_health_records.invoice_storage_path` + `invoice_file_name` + `invoice_mime_type` + `invoice_size_bytes` + `invoice_uploaded_at`
- Bucket privé `medical-invoices` (20 Mo, pdf+images)
- Index partiel `(animal_id, judicial_procedure) WHERE true`

UI :
- **Dans le formulaire santé** (`HealthRecordForm`) : nouveau composant `MedicalInvoiceUploader` visible uniquement quand `judicial_procedure=true` ET en mode édition (la création doit d'abord enregistrer pour avoir un `health_record_id`). Upload / remplace / ouvre / supprime via `getMedicalInvoiceSignedUrl`.
- **Dans l'onglet Procédure** : nouvelle `MedicalCostRecapSection` listant tous les actes judiciaires avec `cost > 0`, total cumulé, badge facture jointe (vert) / manquante (orange), avertissement si actes sans facture.
- Bouton "Générer le récap PDF (template refuge)" → route `/api/pdf/medical-cost-recap/[animalId]` → PDF A4 SDA avec header logo, animal + dossier judiciaire, tableau actes, total HT, blocs signature, à remettre au tribunal pour recouvrement.

Server actions `medical-invoices.ts` : `uploadMedicalInvoice` (FormData) / `deleteMedicalInvoice(healthRecordId)` / `getMedicalInvoiceSignedUrl(healthRecordId)`. Toutes gardées par `requirePermission('manage_health')`.

### Bugs / régressions résolus en cours de session

- TS narrowing dans `cra-template.ts` : le membre union `{kind: 'weekend' | 'holiday'}` ne se narrowait pas après `if (d.kind === 'weekend')`. Fix : check explicite sur `absent_hours` + fallback de sécurité.
- Build Docker Coolify a échoué une fois sur ce point (commit `f9f65b9`) ; corrigé en `6ad0454` (déploiement passé).

### Méta

- 7 branches features + 3 branches fixes mergées sur main au cours de la journée
- 7 migrations Supabase appliquées en production
- Co-réalisé avec un autre poste (Akéla / certificat engagement / nouvelles, DatePicker migration) — historique linéaire conservé par rebases successifs
- Pas de force-push sur main, force-push sur les feature branches uniquement (avant merge)

### 8. Refonte du module Nouvelles (`feature/nouvelles-refonte` — merged commit `a67b24d`)

Demandée par Clément : retravailler la rubrique Nouvelles pour distinguer 2 cas d'usage différents et supprimer la complication "inbox / publication différée".

**Avant** : un seul onglet "Nouvelles" pour tous les animaux sortis (`adopted` / `foster_family` / `transferred` / `returned`), avec inbox (`posted_at IS NULL`) + workflow "Marquer comme publié" + mosaïques optionnelles.

**Après** :
- **Suppression du workflow inbox** : une news est désormais **publiée immédiatement** à sa création (`posted_at = now()`). Plus de bouton "Publier en solo" / "Publier en mosaïque" depuis l'inbox.
- **2 onglets distincts** dans `/nouvelles`, basés sur le statut courant de l'animal :
  - 🐾 **Suivi des protégés** : animaux encore au refuge (`shelter` / `pound` / `boarding` / `foster_family`) → visible par les parrains sur `parrainage.sda-nord.com`
  - ❤️ **Nouvelles des sortis** : animaux partis (`adopted` / `transferred` / `returned`) → publication Facebook avec export visuel
- **Filtres riches** dans chaque onglet : recherche textuelle (nom animal, texte, auteur), dropdown filtre par animal, range de dates "du / au", bouton "Réinitialiser"
- **Modal d'ajout contextualisé** : prop `category` qui adapte la copy (titre, sous-titre, label "Auteur" vs "De qui")
- **Mosaïques conservées** mais uniquement dans l'onglet "Sortis" (récap Facebook). L'action est exposée via `createMosaic({ newsIds, title?, generatedImageUrl? })`.
- **Bande signature SDA** (`gradient orange→teal→navy` 8px) ajoutée en bas des templates visuels solo + mosaïque, cohérente avec la charte officielle des courriers (`sda-brand.ts`).

**Migrations SQL appliquées** :
- `20260520a_news_no_inbox` : backfill `posted_at = COALESCE(posted_at, created_at, now())` sur toutes les news existantes (les anciennes inbox passent en publié rétroactivement), `posted_at NOT NULL DEFAULT now()` pour les futures, index `(establishment_id, posted_at DESC)` + `(animal_id, received_at DESC)`.
- `20260520b_news_public_select` : **policies RLS publiques** ouvrant la lecture de `animal_news` et `animals` aux requêtes anonymes pour les **animaux longs séjours uniquement** (statuts `shelter` / `pound` / `boarding` / `foster_family`). Permet à la plateforme parrainage (`parrainage.sda-nord.com`) de fetch les news en anon sans service role key.

**Server actions refondues** (`lib/actions/animal-news.ts`) :
- `getAnimalNewsByCategory({ category, animalIds?, dateFrom?, dateTo? })` — fetch unifié avec filtres
- `getAnimalsForCategory(category)` — liste des animaux éligibles selon le contexte
- `getMosaics()` — récaps multi-animaux publiés
- `getAnimalNewsForAnimal(animalId)` — toutes les news d'un animal
- `addAnimalNews({...})` — publication immédiate (`posted_at = now()`)
- `createMosaic({ newsIds, title, generatedImageUrl })` — récap multi-animaux
- `deleteAnimalNews(id)`
- Supprimées : `getAnimalNewsInbox`, `getAnimalNewsHistory`, `getEligibleAnimalsForNews`, `markNewsAsPosted` (concept inbox disparu)

**Types DB** (`lib/types/database.ts`) : ajout `SHELTERED_STATUSES`, `ALUMNI_STATUSES`, `NewsCategory`. `ANIMAL_NEWS_ELIGIBLE_STATUSES` conservé deprecated pour rétrocompat.

**Composants refondus** :
- `AnimalNewsClient` : 2 onglets avec compteurs, toolbar filtres, grille de cards, section Mosaïques en bas de l'onglet Sortis
- `AddNewsModal` : prop `category` optionnelle, copy adaptative
- `animal-news-client.tsx` simplifié : suppression de toute la logique multi-sélection / publish solo / publish mosaïque
- Composants `NewsCard` et `MosaicCard` internalisés dans le client (présentation enrichie)

**Plateforme parrainage** branchée en aval (cf. `parrainage/RECAP.md`) : fetch des vraies news en anonyme via les nouvelles RLS policies, fallback gracieux sur les mocks pour la démo Sophie.

Fichiers modifiés : 9 (+537 / -419 lignes). Migrations : 2. TS check + build local OK avant push.

### 9. Modal "Détail du jour" : salariés uniquement (commit `6381463`)

Petit ajustement UX demandé par Clément après revue de l'écran : le modal **Détail du jour** de l'onglet Couverture (`/admin/conges` > Couverture > clic sur un jour) affichait tous les `establishment_members` actifs (~30 personnes pour SDA), ce qui rendait l'écran difficile à lire alors que la couverture n'est calculée que sur les salariés.

**Modif** dans `src/components/leaves/leave-coverage-calendar.tsx` :
- **Présents** : avant `[...active_salaried, ...active_auto, ...active_other]`, désormais `active_salaried` seul. Suppression du badge bleu PRESTA spécifique à `auto_entrepreneur` (devenu inutile).
- **Absents** : filter par `memberMap.get(a.member_id)?.contract_type === 'salarie'` avant rendu. Le compteur "Aucun" reflète maintenant les absents salariés seulement.

Le calcul de couverture (seuil 3 par défaut à la SDA) était déjà basé sur les seuls salariés — donc cohérence métier conservée, juste l'affichage qui s'aligne. Les bénévoles et auto-entrepreneurs restent visibles ailleurs (planning sorties, équipe…) où ils sont pertinents.

1 fichier modifié (+14 / -17 lignes). TS check ✅.

### 10. Couverture : dénominateur du compteur "X / Y" corrigé (commit `daa865c`)

Bug visuel signalé par Clément sur la grille de couverture mensuelle : chaque jour affichait "X / Y" où Y était calculé comme `active_salaried + active_auto + active_other - absent` (~30-34 pour SDA, intégrant tous les bénévoles). Le numérateur X étant déjà sur les salariés uniquement, le ratio n'avait pas de sens.

**Fix** :
- Ajout d'un champ `total_salaried_count` dans `CoverageDay` (server) calculé comme `active_salaried.length + absent.filter(salarie).length` = effectif total sous contrat ce jour-là (incluant arrêts longs + congés).
- Le composant client utilise désormais `d.total_salaried_count` comme dénominateur — peu importe le toggle "Inclure pending".
- Légende mise à jour : "Salariés dispos / total sous contrat" (avant : "Salaries / total dispo").

Pour SDA aujourd'hui, le dénominateur est désormais **6** (Carole, Franck, Marina, Mary, Yann + Eric en arrêt long), au lieu de 31-34 selon les jours.

2 fichiers modifiés (+11 / -7). TS check ✅.

