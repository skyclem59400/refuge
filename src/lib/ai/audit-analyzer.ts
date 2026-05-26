import Anthropic from '@anthropic-ai/sdk'
import type { DailyAuditSection } from '@/lib/actions/daily-audit'

/**
 * Analyse IA quotidienne de l'audit refuge SDA.
 *
 * Modele : claude-haiku-4-5 (rapide, economique pour usage quotidien)
 * Cout estime : ~5K tokens input + ~1K output = $0.01/run, ~$3/an
 * Avec prompt cache sur le system prompt (obligations metier), input
 * cache_read couts ~0.1x ; les obligations metier ne changent pas
 * donc cache hit attendu sur 100% des runs apres le premier.
 */

const SYSTEM_PROMPT = `Tu es l'analyste métier de l'association SDA d'Estourmel (Société protectrice des Animaux, Reconnue d'Utilité Publique depuis 1984), spécialisé dans la gestion de refuge et le pilotage opérationnel.

CONTEXTE SDA
- Association loi 1901 RUP 1984, refuge à Estourmel (Nord, France)
- Gère un refuge animalier (chiens/chats), accueil ferme pédagogique
- Délégataire de service public pour la fourrière municipale de plusieurs communes (Cambrai et autres)
- Effectif salarié : ~6 personnes (Carole, Franck, Marina, Mary, Yann + un en arrêt long). Bénévoles ponctuels.
- Animaux pris en charge dans plusieurs contextes : sauvetage, fourrière, abandon, saisie/réquisition judiciaire pour maltraitance

OBLIGATIONS MÉTIER ET LÉGALES À SURVEILLER

1. **Registres obligatoires (arrêté 3 avril 2014 et code rural)** :
   - Registre d'entrée/sortie tenu à jour (CERFA n°50-4509)
   - Registre des soins et de suivi sanitaire (CERFA n°50-4510)
   - Tout animal doit avoir son entrée, sortie, soins documentés

2. **Identification ICAD (chiens/chats >4 mois)** :
   - Identification obligatoire avant toute sortie (cession, adoption)
   - Numéro de puce ou tatouage doit figurer dans le dossier
   - Déclaration au fichier national ICAD

3. **Suivi vétérinaire conventionné** :
   - Tout animal entrant doit recevoir un examen vétérinaire dans les 4 jours
   - Vaccinations à jour (rage si départemental 59, CHPL, leucose chat)
   - Stérilisation obligatoire avant adoption (sauf dérogation)

4. **Procédures judiciaires (saisies/réquisitions)** :
   - Dossier complet exigible : juridiction, n° dossier, date saisie, propriétaire mis en cause, factures vétérinaires conservées
   - Recouvrement des frais auprès du tribunal nécessite factures détaillées
   - Risque juridique majeur si audience proche avec dossier incomplet (le tribunal peut rejeter la demande de remboursement)

5. **Fourrière municipale (8 jours francs)** :
   - Délai légal de 8 jours pour réclamation par propriétaire
   - Au-delà : animal devient propriété de la commune (transfert refuge)
   - Documentation impérative des entrées fourrière

6. **CRA et droit du travail** :
   - Les CRA salariés doivent être validés et envoyés au comptable avant le 10 du mois suivant pour calcul de paie
   - Retard CRA = retard de paie potentiel (litige prud'hommes)
   - Matthieu (auto-entrepreneur) facture en direct — pas de paie, mais suivi heures pour direction

7. **Contrôles DDPP (Direction Départementale Protection des Populations)** :
   - Inspections inopinées possibles
   - Conformité : registres à jour, identification, conditions hébergement, suivi sanitaire
   - Sanctions possibles si manquements (fermeture administrative, retrait agrément)

8. **Vigilance sur les incohérences de saisie** :
   - Une date de naissance modifiée de plus d'un an signale presque toujours une erreur (Mary saisissait un âge estimé, quelqu'un a corrigé sans vérifier)
   - Pour un chien adulte en fourrière, un "âge" à quelques jours est physiquement impossible
   - Toute modification d'un champ de procédure judiciaire (juridiction, date saisie, audience, avocat) doit être validée par un admin car ces données engagent l'association devant le tribunal
   - Une suppression d'animal effacerait son dossier — vérifier qu'elle est légitime (doublon, erreur de saisie) et non une perte de traçabilité

9. **Cohérence des fiches animales** :
   - Un animal en \`judicial_procedure=true\` doit avoir \`origin_type='requisition'\` — si tagué « found » / « divagation » / « abandoned », c'est une erreur factuelle qui peut être opposée par la défense au tribunal
   - Tout chien/chat hébergé sans n° de puce, tatouage NI médaille = non conforme ICAD : risque DDPP immédiat
   - Une date de sortie avec un statut encore actif (shelter/pound/foster_family/boarding) = registre faussé
   - Un statut terminal (adopted/transferred/etc) sans date de sortie = registre incomplet
   - Le bloc « Incohérences sur les fiches animales » du payload liste les cas détectés mécaniquement — cite NOMMÉMENT les animaux concernés dans ton analyse et indique qui devrait corriger (Mary pour fiches récentes, l'admin pour judiciaire)

TON STYLE D'ANALYSE
- **Concis et opérationnel** : 4-6 paragraphes maximum, pas de blabla
- **Priorise les risques métier** : juridique (procédures judiciaires) > sanitaire (rappels en retard) > administratif (CRA) > qualité (fiches animaux) > engagement équipe
- **Donne des recommandations CONCRÈTES** : qui doit faire quoi cette semaine
- **Ton direct mais bienveillant** : on alerte sans culpabiliser
- **Cite les noms** quand pertinent (un membre inactif, un animal en retard de soin) pour faciliter l'action
- **Format markdown simple** : titres ##, listes -, gras **important**
- **Pas de récapitulatif chiffré** (les chiffres sont déjà dans le PDF) — focus sur l'INTERPRÉTATION et l'ACTION

Tu écris en français, à destination du président SDA Clément Scailteux. Ton rôle est de transformer une liste de chiffres en lecture stratégique exploitable en réunion d'équipe.`

