import type { Catalog } from './catalog.ts'
import { agreger, allModifiers, cibleCoutSort, MAX_FOI, SEUIL_COMBUSTION } from './modifiers.ts'
import { LIBELLE_MAGIE, type Character, type Portee, type Sort } from './types.ts'

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

/**
 * Le coût d'un sort en toutes lettres.
 *
 * Les coûts variables s'écrivent « X » : c'est la joueuse qui décide combien
 * elle dépense au moment de lancer, et l'effet en dépend.
 */
export function decrireCoutSort(sort: Sort, coutFoi: number | null): string {
  switch (sort.cout.kind) {
    case 'aucun':
      return 'sans coût'
    case 'foi':
    case 'foi-plus-variable':
      return `${coutFoi ?? '?'} Foi${sort.cout.kind === 'foi-plus-variable' ? ' + X' : ''}`
    case 'brulures':
      return `${sort.cout.valeur} brûlure(s)`
    case 'brulures-variable':
      return 'X brûlures'
    case 'marques-variable':
      return `X Marques (max ${sort.cout.max})`
  }
}

/**
 * La mini-ligne qui résume un sort : « Sang · X brûlures · Instantané ».
 *
 * Un seul endroit pour les quatre écrans qui l'affichent — fiche, sac à dos,
 * phase Grimoire du camp et inventaire de la MJ. Trois d'entre eux omettaient
 * le coût, si bien qu'on ne pouvait pas choisir son Grimoire en connaissance
 * de cause.
 */
export function resumeSort(sort: Sort, char: Character, catalog: Catalog): string {
  const cout = decrireCoutSort(sort, coutFoiEffectif(sort, char, catalog))
  return [LIBELLE_MAGIE[sort.magie], cout, sort.de, sort.duree].filter(Boolean).join(' · ')
}

/**
 * Les classes autorisées à lancer un sort.
 *
 * Absorbe l'ancien champ `classeId`, au singulier : le catalogue de la table
 * contient des sorts saisis sous cette forme, et l'amorçage n'écrase jamais
 * l'existant. Une liste vide signifie « ouvert à toutes les classes ».
 */
export function classesDuSort(sort: Sort): string[] {
  if (sort.classesIds?.length) return sort.classesIds
  return sort.classeId ? [sort.classeId] : []
}

