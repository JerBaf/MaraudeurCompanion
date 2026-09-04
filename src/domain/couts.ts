import { bruluresDisponibles, consommerBrulures } from './brulures.ts'
import type { Catalog } from './catalog.ts'
import { actionsRapidesRestantes, computeSixthSens } from './competences.ts'
import { descripteur, type CleElement, type ElementVariable } from './elements.ts'
import { ajusterFatigue, fatigueRestante } from './fatigue.ts'
import { agreger, allModifiers, cibleCoutSort } from './modifiers.ts'
import type { Character, Sort } from './types.ts'

/**
 * Les Coûts.
 *
 * Un coût, c'est la réduction d'un ou plusieurs Éléments Variables. Le modèle
 * tient en trois niveaux, et chacun porte une règle :
 *
 *  - une **part** est ce qu'on prélève sur un élément. Fixe, ou variable — le
 *    fameux « X » que la joueuse choisit au lancement et dont dépend l'effet ;
 *  - une **branche** réunit les parts qu'il faut payer **toutes** ;
 *  - un **coût** réunit les branches, dont il suffit d'en payer **une** : c'est
 *    le « OU » de « 2 Points de Foi OU 10 Lumens ».
 *
 * Un coût sans branche est gratuit.
 *
 * ⚠️ **Ni `Cout` ni `BrancheCout` ne doivent devenir des tableaux nus.**
 * Firestore refuse un tableau dont les éléments sont des tableaux, et le store
 * local — qui sérialise en JSON — l'accepte sans broncher : le bug
 * n'apparaîtrait qu'en production, à la première sauvegarde de la MJ. D'où
 * l'objet enveloppe à chaque niveau.
 */

export type PartCout =
  | { kind: 'fixe'; element: ElementVariable; valeur: number }
  /** Le « X ». `max` borne ce que la joueuse peut choisir de dépenser. */
  | { kind: 'variable'; element: ElementVariable; min?: number; max?: number }
  /** Une contrepartie que l'application ne sait pas prélever : la MJ arbitre. */
  | { kind: 'narratif'; description: string }

export interface BrancheCout {
  parts: PartCout[]
}

export interface Cout {
  branches: BrancheCout[]
}

export const COUT_GRATUIT: Cout = { branches: [] }

/**
 * Les éléments dans lesquels un coût peut se libeller.
 *
 * Aucun ne porte de charge utile, d'où des constructeurs qui prennent la seule
 * clé : `fixe('foi', 3)` plutôt que `{ kind: 'fixe', element: { kind: 'foi' }, valeur: 3 }`.
 */
export type ClePayable =
  | 'lumens'
  | 'foi'
  | 'marques'
  | 'brulures'
  | 'fatigue'
  | 'sixth-sens'
  | 'actions-rapides'

export function fixe(element: ClePayable, valeur: number): PartCout {
  return { kind: 'fixe', element: { kind: element }, valeur }
}

export function variable(element: ClePayable, bornes: { min?: number; max?: number } = {}): PartCout {
  return { kind: 'variable', element: { kind: element }, ...bornes }
}

/** Un coût à branche unique : toutes les parts se paient. */
export function coutDe(...parts: PartCout[]): Cout {
  return { branches: [{ parts }] }
}

/** Un coût à plusieurs branches : « ceci OU cela ». */
export function coutAuChoix(...branches: PartCout[][]): Cout {
  return { branches: branches.map((parts) => ({ parts })) }
}

export function estGratuit(cout: Cout): boolean {
  return cout.branches.length === 0
}

/** La part variable d'une branche, s'il y en a une. Le « X » est unique par branche. */
export function partVariable(branche: BrancheCout): Extract<PartCout, { kind: 'variable' }> | null {
  return branche.parts.find((p) => p.kind === 'variable') ?? null
}

export function coutAUnX(cout: Cout): boolean {
  return cout.branches.some((b) => partVariable(b) !== null)
}

// ---------------------------------------------------------------------------
// Ce qu'on sait prélever
// ---------------------------------------------------------------------------

export interface ResultatPaiement {
  char: Character
  /** Ce que le paiement a entraîné au-delà du prélèvement : Combustion, grille pleine. */
  recits: string[]
}

interface Paiement {
  /**
   * Ce sur quoi un coût peut tirer.
   *
   * ⚠️ Ce n'est **pas** `lireElement` pour deux éléments : la Fatigue se paie
   * en cochant des cases, donc ce qui reste est `max − coches` ; et les
   * brûlures se paient sur la part non encore consommée, pas sur le total
   * acquis — une marque déjà dépensée ne paie pas un second sort.
   */
  disponible(char: Character, catalog: Catalog): number
  /** Prélève `n`, effets de bord compris. L'appelant a vérifié la disponibilité. */
  depenser(char: Character, catalog: Catalog, n: number): ResultatPaiement
}

