import type { Catalog } from './catalog.ts'
import { agreger, allModifiers, cibleCoutSort, MAX_FOI, SEUIL_COMBUSTION } from './modifiers.ts'
import type { Character, Portee, Sort } from './types.ts'

// ---------------------------------------------------------------------------
// Arcane
// ---------------------------------------------------------------------------

export interface ResultatArcane {
  de: number
  /** Décision retenue avec la MJ : les Points d'Énergie valent le résultat du d6. */
  pointsEnergie: number
  /**
   * Le cristal s'épuise sur 1 **et** 2.
   * Le texte du PDF fait foi sur la table (qui ne colorait que le 1).
   */
  cristalEpuise: boolean
  /** Sur un 6 : la magie devient incontrôlable, on tire l'Effet Aléatoire (2d4). */
  effetAleatoire: boolean
}

export function resoudreArcane(de: number): ResultatArcane {
  return {
    de,
    pointsEnergie: de,
    cristalEpuise: de <= 2,
    effetAleatoire: de === 6,
  }
}

/** Coûts additionnels en Points d'Énergie (Rules_For_Agents.pdf, « Effets supplémentaires »). */
export const COUT_CIBLES = { une: 0, 'par-cible-supplementaire': 1, 'petite-zone': 2, 'grande-zone': 3 } as const
export const COUT_PORTEE: Record<Portee, number> = { proche: 0, moyenne: 0, distante: 1 }
export const COUT_DUREE = { instantanee: 0, minute: 1, heure: 2 } as const
export const COUT_DISCRETION = { visible: 0, detectable: 1, invisible: 2 } as const

export interface OptionsSort {
  ciblesSupplementaires?: number
  zone?: 'petite' | 'grande' | null
  portee?: Portee
  duree?: keyof typeof COUT_DUREE
  discretion?: keyof typeof COUT_DISCRETION
}

export function coutAdditionnel(o: OptionsSort): number {
  let total = 0
  if (o.zone === 'petite') total += COUT_CIBLES['petite-zone']
  else if (o.zone === 'grande') total += COUT_CIBLES['grande-zone']
  else total += (o.ciblesSupplementaires ?? 0) * COUT_CIBLES['par-cible-supplementaire']
  total += COUT_PORTEE[o.portee ?? 'proche']
  total += COUT_DUREE[o.duree ?? 'instantanee']
  total += COUT_DISCRETION[o.discretion ?? 'visible']
  return total
}

// ---------------------------------------------------------------------------
// Miracle — Points de Foi
// ---------------------------------------------------------------------------

/**
 * Coût réel d'un sort en Points de Foi, modificateurs compris.
 *
 * Renvoie `null` si le sort ne se paie pas en Foi. C'est ici que le passif
 * Conteur du Trickster s'applique : « Word: Crackers » passe de 2 à 1.
 */
export function coutFoiEffectif(
  sort: Sort,
  char: Character,
  catalog: Catalog,
  variable = 0,
): number | null {
  let base: number
  if (sort.cout.kind === 'foi') base = sort.cout.valeur
  else if (sort.cout.kind === 'foi-plus-variable') base = sort.cout.base + variable
  else return null

  const { bonus } = agreger(allModifiers(char, catalog), (m) => cibleCoutSort(m.target, sort))
  return Math.max(0, base + bonus)
}

export function peutPayerFoi(char: Character, cout: number): boolean {
  return char.foi >= cout
}

export function ajusterFoi(char: Character, delta: number): number {
  return Math.max(0, Math.min(MAX_FOI, char.foi + delta))
}

/** Gains de Points de Foi disponibles à la phase Grimoire du Feu de Camp. */
export const GAINS_FOI = [
  {
    id: 'recueillir',
    gain: 2,
    nom: 'Recueillir',
    description:
      "Se recueillir dans un lieu de culte et écrire 2 à 3 phrases sur une thématique tirée au hasard.",
    premierCampDuJour: true,
    unParSession: true,
  },
  {
    id: 'purifier',
    gain: 2,
    nom: 'Purifier',
    description: "Rendre à la Lumière un lieu ou un être corrompu par l'Oblivion. Accordé par la MJ.",
    premierCampDuJour: false,
    unParSession: false,
  },
  {
    id: 'fardeau',
    gain: 3,
    nom: 'Fardeau',
    description:
      "Prendre un désavantage sur une compétence pour la journée, ou un Point de Fatigue à la place d'une autre PJ.",
    premierCampDuJour: false,
    unParSession: true,
  },
  {
    id: 'serment',
    gain: 4,
    nom: 'Serment',
    description:
      'Une compétence est tirée au sort ; toutes les autres subissent -4 jusqu\'à la fin de la journée.',
    premierCampDuJour: true,
    unParSession: true,
  },
] as const

export type IdGainFoi = (typeof GAINS_FOI)[number]['id']

// ---------------------------------------------------------------------------
// Magie du Sang — Brûlures et Combustion
// ---------------------------------------------------------------------------

/**
 * Hook Overheat du Dusk Hunter : « à chaque fois qu'une source devrait générer
 * X brûlures, elle en génère X+1 à la place ».
 *
 * Ce n'est pas un modificateur de statistique mais une transformation du gain,
 * d'où son traitement à part du moteur de modificateurs.
 */
