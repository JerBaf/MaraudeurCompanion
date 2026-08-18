import type { Adversaire, Character, EtatCombat } from './types.ts'

/**
 * Résolution d'une attaque.
 *
 * Rules_For_Agents.pdf, « Séquence du Combat » : si le dé est **supérieur** à
 * l'Évasion de la cible, les dégâts passent ; s'il est inférieur ou égal, la
 * joueuse doit effectuer une Action Alternative.
 * Et « Évasion » : la Fatigue prise vaut E − N.
 */
export interface ResultatAttaque {
  pointsEnergie: number
  evasionCible: number
  touche: boolean
  degats: number
  /** Vrai quand le jet n'a pas pénétré : l'écran bascule sur « G pas touchão ». */
  actionAlternativeRequise: boolean
}

export function resoudreAttaque(pointsEnergie: number, evasionCible: number): ResultatAttaque {
  const touche = pointsEnergie > evasionCible
  return {
    pointsEnergie,
    evasionCible,
    touche,
    degats: touche ? pointsEnergie - evasionCible : 0,
    actionAlternativeRequise: !touche,
  }
}

// ---------------------------------------------------------------------------
// Initiative
// ---------------------------------------------------------------------------

export type SousGroupe = 'avant-mj' | 'mj' | 'apres-mj'

export const LIBELLE_SOUS_GROUPE: Record<SousGroupe, string> = {
  'avant-mj': 'Avant la MJ',
  mj: 'Tour de la MJ',
  'apres-mj': 'Après la MJ',
}

/**
 * Le d6 d'initiative ne produit pas un ordre linéaire mais deux sous-groupes :
 * [4-6] agissent avant la MJ, [1-3] après. C'est ce qui pousse les joueuses à
 * se coordonner plutôt qu'à résoudre chacune son tour.
 */
export function sousGroupeInitiative(d6: number): 'avant-mj' | 'apres-mj' {
  return d6 >= 4 ? 'avant-mj' : 'apres-mj'
}

export const ORDRE_SOUS_GROUPES: SousGroupe[] = ['avant-mj', 'mj', 'apres-mj']

export function sousGroupeSuivant(courant: SousGroupe): { sousGroupe: SousGroupe; nouveauTour: boolean } {
  const i = ORDRE_SOUS_GROUPES.indexOf(courant)
  const suivant = ORDRE_SOUS_GROUPES[(i + 1) % ORDRE_SOUS_GROUPES.length] as SousGroupe
  return { sousGroupe: suivant, nouveauTour: suivant === 'avant-mj' }
}

/** Répartit les personnages selon l'initiative saisie. Sans initiative, on attend. */
export function repartirParInitiative(
  characters: readonly Character[],
  initiatives: Record<string, number>,
): { avantMJ: Character[]; apresMJ: Character[]; enAttente: Character[] } {
  const avantMJ: Character[] = []
  const apresMJ: Character[] = []
  const enAttente: Character[] = []
  for (const c of characters) {
    const d6 = initiatives[c.id]
    if (d6 === undefined) enAttente.push(c)
    else if (sousGroupeInitiative(d6) === 'avant-mj') avantMJ.push(c)
    else apresMJ.push(c)
  }
  return { avantMJ, apresMJ, enAttente }
}

export function estSonTour(char: Character, combat: EtatCombat | null): boolean {
  if (!combat) return false
  const d6 = combat.initiatives[char.id]
  if (d6 === undefined) return false
  return sousGroupeInitiative(d6) === combat.sousGroupeActif
}

export function etatCombatInitial(): EtatCombat {
  return { tour: 1, sousGroupeActif: 'avant-mj', initiatives: {} }
}

// ---------------------------------------------------------------------------
// Adversaires
// ---------------------------------------------------------------------------

/**
 * Les adversaires n'ont pas de réserve de points de vie exposée : les joueuses
 * voient les dégâts **cumulés** infligés, conformément aux guidelines, et c'est
 * la MJ qui décide quand une créature tombe.
 */
export function appliquerDegats(adv: Adversaire, degats: number): Adversaire {
  return { ...adv, degatsSubis: Math.max(0, adv.degatsSubis + degats) }
}

export function evasionAffichee(adv: Adversaire, estMJ: boolean): string {
  return estMJ || adv.evasionPublique ? String(adv.evasion) : '?'
}

// ---------------------------------------------------------------------------
// Actions Alternatives — le bouton « G pas touchão »
// ---------------------------------------------------------------------------

export interface ActionAlternative {
  id: 'esquiver' | 'diversion'
  nom: string
  description: string
  /** L'action demande de désigner une autre joueuse. */
  requiertCible: boolean
}

export const ACTIONS_ALTERNATIVES: ActionAlternative[] = [
  {
    id: 'esquiver',
    nom: 'Esquiver',
    description: 'Vous ajoute un bonus de +1 à votre Évasion en cours.',
    requiertCible: false,
  },
  {
    id: 'diversion',
    nom: 'Faire diversion',
    description:
      "Vous aidez une alliée à porter un coup plus puissant : elle ajoute +1 à ses Points d'Énergie.",
    requiertCible: true,
  },
]