/**
 * Les Éléments Variables qu'un coût sait prélever.
 *
 * **La présence d'une entrée est la règle** : un coût sur un élément absent de
 * cette table est refusé, et le formulaire de la MJ ne le propose pas. Ajouter
 * une monnaie au jeu, c'est ajouter une ligne ici.
 *
 * Cette table vit dans `couts.ts` et non dans `ELEMENTS_VARIABLES` par
 * contrainte de couche : dépenser une brûlure demande `brulures.ts`, cocher un
 * Point de Fatigue demande `competences.ts` — deux modules qu'`elements.ts`,
 * qui ne dépend de rien, ne peut pas importer.
 */
const PAIEMENTS: Partial<Record<CleElement, Paiement>> = {
  lumens: {
    disponible: (c) => c.lumens,
    depenser: (c, _cat, n) => ({ char: { ...c, lumens: c.lumens - n }, recits: [] }),
  },
  foi: {
    disponible: (c) => c.foi,
    depenser: (c, _cat, n) => ({ char: { ...c, foi: c.foi - n }, recits: [] }),
  },
  marques: {
    disponible: (c) => c.marques,
    depenser: (c, _cat, n) => ({ char: { ...c, marques: c.marques - n }, recits: [] }),
  },
  brulures: {
    disponible: (c) => bruluresDisponibles(c),
    depenser: (c, cat, n) => {
      const r = consommerBrulures(c, n)
      const apres = { ...c, brulures: r.brulures, bruluresConsommees: r.bruluresConsommees }
      if (!r.combustion) return { char: apres, recits: [] }

      // La neuvième brûlure consommée coûte un Point de Fatigue et remet tout à zéro.
      const { char } = ajusterFatigue(apres, cat, r.fatigueAjoutee)
      return { char, recits: ['Combustion — 1 Point de Fatigue, brûlures remises à zéro'] }
    },
  },
  fatigue: {
    // Payer en Fatigue, c'est **cocher** une case : la jauge monte.
    disponible: (c, cat) => fatigueRestante(c, cat),
    depenser: (c, cat, n) => {
      const { char, grillePleine } = ajusterFatigue(c, cat, n)
      return { char, recits: grillePleine ? ['Grille de Fatigue pleine'] : [] }
    },
  },
  'sixth-sens': {
    disponible: (c, cat) => computeSixthSens(c, cat).restants,
    depenser: (c, _cat, n) => ({
      char: { ...c, sixthSensUtilises: c.sixthSensUtilises + n },
      recits: [],
    }),
  },
  'actions-rapides': {
    disponible: (c, cat) => actionsRapidesRestantes(c, cat),
    depenser: (c, _cat, n) => ({
      char: { ...c, actionsRapidesUtilisees: c.actionsRapidesUtilisees + n },
      recits: [],
    }),
  },
}

/** Vrai si un coût peut se libeller dans cet élément. */
export function estPayable(element: ElementVariable): boolean {
  return PAIEMENTS[element.kind] !== undefined
}

/** Les éléments qu'un coût sait prélever, pour les formulaires de la MJ. */
export const ELEMENTS_PAYABLES = Object.keys(PAIEMENTS) as CleElement[]

/** Ce dont la joueuse dispose pour payer dans cet élément. */
export function disponiblePour(
  char: Character,
  catalog: Catalog,
  element: ElementVariable,
): number {
  return PAIEMENTS[element.kind]?.disponible(char, catalog) ?? 0
}

// ---------------------------------------------------------------------------
// Montants
// ---------------------------------------------------------------------------

/**
 * Le montant d'une part, modificateurs compris.
 *
 * `sort` permet aux modificateurs de `cout-sort` de s'appliquer — c'est là que
 * le passif Conteur du Trickster fait passer « Word: Crackers » de 2 à 1. Le
 * filtre porte l'élément visé : un rabais sur la Foi ne réduit pas un coût en
 * brûlures. Jamais négatif : un rabais ne rapporte pas.
 */
export function montantPart(
  part: PartCout,
  x: number,
  char?: Character,
  catalog?: Catalog,
  sort?: Sort,
): number {
  if (part.kind === 'narratif') return 0

  const brut = part.kind === 'fixe' ? part.valeur : bornerX(part, x)
  if (!char || !catalog || !sort) return Math.max(0, brut)

  const { bonus } = agreger(allModifiers(char, catalog), (m) =>
    cibleCoutSort(m.target, sort, part.element.kind),
  )
  return Math.max(0, brut + bonus)
}

/** Borne le X choisi par la joueuse aux limites que la part déclare. */
export function bornerX(part: Extract<PartCout, { kind: 'variable' }>, x: number): number {
  const min = part.min ?? 0
  const max = part.max ?? Number.POSITIVE_INFINITY
  return Math.max(min, Math.min(max, x))
}

// ---------------------------------------------------------------------------
// Payer
// ---------------------------------------------------------------------------

