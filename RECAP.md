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
| `/api/cron/cra-resend` | **Admin one-shot** : renvoyer les CRA `sent` d'un mois au comptable avec CC, ou en mode preview à une adresse override. Bearer `CRON_SECRET`. Body : `{establishment_id, year, month, cc?, preview_to?}` |

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
| 2026-06-02 | **Fix visibilité publique des animaux en accueil temporaire** (remarque Carole — cas Mamie-Simone) : la policy RLS anon `"Public can view adoptable animals"` ne couvrait que `adoptable=true AND status='shelter'` → un animal proposé à l'adoption mais hébergé en famille d'accueil (`foster_family`) ne basculait pas sur sda-nord.com. Migration `20260602_public_adoptable_foster` : élargit à `status IN ('shelter','foster_family')`, cohérent avec le filtre du site (`/animaux`) et la policy parrainage `animals_public_select_sheltered`. Fix jumeau côté `sda-website` (`app/page.tsx`, vitrine home oubliée par le commit `60959f7` qui avait déjà corrigé `/animaux`). | migration appliquée via MCP ✅ + TS check ✅ |

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

---

## Session 2026-05-20 (après-midi) — Auth onboarding + Liste noire SDA

Deux chantiers en parallèle via worktrees git + agent background.

### 1. Auth onboarding bloquant (`feature/auth-onboarding`)

**Constat** : système d'auth "léger" — admins en email + Google SSO, salariés/bénévoles en pseudo (prénom) + mot de passe avec email technique caché. Pas de mail perso, donc pas de récup mdp, pas de notif, identifiants non universels.

**Décisions cadrées avec Clément** :
- Tous les bénévoles ont un email → migration 100% vers auth email
- Adresse personnelle obligatoire pour tous (assurance, RGPD)
- Blocage immédiat à la prochaine release
- Mapping conservé entre comptes pré/post — pas de nouveau compte créé, juste enrichissement (auth.users.id immuable)
- Mode pseudo gardé en transition 2 mois puis supprimé
- Google SSO réservé à `clement.scailteux@gmail.com`

**Livré** :
- Migration `20260520e_user_profiles.sql` — table `user_profiles` (nom, prénom, email perso, tél, date naissance, adresse BAN), trigger sur `auth.users` (création auto), backfill pour tous comptes existants (`profile_completed=false`), RLS self-read + estab-read
- Server action `completeMyProfile` : upsert profil + update `auth.users.email` (cas migration pseudo) + écrit `user_metadata.profile_completed=true` pour cache middleware
- Middleware : redirige vers `/onboarding` tant que `profile_completed != true` (lecture metadata, pas de query DB)
- Page `/onboarding` + `onboarding-form.tsx` — form complet avec `AddressAutocomplete` BAN obligatoire, message dédié aux comptes pseudo
- `auth/callback/route.ts` — whitelist Google SSO `[clement.scailteux@gmail.com]` ; sinon signOut + `/login?error=sso_forbidden`
- `login/page.tsx` — affichage du message d'erreur SSO
- `api/auth/signout/route.ts` — logout depuis l'onboarding
- `compte/page.tsx` + `personal-info-section.tsx` — section "Mes informations personnelles" avec toggle lecture/édition pour retrouver/modifier les infos après onboarding

### 2. Liste noire SDA (`feature/judicial-blacklist`) — agent en background

**Besoin** : registre des propriétaires d'animaux mis en cause en procédure judiciaire (réquisition/saisie) qui bloque leurs futures tentatives d'adoption.

