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

/**
 * Voie de la Flamme.
 *
 * Les paliers sont **cumulatifs** : à 7 brûlures on conserve le 6th Sens
 * supplémentaire du palier 4-6 et on gagne en plus l'avantage en Physique.
 *
 * Modélisé comme une liste de seuils plutôt qu'une énumération de paliers
 * exclusifs : ajouter un palier revient à ajouter une entrée ici, sans toucher
 * ni au calcul, ni aux écrans.
 */
export interface PalierFlamme {
  id: string
  /** Nombre de brûlures à partir duquel le palier s'applique. */
  seuil: number
  nom: string
  effet: string
}

export const PALIERS_FLAMME: PalierFlamme[] = [
  {
    id: 'perception',
    seuil: 4,
    nom: 'Voie de la Flamme (4+)',
    effet: 'Perception accrue de la chaleur : un point de 6th Sens supplémentaire.',
  },
  {
    id: 'fureur',
    seuil: 7,
    nom: 'Voie de la Flamme (7+)',
    effet: 'Le brasier vous porte : avantage sur tous les jets de Physique.',
  },
]

/** Tous les paliers atteints, du plus bas au plus haut. */
export function paliersFlammeAtteints(brulures: number): PalierFlamme[] {
  return PALIERS_FLAMME.filter((p) => brulures >= p.seuil)
}

export const SEUIL_COMBUSTION = 9
export const MAX_FOI = 9
export const EVASION_DE_BASE = 1

/**
 * Plafond des Marques.
 *
 * Le PDF ne fixe pas de maximum ; il donne des coûts (1 Marque pour un
 * désavantage, 3 pour une prise de contrôle). La table plafonne à 3 : c'est le
 * seuil au-delà duquel la MJ peut prendre le personnage en main. Rien n'est
 * automatique — les Marques sont une monnaie que la MJ dépense à la main.
 */
export const MAX_MARQUES = 3

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

  // --- Voie de la Flamme (Magie du Sang), cumulative ---
  for (const palier of paliersFlammeAtteints(char.brulures)) {
    if (palier.id === 'perception') {
      out.push(derive('flamme:sens', 'voie-flamme', palier.nom, { kind: 'sixth-sens' }, { kind: 'add', value: 1 }))
    }
    if (palier.id === 'fureur') {
      out.push(
        derive(
          'flamme:physique',
          'voie-flamme',
          palier.nom,
          { kind: 'competence', competence: 'physique' },
          { kind: 'avantage' },
        ),
      )
    }
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
  /**
   * Un feu de camp vient d'être résolu. `frontiereDeSession` distingue le camp
   * initial, qui clôt la session écoulée, d'un simple repos court.
   */
  | { kind: 'camp'; frontiereDeSession: boolean }
  /**
   * Le combat vient d'atteindre ce moment de l'horloge. À évaluer à **chaque**
   * changement de sous-groupe, pas seulement au changement de tour.
   */
  | { kind: 'moment'; moment: number }
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
      // `fin-de-journee` est l'ancien nom de `fin-de-session` : les deux se
      // traitent pareil, sans quoi les Serments déjà en base tomberaient dans
      // aucun cas et le `filter` les effacerait au premier camp venu.
      case 'fin-de-session':
      case 'fin-de-journee':
        // Un repos court ne lève ni Fardeau, ni Serment, ni Marque de session.
        return !(ev.kind === 'camp' && ev.frontiereDeSession)
      case 'moment-combat': {
        if (ev.kind === 'fin-combat') return false
        if (ev.kind === 'moment') return ev.moment < m.expires.momentFin
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

/** Fardeau (Foi +3) : désavantage sur une compétence pour la session. */
export function modificateurFardeau(competence: Competence): Modifier {
  return {
    id: nouvelId('fardeau'),
    source: { kind: 'fardeau', label: 'Fardeau' },
    target: { kind: 'competence', competence },
    op: { kind: 'desavantage' },
    expires: { kind: 'fin-de-session' },
  }
}

/** Serment (Foi +4) : -4 sur toutes les compétences sauf celle tirée au sort. */
export function modificateurSerment(competenceEpargnee: Competence): Modifier {
  return {
    id: nouvelId('serment'),
    source: { kind: 'serment', label: 'Serment' },
    target: { kind: 'competence-sauf', except: competenceEpargnee },
    op: { kind: 'add', value: -4 },
    expires: { kind: 'fin-de-session' },
  }
}

/** Marque dépensée par la MJ : désavantage sur une compétence pour la session. */
export function modificateurMarque(competence: Competence): Modifier {
  return {
    id: nouvelId('marque'),
    source: { kind: 'marque', label: 'Marque' },
    target: { kind: 'competence', competence },
    op: { kind: 'desavantage' },
    expires: { kind: 'fin-de-session' },
  }
}

/**
 * Action Alternative « Esquiver » : +1 Évasion jusqu'à sa prochaine activation.
 * L'échéance se calcule avec `echeanceEsquive` (`combat.ts`).
 */
export function modificateurEsquive(momentFin: number): Modifier {
  return {
    id: nouvelId('esquive'),
    source: { kind: 'action-alt', label: 'Esquiver' },
    target: { kind: 'evasion' },
    op: { kind: 'add', value: 1 },
    expires: { kind: 'moment-combat', momentFin },
  }
}

/**
 * Action Alternative « Faire diversion » : +1 Point d'Énergie à une alliée.
 *
 * C'est le cas qui valide le design du moteur — un modificateur posé par une
 * joueuse sur la fiche d'une autre, avec une échéance qui dépend du sous-groupe
 * de la bénéficiaire. Voir `echeanceDiversion` (`combat.ts`).
 */
export function modificateurDiversion(momentFin: number, poseParNom: string): Modifier {
  return {
    id: nouvelId('diversion'),
    source: { kind: 'action-alt', label: `Diversion de ${poseParNom}` },
    target: { kind: 'energie-attaque' },
    op: { kind: 'add', value: 1 },
    expires: { kind: 'moment-combat', momentFin },
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
