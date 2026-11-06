import type { Catalog } from './catalog.ts'
import { decrireCout, montantPart, peutPayer } from './couts.ts'
import { ajusterFatigue } from './fatigue.ts'
import { MAX_FOI } from './modifiers.ts'
import { aRetenu, regleActive } from './passifs.ts'
import {
  JET_ARCANE,
  LIBELLE_MAGIE,
  type Character,
  type JetMagique,
  type Magie,
  type Portee,
  type Sort,
} from './types.ts'

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

/** Ce que la Combustion raconte à la joueuse. Un seul texte, un seul endroit. */
export const RECIT_COMBUSTION = 'Combustion ! 1 Point de Fatigue, les marques s’effacent.'

/**
 * Reporte sur la fiche ce qu'une consommation de brûlures a produit.
 *
 * `consommerBrulures`, `basculerCaseBrulure` et `combustionVolontaire` rendent
 * toutes le même triplet sans l'appliquer — c'est ce qui les garde pures. Trois
 * écrans faisaient le report à la main, en recopiant chacun le plafonnement de
 * la Fatigue ; le voici une fois, avec le plafond **dérivé** via
 * `ajusterFatigue` plutôt que recalculé sur place.
 *
 * Vit dans `magie.ts` et non dans `brulures.ts` : le plafond de Fatigue demande
 * le catalogue, que `brulures.ts` ignore délibérément pour rester sous
 * `couts.ts` dans l'ordre des couches.
 */
export function appliquerConsommation(
  char: Character,
  catalog: Catalog,
  resultat: { brulures: number; bruluresConsommees: number; fatigueAjoutee: number },
): { char: Character; recit: string | null } {
  const { char: apres } = ajusterFatigue(
    { ...char, brulures: resultat.brulures, bruluresConsommees: resultat.bruluresConsommees },
    catalog,
    resultat.fatigueAjoutee,
  )
  return { char: apres, recit: resultat.fatigueAjoutee > 0 ? RECIT_COMBUSTION : null }
}

// ---------------------------------------------------------------------------
// Le Jet Magique — l'Arcane, et tout type qui porte un jet
// ---------------------------------------------------------------------------

/**
 * La lecture d'un Jet Magique.
 *
 * Générique, et non propre à l'Arcane : tout type magique qui porte un `jet`
 * l'emprunte, comme la mécanique du cristal se lit sur un drapeau plutôt que
 * sur l'identifiant `arcane`. Nommé « Magique » et non « Jet » tout court pour
 * ne pas se confondre avec le Test de Compétence de `jets.ts`.
 */
export interface ResultatJetMagique {
  /** Les dés tels qu'ils sont tombés. */
  des: number[]
  /** Décision retenue avec la MJ : les Points d'Énergie valent le plus haut dé. */
  pointsEnergie: number
  /** Au moins un dé au seuil : c'est l'Effet B du sort qui survient. */
  effetB: boolean
  /**
   * Âme de Géant : sur un Effet B, l'effet du sort est **en outre** décuplé.
   * L'Effet B survient de toute façon — c'est la règle de tous désormais.
   */
  ameDeGeant: boolean
}

/**
 * Le résultat que tient pour acquis une réussite automatique.
 *
 * Décision de la MJ : pas de jet, le sort part comme sur un 5 — la plus haute
 * valeur qui ne fait pas basculer en Effet B.
 */
export const DE_REUSSITE_AUTOMATIQUE = 5

/**
 * Ce que ces dés produisent.
 *
 * `seuilEffetB` absent : le jet ne fait que chiffrer la puissance, et il n'y a
 * pas d'Effet B à déclencher.
 */