export interface ChoixPaiement {
  /** Index de la branche retenue dans `cout.branches`. */
  branche: number
  /** La valeur choisie pour le « X », si la branche en comporte un. */
  x?: number
}

/** Vrai si cette branche est payable en l'état. */
export function peutPayerBranche(
  char: Character,
  catalog: Catalog,
  branche: BrancheCout,
  x = 0,
  sort?: Sort,
): boolean {
  return branche.parts.every((part) => {
    if (part.kind === 'narratif') return true
    if (!estPayable(part.element)) return false
    // Un X à zéro ne paie rien : la branche reste ouverte, la joueuse choisira.
    const montant = montantPart(part, x, char, catalog, sort)
    return disponiblePour(char, catalog, part.element) >= montant
  })
}

/** Les index des branches que la joueuse peut payer. Un coût gratuit n'en a aucune. */
export function branchesPayables(
  char: Character,
  catalog: Catalog,
  cout: Cout,
  x = 0,
  sort?: Sort,
): number[] {
  return cout.branches
    .map((b, i) => (peutPayerBranche(char, catalog, b, x, sort) ? i : -1))
    .filter((i) => i >= 0)
}

/** Vrai si le coût est gratuit, ou si au moins une branche est payable. */
export function peutPayer(
  char: Character,
  catalog: Catalog,
  cout: Cout,
  x = 0,
  sort?: Sort,
): boolean {
  return estGratuit(cout) || branchesPayables(char, catalog, cout, x, sort).length > 0
}

/**
 * Prélève le coût.
 *
 * Un seul point de passage pour les sorts, les objets à effets actifs et les
 * recharges : le jour où une monnaie change de règle, elle change ici.
 */
export function payerCout(
  char: Character,
  catalog: Catalog,
  cout: Cout,
  choix: ChoixPaiement = { branche: 0 },
  sort?: Sort,
): ResultatPaiement {
  if (estGratuit(cout)) return { char, recits: [] }

  const branche = cout.branches[choix.branche]
  if (!branche) throw new Error(`Branche de coût inconnue : ${choix.branche}`)

  const x = choix.x ?? 0
  if (!peutPayerBranche(char, catalog, branche, x, sort)) {
    throw new Error(`Coût impayable : ${decrireBranche(branche)}`)
  }

  let courant = char
  const recits: string[] = []

  for (const part of branche.parts) {
    if (part.kind === 'narratif') continue
    // Le montant se calcule sur la fiche **de départ** : deux parts d'une même
    // branche se paient au tarif annoncé, sans que la première ne change la seconde.
    const montant = montantPart(part, x, char, catalog, sort)
    if (montant <= 0) continue

    const r = PAIEMENTS[part.element.kind]?.depenser(courant, catalog, montant)
    if (!r) throw new Error(`« ${descripteur(part.element).libelle} » ne se dépense pas.`)
    courant = r.char
    recits.push(...r.recits)
  }

  return { char: courant, recits }
}

// ---------------------------------------------------------------------------
// Description
// ---------------------------------------------------------------------------

/**
 * Le nom court d'un élément dans un coût : « 2 Foi » se lit mieux que
 * « 2 Points de Foi » sur la ligne d'un sort, où la place manque.
 */
const LIBELLE_COURT: Partial<Record<CleElement, string>> = {
  foi: 'Foi',
  brulures: 'brûlures',
  marques: 'Marques',
  lumens: 'Lumens',
  fatigue: 'Fatigue',
  'sixth-sens': '6th Sens',
  'actions-rapides': 'Actions Rapides',
}

function libelleCourt(element: ElementVariable): string {
  return LIBELLE_COURT[element.kind] ?? descripteur(element).libelle
}

export function decrirePart(part: PartCout, montant?: number): string {
  if (part.kind === 'narratif') return part.description
  if (part.kind === 'fixe') return `${montant ?? part.valeur} ${libelleCourt(part.element)}`

  const borne = part.max !== undefined ? ` (max ${part.max})` : ''
  return `X ${libelleCourt(part.element)}${borne}`
}

export function decrireBranche(branche: BrancheCout): string {
  return branche.parts.map((p) => decrirePart(p)).join(' + ')
}

/**
 * Le coût en toutes lettres : « 2 Foi ou 10 Lumens ».
 *
 * `char`/`catalog`/`sort` sont facultatifs ; fournis, les montants affichés
 * tiennent compte des modificateurs — un Conteur lit « 1 Foi » là où une autre
 * lit « 2 Foi ».
 */
export function decrireCout(
  cout: Cout,
  char?: Character,
  catalog?: Catalog,
  sort?: Sort,
): string {
  if (estGratuit(cout)) return 'sans coût'

  return cout.branches
    .map((branche) =>
      branche.parts
        .map((part) =>
          decrirePart(
            part,
            part.kind === 'fixe' ? montantPart(part, 0, char, catalog, sort) : undefined,
          ),
        )
        .join(' + '),
    )
    .join(' ou ')
}