/** Vrai si cette classe peut lancer le sort. Un sort sans classe est ouvert à toutes. */
export function sortOuvertA(sort: Sort, classeId: string): boolean {
  const classes = classesDuSort(sort)
  return classes.length === 0 || classes.includes(classeId)
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

/**
 * Ce qui reste dépensable.
 *
 * Les brûlures acquises ne disparaissent pas quand on les dépense — la marque
 * reste sur la peau, et c'est elle qui porte les paliers de la Voie de la
 * Flamme. Seule la part **consommée** cesse d'être utilisable.
 */
export function bruluresDisponibles(char: Character): number {
  return Math.max(0, char.brulures - char.bruluresConsommees)
}

export interface ResultatBrulures {
  gainBrut: number
  gainEffectif: number
  /** Brûlures acquises après le gain, plafonnées à 9. */
  brulures: number
}

/**
 * Applique un gain de brûlures.
 *
 * Le gain n'a **jamais** déclenché la Combustion : c'est la neuvième brûlure
 * *consommée* qui la provoque (voir `consommerBrulures`). Gagner au-delà de 9
 * ne fait rien de plus — le surplus est perdu.
 */
export function appliquerGainBrulures(char: Character, gainBrut: number): ResultatBrulures {
  const gainEffectif = gainBrulureEffectif(char, gainBrut)
  return {
    gainBrut,
    gainEffectif,
    brulures: Math.min(SEUIL_COMBUSTION, char.brulures + gainEffectif),
  }
}

export interface ResultatConsommation {
  brulures: number
  bruluresConsommees: number
  /** La neuvième brûlure a été consommée : 1 Point de Fatigue, tout repart à zéro. */
  combustion: boolean
  fatigueAjoutee: number
}

/**
 * Dépenser des brûlures : soit un sort de Sang de rang N, soit +1 par brûlure
 * à un jet.
 *
 * « Une fois arrivée au seuil maximal de brûlure, établi à 9, le joueur doit
 * prendre un Point de Fatigue. Son nombre de brûlures est ensuite remis à
 * zéro. » Ce seuil se compte sur les brûlures **consommées** : accumuler neuf
 * marques sans en dépenser aucune ne brûle personne.
 */
export function consommerBrulures(char: Character, nombre: number): ResultatConsommation {
  const dispo = bruluresDisponibles(char)
  if (nombre < 0 || nombre > dispo) {
    throw new Error(`Impossible de dépenser ${nombre} brûlure(s) (disponibles : ${dispo})`)
  }

  const consommees = char.bruluresConsommees + nombre
  const combustion = consommees >= SEUIL_COMBUSTION

  return {
    brulures: combustion ? 0 : char.brulures,
    bruluresConsommees: combustion ? 0 : consommees,
    combustion,
    fatigueAjoutee: combustion ? 1 : 0,
  }
}

export type EtatCaseBrulure = 'vierge' | 'disponible' | 'consommee'

/** L'état d'une case de la barre de brûlures. Les deux compteurs sont des préfixes. */
export function etatCaseBrulure(char: Character, index: number): EtatCaseBrulure {
  if (index < char.bruluresConsommees) return 'consommee'
  if (index < char.brulures) return 'disponible'
  return 'vierge'
}

/**
 * Fait tourner une case de la barre : vierge → disponible → consommée → vierge.
 *
 * C'est le geste le plus direct à table — on marque ce qu'on vient de tirer,
 * puis ce qu'on vient de dépenser, sur la même case. Les deux compteurs restant
 * des préfixes, retirer une case retire aussi tout ce qui la suit : une barre
 * trouée n'aurait pas de sens.
 */
export function basculerCaseBrulure(char: Character, index: number): ResultatConsommation {
  const inchange = {
    brulures: char.brulures,
    bruluresConsommees: char.bruluresConsommees,
    combustion: false,
    fatigueAjoutee: 0,
  }

  switch (etatCaseBrulure(char, index)) {
    case 'vierge':
      return { ...inchange, brulures: Math.min(SEUIL_COMBUSTION, index + 1) }
    case 'disponible':
      // Passe par la consommation : c'est elle qui sait reconnaître la neuvième.
      return consommerBrulures(char, index + 1 - char.bruluresConsommees)
    case 'consommee':
      return { ...inchange, brulures: index, bruluresConsommees: index }
  }
}

/**
 * Combustion volontaire : la joueuse paie 1 Point de Fatigue pour disposer
 * instantanément des neuf brûlures — et elles sont **toutes dépensables**,
 * sinon la manœuvre n'aurait aucun intérêt.
 */
export function combustionVolontaire(): {
  brulures: number
  bruluresConsommees: number
  fatigueAjoutee: number
} {
  return { brulures: SEUIL_COMBUSTION, bruluresConsommees: 0, fatigueAjoutee: 1 }
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
 * Illusionniste entrent dans ce cas.
 */
export function estHorsEmplacement(sort: Sort, char: Character): boolean {
  return sort.illusion === true && char.passifs.voieTrickster === 'illusionniste'
}

/**
 * Sorts auxquels un passif donne accès en permanence.
 *
 * ⚠️ Ils sont **dérivés du catalogue**, pas lus dans l'inventaire du
 * personnage. C'est ce que dit la règle : le passif Illusionniste « donne accès
 * à » ces sorts, il ne les fait pas posséder. Trois conséquences voulues :
 *
 *  - une illusion ajoutée au catalogue devient aussitôt disponible pour toutes
 *    les Illusionnistes, y compris les personnages déjà créés ;
 *  - un Détachement ne peut pas les faire perdre — ce ne sont pas des biens ;
 *  - changer de voie au Feu de Camp les retire d'un coup, sans rien à nettoyer.
 */
export function sortsHorsEmplacement(char: Character, catalog: Catalog): Sort[] {
  if (char.passifs.voieTrickster !== 'illusionniste') return []
  return catalog.sorts().filter((s) => s.illusion === true && sortOuvertA(s, char.classeId))
}

/**
 * Le Grimoire tel qu'il s'affiche : les sorts préparés au Feu de Camp, suivis
 * de ceux auxquels un passif donne accès en permanence.
 */
export function grimoireEffectif(
  char: Character,
  catalog: Catalog,
): { sort: Sort; horsEmplacement: boolean }[] {
  const prepares = char.grimoire
    .map((id) => catalog.sort(id))
    .filter((s): s is Sort => Boolean(s))
    .map((sort) => ({ sort, horsEmplacement: false }))

  const permanents = sortsHorsEmplacement(char, catalog)
    // Une illusion préparée par erreur ne doit pas apparaître deux fois.
    .filter((s) => !char.grimoire.includes(s.id))
    .map((sort) => ({ sort, horsEmplacement: true }))

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

  // Sur ce qui reste dépensable, pas sur le total acquis : une marque déjà
  // consommée ne paie pas un second sort.
  const brulures = bruluresDisponibles(char)
  if (sort.cout.kind === 'brulures' && brulures < sort.cout.valeur) {
    raisons.push('brulures-insuffisantes')
  }
  if (sort.cout.kind === 'brulures-variable' && brulures < 1) {
    raisons.push('brulures-insuffisantes')
  }

  return { disponible: raisons.length === 0, raisons }
}
