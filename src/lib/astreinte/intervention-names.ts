/**
 * Liste de noms de refuge en français pour la nomination automatique
 * des animaux récupérés via le portail astreinte.
 *
 * Volontairement courts, doux, et non genrés. Évite les marques et les noms
 * trop "humains" pour ne pas créer de confusion avec des prénoms réels.
 */

const SHARED_NAMES = [
  'Câlin', 'Bichette', 'Patou', 'Filou', 'Ourson', 'Chouchou', 'Bandit',
  'Cookie', 'Caramel', 'Praline', 'Noisette', 'Chocolat', 'Vanille',
  'Caramel', 'Pirate', 'Réglisse', 'Plume', 'Coco', 'Mistou', 'Lutin',
  'Boudin', 'Bouboule', 'Pompon', 'Loulou', 'Bisou', 'Bichon', 'Doudou',
  'Caramel', 'Brioche', 'Toffee', 'Praline', 'Pixie', 'Lutin', 'Petit-Loup',
  'Marsouin', 'Murmure', 'Étoile', 'Noé', 'Sasha', 'Olive', 'Sésame',
]

const DOG_NAMES = [
  'Snoopy', 'Rex', 'Milou', 'Kira', 'Hercule', 'Câline', 'Lupin', 'Médor',
  'Roméo', 'Otis', 'Ulysse', 'Vanille', 'Vagabond', 'Brutus', 'Tess',
  'Sirius', 'Orion', 'Némo', 'Aslan', 'Tobby', 'Joya', 'Sherlock',
]

const CAT_NAMES = [
  'Mistou', 'Minette', 'Felix', 'Mimi', 'Pixel', 'Tigrou', 'Mauve',
  'Olympe', 'Pacha', 'Pixie', 'Sushi', 'Mocha', 'Yuki', 'Kira',
  'Toffee', 'Noisette', 'Maki', 'Tigre', 'Pelote', 'Mistigri',
]

const NAC_NAMES = [
  'Patate', 'Coquillette', 'Ravioli', 'Cacahuète', 'Marshmallow',
  'Brioche', 'Cannelle', 'Crouton', 'Moustache', 'Pompette',
]

function hashStringToInt(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0
  }
  return Math.abs(h)
}

/**
 * Pioche un nom adapté à l'espèce. Le choix est déterministe pour un
 * `seed` donné (= ticket id) — donc rejouer la création donne le même nom.
 */
export function pickAnimalName(species: string | null, seed: string): string {
  let pool: string[]
  if (species === 'dog') {
    pool = [...DOG_NAMES, ...SHARED_NAMES]
  } else if (species === 'cat') {
    pool = [...CAT_NAMES, ...SHARED_NAMES]
  } else {
    pool = [...NAC_NAMES, ...SHARED_NAMES]
  }
  const unique = Array.from(new Set(pool))
  const idx = hashStringToInt(seed) % unique.length
  return unique[idx]
}
