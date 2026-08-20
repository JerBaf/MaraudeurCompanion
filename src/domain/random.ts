/**
 * Tous les tirages de l'app passent par ici.
 *
 * L'aléatoire est injecté plutôt qu'appelé directement : c'est ce qui rend
 * testables le Détachement, les risques d'investissement et le tirage des cycles.
 * En production on utilise `cryptoRng` ; dans les tests, `seededRng` donne une
 * suite reproductible.
 */

export interface Rng {
  /** Entier dans [min, max], bornes incluses. */
  int(min: number, max: number): number
  /** Un élément au hasard. Lève si la liste est vide. */
  pick<T>(items: readonly T[]): T
  /** true avec la probabilité donnée (0 à 1). */
  chance(probability: number): boolean
  /** Lance `count` dés à `faces` faces et renvoie chaque résultat. */
  roll(count: number, faces: number): number[]
}

function makeRng(next: () => number): Rng {
  const int = (min: number, max: number): number => {
    if (max < min) throw new Error(`Intervalle invalide : [${min}, ${max}]`)
    return min + Math.floor(next() * (max - min + 1))
  }
  return {
    int,
    pick<T>(items: readonly T[]): T {
      if (items.length === 0) throw new Error('pick() sur une liste vide')
      return items[int(0, items.length - 1)] as T
    },
    chance(probability: number): boolean {
      return next() < probability
    },
    roll(count: number, faces: number): number[] {
      return Array.from({ length: count }, () => int(1, faces))
    },
  }
}

/** Aléatoire de production, adossé à `crypto` quand il est disponible. */
export const cryptoRng: Rng = makeRng(() => {
  const g = globalThis as { crypto?: Crypto }
  if (g.crypto?.getRandomValues) {
    const buf = new Uint32Array(1)
    g.crypto.getRandomValues(buf)
    return (buf[0] as number) / 2 ** 32
  }
  return Math.random()
})

/**
 * Générateur déterministe (mulberry32) pour les tests et les aperçus.
 * Deux appels avec la même graine produisent exactement la même suite.
 */
export function seededRng(seed: number): Rng {
  let state = seed >>> 0
  return makeRng(() => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 2 ** 32
  })
}

// ---------------------------------------------------------------------------
// Tirages propres au jeu
// ---------------------------------------------------------------------------

// Les cycles (1d4+2) ne sont volontairement pas tirés ici : la MJ lance ses dés
// à sa table et saisit la valeur depuis son écran. C'est le seul moyen que le
// nombre ne transite jamais par l'appareil d'une joueuse.

/** Initiative de combat : 1d6. [4-6] joue avant la MJ, [1-3] après. */
export function tirerInitiative(rng: Rng): number {
  return rng.int(1, 6)
}

/**
 * La seule face d'osselet qui ne porte pas de point rouge est le 4 : un 1, un 2
 * et un 3 brûlent chacun. Ne compter que les 1, comme on le faisait, divisait
 * le gain de brûlures par trois.
 */
const FACE_VIERGE = 4

/**
 * Jeu d'osselets de la Magie du Sang (≈ 4d4).
 * Chaque face marquée d'un point rouge apporte une brûlure.
 *
 * Le gain renvoyé est **brut** : les passifs qui le transforment — Overheat, qui
 * ajoute 1 au total — s'appliquent dans `appliquerGainBrulures` (`magie.ts`).
 */
export function tirerOsselets(rng: Rng): { des: number[]; brulures: number } {
  const des = rng.roll(4, 4)
  return { des, brulures: des.filter((d) => d < FACE_VIERGE).length }
}

/**
 * Effet Aléatoire de l'Arcane, déclenché sur un 6.
 * 2d4 : le dé blanc porte la force positive, le noir la négative.
 * Le plus haut donne la puissance et le signe ; un double ajoute une Cicatrice.
 */
export function tirerEffetAleatoire(rng: Rng): {
  blanc: number
  noir: number
  puissance: number
  signe: 'positif' | 'negatif'
  cicatrice: boolean
} {
  const blanc = rng.int(1, 4)
  const noir = rng.int(1, 4)
  return {
    blanc,
    noir,
    puissance: Math.max(blanc, noir),
    signe: blanc >= noir ? 'positif' : 'negatif',
    cicatrice: blanc === noir,
  }
}
