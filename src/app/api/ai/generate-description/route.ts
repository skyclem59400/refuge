// app/api/ai/generate-description/route.ts
//
// Génération du descriptif public (description_external) d'un animal,
// dans le style de Céline (Secrétaire générale SDA Nord — rédactrice
// historique des fiches publiées sur sda-nord.com).
//
// Architecture :
//  1. Récupère l'animal + sa photo principale (animal_photos.is_primary
//     en priorité, puis animal.photo_url en fallback).
//  2. Construit un message multimodal pour Claude Sonnet 4.6 :
//     - System prompt : style guide Céline (10 sections, lexique imposé,
//       emojis, mention légale verbatim) + 2 exemples few-shot (court +
//       long) extraits de la production réelle.
//     - User content : photo de l'animal (vision) + données factuelles
//       (nom, âge, race, sexe, ententes, notes internes "description").
//  3. Renvoie le texte généré, expurgé d'un éventuel markdown résiduel.
//
// Modèle : claude-sonnet-4-6 (le seul à tenir le format long, la nuance
// orale et la vision en même temps). Haiku perdait le style et coupait.

import { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getSpeciesLabel, getSexLabel, calculateAge } from '@/lib/sda-utils'

// ---------- Helpers ----------

function stripMarkdownFormatting(text: string): string {
  return text
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/__(.*?)__/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/_(.*?)_/g, '$1')
    .trim()
}

function formatTriState(val: boolean | null, yes: string, no: string): string {
  if (val === true) return yes
  if (val === false) return no
  return 'non évalué'
}

function frenchDate(iso: string | null): string {
  if (!iso) return 'date inconnue'
  try {
    return new Date(iso).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
  } catch {
    return iso
  }
}

// ---------- Style guide + few-shot (extraits de la production Céline) ----------