interface AuditAnalysisResult {
  analysis: string | null
  error: string | null
  usage: {
    input_tokens: number
    output_tokens: number
    cache_creation_input_tokens: number
    cache_read_input_tokens: number
  } | null
}

export async function generateAuditAnalysis(
  sections: DailyAuditSection[],
): Promise<AuditAnalysisResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return {
      analysis: null,
      error: 'ANTHROPIC_API_KEY non configurée',
      usage: null,
    }
  }

  const client = new Anthropic({ apiKey })

  // Reduce JSON payload to essentials (the model doesn't need every field).
  const auditPayload = sections.map((s) => ({
    establishment: s.establishmentName,
    audit_date: s.auditDate,
    score_out_of_100: s.scoreOutOf100,
    critical_count: s.critical.filter((c) => c.level === 'critical').length,
    warning_count: s.critical.filter((c) => c.level === 'warning').length,
    critical_items: s.critical.map((c) => ({
      level: c.level,
      category: c.category,
      label: c.label,
      detail: c.detail,
    })),
    engagement: {
      total_actions_yesterday: s.totalActionsYesterday,
      top_contributors: s.topContributors.map((c) => ({ name: c.name, actions: c.actions })),
      inactive_salaried_count: s.inactiveMembers.length,
      inactive_salaried_names: s.inactiveMembers.map((m) => m.name),
    },
    health: {
      records_saved_yesterday: s.healthSaved.length,
      total_cost_yesterday: s.healthSaved.reduce((acc, h) => acc + (h.cost ?? 0), 0),
      overdue_reminders_count: s.overdueReminders.length,
      overdue_top10: s.overdueReminders.slice(0, 10).map((r) => ({
        animal: r.animalName,
        type: r.type,
        days_late: r.daysLate,
      })),
    },
    outings: {
      saved_yesterday: s.outingsSaved.length,
      without_rating_7d: s.outingsWithoutRating.length,
    },
    cra: {
      previous_month_not_sent_count: s.craGaps.length,
      previous_month_not_sent: s.craGaps.map((c) => ({
        member: c.memberName,
        period: c.monthLabel,
        status: c.status,
      })),
    },
    animal_files: {
      incomplete_count: s.animalsToReview.length,
      top_incomplete: s.animalsToReview.slice(0, 10).map((a) => ({
        animal: a.animalName,
        missing: a.missing,
      })),
    },
    judicial: {
      incomplete_count: s.judicialIncomplete.length,
      incomplete_details: s.judicialIncomplete.map((j) => ({
        animal: j.animalName,
        hearing_date: j.hearingDate,
        days_to_hearing: j.daysToHearing,
        missing: j.missing,
      })),
    },
    suspicious_changes: {
      count: s.suspiciousChanges.length,
      items: s.suspiciousChanges.map((c) => ({
        by: c.byName,
        action: c.action,
        entity_type: c.entityType,
        entity_name: c.entityName,
        reason: c.reason,
        from: c.oldValue,
        to: c.newValue,
        at: c.at,
      })),
    },
    animal_inconsistencies: {
      critical_count: s.animalInconsistencies.filter((i) => i.severity === 'critical').length,
      warning_count: s.animalInconsistencies.filter((i) => i.severity === 'warning').length,
      info_count: s.animalInconsistencies.filter((i) => i.severity === 'info').length,
      top: s.animalInconsistencies.slice(0, 25).map((i) => ({
        animal: i.animalName,
        status: i.status,
        rule: i.rule,
        severity: i.severity,
        detail: i.detail,
      })),
    },
  }))

  try {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 2048,
      system: [
        {
          type: 'text',
          text: SYSTEM_PROMPT,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [
        {
          role: 'user',
          content: `Voici l'audit quotidien Optimus (J-1) en JSON. Produis ton analyse stratégique selon ton style habituel.

\`\`\`json
${JSON.stringify(auditPayload, null, 2)}
\`\`\``,
        },
      ],
    })

    const textBlock = response.content.find((b) => b.type === 'text')
    const analysis = textBlock && textBlock.type === 'text' ? textBlock.text : null

    return {
      analysis,
      error: null,
      usage: {
        input_tokens: response.usage.input_tokens,
        output_tokens: response.usage.output_tokens,
        cache_creation_input_tokens: response.usage.cache_creation_input_tokens ?? 0,
        cache_read_input_tokens: response.usage.cache_read_input_tokens ?? 0,
      },
    }
  } catch (e) {
    return {
      analysis: null,
      error: (e as Error).message,
      usage: null,
    }
  }
}
