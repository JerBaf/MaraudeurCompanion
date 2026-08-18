import type { Catalog } from './catalog.ts'
import {
  agreger,
  allModifiers,
  cibleCompetence,
  EVASION_DE_BASE,
  netAvantage,
  type Agregat,
} from './modifiers.ts'
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
 * Rules_For_Agents.pdf : « 1 si la maîtrise de physique est -2 ou 0 ; 2 si +2 ».
 * On applique le seuil sur la valeur **effective** (maîtrise + modificateurs)
 * plutôt que sur la maîtrise brute, pour rester cohérent avec l'exigence de
 * modificateurs dynamiques : un Serment qui écrase le Physique retire aussi
 * l'Action Rapide supplémentaire.
 */
export function actionsRapidesMax(char: Character, catalog: Catalog): number {
  return computeCompetence(char, catalog, 'physique').total >= 2 ? 2 : 1
}

export function actionsRapidesRestantes(char: Character, catalog: Catalog): number {
  return Math.max(0, actionsRapidesMax(char, catalog) - char.actionsRapidesUtilisees)
}

/** Évasion : 1 de base pour toute joueuse, plus l'armure et les esquives en cours. */
export function computeEvasion(char: Character, catalog: Catalog) {
  const agregat = agreger(allModifiers(char, catalog), (m) => m.target.kind === 'evasion')
  return {
    base: EVASION_DE_BASE,
    bonus: agregat.bonus,
    total: EVASION_DE_BASE + agregat.bonus,
    agregat,
  }
}

/**
 * 6th Sens. Le maximum peut monter en cours de partie (Voie de la Flamme 4-6),
 * d'où le clamp : redescendre de palier ne doit jamais produire un reste négatif.
 */
export function computeSixthSens(char: Character, catalog: Catalog) {
  const agregat = agreger(allModifiers(char, catalog), (m) => m.target.kind === 'sixth-sens')
  const max = Math.max(0, char.sixthSensBase + agregat.bonus)
  return {
    base: char.sixthSensBase,
    bonus: agregat.bonus,
    max,
    utilises: char.sixthSensUtilises,
    restants: Math.max(0, max - char.sixthSensUtilises),
    agregat,
  }
}

/** Points d'Énergie bonus sur les Attaques Armées (Overdrive, Faire diversion). */
export function computeBonusEnergieAttaque(char: Character, catalog: Catalog) {
  const agregat = agreger(allModifiers(char, catalog), (m) => m.target.kind === 'energie-attaque')
  return { bonus: agregat.bonus, agregat }
}