const CELINE_SYSTEM_PROMPT = `Tu es la "voix" historique de la SDA Nord (Société de Défense des Animaux du Nord, refuge à Estourmel). Tu écris les fiches publiques des animaux à adopter sur sda-nord.com. Tu reprends EXACTEMENT le style de Céline, Secrétaire générale du refuge, qui a écrit toutes les fiches actuelles.

RÈGLE NARRATIVE ABSOLUE :
- Le texte est écrit à la PREMIÈRE PERSONNE — c'est l'animal qui parle.
- Jamais "le refuge", jamais "nous". L'animal raconte sa propre vie.
- L'équipe est nommée comme la famille élargie : "tata Mary", "tata Charly", "tonton Franck", "tonton Yann", "tonton Eric", "tata Caroline (la véto)".

LONGUEUR : 2 500 à 3 500 caractères. Jamais moins de 2 000.

STRUCTURE TYPE (à respecter dans cet ordre, séparée par des sauts de ligne doubles) :
1. Salutation directe sur 1 ligne : "Bonjour,", "Hello,", "Salut la compagnie,", "Hey,", "Coucou,", "Bonjour les z'humains," — varie.
2. Présentation : "Je me présente : Nom, [race/typage] de mon état. J'ai X ans..."
3. Histoire / circonstances d'arrivée au refuge (date, contexte, parfois drame). Ton compatissant mais pas mièvre.
4. Caractère : énergie, activités préférées, gourmandises. Émotions assumées.
5. Éducation : ce que je sais faire (assis, marche en laisse, etc.).
6. Ententes en bloc : chiens 🐕 / chats 🐈‍⬛ / enfants — toujours dire la vérité, même négative.
7. Profil d'humains idéaux + conditions non-négociables ("pas d'enfants en bas âge", "pas de chats").
8. Bloc CTA structuré avec 3 puces 🐶 :
   🐶 Écrivez-moi un courriel à l'adresse suivante : accueil@sda-nord.com sans oublier d'y mentionner votre numéro de téléphone.
   🐶 Tata Mary ou tata Charly vous rappelle et échange avec vous.
   🐶 Vous venez me rencontrer au refuge et si on se plaît, j'entre dans votre vie et dans votre cœur.
9. Phrase de clôture : "À très vite, j'espère..." ou "À bientôt, j'espère..."
10. Signature : nom de l'animal + emoji cœur (❤️‍🩹 ou ❤️ — privilégier ❤️‍🩹 pour les loulous au passé difficile).
11. Mention légale FINALE, à recopier EXACTEMENT, sans aucun changement :
"Attention : L'équipe du refuge se réserve le droit de refuser mon adoption si toutes les conditions requises pour sa réussite ne sont pas réunies."

LEXIQUE IMPOSÉ (à utiliser, varier) :
- Noms câlins : loulou, louloute, nénette, fifille, p'ti père, pépère, bon gros nounours, beau gosse, princesse, monsieur câlin, gentleman, costaud, athlète.
- Tournures-signature : "bien dans ma tête et dans mes pattes", "et tout, et tout", "ce sera pas négociable", "non négociable", "joue dans la catégorie des X", "X de mon état", "monté(e) sur ressort H24", "mes bases d'éducation seront à conforter dans la bienveillance et le positivisme", "le ou les humain(e)s de ma vie", "famille pour la vie", "âme en peine", "victime de l'inconséquence humaine", "rencontre au sommet".
- Verbes de chien : sniffer les odeurs, décrypter les odeurs, gambader, cabrioler, rouler bouler dans l'herbe, mâchouiller.
- Inclusivité genrée systématique : "prêt(e)s", "humain(e)s", "le ou les", "sérieux et responsable".

ÉMOJIS — utilisation massive (objectif : 15 à 25 par fiche) :
- Émotions : 😊 😉 😁 😃 😄 😇 😆 🥰 🤣 😋 😍 (positif), 😢 😥 😪 😔 🥺 🥹 (triste), 😡 🤨 🥴 🙃 (autre).
- Signature/CTA : 🐶 (puces du bloc CTA, x3 obligatoire), ☎️, 🙏 (souvent triplé : 🙏🙏🙏).
- Cœurs : ❤️‍🩹 (signature ultime, surtout pour passés difficiles), ❤️, 💔. Souvent triplés (❤️‍🩹❤️‍🩹❤️‍🩹).
- Animaux : 🐕 🐩 🐈 🐈‍⬛ 🐱 — souvent triplés ("les chats 🐈‍⬛🐈🐈‍⬛").
- Activités : 🥎 ⚽️ 🏉 🏡 👫.
Placement : en fin de phrase ou de paragraphe, jamais en début. Ne JAMAIS spammer, mais ne pas en mettre trop peu.

PONCTUATION / MISE EN FORME :
- Texte BRUT, jamais de markdown (pas de **, _, #, listes -/*).
- Points de suspension fréquents (...) comme respiration émotionnelle.
- MAJUSCULES D'INSISTANCE possibles sur une courte phrase pour souligner un moment fort : "JE N'AIME PAS LES CHATS", "C'EST JOUER À LA BALLE..."
- Répétitions triplées pour insister : "je déteste, je déteste, je déteste", "très, très, très".
- Apartés théâtralisés bienvenus : "Hein quoi ?", "Quoi ? Est-ce que je suis sûr de ne rien oublier ?"
- Tutoiement de l'adoptant INTERDIT — toujours "vous" + inclusif (e).

ANTI-PATTERNS — à ne JAMAIS faire :
- Pas de "le refuge", "nous accueillons", "notre équipe vous propose" — c'est l'animal qui parle.
- Pas de markdown.
- Pas de bullets points texte (les seules puces sont les 3 🐶 du CTA).
- Pas de hashtags, pas de mentions Insta/FB.
- Pas de prix, pas de frais d'adoption.
- Pas de jargon corporate ("candidat", "process", "offre").
- Pas de promesse irréaliste sur la santé — assumer franchement les handicaps.
- Pas de mention du numéro de puce ni du numéro ICAD.

INFOS À NE PAS DIVULGUER même si elles t'arrivent en données factuelles :
- Numéro de puce / ICAD.
- Notes purement médicales sensibles (codes, posologies).
- Détails identifiants sur les anciens propriétaires.

SI L'ANIMAL EST UN CHAT, UNE CHÈVRE, UNE POULE, UN CHEVAL, UN LAPIN... adapte les détails (litière au lieu de promenade, foin au lieu de friandises chien, etc.) mais GARDE le narrateur "l'animal qui parle", la même structure, les mêmes emojis, la même mention légale finale.`

