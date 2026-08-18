import type { Catalog } from './catalog.ts'
import type { Character, Competence, Magie, Modifier, ModifierTarget, Sort } from './types.ts'

/**
 * Le moteur de modificateurs.
 *
 * Règle d'or : **aucune valeur affichée n'est stockée**. Compétences, Évasion,
 * 6th Sens et coûts de sorts sont recalculés à chaque rendu à partir de
 *
 *     base + Σ(modificateurs explicites) + Σ(modificateurs dérivés)
 *
 * Les modificateurs *dérivés* (Voie de la Flamme, Overdrive, Conteur, armure
 * équipée) ne sont jamais écrits en base : ils sont recalculés depuis l'état du
 * personnage. Ils ne peuvent donc pas se désynchroniser — si les brûlures
 * changent, le bonus suit immédiatement, sans qu'aucun écran n'ait à y penser.
 */

// ---------------------------------------------------------------------------
// Voie de la Flamme
// ---------------------------------------------------------------------------

export type PalierFlamme = 'aucun' | 'perception' | 'fureur'

/**
 * ⚠️ Point d'interprétation du PDF.
 *
 * Rules_For_Agents.pdf liste trois paliers : « 1-3 rien / 4-6 gagne un 6th Sens
 * supplémentaire / 7-9 avantage sur tous les jets de Physique ». Le texte se lit
 * comme des paliers qui se remplacent — c'est ce qui est implémenté ici. Passer
 * cette constante à `true` les rend cumulatifs (7-9 conserverait alors le 6th
 * Sens supplémentaire), si votre table le joue ainsi.
 */
export const VOIE_FLAMME_CUMULATIVE = false

export function palierVoieDeLaFlamme(brulures: number): PalierFlamme {
  if (brulures >= 7) return 'fureur'
  if (brulures >= 4) return 'perception'
  return 'aucun'
}

export const SEUIL_COMBUSTION = 9
export const MAX_FOI = 9
export const EVASION_DE_BASE = 1

// ---------------------------------------------------------------------------
// Ciblage
// ---------------------------------------------------------------------------

export function cibleCompetence(target: ModifierTarget, c: Competence): boolean {
  switch (target.kind) {
    case 'competence':
      return target.competence === c
    case 'competence-sauf':
      return target.except !== c
    case 'competence-toutes':
      return true
    default:
      return false
  }
}

export function cibleCoutSort(target: ModifierTarget, sort: Sort): boolean {
  if (target.kind !== 'cout-sort') return false
  const f = target.filtre
  if (!f) return true
  if (f.magie && f.magie !== sort.magie) return false
  if (f.prefixeNom && !sort.nom.startsWith(f.prefixeNom)) return false
  return true
}

// ---------------------------------------------------------------------------
// Agrégation
// ---------------------------------------------------------------------------

export interface Agregat {
  bonus: number
  avantages: Modifier[]
  desavantages: Modifier[]
  contributions: Modifier[]
}

export function agreger(mods: readonly Modifier[], applique: (m: Modifier) => boolean): Agregat {
  const contributions = mods.filter(applique)
  let bonus = 0
  const avantages: Modifier[] = []
  const desavantages: Modifier[] = []
  for (const m of contributions) {
    if (m.op.kind === 'add') bonus += m.op.value
    else if (m.op.kind === 'avantage') avantages.push(m)
    else desavantages.push(m)
  }
  return { bonus, avantages, desavantages, contributions }
}

/**
 * Avantage et désavantage s'annulent un pour un.
 *
 * Le PDF ne tranche pas ce cas (avantage = +d4, désavantage = -d4). L'annulation
 * est la convention la plus courante et évite d'empiler des dés qui se neutralisent.
 * Les listes brutes restent disponibles dans l'agrégat pour que la MJ arbitre.
 */
export function netAvantage(a: Agregat): 'avantage' | 'desavantage' | 'neutre' {
  const delta = a.avantages.length - a.desavantages.length
  if (delta > 0) return 'avantage'
  if (delta < 0) return 'desavantage'
  return 'neutre'
}

// ---------------------------------------------------------------------------
// Modificateurs dérivés
// ---------------------------------------------------------------------------

