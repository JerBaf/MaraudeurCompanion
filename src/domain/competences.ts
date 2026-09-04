import type { Catalog } from './catalog.ts'
import {
  cibleCompetence,
  cibleElement,
  descripteur,
  type ElementVariable,
} from './elements.ts'
import { agreger, allModifiers, netAvantage, type Agregat } from './modifiers.ts'
import { COMPETENCES, type Character, type Competence } from './types.ts'

/** Valeur affichée d'une compétence, avec de quoi expliquer d'où elle vient. */
export interface ValeurCompetence {
  competence: Competence
  /** Maîtrise du personnage. */
  base: number
  /** Somme des modificateurs additifs. */
  bonus: number
  total: number
  net: 'avantage' | 'desavantage' | 'neutre'
  agregat: Agregat
}

export function computeCompetence(
  char: Character,
  catalog: Catalog,
  competence: Competence,
): ValeurCompetence {
  const mods = allModifiers(char, catalog)
  const agregat = agreger(mods, (m) => cibleCompetence(m.target, competence))
  const base = char.maitrises[competence]
  return {
    competence,
    base,
    bonus: agregat.bonus,
    total: base + agregat.bonus,
    net: netAvantage(agregat),
    agregat,
  }
}

export function computeToutesCompetences(
  char: Character,
  catalog: Catalog,
): Record<Competence, ValeurCompetence> {
  const out = {} as Record<Competence, ValeurCompetence>
  for (const c of COMPETENCES) out[c] = computeCompetence(char, catalog, c)
  return out
}

/**
 * Actions Rapides disponibles par jour.
 *
 * Rules_For_Agents.pdf : « 1 si la maîtrise de physique est -3 ou 0 ; 2 si +3 ».
 * On applique le seuil sur la valeur **effective** (maîtrise + modificateurs)
 * plutôt que sur la maîtrise brute, pour rester cohérent avec l'exigence de
 * modificateurs dynamiques : un Serment qui écrase le Physique retire aussi
 * l'Action Rapide supplémentaire.
 */
export function actionsRapidesMax(char: Character, catalog: Catalog): number {
  return computeCompetence(char, catalog, 'physique').total >= 3 ? 2 : 1
}

export function actionsRapidesRestantes(char: Character, catalog: Catalog): number {
  return Math.max(0, actionsRapidesMax(char, catalog) - char.actionsRapidesUtilisees)
}

/**
 * La valeur d'un Élément Variable qui n'est pas une jauge : une statistique
 * entièrement recalculée à partir d'une base et des modificateurs qui la visent.
 *
 * La base et le plancher sont lus dans `ELEMENTS_VARIABLES` : ajouter une
 * statistique dérivée ne demande plus d'écrire une fonction de plus ici.
 */
export function valeurElement(char: Character, catalog: Catalog, element: ElementVariable) {
  const d = descripteur(element)
  const base = d.baseValeur ?? 0
  const agregat = agreger(allModifiers(char, catalog), (m) => cibleElement(m.target, element, 'valeur'))
  return {
    base,
    bonus: agregat.bonus,
    total: Math.max(d.plancherValeur ?? Number.NEGATIVE_INFINITY, base + agregat.bonus),
    agregat,
  }
}

/** Évasion : 1 de base pour toute joueuse, plus l'armure et les esquives en cours. */
export function computeEvasion(char: Character, catalog: Catalog) {
  return valeurElement(char, catalog, { kind: 'evasion' })
}

/** Points d'Énergie bonus sur les Attaques Armées (Overdrive, Faire diversion). */
export function computeBonusEnergieAttaque(char: Character, catalog: Catalog) {
  const { bonus, agregat } = valeurElement(char, catalog, { kind: 'energie-attaque' })
  return { bonus, agregat }
}

// ---------------------------------------------------------------------------
// Emplacements
// ---------------------------------------------------------------------------

/*
 * Trois comptes qui étaient des constantes, et qu'un passif peut désormais
 * faire varier. Ils vivent ici plutôt que dans `campfire.ts` parce qu'ils se
 * calculent comme l'Évasion — une base, plus ce que les objets et passifs en
 * font — et que rien n'en est stocké.
 */

/** Sorts préparables au Grimoire. */
export function tailleGrimoire(char: Character, catalog: Catalog): number {
  return valeurElement(char, catalog, { kind: 'slots-grimoire' }).total
}

/** Offres tirées pour cette joueuse à la Boutique. */
export function tailleOffres(char: Character, catalog: Catalog): number {
  return valeurElement(char, catalog, { kind: 'slots-boutique' }).total
}

/** Investissements proposés à la Banque. */
export function tailleInvestissements(char: Character, catalog: Catalog): number {
  return valeurElement(char, catalog, { kind: 'slots-investissement' }).total
}

// ---------------------------------------------------------------------------
// Plafonds
// ---------------------------------------------------------------------------

/**
 * Le plafond d'un Élément Variable : sa base, plus ce que les objets et passifs
 * en font. Rien n'est stocké — une dague qui coûte un Point de Fatigue rend la
 * case dès qu'on la range.
 *
 * La base et le plancher sont lus dans `ELEMENTS_VARIABLES` : ajouter un
 * élément plafonnable ne demande plus d'écrire une fonction de plus ici.
 * `char.fatigue.max` n'est donc pas la vérité mais la **base**, celle que la
 * classe a fixée à la création.
 */
export function plafondElement(char: Character, catalog: Catalog, element: ElementVariable) {
  const d = descripteur(element)
  if (!d.plafondBase) throw new Error(`« ${d.libelle} » n'a pas de plafond.`)

  const base = d.plafondBase(char)
  const agregat = agreger(allModifiers(char, catalog), (m) => cibleElement(m.target, element, 'plafond'))
  return {
    base,
    bonus: agregat.bonus,
    max: Math.max(d.plafondPlancher ?? 0, base + agregat.bonus),
    agregat,
  }
}

/**
 * 6th Sens. Le maximum peut monter en cours de partie (Voie de la Flamme 4-6),
 * d'où le clamp : redescendre de palier ne doit jamais produire un reste négatif.
 */
export function computeSixthSens(char: Character, catalog: Catalog) {
  const { base, bonus, max, agregat } = plafondElement(char, catalog, { kind: 'sixth-sens' })
  return {
    base,
    bonus,
    max,
    utilises: char.sixthSensUtilises,
    restants: Math.max(0, max - char.sixthSensUtilises),
    agregat,
  }
}

/** Plancher à 1 : un personnage sans aucune case ne pourrait plus rien encaisser. */
export function computeFatigueMax(char: Character, catalog: Catalog) {
  return plafondElement(char, catalog, { kind: 'fatigue' })
}

export function computeFoiMax(char: Character, catalog: Catalog) {
  return plafondElement(char, catalog, { kind: 'foi' })
}

export function computeMarquesMax(char: Character, catalog: Catalog) {
  return plafondElement(char, catalog, { kind: 'marques' })
}

export function computeBruluresMax(char: Character, catalog: Catalog) {
  return plafondElement(char, catalog, { kind: 'brulures' })
}