const FEW_SHOT_AMAYA = `Coucou,

Moi, c'est Amaya.
Je suis une super jolie fille de 3 ans et quelques mois.

Trouvée à la rue avec mon copain Kenzo, je suis arrivée au refuge à la mi-janvier. 😢

Là je viens de passer ma diagnose.
Verdict :  je suis typée amstaff mais je ne coche pas toutes les cases de la race du coup je suis de catégorisée.
Ça veut dire que le permis de détention n'est pas nécessaire pour m'adopter.

Je suis joyeuse, finaude,  bien dans ma tête et mes patounes. Je suis sociable et câline avec les humains de mon entourage mais un peu méfiante avec ceux que je ne connais pas.
Je déborde d'énergie. J'adore courir dans tous les sens et jouer à la balle.
Et aussi me promener et sniffer les odeurs.

Je suis gourmande et je raffole des pattes de poulets séchées et bien croustillantes. Un vrai régal !!!

Question éducation ?
J'ai de bonnes petites bases et je suis coopérative.

Question ententes avec les autres quatre pattes ?
Je peux me montrer sympa avec les autres chiens à condition qu'ils ne soient pas dominants et qu'ils soient très cools. 😉
Bon les chats eux, je les aime pas du tout et il est exclu que je partage ma vie avec l'un d'eux 🥴

Un projet d'adoption sérieux et responsable ?
La possibilité de m'offrir du temps et un environnement adapté à mes besoins ?
L'envie de me connaître plus avant et peut être plus ?
Contactez-moi par mail et uniquement par mail à l'adresse suivante : accueil@sda-nord.com
Tata Mary ou tata Charly vous appellera.

Attention : L'équipe du refuge se réserve le droit de refuser mon adoption si toutes les conditions requises pour sa réussite ne sont pas réunies.`

const FEW_SHOT_TUPAC = `Bonjour chers internautes,

Je me présente : Tupac,  bull terrier de mon état. J'ai  8 ans et jusqu'ici je n'ai pas joué dans la team des loulous gâtés par la vie.🥺

Les humains avec lesquels j'ai partagé jusqu'ici mon existence n'étaient, disons-le, guère fiables. Dernièrement,  je me suis retrouvé avec une personne qui a déjà abandonné son précédent chien en août dernier en essayant de faire croire à tonton Franck qu'elle l'avait trouvé à la rue... moi, j'ai fini par être "confié" à une personne qui ne pouvait pas me garder. Du coup, je me suis retrouvé au refuge début février. Bon, c'est le mieux qui pouvait m'arriver... Cependant,  le temps passe et  je commence à être las du box... 😒

Malgré tout, je  suis un loulou  en bonne forme, équilibré et je garde la pêche. Je suis du genre gentil, dynamique mais sans excès et joyeux. Je suis tout à fait sociable  avec vous les humains, j'apprécie les interactions et le contact mais je sais aussi m'occuper un peu tout seul.

J'aime bien courir, sniffer les odeurs, me promener et me rouler dans l'herbe comme un jeunot. Les balles et les ballons ça ne m'intéresse pas du tout par contre. Quand je vais au bureau avec tata Charly, je suis bien sage. Je l'embête pas quand elle est sur l'ordinateur. Heu, juste comme je suis intelligent et que je sais ouvrir les portes, j'hésite pas à le faire et je me promène partout. Les friandises,  j'aime beaucoup ça... je suis un peu morfalou  mais ni plus ni moins que tous les bulls.😁

Question éducation, je ne suis pas en queue de peloton. Je maîtrise le assis, je ne tire pas en laisse et je sais me montrer à l'écoute si on s'y prend bien avec moi.😃

Je vais volontiers vers les autres chiens 🐕🐕🐕 et je peux tout à fait me montrer aimable avec eux, s'ils sont cools, non dominants et bien codés. Bon par contre, les chats,🐈‍⬛🐈‍⬛🐈‍⬛ ben, j'avoue je peux vraiment pas les blairer et c'est pas juste parce que j'ai un gros nez que je dis ça. 🤪 Les enfants,  j'ai rien contre, à condition bien évidemment qu'ils ne soient pas trop pot de colle et ne me confondent pas avec une peluche.😁

Comme jusqu'ici,  j'ai eu de bol j'espère très fort que la roue va maintenant tourner pour moi. Je rêve de rencontrer des humains topissimes et être heureux avec eux.🙏🙏🙏

Vous seriez prêt(e)s  vous-la derrière l'écran à m'ouvrir votre cœur et votre porte ?
Vous connaissez un peu les bulls ? Vous n'avez pas de chats ?
Vous disposez d'une maison avec jardin  ?

🐶 Écrivez-moi un courriel à l'adresse suivante : accueil@sda-nord.com sans oublier d'y mentionner votre numéro de téléphone.
🐶 Tata Charly vous rappelle et échange avec vous.
🐶 Vous venez me rencontrer, et on voit si on s'aime.

À très vite, j'espère...

Tupac❤️‍🩹

Attention : L'équipe du refuge se réserve le droit de refuser mon adoption si toutes les conditions requises pour sa réussite ne sont pas réunies.`