function derive(
  id: string,
  kind: Modifier['source']['kind'],
  label: string,
  target: ModifierTarget,
  op: Modifier['op'],
  ref?: string,
): Modifier {
  return { id: `derive:${id}`, source: { kind, label, ...(ref ? { ref } : {}) }, target, op, expires: { kind: 'jamais' } }
}

/**
 * Recalcule les modificateurs qui découlent de l'état du personnage.
 * Jamais persistés : c'est ce qui garantit qu'ils restent cohérents.
 */
export function derivedModifiers(char: Character, catalog: Catalog): Modifier[] {
  const out: Modifier[] = []

  // --- Équipement porté (les 3 slots de l'Armurerie) ---
  for (const equipeId of Object.values(char.equipe)) {
    if (!equipeId) continue
    const eq = catalog.equipement(equipeId)
    if (!eq) continue
    if (eq.bonusEvasion) {
      out.push(
        derive(`equip:${eq.id}:evasion`, 'equipement', eq.nom, { kind: 'evasion' }, { kind: 'add', value: eq.bonusEvasion }, eq.id),
      )
    }
    eq.modificateurs?.forEach((m, i) => {
      out.push({ ...m, id: `derive:equip:${eq.id}:${i}`, expires: { kind: 'jamais' } })
    })
  }

  // --- Améliorations possédées (permanentes, hors Détachement) ---
  for (const amId of char.possede.ameliorations) {
    const am = catalog.amelioration(amId)
    am?.modificateurs?.forEach((m, i) => {
      out.push({ ...m, id: `derive:amelio:${am.id}:${i}`, expires: { kind: 'jamais' } })
    })
  }

  // --- Voie de la Flamme (Magie du Sang) ---
  const palier = palierVoieDeLaFlamme(char.brulures)
  if (palier === 'perception' || (VOIE_FLAMME_CUMULATIVE && palier === 'fureur')) {
    out.push(
      derive('flamme:sens', 'voie-flamme', 'Voie de la Flamme (4-6)', { kind: 'sixth-sens' }, { kind: 'add', value: 1 }),
    )
  }
  if (palier === 'fureur') {
    out.push(
      derive('flamme:physique', 'voie-flamme', 'Voie de la Flamme (7-9)', { kind: 'competence', competence: 'physique' }, { kind: 'avantage' }),
    )
  }

  // --- Dusk Hunter : Overdrive ---
  if (char.passifs.hexcore === 'overdrive') {
    out.push(
      derive('hexcore:overdrive', 'passif', 'Overdrive', { kind: 'energie-attaque' }, { kind: 'add', value: 1 }),
    )
  }

  // --- Trickster : Conteur ---
  if (char.passifs.voieTrickster === 'conteur') {
    out.push(
      derive(
        'trickster:conteur',
        'passif',
        'Conteur',
        { kind: 'cout-sort', filtre: { magie: 'miracle', prefixeNom: 'Word:' } },
        { kind: 'add', value: -1 },
      ),
    )
  }

  return out
}

/** Modificateurs explicites (persistés) + dérivés (recalculés). */
export function allModifiers(char: Character, catalog: Catalog): Modifier[] {
  return [...char.modifiers, ...derivedModifiers(char, catalog)]
}

// ---------------------------------------------------------------------------
// Expiration
// ---------------------------------------------------------------------------

export type EvenementExpiration =
  /** Un feu de camp vient d'être résolu. */
  | { kind: 'camp'; finDeJournee: boolean }
  /** Le combat vient de passer au tour `tour`. */
  | { kind: 'tour'; tour: number }
  /** Le combat est terminé. */
  | { kind: 'fin-combat' }

/**
 * Retire les modificateurs arrivés à échéance.
 * Ne s'applique qu'aux modificateurs *explicites* : les dérivés se recalculent.
 */