export function resoudreJetMagique(
  des: number[],
  jet: JetMagique,
  ameDeGeant = false,
): ResultatJetMagique {
  const seuil = jet.seuilEffetB
  const effetB = seuil !== undefined && des.some((d) => d >= seuil)
  return {
    des,
    pointsEnergie: Math.max(...des),
    effetB,
    ameDeGeant: effetB && ameDeGeant,
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
  // Le dé vient du jet et non de `Sort.de` : celui d'un sort d'Arcane est
  // désormais porté par son type magique, et la ligne le perdrait.
  const de = jetMagiqueDuSort(sort, catalog)?.de
  return [libelleMagie(sort.magieId, catalog), cout, de, sort.duree].filter(Boolean).join(' · ')
}

/** Ce qu'on lit faute d'Effet B écrit : la table a quelque chose à trancher. */
export const EFFET_B_ABSENT = 'Effet B (non renseigné)'

/**
 * L'effet d'un sort tel qu'il se lit en entier, Effet B compris.
 *
 * Un seul endroit pour les écrans qui déplient un sort — Grimoire, sac à dos,
 * phase Grimoire du camp, inventaire de la MJ. Sans Effet B à annoncer, rend le
 * texte seul : un sort qui n'en a pas se lit comme avant.
 */
export function detailSort(sort: Sort, catalog: Catalog): string {
  if (!sortAUnEffetB(sort, catalog)) return sort.effet
  return `${sort.effet}\n\nEffet B — ${sort.effetB ?? EFFET_B_ABSENT}`
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
 * Plus aucun type livré n'en porte : l'Arcane l'a perdu avec la règle des 2d6,
 * et le drapeau n'attend plus qu'un type créé par la MJ. D'où le repli à
 * `false` quand le catalogue n'a pas encore répondu — il valait `true` pour
 * l'Arcane du temps où la mécanique y était câblée.
 */
export function sortAUnCristal(sort: Sort, catalog: Catalog): boolean {
  return catalog.typeMagique(sort.magieId)?.cristal === true
}

/**
 * Le jet que ce sort lance, et ce qu'il décide.
 *
 * Le type magique d'abord — lancer 2d6 et basculer sur un 6 est une règle
 * d'école, que tous ses sorts suivent, y compris ceux qui ne portaient aucun
 * dé. À défaut, le `Sort.de` d'un sort qui porte le sien (le Raging Claw de
 * l'Ombre) : il ne décide alors que de la puissance, sans Effet B.
 *
 * ⚠️ Pour un type à `jet`, `Sort.de` n'est plus lu. C'est ce qui a permis à la
 * règle de changer sans réécrire les quatorze sorts d'Arcane déjà en base.
 *
 * Le repli sur l'Arcane couvre le même moment que celui de `libelleMagie` : une
 * joueuse connectée avant que la MJ n'ait amorcé la table n'y verrait sinon
 * aucun jet là où la règle en demande un.
 */
export function jetMagiqueDuSort(sort: Sort, catalog: Catalog): JetMagique | null {
  const type = catalog.typeMagique(sort.magieId)
  if (type) return type.jet ?? (sort.de ? { de: sort.de } : null)
  if (sort.magieId === 'arcane') return JET_ARCANE
  return sort.de ? { de: sort.de } : null
}

/** Ce sort peut-il basculer en Effet B ? */
export function sortAUnEffetB(sort: Sort, catalog: Catalog): boolean {
  return jetMagiqueDuSort(sort, catalog)?.seuilEffetB !== undefined
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

export function ajusterFoi(char: Character, delta: number): number {
  return Math.max(0, Math.min(MAX_FOI, char.foi + delta))
}

/**
 * Ce que rapporte chaque façon de gagner des Points de Foi, et son nom.
 *
 * Indexé par identifiant plutôt que listé : l'écran du Feu de Camp ne parcourt
 * pas cette table — chaque gain y a son geste propre (une thématique tirée, des
 * boutons de compétence, le choix d'une alliée, une confirmation). Il vient
 * chercher un montant et un nom, et rien d'autre.
 *
 * ⚠️ Les **conditions** ne sont pas ici : « premier camp du jour », « une fois
 * par session » vivent dans `peutRecueillir` / `peutPrendreFardeau` /
 * `peutPrononcerSerment` (`campfire.ts`), qui connaissent le contexte du camp.
 * Les redire ici en aurait fait deux sources.
 *
 * `purifier` n'a pas d'écran : il s'accorde de vive voix par la MJ.
 */
export const GAINS_FOI = {
  recueillir: { gain: 2, nom: 'Recueillir' },
  purifier: { gain: 2, nom: 'Purifier' },
  fardeau: { gain: 3, nom: 'Fardeau' },
  serment: { gain: 4, nom: 'Serment' },
} as const

export type IdGainFoi = keyof typeof GAINS_FOI

// ---------------------------------------------------------------------------
// Disponibilité d'un sort
// ---------------------------------------------------------------------------

/**
 * Un sort utilisable sans occuper un des 3 emplacements du Grimoire : tout sort
 * qu'une option retenue débloque — les illusions de l'Illusionniste, Amaterasu,
 * les sorts de l'état Ombre.
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
  /** Une règle ferme le Grimoire — l'état Ombre de l'Eclipsed. */
  | 'suspendu'

/**
 * Un sort est lançable s'il est dans les 3 slots du Grimoire (les illusions
 * d'Illusionniste font exception), si son cristal n'est pas épuisé, et si la
 * joueuse peut en payer au moins une branche du coût. Une règle
 * `sorts-suspendus` ferme le Grimoire : seuls restent alors les sorts qu'une
 * option débloque.
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
  const horsEmplacement = estHorsEmplacement(sort, char, catalog)

  if (!horsEmplacement && !char.grimoire.includes(sort.id)) raisons.push('hors-grimoire')
  if (!horsEmplacement && regleActive(char, catalog, 'sorts-suspendus')) raisons.push('suspendu')
  if (char.sortsEpuises.includes(sort.id)) raisons.push('cristal-epuise')

  // `peutPayer` interroge le registre des paiements, qui sait déjà que les
  // brûlures se dépensent sur la part non consommée et la Fatigue sur les cases
  // restantes : aucune de ces règles n'a plus à être répétée ici.
  if (!peutPayer(char, catalog, sort.cout, x, sort)) raisons.push('cout-impayable')

  return { disponible: raisons.length === 0, raisons }
}