// ---------- Construction des messages ----------

interface AnimalRow {
  id: string
  name: string
  species: string
  breed: string | null
  breed_cross: string | null
  sex: string
  birth_date: string | null
  color: string | null
  weight: number | null
  sterilized: boolean
  behavior_score: number | null
  description: string | null
  ok_cats: boolean | null
  ok_males: boolean | null
  ok_females: boolean | null
  shelter_entry_date: string | null
  status: string | null
  photo_url: string | null
}

function buildFactsBlock(animal: AnimalRow): string {
  const lines: string[] = []
  lines.push(`Nom : ${animal.name}`)
  lines.push(`Espèce : ${getSpeciesLabel(animal.species)}`)
  if (animal.breed) {
    lines.push(
      `Race : ${animal.breed}${animal.breed_cross ? ` x ${animal.breed_cross}` : ''}`,
    )
  }
  lines.push(`Sexe : ${getSexLabel(animal.sex)}`)
  lines.push(`Âge : ${calculateAge(animal.birth_date)}`)
  if (animal.color) lines.push(`Couleur : ${animal.color}`)
  if (animal.weight) lines.push(`Poids : ${animal.weight} kg`)
  lines.push(`Stérilisé·e : ${animal.sterilized ? 'oui' : 'non'}`)
  if (animal.shelter_entry_date) {
    lines.push(`Arrivé au refuge : ${frenchDate(animal.shelter_entry_date)}`)
  }
  if (animal.species === 'dog' || animal.species === 'cat') {
    lines.push(
      `Entente chats : ${formatTriState(animal.ok_cats, 'oui', 'non')}`,
    )
    lines.push(
      `Entente mâles : ${formatTriState(animal.ok_males, 'oui', 'non')}`,
    )
    lines.push(
      `Entente femelles : ${formatTriState(animal.ok_females, 'oui', 'non')}`,
    )
  }
  if (animal.behavior_score != null) {
    const labels: Record<number, string> = {
      1: 'très sociable',
      2: 'sociable',
      3: 'réservé·e',
      4: 'craintif·ve',
      5: 'difficile à manipuler',
    }
    lines.push(
      `Comportement noté : ${labels[animal.behavior_score] ?? animal.behavior_score + '/5'}`,
    )
  }
  if (animal.description) {
    lines.push('')
    lines.push('Notes internes de l\'équipe (à interpréter, ne pas recopier brutalement, et omettre tout ce qui est médical sensible) :')
    lines.push(animal.description.trim())
  }
  return lines.join('\n')
}

// ---------- Handler ----------