export function gainBrulureEffectif(char: Character, gainBrut: number): number {
  if (gainBrut <= 0) return gainBrut
  return char.passifs.hexcore === 'overheat' ? gainBrut + 1 : gainBrut
}

export interface ResultatBrulures {
  gainBrut: number
  gainEffectif: number
  brulures: number
  /** Le seuil de 9 a été franchi : 1 Point de Fatigue et remise à zéro. */
  combustion: boolean
  fatigueAjoutee: number
}

/**
 * Applique un gain de brûlures.
 *
 * « Une fois arrivée au seuil maximal de brûlure, établi à 9, le joueur doit
 * prendre un Point de Fatigue. Son nombre de brûlures est ensuite remis à zéro. »
 * Le dépassement est perdu, conformément à « remis à zéro ».
 */
export function appliquerGainBrulures(char: Character, gainBrut: number): ResultatBrulures {
  const gainEffectif = gainBrulureEffectif(char, gainBrut)
  const cumul = char.brulures + gainEffectif
  const franchit = char.brulures < SEUIL_COMBUSTION && cumul >= SEUIL_COMBUSTION
  return {
    gainBrut,
    gainEffectif,
    brulures: franchit ? 0 : Math.max(0, Math.min(SEUIL_COMBUSTION, cumul)),
    combustion: franchit,
    fatigueAjoutee: franchit ? 1 : 0,
  }
}

/**
 * Combustion volontaire : la joueuse paie 1 Point de Fatigue pour atteindre
 * instantanément 9 brûlures — et les garde, sinon la manœuvre n'aurait aucun
 * intérêt. C'est ce qui la distingue du franchissement passif du seuil, qui lui
 * remet le compteur à zéro.
 */
export function combustionVolontaire(): { brulures: number; fatigueAjoutee: number } {
  return { brulures: SEUIL_COMBUSTION, fatigueAjoutee: 1 }
}

/** Dépenser des brûlures : soit un sort de Sang de rang N, soit +1 par brûlure à un jet. */
export function depenserBrulures(char: Character, nombre: number): number {
  if (nombre < 0 || nombre > char.brulures) {
    throw new Error(`Impossible de dépenser ${nombre} brûlures (disponibles : ${char.brulures})`)
  }
  return char.brulures - nombre
}

/** Le rang du sort de Magie du Sang lancé correspond au nombre de brûlures dépensées. */
export function rangSortSang(bruluresDepensees: number): number {
  return bruluresDepensees
}

// ---------------------------------------------------------------------------
// Disponibilité d'un sort
// ---------------------------------------------------------------------------

/**
 * Un sort utilisable sans occuper un des 3 emplacements du Grimoire.
 *
 * Aujourd'hui, seules les illusions du Trickster ayant choisi la voie
 * Illusionniste entrent dans ce cas : elles sont disponibles en permanence,
 * échappent à la sélection du Feu de Camp, et toute illusion acquise plus tard
 * le sera de la même façon — sans code supplémentaire.
 */
export function estHorsEmplacement(sort: Sort, char: Character): boolean {
  return sort.illusion === true && char.passifs.voieTrickster === 'illusionniste'
}

/**
 * Le Grimoire tel qu'il s'affiche : les sorts préparés au Feu de Camp, suivis
 * de ceux qui sont disponibles en permanence.
 */
export function grimoireEffectif(
  char: Character,
  catalog: Catalog,
): { sort: Sort; horsEmplacement: boolean }[] {
  const prepares = char.grimoire
    .map((id) => catalog.sort(id))
    .filter((s): s is Sort => Boolean(s))
    .map((sort) => ({ sort, horsEmplacement: false }))

  const permanents = char.possede.sorts
    .map((id) => catalog.sort(id))
    .filter((s): s is Sort => Boolean(s) && estHorsEmplacement(s as Sort, char))
    // Une illusion préparée par erreur ne doit pas apparaître deux fois.
    .filter((s) => !char.grimoire.includes((s as Sort).id))
    .map((sort) => ({ sort: sort as Sort, horsEmplacement: true }))

  return [...prepares, ...permanents]
}

export type RaisonIndisponible = 'hors-grimoire' | 'cristal-epuise' | 'foi-insuffisante' | 'brulures-insuffisantes'

/**
 * Un sort est lançable s'il est dans les 3 slots du Grimoire (les illusions
 * d'Illusionniste font exception), si son cristal n'est pas épuisé, et si la
 * joueuse peut en payer le coût.
 */
export function disponibiliteSort(
  sort: Sort,
  char: Character,
  catalog: Catalog,
): { disponible: boolean; raisons: RaisonIndisponible[] } {
  const raisons: RaisonIndisponible[] = []

  if (!estHorsEmplacement(sort, char) && !char.grimoire.includes(sort.id)) raisons.push('hors-grimoire')
  if (char.sortsEpuises.includes(sort.id)) raisons.push('cristal-epuise')

  const coutFoi = coutFoiEffectif(sort, char, catalog)
  if (coutFoi !== null && char.foi < coutFoi) raisons.push('foi-insuffisante')

  if (sort.cout.kind === 'brulures' && char.brulures < sort.cout.valeur) {
    raisons.push('brulures-insuffisantes')
  }
  if (sort.cout.kind === 'brulures-variable' && char.brulures < 1) {
    raisons.push('brulures-insuffisantes')
  }

  return { disponible: raisons.length === 0, raisons }
}