**Architecture validée** : pas de nouvelle table, on étend `clients` (réutilise nom/prénom/adresse/tel/email existants ; si la personne tente plus tard d'adopter, elle apparaît dans la recherche client avec badge ⛔).

**Livré par l'agent (commit `f2cd88e`)** :
- Migration `20260520d_judicial_blacklist.sql` — `clients` +9 colonnes (`is_blacklisted`, `blacklist_reason/source/at/by`, `blacklist_removed_*`, `birth_date`, `birth_place`, `national_id`), `animals.judicial_owner_client_id`, `adoption_inquiries.possible_blacklist_match`, extension `unaccent`, fonction `check_adopter_blacklist(estab, last_name, first_name, email?, phone?, birth_date?)` retournant `match_strength` (`exact_email`/`exact_phone`/`name_birthdate`/`name_only`)
- Server actions `blacklist.ts` (6 fonctions : matching, picker search, upsert propriétaire judiciaire, ajout manuel, retrait admin avec audit critique, lecture enrichie)
- Page `/etablissement/liste-noire` + composants `BlacklistTable`, `BlacklistAddButton`, `BlacklistOverrideModal`
- `JudicialOwnerPicker` (2 steps : recherche client existant ou création complète avec BAN, naissance, motif) — remplace l'input texte libre dans la fiche animal en édition
- Blocage inquiry publique : match exact/email/phone/birthdate → `status='refused'` + raison neutre côté demandeur (on ne révèle pas la liste noire au public) ; match nom seul → flag `possible_blacklist_match` pour vérif équipe
- Blocage contrat back-office : Server Action retourne `BLACKLIST_BLOCK` → `BlacklistOverrideModal` ; admin peut forcer avec justification obligatoire + audit critique
- Fiche client : bandeau rouge + badge ⛔ + section dédiée "Liste noire SDA" (motif, source, animaux liés, historique)
- Recherche client : badge ⛔ + toggle "Afficher la liste noire" (OFF par défaut)
- Lien dans le menu admin "Pilotage"

### 3. Hotfixes build TS (3 cycles)

Builds Coolify successifs cassés par des erreurs TypeScript strict sur des interfaces locales non synchronisées avec `database.ts` :

| Commit | Fix |
|---|---|
| `a4086d2` | `sante/page.tsx` — ajout des 5 champs `invoice_*` à l'interface locale `HealthRecordWithAnimal` (manquaient depuis la migration `20260520c`) |
| `889b0f9` | `medical-cost-recap-section.tsx` — suppression de `interface ExtendedHealthRecord extends AnimalHealthRecord` qui re-déclarait des champs requis en optionnel (TS strict refuse l'élargissement) |
| `e95ed5d` | `animal-detail-tabs.tsx` — propagation du prop `judicialOwner` de `AnimalDetailTabs` vers la sous-fonction `InfoTab` (l'agent référençait la variable sans l'avoir reçue) |

### Workflow technique

- Worktrees git créés à la volée pour paralléliser : `refuge` (agent blacklist), `refuge-auth` (auth), `refuge-hotfix` (merges + fixes)
- Conflit attendu sur `database.ts` résolu en auto-merge (zones différentes : agent en haut, ajout `UserProfile` en bas)
- Migrations appliquées directement sur Supabase prod via MCP (`apply_migration`) — pas d'attente du déploiement applicatif
- Tous les commits forcés en `--author="skyclem59400 <c.scailteux@sda-nord.com>"` (git config jamais modifié, conformément au protocole)

### À configurer côté Supabase Dashboard (manuel, hors session)

- Auth → Email → activer "Confirm email"
- Auth → Policies → password min length = 12
- Vérifier templates email FR

### Effet utilisateur

- **Au prochain login de chacun** : redirection forcée vers `/onboarding` jusqu'à saisie complète
- **Section `/compte` "Mes informations"** : éditable à tout moment après onboarding
- **Création animal en procédure judiciaire** : picker propriétaire en édition (pas à la création — limitation assumée par l'agent, lier après création)
- **Demandes d'adoption publiques** : filtrage automatique silencieux des personnes blacklistées
- **Création contrat d'adoption back-office** : warning bloquant avec override admin si match

### Méta

- 4 commits feature mergés sur main (`feature/auth-onboarding`, `feature/judicial-blacklist`, section compte, hotfixes)
- 2 migrations appliquées sur Supabase prod
- Agent général-purpose lancé en background (~25 min, 8 fichiers créés, 11 modifiés, 2695 insertions)
- 3 cycles de build Coolify pour atterrir — build non testé en local (pas de node_modules dans les worktrees)
- `pseudo` à supprimer dans 2 mois (~juillet 2026) une fois tout le monde migré

---

## Session 2026-05-20 (fin après-midi) — Module CRA complet

### 11. Module CRA — saisie complète et workflow de validation (2026-05-20)

Module entièrement nouveau. Le précédent "CRA" (`src/lib/actions/cra.ts` + `src/lib/pdf/cra-template.ts`) était un **calcul automatique** des absences à partir des `leave_requests` — il restera utilisé pour le PDF rapide accessible depuis `/admin/conges`. Ce nouveau module ajoute une **saisie réelle des heures travaillées** par jour, avec workflow de validation triple : collaborateur → admin (Clément/Céline) → comptable.

**Migrations SQL** (`supabase/migrations/20260520f_cra_module.sql` + `20260520g_cra_admin_validation.sql`) — appliquées en prod :
- `member_work_schedules` : semaine type d'un collaborateur (1 ligne par `day_of_week`, 7 lignes max). Contrainte SQL : aucun horaire ne dépasse 17h00. Index unique partiel sur (member, day) WHERE valid_until IS NULL.
- `cra_entries` : surcharges journalières (only when ≠ template). `hours_total` est une **computed column** (`GENERATED ALWAYS AS ... STORED`) → la source de vérité du total est PostgreSQL, pas le front.
- `cra_monthly_status` : workflow par (member, year, month). Statuts : `draft` → `submitted` → `validated_by_member` → `validated_by_admin` → `sent`. État alternatif `change_requested`.
- `cra_change_requests` : audit log des demandes de modif (col → Mary, Clément/Céline notifiés).
- Extension `establishments` : `accountant_email`, `accountant_name`.
- RLS aligné sur le pattern `leave_requests` (un user voit ses lignes ou s'il a `manage_leaves`).

**Seed initial** : semaines types des 5 salariés SDA déjà en base (Mary, Franck, Marina, Yann, Carole) avec leurs jours de repos confirmés (Mary = Mer+Dim, Franck = Jeu+Dim, Marina/Yann = Mar+Dim, Carole = Mer+Ven+Dim). Horaire standard 8-12 / 14-17. Matthieu (auto-entrepreneur, ferme) n'a pas de seed — Mary saisira ses heures variables au cas par cas.

**Types TypeScript** (`src/lib/types/database.ts`) : `MemberWorkSchedule`, `CraEntry`, `CraStatus`, `CraMonthlyStatus`, `CraChangeRequest`, `CraDay`, `CraMonthlyView`, + labels FR.

**Server actions** :
- `src/lib/actions/work-schedules.ts` — CRUD semaine type. `listMembersWithSchedules`, `upsertWorkScheduleDay`, `applyStandardSchedule`.
- `src/lib/actions/cra-saisie.ts` — moteur de pré-remplissage + workflow. `getMonthlySaisie` agrège template + congés + fériés + overrides ; `upsertCraEntry` / `deleteCraEntry` ; `submitCraToMember`, `validateCraAsMember`, **`validateCraAsAdmin`** (réservé `role_type = admin`), `requestCraChange`, `resolveChangeRequest`. Notifications via la table `notifications` existante (réutilisation).
- `src/lib/actions/cra-send.ts` — envoi comptable (PDF + email Brevo).

**Pages** :
- `/admin/cra/horaires` — éditeur de semaines types (Mary). Modal par collaborateur avec 7 jours, granularité quart d'heure, max 17h00, total semaine live, bouton "Appliquer 8-12 / 14-17".
- `/admin/cra/saisie` — grille mensuelle pré-remplie. Cliquer un jour ouvre un modal d'override. Toolbar : sélecteur collab, nav mois, badge statut, boutons workflow conditionnels (soumettre / valider admin / envoyer comptable).
- `/admin/cra/validations` — **réservé aux admins (Clément/Céline)**. Liste des CRA `validated_by_member` en attente de validation finale. Clic → ouvre `/admin/cra/saisie` avec le bon contexte.
- `/admin/cra/demandes` — file des demandes de modification (ouvertes + résolues). Visible Mary + admins.
- `/espace-collaborateur/cra` — liste des 12 derniers mois pour le collaborateur connecté.
- `/espace-collaborateur/cra/[year]/[month]` — vue détail mensuel. Workflow visible (stepper 5 étapes). Boutons "Valider mon CRA" / "Demander une modification" quand `submitted`.

**PDF** : nouveau template `src/lib/pdf/cra-saisie-template.ts` (charte SDA bleu marine + teal + signature-strip orange) + `cra-saisie-pdf.ts` (Puppeteer A4 landscape). Affiche le calendrier mensuel + KPI + bloc signature double (validation collab + validation admin avec dates).

**Notifications** : 4 nouveaux types `text` dans la table `notifications` (le CHECK est sur TEXT libre, pas besoin de migration) :
- `cra_submitted` → notif au collab (Mary a soumis)
- `cra_pending_admin_validation` → notif aux admins (collab a validé, action requise)
- `cra_admin_validated` → notif aux managers (Mary peut envoyer comptable)
- `cra_change_requested` → notif aux managers + admins

**Workflow complet** :
1. Mary clique "Saisie CRA" → choisit collab + mois → ajuste si besoin → "Soumettre au collaborateur"
2. Le collab reçoit une notif, ouvre `/espace-collaborateur/cra` → valide OU demande modif (avec commentaire)
3. Si validé → Clément/Céline notifiés via `/admin/cra/validations` → valident en tant qu'admin
4. Mary voit le bouton "Envoyer au comptable" actif → clique → PDF généré + email envoyé à `establishments.accountant_email`
5. Statut final `sent`, plus de modification possible

**Sidebar** : 5 nouveaux liens ajoutés dans `nav-config.ts` section Équipe (Saisie, Horaires, Validations admin, Demandes, Mes CRA).

**Configuration restante côté Clément** :
- Renseigner `accountant_email` et `accountant_name` sur l'établissement SDA (à faire en interface plus tard ou directement en SQL).
- Compléter le seed des horaires de Matthieu si nécessaire (ou laisser variable, géré au cas par cas dans la saisie).

Aucune dépendance npm nouvelle. Build local + TS check ✅.

---

## Session 2026-05-22 — Récap véto auto + horaires jours fériés CRA

### 12. Récap PDF auto à la clinique vétérinaire (commits `6db9698` + config DB)

**Origine** : demande de Mary suite à un passage véto avec Caroline → besoin que, à la fin de chaque passage, un récap PDF des actes effectués soit envoyé automatiquement au comptable de la clinique vétérinaire. Et besoin d'agrandir les zones de commentaires dans le tableau car Caroline n'avait pas la place de noter ses observations.

**Migration `20260522a_vet_visit_recap.sql`** appliquée en prod :
- 5 colonnes sur `vet_visits` : `recap_sent_at`, `recap_sent_by`, `recap_sent_to`, `recap_storage_path`, `recap_email_message_id`
- Colonne `vet_recap_email` sur `establishments` (configurable côté UI, défaut SDA = `compta@deltour.vet`)
- Bucket Storage `vet-visit-recaps` (privé, archive de chaque PDF envoyé)

**Logique auto-send** (`src/lib/actions/vet-visit-recap.ts`) :
- Hook dans `validateVetVisitLine` : à chaque validation d'une ligne, on vérifie si TOUTES les lignes du passage sont validées. Si oui ET récap pas encore envoyé → envoi automatique.
- Fire-and-forget : pas de blocage de l'UX de validation. Si l'envoi échoue (token Brevo, etc.), log console mais la validation reste OK.
- Idempotent : ne renvoie pas si `recap_sent_at IS NOT NULL`, sauf force=true.
- Bouton manuel "Envoyer le récap maintenant" disponible dès qu'au moins une ligne est validée.

**Template PDF** (`src/lib/pdf/vet-visit-recap-template.ts`) : A4 portrait, charte SDA officielle (navy `#1e3a5f`, teal `#5ba8a0`, orange terracotta `#c96b3c`, signature-strip gradient en bas). Affiche : header établissement + date du passage + véto + nombre d'animaux + tableau détail par animal (actes en pills émeraude + observations + complément + coût) + synthèse (compte des actes par type + coût total bloc navy) + footer.

**UX tableau planning véto** (`src/components/planning-veto/vet-visit-table-client.tsx`) :
- Bandeau récap en haut : vert si déjà envoyé (date + destinataire + bouton "Télécharger le PDF archivé" + "Renvoyer"), surface neutre sinon avec progress "X/Y validées" + bouton manuel.
- Colonnes Observations et Complément passent de `<input type="text">` mono-ligne à `<textarea rows={2}>` avec auto-grow JS (`onInput` adjust scrollHeight). minWidth: 220px pour Observations, 140px pour Complément.
- Colonnes d'actes (11) réduites de `minWidth: 28` à `minWidth: 22` + `fontSize: 9px` pour libérer de la place horizontale.

**Configuration paramétrable** dans `/etablissement` (`src/components/establishment/establishment-form.tsx`) :
- Nouvelle section "Destinataires emails automatiques" avec 3 champs :
  - **Comptable — Email** (`accountant_email`)
  - **Comptable — Nom / Cabinet** (`accountant_name`)
  - **Clinique vétérinaire — Email récap** (`vet_recap_email`)
- Server action `updateEstablishment` étendue avec ces 3 champs.

**Valeurs config prod SDA** (DB) :
- `accountant_email = g.arciuolo@fiteco.com`
- `accountant_name = Fiteco (M./Mme Arciuolo)`
- `vet_recap_email = compta@deltour.vet`

**Hierarchie de fonctionnement** :
1. Mary ouvre `/sante/planning/[id]`
2. Caroline note ses observations dans le tableau (zones agrandies)
3. Mary valide chaque ligne avec "✓ Valider"
4. À la dernière validation → génération PDF + envoi auto à `compta@deltour.vet` + archive Storage
5. Bandeau vert "Récap envoyé" apparaît avec lien de téléchargement du PDF archivé

8 fichiers modifiés + 4 créés. Build local + TS check ✅. Push direct prod, Coolify déployé.

### 13. CRA — Horaires jours fériés par collaborateur (commit `d64043c`)

**Origine** : Clément a précisé que certains salariés viennent nourrir les animaux les jours fériés. Le CRA doit pouvoir refléter ces heures travaillées un jour férié, par défaut vide (= 0h, comportement initial) sauf si configuré manuellement par collaborateur.

**Migration `20260522b_cra_member_holiday.sql`** appliquée en prod :
- 4 colonnes TIME sur `establishment_members` : `holiday_start_am`, `holiday_end_am`, `holiday_start_pm`, `holiday_end_pm`
- Contraintes CHECK : max 17h00, fin > début, AM avant PM (alignement avec `member_work_schedules`)

**Logique** dans `getMonthlySaisie` :
- À chaque jour férié :
  1. Si override `cra_entries` existe → l'utiliser (priorité absolue)
  2. Sinon, si membre a un `holiday_*` renseigné → l'appliquer (compte les heures comme travaillées)
  3. Sinon → jour de repos (0h, comportement par défaut inchangé)

**Server action** `upsertHolidaySchedule(memberId, payload)` dans `work-schedules.ts` : update les 4 colonnes en une transaction. Si tous null → le membre ne travaille plus les fériés.

**UI éditeur** `work-schedules-editor.tsx` :
- Modal : nouvelle carte "🎉 Férié" en bas des 7 jours de la semaine. Checkbox "Travaille les jours fériés (nourrissage animaux)" + 4 inputs time (granularité quart d'heure, max 17h). Total heures du jour férié affiché en orange.
- Tableau liste : nouvelle colonne **Férié** entre `Dim` et `h/sem`, qui affiche l'horaire si configuré ou `—` sinon.

**Hiérarchie complète de résolution dans le CRA mensuel** (du plus prioritaire au moins) :
1. Override `cra_entries` (jour spécifique surcharge Mary)
2. Arrêt longue durée du membre
3. Congé approuvé ou en attente
4. Jour férié :
   - a. `holiday_*` du membre si renseigné → heures travaillées
   - b. Sinon → repos
5. Semaine type (`member_work_schedules`)
6. Fallback : repos

5 fichiers modifiés + 1 créé. Build local + TS check ✅. Pushé sur main, Coolify déployé.

**Comment configurer pour SDA** : Mary va dans `/admin/cra/horaires` → clic "Modifier" sur le collaborateur concerné → en bas de la modal cocher "Travaille les jours fériés" → renseigner les 4 horaires (typiquement plus courts que la journée standard, genre 8h-12h sans aprem) → Enregistrer.

---

## Session 2026-05-22 (suite) — Astreintes + Fix CCN + Module Satisfaction + Contrats RH + Sidebar accordéon + Fratrie + bugs

Très grosse session : 16 livraisons en chaîne sur la journée. Le détail par bloc.

### 14. CRA Astreintes hebdomadaires (commit `118f1e6`)

**Besoin** : Marie remonte que les semaines d'astreinte (forfait 100€ hebdo, lundi → lundi) doivent être marquées sur le CRA pour le comptable. Une seule personne par semaine.

**Migration** : `20260522c_cra_astreintes.sql` — table `cra_astreintes(id, member_id, establishment_id, week_start_monday, ...)` + contrainte `CHECK (EXTRACT(ISODOW FROM week_start_monday) = 1)` + UNIQUE `(establishment_id, week_start_monday)` qui garantit en base "1 personne par semaine".

**Server actions** dans `src/lib/actions/cra-astreintes.ts` :
- `toggleAstreinteWeek(memberId, weekStartDate)` : crée ou supprime. Si la semaine est déjà attribuée à un autre membre → erreur explicite avec son nom.
- `listAstreintesForMonth(year, month)` : pour la vue admin globale.
- `listMemberAstreintesForMonth` : pour le PDF/espace collab.

**UI** : `AstreintesBar` au-dessus de la grille `cra-saisie-client.tsx` — chip par lundi du mois, click toggle. `CraMonthlyView.astreinte_weeks` (liste des `week_start_monday`) exposé via `getMonthlySaisie`. Stat card violette "Astreintes" dans le bandeau totaux. Côté collaborateur : bandeau read-only des semaines.

**PDF CRA** mis à jour : tuile orange terracotta "Semaines d'astreinte" + détail des dates dans le bloc summary. Le comptable voit le nombre, calcule le forfait lui-même.

### 15. Fix visibilité sidebar pour auto-entrepreneurs (même commit `118f1e6`)

**Bug** Yann remonté par Mary : "il dit qu'il doit vérifier mes modifications mais n'a pas de visuel". Diagnostic : le sidebar filtrait `roles: ['admin', 'salarie']` sur `role_type`, mais Yann est `contract_type='auto_entrepreneur'` (donc soumis au CRA mais pas `role_type='salarie'`). Résultat : aucun lien "Mes CRA" / "Mon espace" dans sa sidebar.

**Fix** : ajout d'un champ `contractTypes?: ContractType[]` sur `NavItem`. Les entrées `/espace-collaborateur` et `/espace-collaborateur/cra` filtrent désormais sur `contract_type ∈ ('salarie', 'auto_entrepreneur')` plutôt que `role_type`. Propagation de `contract_type` à `Sidebar` et `Header` via `getNavSections(type, perms, roleType, contractType)`.

### 16. Email automatique à la soumission du CRA (même commit `118f1e6`)

Nouveau module `src/lib/email/cra-submitted.ts` — charte SDA (header navy, CTA teal, bandeau orange terracotta) — appelé en fire-and-forget depuis `submitCraToMember()` après la notification in-app. Lien direct vers `/espace-collaborateur/cra/[year]/[month]`. Le collaborateur sait immédiatement quand Mary attend sa validation.

### 17. Fix décompte CP (jours fériés + dimanches exclus) — CCN fleuristes-animalerie (commits `480c403`, `73079f6`, `6e79282`)

**Bug initial signalé par Maryline** : "Du 4 au 9 mai j'ai eu une semaine de congés soit 5 jours mais Optimus en compte 6, sachant que le 8 mai est férié." Le calcul de `days_count` dans `createLeaveRequest` / `adminCreateLeaveRequest` faisait juste `diffDays(end - start) + 1` côté client → 6 jours calendaires.

**Itérations** :
- **480c403** — Première version "favorable salarié" : décompte basé sur la semaine type personnelle (mercredi de Mary = repos donc pas décompté). Faux logiquement quand on a confirmé que la CCN s'applique.
- **6e79282** — Recalibrage CCN Fleuristes-animalerie (IDCC 1978, art. 5) : 30 j ouvrables/an, période 1er juin → 31 mai. Mode "jours ouvrables" strict : `restWeekdays = [0]` (dim seul) pour tout le monde, le mercredi de Mary EST décompté. Maryline qui attendait 5 jours pour 4-9 mai → 5 jours décomptés (lun, mar, mer, jeu, sam ; ven 8 férié exclu).

**Architecture du fix** :
- Nouveau module pur `src/lib/leaves/compute-days.ts` — fonction `computeLeaveDays({startDate, endDate, restWeekdays, holidays, halfDayStart, halfDayEnd})` sans dépendance DB, testable.
- `computeLeaveDaysFromDB(memberId, dates)` charge les jours fériés + délègue au pur, avec `restWeekdays = [0]` codé en dur (CCN fleuristes).
- **Server-side authority** : `createLeaveRequest` et `adminCreateLeaveRequest` ignorent désormais la valeur `days_count` envoyée par le client et la recalculent en SQL. Pas de manipulation possible.
- Nouvelle server action `previewLeaveDaysCount` exposée à l'UI pour le live preview (le client appelle au changement de dates pour afficher le bon nombre avant submission).
- Nouvelle server action `recomputeLeaveRequestDays(requestId)` accessible depuis `/admin/conges` : recalcule un congé existant ET ajuste `leave_balances.used` du delta. Idempotente.
- Bouton "Recalculer" sur la page review des demandes pour corriger les anciens congés mal calculés.

**Fix complémentaire commit `73079f6`** : symétrie côté affichage CRA. Pendant un congé, le mercredi de Mary (repos hebdo) apparaissait en "Congé payé" alors qu'il est repos. Modifié `cra-saisie.ts` pour utiliser les heures du template (`0h` si jour de repos) et garder l'affichage cohérent.

7 fichiers touchés, build clean, lint clean. Pas de hotfix nécessaire post-déploiement.

### 18. Module Contrats & docs RH par collaborateur (commit `e747145`)

**Besoin** : Clément envoie 6 contrats CDI/CDD + bulletins de paie pour Mary, Maryline, Franck, Carole, Eric, Yann, Marina. Optimus n'a aucun endroit pour stocker ces docs administratifs.

**Migration** `20260522d_member_documents.sql` :
- Table `member_documents(id, member_id, kind, label, signed_date, file_path, file_url, file_size, uploaded_by, created_at)` avec `kind IN ('contract', 'amendment', 'certificate', 'other')` pour rester générique (avenants, attestations Pôle Emploi, certificats…).
- Storage bucket privé `employment-docs` avec policy RLS qui n'autorise la lecture qu'au membre concerné OU aux RH (`manage_payslips`).
- Pattern calqué sur `payslips` (FK uploaded_by = auth.users(id), signed URL 1h).

**Server actions** dans `src/lib/actions/member-documents.ts` :
- `uploadMemberDocument(formData)` — admin uniquement, multipart PDF.
- `getMemberDocuments({memberId, kind?})` — un membre voit ses propres docs, un admin voit tout.
- `deleteMemberDocument(id)` — admin uniquement.
- `getMemberDocumentSignedUrl(id)` — URL signée 1h, accès vérifié par token serveur.

**UI** :
- `/admin/contrats` (perm `manage_payslips`) : form d'upload (Drop zone PDF + select membre + kind + label + date signature optionnelle) + liste regroupée par collaborateur avec téléchargement + suppression.
- `/espace-collaborateur/contrats` : lecture seule de ses propres docs, regroupés par type.
- Sidebar : "Mes contrats" (collaborateur) + "Contrats / docs RH" (admin) ajoutés à la section Équipe.

Notification in-app au membre quand un nouveau doc est uploadé. **Clément doit uploader manuellement** les PDFs des contrats (je n'ai pas accès aux binaires dans le chat).

### 19. Sidebar accordéon (commit `7a830b5`)

**Besoin** : "il faut toujours scroller pour pouvoir sélectionner une catégorie". 8 sections déployées sur ~1200px de hauteur sur desktop, ~1800px sur mobile.

**Solution** : chaque section avec un `label` devient repliable via un chevron cliquable à droite du titre. État persisté dans `localStorage` (clé `sidebar-open-sections`). Au premier chargement, seule la section contenant la page courante est ouverte. Auto-ouverture de la section active si l'utilisateur navigue via URL directe.

**Pattern technique** : animation via `grid-template-rows: 1fr` (ouvert) ↔ `0fr` (fermé) avec `overflow-hidden` sur l'enfant. Animation fluide GPU-friendly sans calcul de hauteur. Mode sidebar collapsed (icônes seules) : pas d'accordéon, comportement original préservé. Indicateur d'activité : titre de section en teal quand une page de cette section est active.

### 20. Responsive — grille calendrier CRA scrollable (commit `0bd21e9`)

Audit complet du responsive. Tous les composants critiques OK sauf la grille calendaire 7 colonnes (`cra-saisie-client.tsx` + `cra-member-view.tsx`) : cellules de ~46px sur mobile, contenu illisible. Fix : wrapper `overflow-x-auto + min-w-[640px]`. Scroll horizontal naturel sur petit écran, cellules conservent 90+ px. Modal d'édition jour : `max-h-[90vh] + overflow-y-auto` pour éviter débordement sur petite hauteur.

### 21. Module Satisfaction NPS automatique (commits `176c2ff`, `cead44f`, `09b3454`, `817a890`)

**Besoin** : "récupérer ce qui ne marche pas, ce qui ne va pas" après une adoption, un don, un foster.

**Architecture** :
- **Migration** `20260522e_satisfaction_surveys.sql` — table `satisfaction_surveys(id, kind, related_id, recipient_email, token, scheduled_for, sent_at, completed_at, nps_score, verbatim, resolved_*)` avec contrainte UNIQUE `(kind, related_id)` qui garantit l'idempotence des envois.
- **Endpoint cron** `/api/cron/satisfaction` protégé par `Authorization: Bearer $CRON_SECRET` :
  - Scan `animal_movements` type `adoption` créés ≥ 7 jours → envoie le mail "Comment se passe l'adoption ?"
  - Scan `animal_movements` type `foster_placement` créés ≥ 7 jours → "Votre expérience en famille d'accueil"
  - Scan `donations` créés ≥ 1 jour → "Merci pour votre don, votre ressenti ?"
  - Limite 50 events par exécution (rate limit Brevo + timeout serverless).
  - Retourne JSON `{ok, sent: {adoption, foster, donation}, already_done: {...}, errors: []}`.
- **pg_cron + pg_net** activés dans Supabase (extensions `pg_cron 1.6.4`, `pg_net 0.19.5`). Job `satisfaction-daily-send` programmé `0 9 * * *` (10h Paris hiver / 11h été).
- **Page publique** `/satisfaction/[token]` (hors middleware auth) : form NPS 0→10 avec gradient orange (0-6) → jaune (7-8) → vert (9-10), textarea verbatim 2000 caractères max. Soumission stocke `nps_score + verbatim + completed_at`. Lien permet seulement 1 réponse.
- **Dashboard** `/admin/satisfaction` (perm `manage_establishment`) : KPI cards (score NPS, % promoteurs/passifs/détracteurs, note moyenne, taux de réponse), filtres type + statut, liste des verbatims avec border orange sur les détracteurs non traités, marquage "traité" avec note interne.
- **Email Brevo** charte SDA (header navy + logo `logo-sda.png` avec border-radius 12px, CTA teal, bandeau orange terracotta "Promesse: pas de spam"), variantes contextualisées par kind (adoption / donation / foster).

**Garde-fou pré-production critique** : 1410 dons + 3 adoptions + 3 fosters anciens éligibles dans la base. Sans intervention, le premier cron run aurait spammé 1416 destinataires. Pré-création de 1416 "phantom rows" en SQL avec `sent_at = NOW()` et `send_error = 'Backfilled...'` pour neutraliser le scan initial. Les events futurs créeront leurs propres surveys au délai normal.

**Config infra** :
- Env var Coolify `CRON_SECRET` = `3cacae3767...` (256 bits hex, `is_literal: false` — bug rencontré avec `is_literal: true` qui ajoutait des quotes parasites). Cf. mémoire `feedback_coolify_env_vars`.
- Pattern cron via pg_cron + pg_net + secret Bearer plutôt que cron-job.org tiers. Cf. mémoire `pattern_cron_pg_supabase`.

### 22. Email transactionnel : from contact@sda-nord.com + reply-to global (commit `09b3454`)

`signature@sda-nord.com` était dédiée Documenso. Bascule sur `contact@sda-nord.com` (humaine, ouvre la porte au dialogue) avec `BREVO_REPLY_TO=clement.scailteux@gmail.com` global. Le client `sendEmail` lit l'env var en cascade : `params.replyTo || process.env.BREVO_REPLY_TO || undefined`. S'applique à TOUS les mails transactionnels (NPS, CRA submitted, futures fonctionnalités).

Domaine `sda-nord.com` entier déjà SPF/DKIM-validé dans Brevo donc pas d'étape sender supplémentaire requise.

### 23. Fix FK judicial_attachments.uploaded_by (commit `bffbe5c`)

Bug : la FK pointait par erreur vers `establishment_members(id)` alors que le code insère `ctx.userId` (= `auth.users(id)`). Pattern utilisé dans toutes les autres tables (payslips, cra_entries, member_documents, satisfaction_surveys). Migration `20260522g_fix_judicial_attachments_uploaded_by_fk.sql` aligne la FK sur `auth.users(id) ON DELETE SET NULL`. Pas de migration de données : la table était vide (le bug empêchait toute insertion).

### 24. Permission liste noire : manage_clients au lieu de manage_establishment (commit `b18c219`)

**Bug Mary** : "je ne peux pas valider la création d'une fiche propriétaire liste noire". Diagnostic : `addManualBlacklist` exigeait `manage_establishment` que Mary n'a pas (juste `manage_clients + manage_animals`). Bascule sur `manage_clients` : c'est cohérent avec la gestion quotidienne des contacts. Le retrait reste `manage_establishment + groupe Administrateur` (acte sensible préservé).

### 25. Adoption depuis fourrière (même commit `b18c219`)

**Bug Mary** : "on ne peut pas mettre à l'adoption un animal en réquisition". Diagnostic : `movementsByStatus.pound` dans `movement-form.tsx` n'incluait pas le mouvement `adoption`. Workflow forcé : `pound → shelter_transfer → shelter → adoption`. Pour les animaux en réquisition une fois la décision judiciaire actée, c'est une étape administrative inutile. Ajout de `{ value: 'adoption', label: 'Adoption' }` dans le menu pour statut `pound`.

### 26. Création de fratrie (commit `85a06a4`)

**Besoin Maryline** : "possible de créer des dossiers d'entrées par fratrie ?". Pour une portée de chiots/chatons ou plusieurs animaux d'une même saisie, éviter la saisie répétitive des mêmes infos.

**MVP sans table `litters`** (choix incrémental) : chaque animal créé est indépendant, juste un raccourci de saisie.

- Server action `createAnimalSiblings({common, animals[]})` dans `src/lib/actions/animal-siblings.ts`. Boucle d'INSERT atomiques par animal, retourne `{created: [...], failed: [...]}` (un échec par animal n'empêche pas les autres). Limite 20 animaux par batch. Numéro de médaille auto via RPC `get_next_medal_number` pour chacun.
- Composant `SiblingForm` : section "Infos communes" (espèce, race, date naissance approx., origine, statut d'arrivée, box commun, lieu/circonstances) + section "Animaux" répétable (cards avec nom, sexe, couleur, n° puce, n° tatouage, poids). Boutons +/- pour ajouter/retirer.
- Page `/animals/nouveau/fratrie`. Bouton "Plusieurs animaux d'un coup" en haut à droite de `/animals/nouveau`.
- Si origine = `requisition`, `judicial_procedure` automatiquement à true sur tous.

### Bilan session 2026-05-22

**13 commits livrés en chaîne :**
| # | Commit | Sujet |
|---|---|---|
| 1 | `118f1e6` | Astreintes + sidebar visibility + email submission |
| 2 | `480c403` | Décompte CP fériés + repos (v1, ouvré réel) |
| 3 | `73079f6` | Symétrie affichage CRA pendant congés |
| 4 | `6e79282` | Recalibrage CCN fleuristes mode ouvrable |
| 5 | `e747145` | Module Contrats / docs RH |
| 6 | `7a830b5` | Sidebar accordéon |
| 7 | `0bd21e9` | Responsive grille CRA |
| 8 | `176c2ff` | Module Satisfaction NPS + cron |
| 9 | `cead44f` | Fix compteur cron (sent vs already_done) |
| 10 | `09b3454` | from contact@ + reply-to global |
| 11 | `817a890` | Logo SDA dans email satisfaction |
| 12 | `bffbe5c` | Fix FK judicial_attachments |
| 13 | `b18c219` | Permission blacklist + adoption depuis fourrière |
| 14 | `85a06a4` | Création de fratrie |

**Infra Supabase / Coolify hors git :**
- Extensions `pg_cron` + `pg_net` activées
- Job `satisfaction-daily-send` programmé quotidien 09:00 UTC
- 1416 phantom rows pré-créées dans `satisfaction_surveys`
- Env vars Coolify : `CRON_SECRET`, `BREVO_FROM_ADDRESS` → `contact@sda-nord.com`, `BREVO_REPLY_TO` → `clement.scailteux@gmail.com`

**Patterns mémorisés pour les futures features :**
- `pattern_cron_pg_supabase.md` — pg_cron + pg_net plutôt que tiers
- `feedback_coolify_env_vars.md` — `is_literal: false` par défaut + redeploy obligatoire
- `pattern_backfill_phantom_rows.md` — neutraliser les events historiques avant cron

**Validation production :**
- 3 mails satisfaction envoyés à clement.scailteux@gmail.com (un par variante), Brevo accepte, charte SDA OK, logo OK
- Endpoint `/api/test/satisfaction-email` créé pour preview rapide (à retirer plus tard)
- INSERT test sur `judicial_attachments` avec user_id réel : passe (FK fix validée)

---

## Session 2026-05-23 — Réconciliation /requisitions vs filtre judicial_procedure

### 27. Renommage /requisitions → /procedures + filtre sur judicial_procedure (commit `549eae0`)

**Symptôme remonté par Clément :** la page Réquisition affichait 4 animaux, alors que le filtre "Procédure : oui" dans /animals en montrait 10. Incohérence visible.

**Cause :** deux concepts confondus dans l'UI.
- `animals.origin_type = 'requisition'` = **mode d'arrivée** historique figé (4 animaux : OLAF, NICOLETTA, SIMBA, DUSTER, tous arrivés par réquisition stricte du procureur)
- `animals.judicial_procedure = true` = **état actuel** d'une procédure judiciaire en cours (10 animaux, dont les 4 réquisitions + 6 chiens trouvés errants mais marqués en procédure après enquête)

La page `/requisitions` filtrait sur `origin_type`. Le filtre `/animals` filtre sur `judicial_procedure`. Sémantiques différentes, vocabulaire identique → confusion.

**Changements (sur recommandation validée par Clément) :**
- `git mv src/app/(app)/requisitions → src/app/(app)/procedures` (historique préservé)
- Filtre changé : `origin_type='requisition'` → `judicial_procedure=true`
- Titre "Requisition" → "Procédure judiciaire" + accents corrects
- Sous-titre dynamique : `"X animaux en procédure judiciaire en cours (dont N arrivés par réquisition)"`
- Nouvelle colonne **Origine** avec `ORIGIN_LABELS: Record<AnimalOrigin, string>` exhaustif (typé : compile error si on ajoute une origine sans la libeller). Badge primary pour les réquisitions strictes, badge neutre pour les autres modes d'arrivée.
- `nav-config.ts` : sidebar `/procedures` + label "Procédure judiciaire"

**Effet métier :** la page reflète maintenant le vrai besoin — voir tous les animaux **bloqués juridiquement** (qu'on ne peut pas adopter / sortir), peu importe leur mode d'admission. La nuance "réquisition vs autre" reste visible via la colonne Origine.

**Insight architecture :** garder deux champs distincts (`origin_type` historique + `judicial_procedure` état) est juste métier. Seul le routage UI doit refléter le besoin de lecture, pas le détail de saisie.

---

## Session 2026-05-24 — Fiche membre + vue zone agrégée + backfill contrats

### 28. Fiche détaillée par membre /etablissement/membres/[id] (commit `2ca5f87`)

**Symptôme remonté par Clément :** "j'ai le sentiment que les contrats n'ont pas été intégrés directement à chaque personne, dans chaque espace, avec la possibilité pour les admins de voir tout le monde."

**Diagnostic :** avant ce commit, la donnée existait (table `member_documents` + actions filtrables par `memberId`) mais l'UI manquait :
- `/admin/contrats` : page admin globale qui groupait visuellement par collaborateur (encart par personne), mais reste un seul écran centralisé
- `/espace-collaborateur/contrats` : page perso filtrée sur le membre courant
- **Pas de fiche par membre** où l'admin pourrait voir tout sur un collaborateur (identité + permissions + contrats + à terme congés/CRA)
- Liste des membres dans `/etablissement` non cliquable (aucun `<Link>` sortant dans `members-list.tsx`)

**Implémentation :**
- **Nouvelle route `/etablissement/membres/[id]/page.tsx`** (server component, `dynamic = 'force-dynamic'`)
  - Charge le membre via `establishment_members` (1 query) + enrichit avec `get_users_info` RPC (full_name/email/avatar)
  - Charge les groupes via `member_groups` → `permission_groups` (2 queries — copié du pattern `getEstablishmentMembers` après avoir vérifié le vrai nom de la table de jointure : `member_groups`, pas `member_group_links` comme je l'avais deviné en premier)
  - Charge les documents via `getMemberDocuments({ memberId: id })`
  - En-tête : avatar 64px + nom + email + badges (rôle, type de contrat via `CONTRACT_TYPE_LABELS`, groupes)
  - Section "Contrats & documents RH" intégrée : `MemberDocumentUpload` (si admin) + `MemberDocumentList` (toujours)
  - Bouton "← Retour aux membres"
- **`MemberDocumentUpload` enrichi** d'une prop optionnelle `lockedMemberId?: string`
  - Si présente, le state `memberId` est initialisé avec cette valeur et le dropdown collaborateur est masqué
  - Le `resetForm()` re-fixe sur `lockedMemberId` (au lieu de vider)
  - Évite de dupliquer le composant en mode "single member"
- **`MembersList` modifié** : le nom du membre devient un `<Link href="/etablissement/membres/${member.id}">` (couleur primary au hover + underline). Reste du composant (groupes, reset mdp, retirer) inchangé.

**Permissions :**
- Accès à toutes les fiches : `canManageEstablishment` OU `canManagePayslips`
- Accès à sa propre fiche : tout membre (badge "Vous" affiché)
- Upload / delete : strictement `manage_payslips` (déjà géré côté server action)

**Insight tooling :** la première version utilisait `select('*, groups:member_group_links(group:permission_groups(*))')` (nested embed). Le build TS passait, mais en runtime ça aurait planté car la table de jointure s'appelle **`member_groups`** (pas `member_group_links`). Sauvée par la vérification de `getEstablishmentMembers` qui lui faisait du multi-queries explicite. Règle : **ne jamais deviner un schéma DB, toujours grep une fonction existante qui interroge cette table.**

### 29. Vue agrégée par zone /boxes/zones/[id] + script backfill contrats (commit `0905b32`)

**Symptôme remonté par Clément :** "le problème dans le fonctionnement actuel, c'est que tu as par exemple enclos Pierrette, et derrière, tu dois faire des boxes avec X place. Sauf que, là, il faut que je puisse visualiser facilement l'enclos Pierrette et l'intégralité des animaux qui sont avec."

**Diagnostic :** modèle Zone > Box > Animaux calibré pour SDA (chenil avec boxes individuels). Pour la Ferme Ô Quatre Vents (enclos extérieur = un troupeau libre), forcer 1 box par animal n'a pas de sens. L'utilisateur veut voir "Enclos Pierrette : 20 chèvres" directement.

**Choix d'architecture (option recommandée et validée) :**
- **Pas de migration DB** (on garde `animals.box_id` FK unique). Les boxes restent l'unité de stockage technique.
- **Zone = unité de lecture principale** : on agrège visuellement les animaux de tous les boxes d'une zone racine (+ sous-zones).
- Pattern minimaliste, réversible, sans surface de bug.

**Changements `/boxes/page.tsx` :**
- `RootZoneGroup` enrichi d'un `totalAnimals` calculé dans `groupBoxesByRootZone` (somme de `box.animal_count` pour les boxes directs + sous-zones)
- En-tête de zone : nouveau badge `<PawPrint /> X animaux` à côté de `X boxes`
- Nouveau bouton "Voir tous les animaux" → `/boxes/zones/[id]` (visible dès qu'il y a ≥ 1 animal)

**Nouvelle route `/boxes/zones/[id]/page.tsx` :**
- Charge la zone (404 si on tombe sur une sous-zone : on redirige conceptuellement vers la racine)
- Charge `listBoxZones` + `getBoxes` (à l'époque, sans optimisation — corrigé dans la session suivante)
- Filtre les boxes appartenant à la zone racine ou à ses sous-zones via `allZoneIds = new Set([zone.id, ...subzones.map(z => z.id)])`
- Agrège la liste plate d'animaux avec le `box_name` d'origine pour traçabilité
- **Tri intelligent** : noms numériques d'abord en ordre numérique (1, 2, 3… 20 — au lieu du tri alphabétique qui donnerait 1, 10, 11, 12, 2, 20, 3…). Code :
  ```ts
  animals.sort((a, b) => {
    const na = Number(a.name); const nb = Number(b.name)
    if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb
    if (!Number.isNaN(na)) return -1
    if (!Number.isNaN(nb)) return 1
    return a.name.localeCompare(b.name)
  })
  ```
- Grille responsive `grid-cols-2 sm:3 md:4 lg:5 xl:6` avec cards photo + nom + sexe + espèce + statut
- Si plusieurs boxes dans la zone : affichage du nom du box sous chaque carte (`📦 box_name`). Sinon masqué (info redondante).
- Couleur de zone reprise via `getZoneColor(zone.id)` (déterministe — même couleur que sur /boxes)

**Action métier réalisée en parallèle :** affectation des 20 animaux numérotés (chèvres + 1 mouton n°7) de la Ferme à l'enclos Pierette via UPDATE direct en SQL. Aucune contrainte DB ne bloque le mouton dans un box étiqueté `species_type='goat'` (c'est juste un libellé UI). Capacité 25, OK.

### 30. Script backfill contrats `scripts/upload-initial-contracts.mjs` (même commit `0905b32`)

**Contexte :** lors de la session 2026-05-22, j'avais documenté que Clément devait uploader manuellement les 6 contrats CDI dans `/admin/contrats` (je n'ai pas accès aux fichiers binaires des pièces jointes Claude). Quand il m'a relancé "tu as déjà mis les contrats à chaque collaborateur ?", j'ai confirmé : 0 ligne dans `member_documents`.

**Solution :** script Node CLI exécuté en local avec les credentials Supabase service_role.

**Mapping confirmé** (FREMAUX Maryline = Mary la manager — j'avais à tort noté Mary comme distincte de Maryline dans ma mémoire ; corrigé dans `sda_salaries_actifs.md`) :

| PDF (~/Downloads/) | member_id | Label |
|---|---|---|
| ROSELLE Franck CDI.pdf | ece49e8a-… | CDI initial |
| FREMAUX Maryline CDI.pdf | 44d5419f-… (Mary) | CDI initial |
| DELVILLE Marina contrat.pdf | 610bf4ca-… | Contrat de travail |
| SENECHAL Carole CDI.pdf | d6d4c766-… | CDI initial |
| DAUX Eric CDI.pdf | 46ff29b5-… | CDI initial |
| DELOCH Yann CDI.pdf | 34f2d72a-… | CDI initial |

**Caractéristiques du script :**
- `node --env-file=.env.local scripts/upload-initial-contracts.mjs` (env natif Node 20.6+, pas de `dotenv` requis)
- Upload via `supabase.storage.from('employment-docs').upload(...)` avec path `{estab}/{member}/contract/{ts}-{safe_name}`
- Insert direct dans `member_documents` (bypass `uploadMemberDocument` car celui-ci attend un cookie de session — impossible en CLI)
- **Idempotent par rollback** : si l'insert DB échoue, le fichier storage est supprimé (`storage.remove([path])`) — pas de fichier orphelin. Même contrat que la server action prod.
- Pas de notification au collaborateur (volontaire : éviter de spammer 6 notifs pour des contrats qu'ils ont déjà en main)
- Vérif post-exécution via SQL : 6 rows insérées (298 Ko à 1302 Ko)

---

## Session 2026-05-25 — Refonte UX vignette box + fix photo mobile

### 31. Fix bug photo mobile : tap miniature affiche au lieu de supprimer (commit `8445d84`)

**Symptôme remonté par Clément :** "sur téléphone lorsque l'on est sur les photos d'un animal, si on clique sur une autre photo ça propose supprimer directement la photo plutôt que de l'afficher."

**Cause :** l'overlay d'actions (Star + Trash2) au-dessus de chaque thumbnail utilisait `opacity-0 group-hover:opacity-100`. Sur Safari iOS, un tap déclenche un `:hover` éphémère qui révèle l'overlay le temps du tap. Comme les boutons restaient `pointer-events: auto`, le tap atterrissait sur la poubelle au centre de la miniature au lieu du div parent qui voulait sélectionner la photo.

**Fix :**
- Overlay limité aux appareils à hover réel via `[@media(hover:hover)]:group-hover:opacity-100` + `[@media(hover:hover)]:group-hover:pointer-events-auto`
- Par défaut : `pointer-events-none` → l'overlay reste invisible **et** non-cliquable sur tactile, même si Safari simule un hover éphémère
- Compensation : barre d'actions visible **sous la grande photo** (Définir comme principale / Supprimer) qui agit sur `displayPhoto`. Accessible sur tous écrans. Pattern à généraliser pour les overlays "au survol".

### 32. Clic vignette box → page de détail plein écran (commit `15237ba`)

**Symptôme remonté par Clément (capture drawer Pierette avec 20 chèvres en liste verticale) :** "en terme d'affichage je souhaiterais que l'on puisse simplement visualiser tous les animaux, car là c'est pas pratique."

**Diagnostic :** `BoxDetailDrawer` ouvert au clic listait les animaux verticalement. Pratique pour un box chenil avec 3-4 chiens, inadapté pour un troupeau de 20.

**Changements :**
- **Nouveau composant `BoxActionsBar`** (client) : boutons Assigner / Modifier / Fiche PDF, réutilise les popovers existants `AssignAnimalsPopover` et `EditBoxDrawer`
- **Nouvelle route `/boxes/[id]/page.tsx`** : grille flat des animaux + barre d'actions + en-tête avec fil d'ariane vers la zone (couleur de zone reprise pour cohérence). Tri intelligent (numérique d'abord, comme `/boxes/zones/[id]`)
- **`box-tile.tsx` modifié** : `onClick={() => router.push(`/boxes/${box.id}`)}` au lieu d'`setShowDetail(true)`. Suppression des states `showDetail/showAssign/showEdit` et des imports inutiles (`BoxDetailDrawer`, `AssignAnimalsPopover`, `EditBoxDrawer`). Drag & drop d'animaux entre boxes préservé. Props `allBoxes`/`zones`/`groupKey` gardées dans l'interface (commentaire) pour compat de l'API parent.
- **`BoxDetailDrawer` laissé dans le repo** (non utilisé) : contient `MoveAnimalMenu` et `AssignOutingModal` qu'on pourra réactiver via un bouton "Vue détaillée" si besoin

### 33. Triple fix perf : /boxes/[id] + retour + switch d'établissement (commit `24d42a4`)

**3 symptômes remontés par Clément :**
1. "C'est extrêmement long entre le moment où l'on clique et où l'on arrive sur tous les animaux de la parcelle."
2. "Et quand on fait retour au box, c'est assez long, je trouve."
3. "Lorsque l'on change d'établissement, ça ne se fait pas directement. Ça reste bloqué. Il faut faire un refresh pour bien accéder à l'établissement, et ça met de temps en temps des erreurs."

**Fix 1 — `/boxes/[id]` lent (pattern N+1) :**

`getBoxes().find()` chargeait TOUS les boxes + animaux + photos de l'établissement pour en garder 1. Sur Ferme (1 box) invisible, sur SDA (~30 boxes, 100+ animaux) → ~500ms-2s gaspillés à chaque clic.

Nouvelle action `getBoxById(boxId)` :
- 1 query `boxes` (+ zone via nested select)
- 1 query `animals` filtrée par `box_id = boxId`
- 1 query `animal_photos` filtrée par les `animal_id` du box uniquement
- 3 queries fixes au lieu de proportionnelles à la taille de l'établissement

Page `/boxes/[id]` refactor : `getBoxById(id)` au lieu de `getBoxes().find()`.

**Fix 2 — Retour lent :**

`<Link href="/boxes">` déclenche un re-render serveur complet de la page principale (force-dynamic, cookies). Aucun prefetch utile.

Nouveau composant client `BackToBoxes` :
- `router.back()` en priorité si `window.history.length > 1` (restaure l'état précédent depuis la bfcache navigateur — instantané)
- Fallback `router.push(href)` si pas d'historique (arrivée via URL directe)
- Pattern à généraliser pour tous les liens "Retour"

**Fix 3 — Switch d'établissement bloqué + erreurs :**

`router.refresh()` après `switchEstablishment` invalidait la cache de tous les server components mais laissait l'UI bloquée pendant la re-hydratation (plusieurs centaines de ms). Pendant ce temps, des queries en cours retournaient encore des données de l'**ancien** établissement → erreurs visibles (mismatch context).

Fix :
- `window.location.href = '/dashboard'` après le switch : hard navigation qui purge cookies + cache Next App Router + state navigateur en une fois. Garantit un état propre, élimine la race condition.
- Pourquoi c'est OK ici : action **rare** (~1-2 fois par jour), c'est exactement ce que l'utilisateur attend (un "vrai" changement de contexte). Pattern standard chez Linear / Notion.
- Indicateur visuel pendant `isPending` : "Bascule en cours…" sous le nom + spinner remplaçant le chevron + spinner sur l'item ciblé. L'utilisateur sait que ça travaille.

### Bilan session 2026-05-23 → 2026-05-25

**6 commits livrés :**

| # | Commit | Sujet |
|---|---|---|
| 1 | `549eae0` | Renommage /requisitions → /procedures + filtre judicial_procedure |
| 2 | `2ca5f87` | Fiche membre /etablissement/membres/[id] avec contrats intégrés |
| 3 | `0905b32` | Vue agrégée par zone + script backfill contrats |
| 4 | `8445d84` | Fix photo mobile (tap = afficher, plus supprimer) |
| 5 | `15237ba` | Clic vignette box = page de détail plein écran |
| 6 | `24d42a4` | Perf /boxes/[id] (getBoxById) + retour (router.back) + switch établissement (hard nav) |

**Actions DB hors git :**
- 20 animaux numérotés (Ferme) affectés au box Pierette via UPDATE direct
- 6 contrats CDI uploadés via script `scripts/upload-initial-contracts.mjs` (table `member_documents` + bucket `employment-docs`)

**Patterns à retenir :**
- **N+1 sur read-by-id** : avant de faire `.find()` sur le résultat d'un "list all", créer une fonction "by id" dédiée. Surtout si la page est server-rendered et appelée souvent.
- **Hard nav pour switch de tenant** : `router.refresh()` rate trop souvent les invalidations de cache cookies. Pour une action de changement de contexte, hard reload est le pattern fiable. Compenser par un indicateur visuel.
- **`router.back()` pour retour** : avec `force-dynamic`, Next ne peut pas prefetch. `router.back()` utilise le cache navigateur. Quasi-toujours instantané.
- **Overlay actions au survol = piège mobile** : utiliser `[@media(hover:hover)]` + `pointer-events-none` par défaut pour éviter le tap-hover Safari iOS.
- **Toujours grep un schéma DB** plutôt que deviner les noms de tables de jointure. `member_groups` ≠ `member_group_links`.

---

## Session 2026-05-26 — CRA Matthieu + Audit IA quotidien + Adhésion 35€

Session axée pilotage de la direction : fixes opérationnels suite à signalement Mary, mise en place d'un audit quotidien automatisé avec analyse IA, et correction d'une incohérence facturation/contrat.

### 1. CRA — demi-journée Matthieu (commits `e895a89`, `e4561e2`)

**Bug remonté par Mary le 26/05** : "Pas moyen d'enregistrer que le matin pour les dimanches" — erreur DB `new row for relation "cra_entries" violates check constraint "ce_times_ordered"`.

**Cause** : sur un dimanche (jour de repos par défaut), quand Matthieu décochait "Jour de repos" dans la modale, **les deux** cases Matin + Après-midi étaient pré-cochées avec leurs horaires par défaut (14:00-17:00). S'il ajustait le matin pour finir après 14h (cas intervention astreinte 7h30-10h30 puis prolongation), `start_pm < end_am` violait la contrainte DB `ce_times_ordered`.

**Fix en deux passes** :
- `e895a89` : UX modale + validations
  - Initialisation `hasAfternoon = false` quand `day.is_rest_day` (au lieu de `true`)
  - Validation côté client : end > start, après-midi après matin (3 messages clairs)
  - Validation côté serveur : message lisible au lieu du cryptique `ce_times_ordered`
- `e4561e2` : élargissement à TOUS les jours (Clément : "pas que le dimanche, il travaille en demi-journées la semaine aussi")
  - Handler sur le toggle "Jour de repos" : quand on décoche, force `hasMorning=true, hasAfternoon=false`
  - Geste explicite = défaut prévisible, plus jamais d'erreur DB par mauvais défaut

### 2. Workflow CRA externe — auto-entrepreneur (commit `e895a89`)

**Besoin** : Matthieu est auto-entrepreneur (facturation directe), son CRA ne doit PAS être envoyé au comptable (pas de paie). Clément (président SDA) doit le recevoir personnellement.

**Implémentation** dans `src/lib/actions/cra-send.ts` :
- Détection `memberRow.contract_type === 'auto_entrepreneur'` après vérification du statut `validated_by_admin`
- Routage email selon le type :
  - Salarié → `establishments.accountant_email` (comportement existant)
  - Auto-entrepreneur → `clement.scailteux@gmail.com` (hardcodé)
- Sujet adapté : `[Externe — Suivi heures]` pour les externes
- Corps email explicite : "ne pas transmettre au comptable (pas de paie, facturation directe)"
- Retour API enrichi : `{ sentTo, isExternal }`

### 3. Audit quotidien automatisé — V1 (commit `adeecde`)

**Besoin** Clément : *"il y a du laissé aller au niveau des équipes qui est fatiguant, ils sont à fond pour saisir leurs congés mais pas pour maintenir à jour le logiciel. Je voudrais un audit quotidien avec PDF par mail."*

**Décisions cadrées** :
- Cadence : quotidien 7h00 + alerte instantanée si critique
- Destinataire : `clement.scailteux@gmail.com` uniquement (toi pilotes, l'équipe ne voit pas)
- Architecture : `/api/cron/daily-audit` protégé par `CRON_SECRET` (aligné sur le pattern `/api/cron/satisfaction` existant)
- Multi-établissement : SDA + Ferme Ô 4 Vents dans le même PDF

**Sections du rapport** (calculées dans `src/lib/actions/daily-audit.ts`) :
- 🚨 **Critiques** : audience judiciaire <3j sans dossier, rappels santé >30j, CRA non envoyés après le 10
- **Engagement équipe** : top 5 contributeurs J-1 + salariés inactifs (zéro action)
- **Soins** : actes saisis hier + rappels en retard (animaux encore présents, filtrés des completés)
- **Sorties** : saisies hier + sorties terminées >7j sans rating
- **CRA** : mois N-1 non envoyé (non `sent`)
- **Dossiers animaux** : présents sans photo / sans description publique / sans n° médaille / résidents >6 mois sans actu >60j
- **Procédures judiciaires** : dossiers incomplets (juridiction, n° dossier, propriétaire mis en cause, avocat) + audiences proches
- **Score /100** par établissement avec badge couleur (vert/ambre/orange/rouge)

PDF généré via Puppeteer (template HTML A4 portrait) + envoyé via Brevo SMTP.

### 4. Audit quotidien — V2 : analyse IA + stockage + page admin (commit `741ba0d`)

Demande Clément suite à V1 : *"je veux une analyse IA qui connait notre activité et nos obligations… et je veux un bouton en tant que super admin de génération de rapport avec son stockage et son historique"*.

**Analyse IA — Claude Haiku 4.5** (`src/lib/ai/audit-analyzer.ts`)
- Modèle : `claude-haiku-4-5` (rapide, économique ~$0.01/run, ~$3/an pour 365 runs)
- **Prompt caching** sur le system prompt (obligations métier SDA) → ~0.1× coût input après le premier run
- System prompt = contexte SDA complet : RUP 1984, registres CERFA (50-4509 entrée/sortie + 50-4510 soins), identification ICAD obligatoire, suivi vétérinaire 4 jours, procédures judiciaires (juridiction + factures pour recouvrement tribunal), fourrière 8 jours francs, CRA salariés avant le 10, contrôles DDPP
- Style imposé : 4-6 paragraphes, hiérarchisé par risque métier (juridique > sanitaire > admin > qualité > engagement), recommandations concrètes nominatives, markdown simple
- Payload : JSON allégé des sections d'audit (~5K tokens input + ~1K output)
- Erreur graceful : si l'API échoue (clé absente, billing épuisé, etc.), le PDF se génère sans la synthèse avec mention "⚠️ Analyse IA indisponible"
- Output rendu en HTML markdown (titres, listes, gras) en page 1 du PDF avec gradient cyan signature

**Stockage Supabase** (migration `20260526a_daily_audit_runs.sql`)
- Bucket `audit-reports` (privé, 10 Mo max, allowed_mime_types=['application/pdf'])
- Table `daily_audit_runs` : `audit_date`, `generated_at`, `trigger_source` (`cron`|`manual`), `generated_by_user_id`, `pdf_storage_path`, `pdf_size_bytes`, `ai_summary`, `ai_model`, `ai_tokens_input/output/cache_read`, `ai_error`, `stats` (JSONB snapshot par établissement), `sent_to`, `sent_at`, `send_error`
- RLS : lecture admin only (jointure `establishment_members` → `member_groups` → `permission_groups` is_system 'Administrateur')

**Orchestrateur central** (`src/lib/pdf/daily-audit-pdf.ts` refait)
- Fonction `buildDailyAuditPdf({ triggerSource, generatedByUserId? })` : calcule sections → appelle IA → génère PDF → upload bucket → insert ligne historique → retourne `DailyAuditRunResult` complet
- Helper `markAuditRunSent(runId, sentTo, sendError?)` pour fermer le cycle après envoi mail

**Endpoint cron mis à jour** (`/api/cron/daily-audit`)
- Auth `CRON_SECRET` inchangé
- Appelle l'orchestrateur, envoie l'email (sujet adapté selon nombre de critiques), `markAuditRunSent` avec succès/erreur, log usage IA dans la réponse JSON
- Email enrichi : mention de l'analyse IA en page 1 + lien vers `/etablissement/audit-quotidien`

**Page admin** (`/etablissement/audit-quotidien`)
- Server action `listAuditRuns(limit=30)` + `getAuditPdfSignedUrl(runId)` (signed URL 30 min) + `generateAuditNow({ sendEmail?: bool })` (relancent le cron en mode manuel)
- UI client : bouton "Générer (sans mail)" + "Générer + envoyer", historique tabulaire (date, source cron/manuel + nom de l'admin, score badge, alertes, lien PDF, modale synthèse IA in-app)
- Permission : `ctx.permissions.isAdmin` requis (redirect `/dashboard` sinon)

**Configuration prod requise** (à faire dans Coolify avant que ça marche) :
- `ANTHROPIC_API_KEY` : nouvelle clé à créer sur `console.anthropic.com/settings/keys` (compte avec carte bancaire + ~5$ de crédit)
- `CRON_SECRET` : déjà en place pour `/api/cron/satisfaction`
- Cron externe (cron-job.org gratuit ou pg_cron Supabase) pour POST quotidien 7h00 sur `/api/cron/daily-audit`

### 5. Fix adhésion contrat d'adoption : 30€ → 35€ (commit `07d7e81`)

**Incohérence détectée** signalée par Clément : *"dans tous les contrats, on est à 35 euros d'adhésion"*.

| Fichier | Avant | Après |
|---|---|---|
| `src/lib/pdf/adoption-contract-template.ts:56` `ADHESION_FEE` | `30` | `35` |
| `src/lib/actions/adoption-finalize.ts:16` `ADHESION_AMOUNT_EUR` | `35` (déjà OK) | `35` |
| Commentaires `adoption-finalize.ts` (lignes 5, 129, 226) | "30 €" | "35 €" |

**Risque évité** : litige adoptant (contrat signé pour 30€, facture comptable 35€). Le calcul `adoptionLineAmount = adoption_fee - ADHESION_FEE` était également désynchronisé, donc la ligne "participation soins" dans le PDF affichait un montant différent de la facture.

**Dette assumée** : la constante reste dupliquée entre les 2 fichiers. À centraliser dans un futur refactor (`src/lib/config/refuge-pricing.ts` par exemple).

### Patterns à retenir

- **Constantes financières dupliquées = piège récurrent.** Toute valeur tarifaire (adhésion, refund période d'accueil, frais non remboursables) doit vivre en UN seul endroit. Si le code l'a en 2 endroits, c'est une question de "quand" pas de "si" pour la désynchronisation.
- **Pre-cochage UX agressif crée des bugs DB.** Le défaut "tout coché par confort" rend implicite ce qui devrait être explicite. Préférer : décoche tout par défaut, l'utilisateur active ce qu'il veut. Les contraintes DB (`ce_times_ordered`) sont là pour rattraper les défauts UX mauvais — mieux vaut ne pas s'y appuyer.
- **Erreurs DB → message lisible côté serveur.** Ne jamais laisser un `error.message` PostgreSQL remonter au toast. Mapping vers messages métier (`l'après-midi ne peut pas commencer avant la fin du matin`). Coût : 15 lignes de code, gain : 0 ticket support.
- **Prompt caching = ROI immédiat sur usage récurrent.** Pour l'audit IA quotidien (365 runs/an avec system prompt identique), le cache amortit ~90% du coût input. À utiliser dès que la même base de contexte est rejouée >2 fois.
- **Pattern cron externe + endpoint protégé.** Le tandem `/api/cron/*` + `CRON_SECRET` (Bearer header) + cron-job.org gratuit est la voie la plus simple sans dépendance pg_cron / GitHub Actions / Vercel cron. Suffit pour les workloads "1 par jour à heure fixe".

### Méta

- 5 commits poussés sur main (`e895a89`, `e4561e2`, `adeecde`, `741ba0d`, `07d7e81`)
- 2 migrations Supabase appliquées (`20260520e` recalibrée, `20260526a_daily_audit_runs`)
- Bucket Supabase `audit-reports` créé (privé, 10 Mo, PDF only)
- Pas de breaking change — les comptes pseudo / l'auth / les contrats existants continuent de fonctionner
- Coût IA estimé : ~$3/an pour l'audit quotidien (Haiku 4.5 + prompt cache)


---

## Session 2026-05-29 — Contrats Documenso + Congés + Formulaires publics + Infra

### 1. Contrats Documenso : alignement signatures + paraphage

Corrige plusieurs problèmes structurels des 4 types de contrats électroniques
(foster, adoption, abandonment, adoption-cancellation) :

- **pageX corrigé** : foster/adoption/adoption-cancellation passaient
  `pageX: 55` (colonne droite) mais l'encart du signataire (FA/adoptant) est
  en colonne gauche → la signature tombait sur l'encart Refuge SDA. Corrigé
  à `pageX: 8` (gauche). Abandonment était déjà à 10.
- **Paraphes (INITIALS) sur chaque page** : activation du footer running
  Puppeteer (`displayHeaderFooter: true` + `footerTemplate` avec encart
  "Paraphes" en bas à droite + `margin.bottom: 16mm`). Documenso pose un
  `INITIALS` à `pageY: 95.5` pile dans cet encart sur chaque page sauf la(les)
  page(s) de signature finale. Standard juridique anti-substitution.
- **Encart Refuge SDA pré-rempli** : cachet SVG dynamique généré depuis
  les infos établissement (helper extrait `src/lib/pdf/cachet.ts`) + nom
  du membre qui envoie le contrat (lookup RPC `get_users_info` à partir
  du `userId` connecté, fallback "Le représentant").
- **Adoption — 2 signatures** : le contrat d'adoption a 2 zones de signature
  (contrat principal + annexe "Conditions d'adoption"). Refactor en
  split-and-merge :
  - Template accepte un param `part: 'full' | 'main' | 'annex'`
  - Builder PDF avec option `splitForSignature: true` génère 2 PDFs séparés
    (main + annex), les merge via pdf-lib
  - Retourne `mainPageCount` en plus de `pageCount` total
  - L'action signature place 2 SIGNATURE complètes + INITIALS partout ailleurs

**Helper partagé** : `src/lib/pdf/cachet.ts` (extrait de `cerfa-template.ts`).

**Commits** : `a0ff247`, `6206f9c`, `90040fb`

### 2. Congés / Couverture : prise en compte des jours de repos hebdo

La fonction `getCoverageRange` ne consultait pas `member_work_schedules`,
donc un membre comme Matthieu (repos hebdo le lundi) était compté "présent"
et "dispo" alors qu'il ne travaille pas ce jour.

- `getCoverageRange` : fetch des schedules valides (`valid_until IS NULL`),
  indexation `Map<member_id, Set<DayOfWeek>>`, calcul `members_on_rest_day`
  par jour, exclusion du numérateur `available_salaried_count` /
  `available_total_count` / `salariedWithPendingAvail`
- `getCoverageImpactForRequest` adapté (recalcul local)
- UI : nouveau bloc "Au repos hebdo" dans le détail jour (badge bleu, distinct
  du rouge "absent congé"). Renommage "Présents" → "Présents (selon planning)"
- Le ratio "X/Y" affiché dans la grille reflète maintenant l'effectif
  réellement disponible (numérateur) sur l'effectif total sous contrat
  (dénominateur RH historique inchangé)

**Commits** : `61141eb` (ajout affichage), `eda8bb8` (exclusion repos du
numérateur)

### 3. Formulaires publics du site sda-nord.com (côté Optimus)

3 nouvelles vues admin Optimus pour recevoir les soumissions des 3 formulaires
globaux du site sda-website (qui partage la même base Supabase).

**Migration** : extension `permission_groups` avec 3 booleans :
- `manage_adoption_applications`
- `manage_volunteer_applications`
- `manage_abuse_reports`

Helper SQL `user_has_permission()` étendu.

**3 vues admin créées** (toutes calquées sur le pattern `contacts-entrants/`) :

1. `/admin/candidatures-adoption` : liste les `adoption_inquiries` avec
   `inquiry_type='pre_qualification'` (le formulaire global, sans animal
   ciblé). Détail = rendering structuré FR du questionnaire JSONB. Badge
   "Liste noire" si `possible_blacklist_match`.
2. `/admin/candidatures-benevoles` : liste les `volunteer_applications`.
   Détail = motivation, matrice dispo 7×3, compétences badges, aptitudes,
   expérience. Pattern qualified_at/by auto-set sur transition.
3. `/admin/signalements-maltraitance` : liste les `abuse_reports`. Tri par
   défaut urgent en haut. Badge urgent rouge clignotant. Détail avec
   bandeau alerte si urgent, grille photos signed URLs 60s (bucket privé
   `abuse-report-photos`), gestion anonymat signalant.

**Fichiers principaux** :
- `src/lib/actions/{adoption,volunteer}-applications.ts` + `abuse-reports.ts`
- `src/app/(app)/admin/{candidatures-adoption,candidatures-benevoles,signalements-maltraitance}/page.tsx + [id]/page.tsx`
- `src/components/{adoption,volunteer}-applications/resolve-actions.tsx` + `abuse-reports/resolve-actions.tsx`
- `src/lib/types/database.ts` : ajout types `AdoptionInquiry`, `VolunteerApplication`, `AbuseReport`, `AbuseReportPhoto` + extension `PermissionGroup` et `Permissions`
- `src/lib/establishment/context.ts` : `buildPermissions()` étendu
- `src/components/layout/nav-config.ts` : 3 entrées sidebar dans section "Communication"

**Commit** : `8296c56`

### 4. Migration Supabase associée

Migration `public_forms_volunteer_abuse_reports` appliquée sur
`zzevrtrgtgnlxxuwbnge` :
- `permission_groups` : ajout 3 colonnes
- `adoption_inquiries` : `animal_id` rendu NULLABLE + colonne `inquiry_type`
  CHECK IN ('specific_animal', 'pre_qualification')
- Nouvelles tables `volunteer_applications`, `abuse_reports`,
  `abuse_report_photos`
- Bucket Storage privé `abuse-report-photos` (5 Mo max, jpeg/png/webp/heic)
- RLS + policies sur permissions + triggers updated_at

### 5. Infra Scaleway + Coolify (pour le site sda-website)

VPS Scaleway DEV1-L provisionné à `51.159.128.221` (Paris fr-par-2), Coolify
v4.1.1 installé, sda-website déployé et accessible via 4 sous-domaines
(`nouveau`, `adoption`, `benevole`, `signalement` `.sda-nord.com`).

**Le DNS apex sda-nord.com a été basculé puis rollback à la demande du user
le même jour.** Le site continue de tourner sur Infomaniak. Le nouveau VPS
reste prêt pour quand on voudra migrer.

Voir document détaillé : `~/Projets/SDA/docs/SESSION-2026-05-29.md` (procédures
de bascule/rollback, credentials, configuration Coolify).

### Méta

- 6 commits poussés sur `main`
- 1 migration Supabase + 1 bucket Storage
- Pas de breaking change — toutes les permissions par défaut sont à false,
  les nouveaux booleans n'affectent personne tant qu'on ne les active pas
- Documentation : `~/Projets/SDA/docs/SESSION-2026-05-29.md` (vue d'ensemble
  complète incluant l'infra Scaleway et les procédures de bascule)

---

## Session 2026-05-29 (soir) — Renvoi CRA FITECO + PDF 1 page

Suite à un signalement de la responsable administrative (Céline) : le
comptable FITECO (`g.arciuolo@fiteco.com`) n'avait pas reçu les CRA salariés
de mai 2026 validés ce matin (entre 11:43 et 11:44).

### Investigation

- ✅ Conf email comptable correcte en base : `establishments.accountant_email`
  = `g.arciuolo@fiteco.com`
- ✅ 5 CRA salariés (Carole, Franck, Marina, Mary, Yann) en statut `sent`,
  envoyés ce matin
- ✅ Code de [`cra-send.ts`](src/lib/actions/cra-send.ts) propre, status `sent`
  ne passe que si Brevo SMTP a accepté
- ⚠️ Eric (salarié actif) n'apparaît pas dans la liste — à investiguer
  séparément
- → Problème probable en aval : spam FITECO ou whitelist Brevo

### Décision : ajouter une route admin one-shot

Renvoi forcé avec `clement.scailteux@gmail.com` + `m.fremaux@sda-nord.com`
en copie, via une route admin `/api/cron/cra-resend` plutôt que de modifier
l'UI ou de scripter en local (chemin le plus propre, traceable, réutilisable).

### Bugs déterrés en chaîne

1. **`'use server'` + `export const X = {…}`** : 3 fichiers (`volunteer-applications.ts`,
   `abuse-reports.ts`, `portal-ticket-events.ts`) cassaient le build prod
   Next 16.1.6 / Turbopack avec "A 'use server' file can only export async
   functions, found object". Régression silencieuse du commit `8296c56`
   (probablement build dev moins strict que build Docker).

   **Fix** : extraire les constantes UI vers `*-constants.ts` siblings
   (volunteer + abuse), ou les passer en private vars locaux (portal,
   inutilisés ailleurs).

2. **`getMonthlySaisie` exige une session** alors que mon endpoint CRON-auth
   n'en a pas → "Non authentifié".

   **Fix** : ajout du paramètre optionnel `serviceEstablishmentId` qui
   bypass `requireEstablishment()` quand fourni. Propagé dans
   `buildCraSaisiePdf` également. Rétrocompatible (signature non breaking).

3. **Brevo SMTP : "525 5.7.1 Unauthorized IP address"**. L'IP du VPS Optimus
   avait été retirée de la whitelist Brevo lors d'une autre modif de la
   journée (probablement liée au setup Scaleway sda-website). Le user a
   ré-autorisé l'IP manuellement dans le dashboard Brevo.

### Patterns implémentés

- **Service-mode bypass** sur Server Actions : ajouter un paramètre optionnel
  `serviceEstablishmentId` qui, quand fourni, saute l'auth. À n'utiliser que
  depuis un endpoint protégé par secret (Bearer `CRON_SECRET`).
- **Version probe** sur endpoint POST CRON : exposer un GET qui retourne
  `{version: 'vX-...'}` pour polling sans side-effect (détecter quand un
  nouveau build est réellement live, distinguer "endpoint joignable" vs
  "nouveau code actif").
- **Mode preview** : paramètre body `preview_to` qui override le destinataire
  réel et préfixe le subject `[PREVIEW]`. Aucun update DB / activity_log
  en preview. Permet de tester la mise en page d'un PDF avant l'envoi
  officiel sans spammer le destinataire final.

### Résultat envoi final

| Salarié | messageId Brevo (renvoi officiel CC) |
|---------|---------------------------------------|
| Franck  | `d6ab11bc-…@sda-nord.com` |
| Marina  | `d4306b68-…@sda-nord.com` |
| Mary    | `05f2dd4b-…@sda-nord.com` |
| Carole  | `73652617-…@sda-nord.com` |
| Yann    | `cede1ca5-…@sda-nord.com` |

Tracé dans `activity_logs` avec `details.resend = true` + liste CC +
message_id.

### PDF CRA compacté pour tenir en 1 page A4 paysage

Le PDF débordait sur 2 pages. Compactage de `cra-saisie-template.ts` :
- `@page margin` : 12mm → 8mm
- Cellules calendrier : 68px → 52px
- Font-sizes globalement -1pt (corps 11→10, labels 9→8, valeurs 13→12)
- Paddings / margins-top resserrés (~50%)

Validé par preview à `clement.scailteux@gmail.com` puis confirmé OK
par Clément. Tous les futurs CRA générés tiennent en 1 page.

### Méta

- 7 commits poussés sur `main` (les 3 push des fixes "use server" +
  endpoint + bypass + version probe + preview-mode + compactage PDF)
- 1 nouvel endpoint : `/api/cron/cra-resend` (admin, CRON_SECRET)
- 3 nouveaux fichiers `*-constants.ts` (volunteer-applications,
  abuse-reports — extraits depuis les `'use server'`)
- Pas de migration DB

---

## Session 2026-05-30 — FA + Parrainage + Refonte design + IA Céline + Vaccins

Grosse session multi-chantiers. Tout poussé sur `main`, builds locaux validés
avant chaque push (sauf une régression `'use server'` corrigée immédiatement).

### 1. Candidatures Famille d'Accueil (nouveau workflow complet)

**Côté site SDA** :
- `/famille-accueil` (page éditoriale) : suppression du CTA chatbot mort,
  remplacement par un `InfoCta` vers `/espace/nouveau/famille-accueil`.
- Nouveau formulaire authentifié `/espace/nouveau/famille-accueil` —
  8 sections : Logement, Foyer, Animaux personnels, Disponibilité d'accueil,
  Expérience préalable, Motivation, Engagement RGPD, profil read-only depuis
  le compte. Indicateur de progression sticky.
- Endpoint `POST /api/portal/foster/submit` (auth requise, bloque les comptes
  staff via RLS `portal_foster_self_insert`).
- Endpoint public anonyme `/api/foster-application` en fallback (Turnstile).
- Ajout du lien "Famille d'accueil" dans `newRequestNav` du PortalShell.

**Côté Optimus** :
- Migration `foster_applications_phase2` : table `foster_applications`
  (logement, foyer, animaux, dispo, motivation), séquence `foster_ticket_seq`,
  trigger `assign_foster_ticket_number` (préfixe `FA-YYYY-XXXX`), RLS staff
  + `portal_foster_self_*`, nouvelle perm `manage_foster_applications`
  ajoutée à `permission_groups` + `user_has_permission`.
- Nouvelle page `/admin/candidatures-fa` (liste) + `[id]` (détail).
  Mêmes stats / filtres / workflow que `/admin/candidatures-benevoles`.
- Server actions `listFosterApplications`, `getFosterApplication`,
  `getFosterApplicationStats`, `updateFosterApplicationStatus`.
- Composant `FosterResolveActions` (changement statut + notes).
- Nav : nouvelle entrée "Candidatures FA" sous Communication.

**Champs obligatoires demandés ensuite** : tous les champs du formulaire
sont passés en obligatoires (date naissance, profession, disponibilité,
durée max, vaccins des animaux si has_pets, espace extérieur si has_garden,
expérience si déclarée). Validations Zod côté front + endpoint + refines.

**Nouveau champ `profession`** : drop-down 23 options (CSP large)
ajoutées en section 1 — Étudiant·e, Sans emploi, Au foyer, Retraité·e,
Cadre, Profession libérale, Métier de l'animal, etc. Migration
`foster_applications_add_profession` (colonne text nullable).
Affichage de la profession dans le bloc Contact de la fiche admin.

### 2. Espace parrainage côté site SDA

**Existant constaté** : la page `/espace/parrainages` existait déjà avec
liste des parrainages actifs + 3 dernières nouvelles par animal. Manque :
une page détail montrant TOUTE l'histoire et TOUS les versements.

**Ajouts** :
- Nouvelle page `/espace/parrainages/[id]` : photo HD de l'animal, fiche
  complète (race, âge, sexe, description externe = son histoire), KPI
  parrainage (montant mensuel, total versé, nb versements), toutes les
  nouvelles publiées, tableau historique des versements (date, montant,
  mode, n° Cerfa).
- Lien "Voir toute son histoire" depuis la liste vers la page détail.
- Nouveaux fetchers `optimus-client-queries.ts` :
  - `getSponsorshipById(sponsorshipId, clientId)` — vérifie l'appartenance
  - `getSponsorshipPayments(sponsorshipId)`
  - `getAnimalNewsForAnimal(animalId)`
- Nouveaux types `OptimusAnimalExtended`, `SponsorshipDetailRow`.

### 3. Page gestion parrains côté Optimus

Nouvelle vue `/admin/parrainages` (perm `manage_donations`) :
- **4 KPI en tête** : Parrains actifs (distincts), Revenu mensuel récurrent
  (MRR = somme `monthly_amount` actifs), Encaissé année en cours (donations
  fléchées via `sponsorship_id`), Moyenne mensuelle par parrain.
- **Tableau** : Parrain · Animal · Type · Mensuel · Total versé · Depuis ·
  Statut, avec lien vers la fiche client.
- **Filtres** : recherche libre, statut, type, toggle "inclure terminés".
- Server actions dans `sponsorships-admin.ts` + types dans
  `sponsorships-admin-types.ts` (séparation obligatoire, cf. gotcha
  Next 16 `'use server'`).
- Nav : entrée "Parrainages" sous Finances.

### 4. Coup de fraîcheur design Optimus

Alignement de l'app sur la charte du site sda-nord.com :
- **Palette** : indigo/violet/pink → navy `#1e3a5f` + teal `#5ba8a0` +
  terracotta `#c96b3c`. Aliases `--color-primary/accent` conservés pour
  rétrocompat (pas de refactor des pages).
- **Typo** : Inter → Baloo 2 (corps) + Fraunces (titres `.h-display`).
  Variables `--font-baloo`, `--font-fraunces` chargées via `next/font`.
- **Dark mode conservé** mais sur base navy deep `#14253d` au lieu de
  slate. Light mode : paper/canvas blanc cassé.
- **Classes signature** ajoutées :
  - `.eyebrow` (mini-label uppercase teal, tracking 0.22em)
  - `.h-display` (titre Fraunces navy)
  - `.badge-pill-warm` (pill terracotta)
  - `.container-edge` (padding horizontal + max-width 1280px)
  - `.gradient-warm` (terracotta clair pour CTA chauds)

### 5. Photo principale animal (sync vitrine)

**Bug constaté** : `setPrimaryAnimalPhoto` mettait à jour
`animal_photos.is_primary` mais pas `animals.photo_url`. Conséquence :
la liste publique `/animaux` du site SDA continuait d'afficher l'ancienne
photo sur les cartes (la galerie détail elle, lisait `is_primary` et
fonctionnait déjà).

**Fix** : la server action récupère désormais l'URL de la photo cible et
synchronise `animals.photo_url`. Check d'intégrité ajouté (la photo doit
appartenir à l'animal demandé).

### 6. Wording adoption — "équipe" vs "bénévoles"

Sur le tunnel d'adoption, le wording laissait croire que les bénévoles
pilotaient les candidatures. Correction sur 3 endroits (`/processus-adoption`
+ `/adopter`) : la voix devient "notre équipe salariée" qui répond aux
questions et fait les visites à domicile. Les bénévoles restent mentionnés
sur les pages bénévolat / FA (terrains : promenades, soins, événements).

### 7. CTA fiche animal — formulaire au lieu d'appeler

Sur `/animaux/[id]`, suppression du bouton "Appeler le refuge"
(`tel:+33327786256`) qui créait deux chemins concurrents. Le seul CTA
mis en avant est désormais "Je veux adopter X" → ancre vers le formulaire
de pré-qualification plus bas sur la page. Cohérent desktop + sticky mobile.

### 8. Page admin Comptes portail (potentiels adoptants)

Nouvelle vue `/admin/comptes-portail` (perm `manage_clients`) qui liste
les comptes créés par les visiteurs du site sda-nord.com (table
`portal_profiles` synchronisée depuis le projet `sda-portail`).

Pour chaque compte :
- Nom (depuis `portal_profiles`) + email (depuis `auth.users` via RPC
  `get_users_info`) + téléphone
- Localisation
- **Badges de candidatures** : ❤ adoption (`adoption_inquiries.user_id`)
  · 🤝 bénévole (`volunteer_applications.user_id`) · 🏠 FA
  (`foster_applications.user_id`), avec compteur
- Statut RGPD opt-in marketing
- **Lien client** Optimus si déjà rattaché (`clients.portal_user_id`)
- Date d'inscription

KPI en tête (Total / Avec candidature / Liés / Non liés) + filtres
(recherche libre, statut de liaison). Server actions dans
`portal-accounts-admin.ts` + types dans `portal-accounts-admin-types.ts`.

### 9. Générateur descriptif animal style Céline (vision + few-shot)

**Constat** : la route `/api/ai/generate-description` existait déjà mais
produisait un texte générique 150-250 mots, sans personnalité ni vision,
sans aucun lien avec le style des ~32 fiches actuelles écrites par Céline
(Secrétaire générale).

**Analyse stylistique** déléguée à un agent qui a lu les 32 fiches.
Verdict : une seule plume, très marquée et reproductible :
- Narrateur = l'animal qui parle (jamais "le refuge")
- 2 500–3 500 caractères, 10 blocs (salut → présentation → histoire →
  caractère → éducation → ententes → profil → CTA 🐶 x3 → "À bientôt" →
  signature + mention légale verbatim)
- Lexique signature : "loulou/louloute/nénette", "tata Mary / tonton
  Franck", "bien dans ma tête et dans mes pattes", "X de mon état"
- 15-25 emojis par fiche (❤️‍🩹 en signature, 🐶 sur les 3 puces CTA,
  🐈‍⬛ x3 pour les chats détestés)
- Mention légale finale **verbatim** sur 32/32

**Refonte de la route** :
- Modèle : `claude-haiku-4-5` → `claude-sonnet-4-6` (vision + tenue
  stylistique long format)
- **Vision** : récupère `animal_photos.is_primary` (fallback
  `animal.photo_url`), passe la photo en `type: 'image'` (source URL)
- **Few-shot** : 2 messages avec exemples production (Amaya 1.6k car +
  Tupac 3.2k car) avant la cible
- **System prompt** structuré : style guide complet de Céline + lexique
  + emojis + anti-patterns + règle absolue narrateur
- **Facts block** envoyé : nom, espèce, race, sexe, âge calculé, couleur,
  poids, date arrivée, ententes chats/mâles/femelles, score comportement,
  notes internes (`description`) avec consigne explicite "ne pas recopier
  brutalement, omettre médical sensible + n° de puce"

Pas de modification UI nécessaire — le bouton "Générer avec l'IA" est
déjà sous le textarea Description externe du formulaire animal.

#### Raffinement v2 (commit `ad6f672`) — feedback Céline après test réel

Premier passage en condition réelle par Céline : verdict positif global
("gain de temps réel"), mais 3 corrections à intégrer au prompt :

1. **Ordre des 7 rubriques imposé** (consigne Céline non-négociable) :
   Présentation → Histoire → Caractère → Goûts → Ententes → Éducation
   → Profil humain. Seule liberté tolérée : inverser Éducation et
   Ententes. Le system prompt liste les 7 blocs avec leur scope précis
   pour éviter qu'un trait migre d'une rubrique à l'autre.

2. **Règle d'or anti-invention sur les ententes** — Céline avait
   signalé "infos transformées sur les ententes". Table de conversion
   stricte ajoutée : `oui` → "j'aime", `non` → "je ne supporte pas /
   non négociable", `non évalué` → "je n'ai pas encore été testé(e)".
   Interdit formellement d'extrapoler ou d'inventer des copains.

3. **Règle d'or anti-redondance** : chaque trait n'apparaît qu'une
   fois. Le Profil humain devient une SYNTHÈSE DÉDUCTIVE (ce que
   cherchent les humains), pas une reprise du Caractère / Goûts /
   Ententes.

Le user prompt rappelle ces 3 règles à chaque appel (anti-dérive).

**UX** : `rows={5}` → `rows={20}` + `font-serif leading-relaxed` sur
le textarea Description externe. Céline retouche directement dans
Optimus, c'est son gain de temps principal ("plus simple que je le
fasse directement").

### 10. Vaccins primo / rappel mois / rappel annuel + rappels auto

**Demande de Mary** : sur le tableau passage véto, le bouton "VACCIN"
ne distingue pas primo / rappel mois / rappel annuel → pas de calcul du
prochain rappel, pas d'alerte pour Caroline.

**Charte appliquée** (tableau Mary du 18/05/2026) :
- Chien — Primo CHPPI+Lepto+toux       → rappel +4 semaines
- Chien — Rappel mois CHPPI            → rappel +365 jours
- Chien — Rappel annuel CHPPI+Lepto+toux → rappel +365 jours
- Chat — Primo RCP                     → rappel +4 semaines
- Chat — Rappel mois RCP               → rappel +365 jours
- Chat — Rappel annuel RCP             → rappel +365 jours

**Implémentation** :
- Nouveau helper `lib/health/vaccine-schedule.ts` : 6 sous-types,
  compositions, délais, `computeNextDueDate(actKey, visitDate)`,
  `isVaccineActKey()`, `getReminderStatus(date)` (overdue / due_soon /
  upcoming).
- `VetVisitActKey` étendu de 6 clés. Les anciens `vaccin_chien` /
  `vaccin_chat` restent acceptés en lecture (rétrocompat anciens
  passages) mais ne déclenchent plus de calcul.
- Tableau passage véto : remplacement des 2 cases simples par
  6 colonnes distinctes, code couleur fidèle au tableau Mary
  (jaune primo chien, orange rappel mois, violet rappel annuel,
  lime/emerald/green pour les chats).
- `validateVetVisitLine` : chaque acte vaccin reconnu crée un
  `animal_health_record` avec `next_due_date` calculé automatiquement.
- `ACT_TO_HEALTH_TYPE` + `ACT_LABELS` étendus dans
  `vet-visits.ts` ET `vet-visit-recap-template.ts` (PDF récap véto).
- Nouveau composant `VaccineRemindersBanner` affiché en haut de la fiche
  animal :
  - 🔴 rouge si rappel overdue
  - 🟠 orange si rappel ≤ 30j
  - 🟢 vert discret si vaccins à jour (prochain rappel > 30j)
  - rien si aucun vaccin enregistré
  - filtrage des rappels déjà couverts par un vaccin plus récent

**Pas de backfill** : décision conjointe avec Mary, les anciens vaccins
restent tels quels, le prochain passage véto remettra tout d'équerre.

### 11. Articles home — images cassées

Le composant `components/home/articles-section.tsx` hardcodait 3 articles
pointant vers `/images/articles/*.svg` qui n'existaient plus (SVG
placeholders supprimés dans une session précédente quand j'avais réparé
les `featuredImage` des fichiers `.md` du blog, en oubliant ce composant).

Remappés vers les vraies photos stock :
- "Adopter : ce que personne ne vous dit" → `/images/stock/cat-portrait.jpg`
- "Stérilisation : la décision la plus utile" → `/images/stock/hands.jpg`
- "Bilan portes ouvertes : 12 adoptions" → `/images/site-original/hero-2.jpg`

### Méta — commits poussés (refuge/main)

| Commit | Sujet |
|--------|-------|
| `4ed8111` | feat(admin): candidatures famille d'accueil |
| `7b6f7e6` | feat(admin): page parrainages avec KPI financiers |
| `ec10fc5` | feat(theme): coup de fraîcheur palette SDA + typo |
| `e28799e` | fix(parrainages): extract types out of 'use server' module |
| `a0fee02` | feat(candidatures-fa): afficher la profession du candidat |
| `2f2846b` | fix(photos): sync animals.photo_url quand on change la photo principale |
| `caf4ec2` | feat(admin): page Comptes portail (potentiels adoptants/parrains/bénévoles) |
| `9db360f` | feat(ai): générateur descriptif animal façon Céline (vision + few-shot) |
| `b7dee09` | feat(sante): vaccins primo/rappel mois/rappel annuel + rappels auto |

### Méta — migrations DB appliquées (CRM Refuge)

| Migration | Objet |
|-----------|-------|
| `foster_applications_phase2` | Table `foster_applications` + perm + RLS + trigger ticket_number |
| `foster_applications_add_profession` | Colonne `profession` text nullable |

### Gotchas confirmés cette session

- **Re-validation du gotcha `'use server'` Next 16** : les exports
  `type` / `interface` plantent AUSSI le build prod (pas seulement les
  `const`). Cassé sur `sponsorships-admin.ts` avec `export interface
  SponsorshipWithBoth` + `export type { Sponsorship, ... }`. Le typecheck
  `tsc --noEmit` est OK, c'est le bundling Turbopack qui échoue parce
  qu'il essaie de hash chaque export en server action. Fix : extraction
  vers `sponsorships-admin-types.ts`. Mémoire raffinée
  (`gotcha_next16_use_server_exports`) — règle absolue : un fichier
  `'use server'` ne contient QUE `export async function ...`.