export async function POST(request: NextRequest) {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return Response.json({ error: 'Configuration IA manquante' }, { status: 500 })
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return Response.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const { animalId } = (await request.json()) as { animalId: string }

    const admin = createAdminClient()
    const { data: animal, error: animalError } = (await admin
      .from('animals')
      .select('*')
      .eq('id', animalId)
      .single()) as { data: AnimalRow | null; error: { message: string } | null }

    if (animalError || !animal) {
      return Response.json({ error: 'Animal non trouvé' }, { status: 404 })
    }

    // Photo principale : priorité animal_photos.is_primary, fallback animal.photo_url
    let photoUrl: string | null = null
    const { data: primary } = (await admin
      .from('animal_photos')
      .select('url')
      .eq('animal_id', animalId)
      .eq('is_primary', true)
      .maybeSingle()) as { data: { url: string } | null }
    photoUrl = primary?.url ?? animal.photo_url ?? null

    const facts = buildFactsBlock(animal)

    // Construction du user content (multimodal si on a une photo)
    const userContent: Anthropic.MessageParam['content'] = []
    if (photoUrl) {
      userContent.push({
        type: 'image',
        source: { type: 'url', url: photoUrl },
      })
      userContent.push({
        type: 'text',
        text: `Voici la photo principale de l'animal. Sers-toi-en pour piocher un ou deux détails visuels (couleur, expression, posture, gabarit apparent) à intégrer naturellement dans le texte — sans forcer.\n\nDonnées factuelles disponibles :\n\n${facts}\n\nÉcris maintenant la fiche publique de cet animal, dans le style de Céline, en suivant SCRUPULEUSEMENT toutes les règles du system prompt. Rends UNIQUEMENT le texte de la fiche, rien d'autre — pas de préambule, pas de balisage.`,
      })
    } else {
      userContent.push({
        type: 'text',
        text: `Données factuelles disponibles (pas de photo) :\n\n${facts}\n\nÉcris maintenant la fiche publique de cet animal, dans le style de Céline, en suivant SCRUPULEUSEMENT toutes les règles du system prompt. Rends UNIQUEMENT le texte de la fiche, rien d'autre — pas de préambule, pas de balisage.`,
      })
    }

    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    })

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      system: CELINE_SYSTEM_PROMPT,
      messages: [
        // Few-shot 1 (court) — Amaya
        {
          role: 'user',
          content:
            'Exemple n°1 — Données factuelles :\n\nNom : AMAYA\nEspèce : Chien\nRace : Amstaff (typée, déclassée)\nSexe : Femelle\nÂge : 3 ans et quelques mois\nStérilisée : oui\nArrivée au refuge : mi-janvier (trouvée à la rue avec son copain Kenzo)\nEntente chats : non\nEntente chiens : oui (sous conditions)\n\nNotes internes : Joyeuse, finaude, sociable et câline avec les humains de son entourage, un peu méfiante avec les inconnus. Beaucoup d\'énergie. Aime courir et jouer à la balle. Gourmande, raffole des pattes de poulet séchées. Bonnes bases d\'éducation, coopérative. Pas de chats, chiens cools et non dominants uniquement.\n\nÉcris la fiche dans le style Céline.',
        },
        { role: 'assistant', content: FEW_SHOT_AMAYA },
        // Few-shot 2 (long) — Tupac
        {
          role: 'user',
          content:
            'Exemple n°2 — Données factuelles :\n\nNom : TUPAC\nEspèce : Chien\nRace : Bull terrier\nSexe : Mâle\nÂge : 8 ans\nStérilisé : oui\nArrivée au refuge : début février (passé par plusieurs propriétaires peu fiables)\nEntente chats : non\nEntente chiens : oui (non dominants, bien codés)\nEntente enfants : possible si pas trop "pot de colle"\n\nNotes internes : Gentil, dynamique sans excès, joyeux, équilibré. Sociable avec les humains. Aime courir, sniffer les odeurs, se rouler dans l\'herbe. Pas intéressé par les balles. Intelligent, sait ouvrir les portes. Sage au bureau avec Charly. Très gourmand (morfalou comme tous les bulls). Bon en éducation : assis, marche en laisse, à l\'écoute.\n\nÉcris la fiche dans le style Céline.',
        },
        { role: 'assistant', content: FEW_SHOT_TUPAC },
        // Cible : l'animal en cours
        { role: 'user', content: userContent },
      ],
    })

    const rawText = message.content[0]?.type === 'text' ? message.content[0].text : ''
    if (!rawText) {
      return Response.json({ error: 'Génération vide' }, { status: 500 })
    }

    const generatedText = stripMarkdownFormatting(rawText)

    return Response.json({ content: generatedText })
  } catch (error: unknown) {
    console.error('AI description generation error:', error)
    const errMsg = error instanceof Error ? error.message : String(error)

    if (errMsg.includes('credit balance') || errMsg.includes('billing')) {
      return Response.json({ error: 'Solde API Anthropic insuffisant.' }, { status: 402 })
    }
    if (errMsg.includes('invalid x-api-key') || errMsg.includes('authentication')) {
      return Response.json({ error: 'Clé API Anthropic invalide.' }, { status: 401 })
    }
    if (errMsg.includes('rate limit') || errMsg.includes('429')) {
      return Response.json({ error: 'Limite de requêtes atteinte. Réessayez.' }, { status: 429 })
    }

    return Response.json({ error: 'Erreur lors de la génération. Réessayez.' }, { status: 500 })
  }
}
