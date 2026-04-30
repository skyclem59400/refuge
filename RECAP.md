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
- ✅ Photos (bucket `animal-photos`)
- ✅ Mouvements (entrée fourrière, transfert, adoption, retour, transfert sortant, décès, euthanasie)
- ✅ Sorties (promenade) + assignations
- ✅ Sync Hunimalis (intégration externe)
- ✅ Onglets fiche : Infos, Photos, Santé, Mouvements, Famille d'accueil, **Documents** (PDF), Sorties, Publications, I-CAD, Activité (admin)
- ✅ **Anti-doublon** à la création : avertit si même nom créé < 24h
- ✅ **Procédure judiciaire** : marquage + champs (n° dossier, juridiction, date saisine, propriétaire mis en cause, destinataire facturation, notes), badge sur fiche & liste, filtre, alerte automatique sur acte santé

### Santé
- ✅ 10 types d'actes : vaccination, stérilisation, antiparasitaire, consultation, chirurgie, médicament, bilan comportemental, **identification**, **radio**, **prise de sang**
- ✅ Protocoles de soins ([health/protocols](src/app/(app)/health/protocols/page.tsx)) avec étapes et rappels automatiques
- ✅ Carte d'identification animal accessible aux vétérinaires/soigneurs
- ✅ Traitements en cours (administration journalière)
- ✅ Sur acte santé d'un animal en procédure : alerte facture nominative + champs `judicial_procedure`, `billed_to`, `invoice_reference`

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
| `payment_entries` | Saisies de règlement |
| `donations`, `helloasso_connections` | Dons et intégration HelloAsso |
| `icad_declarations` | Déclarations I-CAD |
| `social_posts`, `meta_connections` | Publications réseaux sociaux |
| `pound_interventions` | Interventions fourrière |
| `appointments`, `staff_schedules` | Planning RDV / créneaux |
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

## Problèmes connus / Dette technique

- ⚠️ Branch git locale `feature/avril-2026-features` pas supprimée après merge dans `main`
- ⚠️ Modifications non commitées en cours sur d'autres chantiers : module `contacts-entrants` (page + actions + composants), `lib/actions/leaves.ts`, mises à jour `CLAUDE.md` / `README.md` — laissées dans le working tree, à finaliser plus tard
- ⚠️ Avertissement build Next.js : `metadataBase` non défini (cosmétique)
- ⚠️ Lien sidebar `/contacts-entrants` réservé aux owners mais la route n'est pas encore committée → 404 pour Clément
- ⚠️ `MIGRATION_TO_RUN_2026_04_27.sql` à la racine : déjà appliqué en prod, à archiver dans `supabase/migrations/`

## Prochaines étapes possibles

- Finaliser et committer le module `contacts-entrants`
- Activer la permission "Praticiens" sur les groupes Manager (à faire en UI)
- Marquer rétroactivement les animaux SDA en procédure (Nicoletta, etc.)
- Ajouter un export PDF "frais engagés global SDA" tous animaux en procédure confondus
- Notifications quand un animal en procédure approche d'une échéance (audience, etc.)
- Documenter la procédure pour Maryline / Céline / Caroline (mode d'emploi rapide)