export function expireModifiers(mods: readonly Modifier[], ev: EvenementExpiration): Modifier[] {
  return mods.filter((m) => {
    switch (m.expires.kind) {
      case 'jamais':
        return true
      case 'fin-de-camp':
        return ev.kind !== 'camp'
      case 'fin-de-journee':
        // Un repos court ne lève ni Fardeau, ni Serment, ni Marque journalière.
        return !(ev.kind === 'camp' && ev.finDeJournee)
      case 'fin-tour-suivant': {
        // Posé au tour N, actif jusqu'à la fin du tour N : il tombe dès que le
        // combat passe au tour suivant, et disparaît avec le combat.
        if (ev.kind === 'fin-combat') return false
        if (ev.kind === 'tour') return ev.tour <= m.expires.turnId
        return true
      }
      case 'fin-de-combat':
        return ev.kind !== 'fin-combat'
    }
  })
}

// ---------------------------------------------------------------------------
// Constructeurs des modificateurs posés par les règles
// ---------------------------------------------------------------------------

let compteur = 0
function nouvelId(prefixe: string): string {
  compteur += 1
  return `${prefixe}:${Date.now().toString(36)}:${compteur}`
}

/** Fardeau (Foi +3) : désavantage sur une compétence pour la journée. */
export function modificateurFardeau(competence: Competence): Modifier {
  return {
    id: nouvelId('fardeau'),
    source: { kind: 'fardeau', label: 'Fardeau' },
    target: { kind: 'competence', competence },
    op: { kind: 'desavantage' },
    expires: { kind: 'fin-de-journee' },
  }
}

/** Serment (Foi +4) : -4 sur toutes les compétences sauf celle tirée au sort. */
export function modificateurSerment(competenceEpargnee: Competence): Modifier {
  return {
    id: nouvelId('serment'),
    source: { kind: 'serment', label: 'Serment' },
    target: { kind: 'competence-sauf', except: competenceEpargnee },
    op: { kind: 'add', value: -4 },
    expires: { kind: 'fin-de-journee' },
  }
}

/** Marque dépensée par la MJ : désavantage sur une compétence pour la journée. */
export function modificateurMarque(competence: Competence): Modifier {
  return {
    id: nouvelId('marque'),
    source: { kind: 'marque', label: 'Marque' },
    target: { kind: 'competence', competence },
    op: { kind: 'desavantage' },
    expires: { kind: 'fin-de-journee' },
  }
}

/** Action Alternative « Esquiver » : +1 Évasion jusqu'au tour suivant. */
export function modificateurEsquive(tour: number): Modifier {
  return {
    id: nouvelId('esquive'),
    source: { kind: 'action-alt', label: 'Esquiver' },
    target: { kind: 'evasion' },
    op: { kind: 'add', value: 1 },
    expires: { kind: 'fin-tour-suivant', turnId: tour },
  }
}

/**
 * Action Alternative « Faire diversion » : +1 Point d'Énergie à une alliée.
 *
 * C'est le cas qui valide le design du moteur — un modificateur posé par une
 * joueuse sur la fiche d'une autre, avec sa propre échéance.
 */
export function modificateurDiversion(tour: number, poseParNom: string): Modifier {
  return {
    id: nouvelId('diversion'),
    source: { kind: 'action-alt', label: `Diversion de ${poseParNom}` },
    target: { kind: 'energie-attaque' },
    op: { kind: 'add', value: 1 },
    expires: { kind: 'fin-tour-suivant', turnId: tour },
    posePar: poseParNom,
  }
}

/** Ajustement libre posé par la MJ (« Infliger des modifications sur les Compétences »). */
export function modificateurMJ(
  target: ModifierTarget,
  op: Modifier['op'],
  label: string,
  expires: Modifier['expires'] = { kind: 'fin-de-journee' },
): Modifier {
  return { id: nouvelId('mj'), source: { kind: 'mj', label }, target, op, expires }
}

/** Effet d'une personnalité de Soulshifter, posé au lancement de Tribue ou Sens. */
export function modificateurPersonnalite(
  label: string,
  target: ModifierTarget,
  op: Modifier['op'],
  magie: Magie = 'arcane',
): Modifier {
  return {
    id: nouvelId('personnalite'),
    source: { kind: 'personnalite', label, ref: magie },
    target,
    op,
    expires: { kind: 'fin-de-combat' },
  }
}
