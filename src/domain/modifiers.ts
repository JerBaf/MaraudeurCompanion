import type { Catalog } from './catalog.ts'
import { cibleValeur, type Cible } from './elements.ts'
import {
  conditionRemplie,
  estEcritureDirecte,
  estPermanentApplicable,
  passifsActifs,
  type ProvenancePassif,
} from './passifs.ts'
import type {
  Character,
  Competence,
  Modifier,
  ModifierSourceKind,
  Passif,
} from './types.ts'

/*
 * Le vocabulaire des cibles et les constantes de règle vivent désormais dans
 * `elements.ts`, avec les Éléments Variables qu'ils décrivent. On les
 * ré-exporte : le moteur reste le point d'entrée naturel pour qui raisonne en
 * modificateurs, et aucun site d'import n'a eu à changer.
 */
export {
  cibleCompetence,
  cibleCoutSort,
  cibleElement,
  EVASION_DE_BASE,
  FOI_DE_DEPART,
  MAX_FOI,
  MAX_MARQUES,
  SEUIL_COMBUSTION,
} from './elements.ts'

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

/*
 * La Voie de la Flamme s'exprime désormais comme n'importe quel passif à seuil
 * — voir `PASSIFS_FLAMME` dans `passifs.ts`. Ré-exportée ici, où les écrans la
 * cherchaient.
 */
export { PASSIFS_FLAMME, paliersFlammeAtteints } from './passifs.ts'

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
  target: Cible,
  op: Modifier['op'],
  ref?: string,
): Modifier {
  return { id: `derive:${id}`, source: { kind, label, ...(ref ? { ref } : {}) }, target, op, expires: { kind: 'jamais' } }
}

/**
 * Le passif permanent tel que le moteur le consomme.
 *
 * ⚠️ **`Passif` et `Modifier` restent deux choses distinctes.** `Passif` est du
 * contenu écrit par la MJ ; `Modifier` est la monnaie d'exécution, persistée
 * dans `Character.modifiers` (Fardeau, Serment, Marque, Esquive, Diversion),
 * porteuse d'un `posePar` et d'une échéance. Cette fonction est le compilateur
 * de l'un vers l'autre.
 *
 * Elle ignore les opérations qui n'ont pas de sens en permanence : une écriture
 * de jauge s'appliquerait à chaque rendu, et `set` comme `add-x` ne survivent
 * pas à l'agrégation (`agreger` somme les `add` en un scalaire).
 */
function compilerPassif(
  passif: Passif,
  sourceKind: ModifierSourceKind,
  label: string,
  ref: string,
): Modifier[] {
  if (!estPermanentApplicable(passif)) return []

  return (passif.effet.operations ?? [])
    .filter((o) => !estEcritureDirecte(o.cible))
    .filter((o) => o.op.kind === 'add' || o.op.kind === 'avantage' || o.op.kind === 'desavantage')
    .map((o, i) => ({
      id: `derive:passif:${ref}:${passif.id}:${i}`,
      /*
       * Le libellé : celui du passif s'il en porte un, sinon **celui du
       * porteur**, relu à chaque rendu. Ce repli est ce qui retire le besoin de
       * réécrire les libellés à l'enregistrement : renommer un objet renomme
       * son passif, sans qu'on ait à toucher à la base.
       */
      source: { kind: sourceKind, label: passif.libelle || label, ref },
      target: o.cible,
      op: o.op as Modifier['op'],
      expires: { kind: 'jamais' } as const,
    }))
}

const SOURCE_PAR_PROVENANCE: Record<ProvenancePassif, ModifierSourceKind> = {
  equipement: 'equipement',
  amelioration: 'passif',
  classe: 'passif',
  'type-magique': 'passif',
  // La Voie de la Flamme découle des brûlures : elle n'est pas un choix.
  derive: 'voie-flamme',
}

/**
 * Recalcule les modificateurs qui découlent de l'état du personnage.
 * Jamais persistés : c'est ce qui garantit qu'ils restent cohérents.
 */
export function derivedModifiers(char: Character, catalog: Catalog): Modifier[] {
  const out: Modifier[] = []

  // --- Bonus d'Évasion des objets portés ---
  // Reste un champ à part : c'est le raccourci que la MJ attend d'une armure,
  // et l'écrire en passif à chaque fois serait une corvée sans contrepartie.
  for (const equipeId of Object.values(char.equipe)) {
    if (!equipeId) continue
    const eq = catalog.equipement(equipeId)
    if (!eq?.bonusEvasion) continue
    out.push(
      derive(`equip:${eq.id}:evasion`, 'equipement', eq.nom, cibleValeur({ kind: 'evasion' }), { kind: 'add', value: eq.bonusEvasion }, eq.id),
    )
  }

  // --- Passifs permanents : objets portés, améliorations, classe, types magiques ---
  for (const { passif, source, provenance, ref } of passifsActifs(char, catalog)) {
    if (!conditionRemplie(passif, char)) continue
    out.push(...compilerPassif(passif, SOURCE_PAR_PROVENANCE[provenance], source, ref))
  }

  /*
   * Overdrive et Conteur ne figurent plus ici : ce sont désormais des options
   * de classe, écrites en données dans le seed et récoltées ci-dessus comme
   * n'importe quel passif. C'est ce qui permet de créer une classe complète
   * depuis l'écran MJ, sans toucher au code.
   */
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
    target: cibleValeur({ kind: 'competence', competence }),
    op: { kind: 'desavantage' },
    expires: { kind: 'fin-de-session' },
  }
}

/** Serment (Foi +4) : -4 sur toutes les compétences sauf celle tirée au sort. */
export function modificateurSerment(competenceEpargnee: Competence): Modifier {
  return {
    id: nouvelId('serment'),
    source: { kind: 'serment', label: 'Serment' },
    target: cibleValeur({ kind: 'competence-sauf', except: competenceEpargnee }),
    op: { kind: 'add', value: -4 },
    expires: { kind: 'fin-de-session' },
  }
}

/** Marque dépensée par la MJ : désavantage sur une compétence pour la session. */
export function modificateurMarque(competence: Competence): Modifier {
  return {
    id: nouvelId('marque'),
    source: { kind: 'marque', label: 'Marque' },
    target: cibleValeur({ kind: 'competence', competence }),
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
    target: cibleValeur({ kind: 'evasion' }),
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
    target: cibleValeur({ kind: 'energie-attaque' }),
    op: { kind: 'add', value: 1 },
    expires: { kind: 'moment-combat', momentFin },
    posePar: poseParNom,
  }
}

/** Ajustement libre posé par la MJ (« Infliger des modifications sur les Compétences »). */
export function modificateurMJ(
  target: Cible,
  op: Modifier['op'],
  label: string,
  expires: Modifier['expires'] = { kind: 'fin-de-session' },
): Modifier {
  return { id: nouvelId('mj'), source: { kind: 'mj', label }, target, op, expires }
}

