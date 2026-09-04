import type { Catalog } from './catalog.ts'
import { decrireCout, montantPart, peutPayer } from './couts.ts'
import { MAX_FOI } from './modifiers.ts'
import { aRetenu } from './passifs.ts'
import { LIBELLE_MAGIE, type Character, type Magie, type Portee, type Sort } from './types.ts'

/*
 * La mécanique des brûlures vit dans `brulures.ts` — `couts.ts` en a besoin
 * pour dépenser une brûlure, et l'y laisser aurait fermé un cycle d'imports.
 * Ré-exportée ici : `magie.ts` reste le point d'entrée naturel de la Magie du
 * Sang, et aucun site d'appel n'a eu à changer.
 */
export {
  appliquerGainBrulures,
  basculerCaseBrulure,
  bruluresDisponibles,
  combustionVolontaire,
  consommerBrulures,
  etatCaseBrulure,
  gainBrulureEffectif,
  rangSortSang,
  type EtatCaseBrulure,
  type ResultatBrulures,
  type ResultatConsommation,
} from './brulures.ts'

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
 *
 * Depuis l'unification des coûts, ce n'est plus qu'une lecture spécialisée d'un
 * `Cout` générique : la somme des parts libellées en Foi de la première
 * branche. Conservée parce que trois écrans et la Foi de la joueuse raisonnent
 * encore en Points de Foi, et parce qu'elle porte les tests de non-régression
 * du passif Conteur.
 */
export function coutFoiEffectif(
  sort: Sort,
  char: Character,
  catalog: Catalog,
  variable = 0,
): number | null {
  const branche = sort.cout.branches[0]
  if (!branche) return null

  const enFoi = branche.parts.filter(
    (p) => p.kind !== 'narratif' && p.element.kind === 'foi',
  )
  if (enFoi.length === 0) return null

  return enFoi.reduce((total, p) => total + montantPart(p, variable, char, catalog, sort), 0)
}

/**
 * Le coût d'un sort en toutes lettres.
 *
 * Les coûts variables s'écrivent « X » : c'est la joueuse qui décide combien
 * elle dépense au moment de lancer, et l'effet en dépend. Les branches se
 * lisent « ou » — « 2 Foi ou 10 Lumens ».
 */
export function decrireCoutSort(sort: Sort, char?: Character, catalog?: Catalog): string {
  return decrireCout(sort.cout, char, catalog, sort)
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
  const cout = decrireCoutSort(sort, char, catalog)
  return [libelleMagie(sort.magieId, catalog), cout, sort.de, sort.duree].filter(Boolean).join(' · ')
}

/**
 * Le nom d'un type magique.
 *
 * ⚠️ **Trois replis, et chacun couvre un moment réel.** Le catalogue d'abord —
 * c'est la source de vérité. Puis les trois noms d'origine, pour la fenêtre
 * pendant laquelle une table déjà en service n'a pas encore reçu les entrées
 * semées : l'amorçage ne tourne qu'à la connexion de la MJ, et une joueuse
 * arrivée avant elle ne doit pas voir ses sorts perdre leur école. L'identifiant
 * brut en dernier, qui reste lisible.
 */
export function libelleMagie(magieId: string, catalog: Catalog): string {
  const type = catalog.typeMagique(magieId)
  if (type) return type.nom
  return LIBELLE_MAGIE[magieId as Magie] ?? magieId
}

/**
 * Les sorts de ce type consomment-ils un cristal, épuisable jusqu'au camp ?
 *
 * L'Arcane par défaut, tant que le catalogue n'a pas répondu — c'était la
 * mécanique câblée avant que les types magiques ne deviennent du contenu.
 */
export function sortAUnCristal(sort: Sort, catalog: Catalog): boolean {
  const type = catalog.typeMagique(sort.magieId)
  return type ? type.cristal === true : sort.magieId === 'arcane'
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
// Disponibilité d'un sort
// ---------------------------------------------------------------------------

/**
 * Un sort utilisable sans occuper un des 3 emplacements du Grimoire.
 *
 * Aujourd'hui, seules les illusions du Trickster ayant choisi la voie
 * Illusionniste entrent dans ce cas.
 */
export function estHorsEmplacement(sort: Sort, char: Character, catalog: Catalog): boolean {
  return sort.requiertPassif !== undefined && aRetenu(char, catalog, sort.requiertPassif)
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
  return catalog
    .sorts()
    .filter((s) => estHorsEmplacement(s, char, catalog) && sortOuvertA(s, char.classeId))
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

export type RaisonIndisponible =
  | 'hors-grimoire'
  | 'cristal-epuise'
  /**
   * Aucune branche du coût n'est payable. Les deux anciennes raisons
   * (`foi-insuffisante`, `brulures-insuffisantes`) fusionnent ici : avec un
   * coût qui admet un « OU », ce n'est plus telle monnaie qui manque mais
   * l'ensemble des façons de payer qui est fermé. Le détail se lit dans
   * `decrireCoutSort`, qui dit ce qu'il aurait fallu.
   */
  | 'cout-impayable'

/**
 * Un sort est lançable s'il est dans les 3 slots du Grimoire (les illusions
 * d'Illusionniste font exception), si son cristal n'est pas épuisé, et si la
 * joueuse peut en payer au moins une branche du coût.
 *
 * `x` est la valeur envisagée pour un coût variable : à zéro, un sort en « X
 * brûlures » reste disponible dès qu'il en reste une, puisque `min` borne le
 * minimum exigible.
 */
export function disponibiliteSort(
  sort: Sort,
  char: Character,
  catalog: Catalog,
  x = 0,
): { disponible: boolean; raisons: RaisonIndisponible[] } {
  const raisons: RaisonIndisponible[] = []

  if (!estHorsEmplacement(sort, char, catalog) && !char.grimoire.includes(sort.id))
    raisons.push('hors-grimoire')
  if (char.sortsEpuises.includes(sort.id)) raisons.push('cristal-epuise')

  // `peutPayer` interroge le registre des paiements, qui sait déjà que les
  // brûlures se dépensent sur la part non consommée et la Fatigue sur les cases
  // restantes : aucune de ces règles n'a plus à être répétée ici.
  if (!peutPayer(char, catalog, sort.cout, x, sort)) raisons.push('cout-impayable')

  return { disponible: raisons.length === 0, raisons }
}
