import {
  COMPETENCES,
  LIBELLE_COMPETENCE,
  type Character,
  type Competence,
  type Magie,
  type Sort,
} from './types.ts'

/**
 * Les Éléments Variables — le vocabulaire unique du système.
 *
 * Avant ce module, quatre vocabulaires décrivaient la même chose sans se
 * connaître : `Ressource` (ce qu'un passif réactif lisait), `ModifierTarget` (ce
 * qu'un passif permanent ajustait), `CoutSort` et `CoutUsage` (ce que coûtait un
 * sort, un objet). Un déclencheur ne pouvait donc pas viser l'Évasion, et un
 * coût ne pouvait pas se payer en Marques : non par choix de règle, mais parce
 * que les trois listes n'avaient jamais été écrites au même endroit.
 *
 * Il n'y en a plus qu'une. Ajouter un Élément Variable — et tout ce qu'on peut
 * en faire — c'est ajouter une entrée à `ELEMENTS_VARIABLES`.
 *
 * ⚠️ Ce module ne dépend que de `types.ts`. C'est ce qui permet à
 * `modifiers.ts` de s'appuyer sur lui sans refermer de cycle d'imports : tout ce
 * qui demande d'agréger des modificateurs (les plafonds) vit dans
 * `competences.ts`, en aval.
 */

// ---------------------------------------------------------------------------
// Constantes de règle
// ---------------------------------------------------------------------------

/*
 * Elles vivent ici, avec les éléments qu'elles bornent, et non plus dans
 * `modifiers.ts` — le registre en a besoin et ne peut pas l'importer.
 * `modifiers.ts` les ré-exporte, si bien qu'aucun site d'import ne change.
 */

export const SEUIL_COMBUSTION = 9
export const MAX_FOI = 9
export const EVASION_DE_BASE = 1

/**
 * Points de Foi de départ : « Les joueuses commencent toutes avec 2 Points de Foi ».
 *
 * Décision de la MJ : c'est aussi le solde auquel chacune revient à l'ouverture
 * d'une session, contre le PDF qui les conservait de jour en jour.
 */
export const FOI_DE_DEPART = 2

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
// Le vocabulaire
// ---------------------------------------------------------------------------

/**
 * Filtre d'un ajustement de coût.
 *
 * `element` dit **quelle part du coût** est réduite. Absent, le filtre est
 * ouvert et vaut pour toutes. La normalisation y inscrit `'foi'` pour les
 * modificateurs déjà en base : avant l'unification des coûts, `coutFoiEffectif`
 * était seul à les consulter, si bien qu'un filtre vide signifiait « la Foi ».
 */
export interface FiltreCoutSort {
  /** Restreint à un type magique. */
  magieId?: string
  /** ⚠️ **Ancien nom**, converti par `normaliserCible`. */
  magie?: Magie
  prefixeNom?: string
  element?: CleElement
}

/**
 * Tout ce qui, chez un personnage, est susceptible de varier en cours de partie.
 *
 * Les trois familles de compétence restent des éléments distincts plutôt qu'un
 * seul avec un filtre : `competence-sauf` sert au Serment (« toutes sauf celle
 * tirée au sort »), et l'exprimer en une entrée évite de recalculer trois
 * modificateurs quand la compétence épargnée change.
 */
export type ElementVariable =
  | { kind: 'lumens' }
  | { kind: 'fatigue' }
  | { kind: 'foi' }
  | { kind: 'marques' }
  | { kind: 'brulures' }
  | { kind: 'sixth-sens' }
  | { kind: 'actions-rapides' }
  | { kind: 'evasion' }
  | { kind: 'energie-attaque' }
  | { kind: 'initiative' }
  | { kind: 'competence'; competence: Competence }
  | { kind: 'competence-toutes' }
  | { kind: 'competence-sauf'; except: Competence }
  | { kind: 'cout-sort'; filtre?: FiltreCoutSort }
  | { kind: 'slots-boutique' }
  | { kind: 'slots-investissement' }
  | { kind: 'slots-grimoire' }

export type CleElement = ElementVariable['kind']

/**
 * Ce qu'on vise d'un élément.
 *
 * `valeur`, c'est la jauge courante ou la statistique affichée ; `plafond`,
 * c'est sa borne haute. La distinction porte une règle : une dague qui « retire
 * un Point de Fatigue » abaisse la grille, elle ne coche pas une case — ranger
 * l'objet doit rendre la case aussitôt, ce qu'un plafond dérivé fait tout seul.
 */
export type Aspect = 'valeur' | 'plafond'

export interface Cible {
  element: ElementVariable
  aspect: Aspect
}

// ---------------------------------------------------------------------------
// Le registre
// ---------------------------------------------------------------------------

export interface DescripteurElement {
  libelle: string
  /**
   * Les aspects qu'un modificateur peut viser. Vide = l'élément existe dans le
   * vocabulaire mais aucun passif ne sait encore l'ajuster.
   */
  aspects: Aspect[]
  /**
   * Lecture de la valeur courante. Sa **présence** signifie que l'élément est
   * une jauge : quelque chose de stocké sur la fiche, qu'on peut faire varier
   * d'un cran. Son absence rend impossible, à la compilation, d'écrire un coût
   * ou une réaction sur un élément qui n'a pas de compteur.
   */
  lire?: (char: Character) => number
  /** Écriture de la valeur courante. L'appelant a déjà borné `valeur`. */
  ecrire?: (char: Character, valeur: number) => Character
  /**
   * Base du plafond, avant modificateurs. L'agrégation vit dans
   * `competences.ts` (`plafondElement`) : elle a besoin du catalogue, que ce
   * module ne connaît pas.
   */
  plafondBase?: (char: Character) => number
  /** Plancher du plafond calculé, quand descendre à zéro n'aurait pas de sens. */
  plafondPlancher?: number
  /**
   * Base d'une **statistique dérivée** — Évasion, emplacements de Grimoire,
   * offres en boutique. Rien n'en est stocké : la valeur affichée vaut
   * `baseValeur + Σ(modificateurs)`, recalculée à chaque rendu.
   *
   * À distinguer de `lire`/`ecrire`, qui décrivent une **jauge** : une jauge se
   * stocke et se dépense, une statistique dérivée se calcule.
   */
  baseValeur?: number
  /** Plancher de la valeur dérivée, quand descendre à zéro n'aurait pas de sens. */
  plancherValeur?: number
}

/**
 * ⚠️ `Record<CleElement, …>` et non un objet libre : ajouter une variante à
 * `ElementVariable` sans la décrire ici ne compile pas.
 */
export const ELEMENTS_VARIABLES: Record<CleElement, DescripteurElement> = {
  lumens: {
    libelle: 'Lumens',
    // Une bourse, pas une jauge : les Lumens n'ont pas de plafond.
    aspects: [],
    lire: (c) => c.lumens,
    ecrire: (c, v) => ({ ...c, lumens: v }),
  },
  fatigue: {
    libelle: 'Points de Fatigue',
    aspects: ['plafond'],
    // La Fatigue se compte en cases **cochées** : la jauge monte quand on encaisse.
    lire: (c) => c.fatigue.coches,
    ecrire: (c, v) => ({ ...c, fatigue: { ...c.fatigue, coches: v } }),
    // `fatigue.max` n'est pas la vérité mais la base, celle que la classe a fixée.
    plafondBase: (c) => c.fatigue.max,
    // Un personnage sans aucune case ne pourrait plus rien encaisser.
    plafondPlancher: 1,
  },
  foi: {
    libelle: 'Points de Foi',
    aspects: ['plafond'],
    lire: (c) => c.foi,
    ecrire: (c, v) => ({ ...c, foi: v }),
    plafondBase: () => MAX_FOI,
    plafondPlancher: 0,
  },
  marques: {
    libelle: 'Marques',
    aspects: ['plafond'],
    lire: (c) => c.marques,
    ecrire: (c, v) => ({ ...c, marques: v }),
    plafondBase: () => MAX_MARQUES,
    plafondPlancher: 0,
  },
  brulures: {
    libelle: 'Brûlures',
    aspects: ['plafond'],
    /*
     * Les brûlures **acquises**. La part consommée n'est pas une jauge
     * distincte : la marque reste sur la peau, et c'est sur ce total que se
     * lisent les paliers de la Voie de la Flamme. Ce qui reste *dépensable* se
     * lit par `bruluresDisponibles` (`magie.ts`) — un coût s'y adosse, pas ici.
     */
    lire: (c) => c.brulures,
    ecrire: (c, v) => ({ ...c, brulures: v }),
    plafondBase: () => SEUIL_COMBUSTION,
    plafondPlancher: 0,
  },
  'sixth-sens': {
    libelle: '6th Sens',
    /*
     * Un modificateur de 6th Sens hausse le **maximum**, pas la valeur courante
     * (`computeSixthSens` ajoute l'agrégat à `sixthSensBase`, et
     * `sixthSensUtilises` compte à part ce qui a été dépensé). D'où `plafond` :
     * s'y tromper ferait taire le +1 de la Voie de la Flamme sans rien casser
     * de visible.
     */
    aspects: ['plafond'],
    plafondBase: (c) => c.sixthSensBase,
    plafondPlancher: 0,
  },
  'actions-rapides': {
    libelle: 'Actions Rapides',
    // Dérivées du Physique effectif (`actionsRapidesMax`), pas d'un modificateur.
    aspects: [],
  },
  evasion: {
    libelle: 'Évasion',
    aspects: ['valeur'],
    baseValeur: EVASION_DE_BASE,
    plancherValeur: 0,
  },
  'energie-attaque': {
    libelle: "Points d'Énergie",
    aspects: ['valeur'],
    baseValeur: 0,
  },
  initiative: {
    libelle: 'Initiative',
    // Vit sur `EtatCombat`, pas sur la fiche : aucun accès personnage ici.
    aspects: [],
  },
  competence: { libelle: 'Une compétence', aspects: ['valeur'] },
  'competence-toutes': { libelle: 'Toutes les compétences', aspects: ['valeur'] },
  'competence-sauf': { libelle: 'Toutes les compétences sauf une', aspects: ['valeur'] },
  'cout-sort': { libelle: 'Coût des sorts', aspects: ['valeur'] },
  /*
   * Les trois comptes d'emplacements. Ce sont des **nombres proposés**, pas des
   * limites d'acquisition : un passif qui hausse `slots-boutique` fait tirer
   * une offre de plus, il n'autorise pas un second achat — la limite « une
   * acquisition par feu de camp » reste portée par `JetonsCamp`.
   */
  'slots-boutique': {
    libelle: 'Offres en boutique',
    aspects: ['valeur'],
    baseValeur: 3,
    plancherValeur: 0,
  },
  'slots-investissement': {
    libelle: 'Investissements proposés',
    aspects: ['valeur'],
    baseValeur: 3,
    plancherValeur: 0,
  },
  'slots-grimoire': {
    libelle: 'Emplacements de Grimoire',
    aspects: ['valeur'],
    baseValeur: 3,
    // Un Grimoire sans emplacement rendrait tout sort inlançable.
    plancherValeur: 1,
  },
}

/** Le descripteur d'un élément. */
export function descripteur(element: ElementVariable): DescripteurElement {
  return ELEMENTS_VARIABLES[element.kind]
}

/**
 * Construit un élément à partir de sa seule clé.
 *
 * Trois variantes portent une donnée en plus de leur clé — les deux familles de
 * compétence et le filtre de coût — et reçoivent ici une valeur par défaut. Sans
 * ce constructeur, chaque formulaire qui compose un élément depuis un `<select>`
 * devrait refaire le même élargissement de type.
 */
export function elementDepuisCle(cle: CleElement): ElementVariable {
  switch (cle) {
    case 'competence':
      return { kind: 'competence', competence: 'physique' }
    case 'competence-sauf':
      return { kind: 'competence-sauf', except: 'physique' }
    case 'cout-sort':
      return { kind: 'cout-sort' }
    default:
      return { kind: cle }
  }
}

/** Vrai si l'élément est une jauge : une valeur stockée sur la fiche. */
export function estJauge(element: ElementVariable): boolean {
  return descripteur(element).lire !== undefined
}

/** La valeur courante d'une jauge. Lève sur un élément qui n'en est pas une. */
export function lireElement(char: Character, element: ElementVariable): number {
  const lire = descripteur(element).lire
  if (!lire) throw new Error(`« ${descripteur(element).libelle} » n'est pas une jauge.`)
  return lire(char)
}

/** Écrit la valeur d'une jauge, sans borner : c'est à l'appelant de le faire. */
export function ecrireElement(
  char: Character,
  element: ElementVariable,
  valeur: number,
): Character {
  const ecrire = descripteur(element).ecrire
  if (!ecrire) throw new Error(`« ${descripteur(element).libelle} » n'est pas une jauge.`)
  return ecrire(char, valeur)
}

// ---------------------------------------------------------------------------
// Ciblage
// ---------------------------------------------------------------------------

/** Raccourci de lecture : `cibleValeur({ kind: 'evasion' })`. */
export function cibleValeur(element: ElementVariable): Cible {
  return { element, aspect: 'valeur' }
}

/** Raccourci de lecture : `ciblePlafond({ kind: 'fatigue' })`. */
export function ciblePlafond(element: ElementVariable): Cible {
  return { element, aspect: 'plafond' }
}

/** Vrai si la cible porte sur cette compétence — les trois familles comprises. */
export function cibleCompetence(cible: Cible, c: Competence): boolean {
  if (cible.aspect !== 'valeur') return false
  switch (cible.element.kind) {
    case 'competence':
      return cible.element.competence === c
    case 'competence-sauf':
      return cible.element.except !== c
    case 'competence-toutes':
      return true
    default:
      return false
  }
}

/**
 * Vrai si la cible ajuste ce que ce sort coûte, dans cet élément.
 *
 * `element` est la part du coût qu'on est en train de calculer : un
 * modificateur filtré sur la Foi ne réduit pas un coût en brûlures.
 */
export function cibleCoutSort(cible: Cible, sort: Sort, element: CleElement): boolean {
  if (cible.aspect !== 'valeur' || cible.element.kind !== 'cout-sort') return false
  const f = cible.element.filtre
  if (!f) return true
  if (f.element && f.element !== element) return false
  if (f.magieId && f.magieId !== sort.magieId) return false
  if (f.prefixeNom && !sort.nom.startsWith(f.prefixeNom)) return false
  return true
}

/**
 * Vrai si la cible vise exactement cet élément sous cet aspect.
 *
 * Pour les compétences, préférer `cibleCompetence` : lui seul sait qu'un
 * `competence-toutes` porte aussi sur le Physique.
 */
export function cibleElement(cible: Cible, element: ElementVariable, aspect: Aspect): boolean {
  return cible.aspect === aspect && cible.element.kind === element.kind
}

// ---------------------------------------------------------------------------
// Description
// ---------------------------------------------------------------------------

export function decrireElement(element: ElementVariable): string {
  switch (element.kind) {
    case 'competence':
      return LIBELLE_COMPETENCE[element.competence]
    case 'competence-sauf':
      return `toutes les compétences sauf ${LIBELLE_COMPETENCE[element.except]}`
    case 'cout-sort':
      return element.filtre?.prefixeNom
        ? `coût des sorts « ${element.filtre.prefixeNom} »`
        : 'coût des sorts'
    default:
      return ELEMENTS_VARIABLES[element.kind].libelle
  }
}

export function decrireCible(cible: Cible): string {
  const nom = decrireElement(cible.element)
  // « Points de Foi maximum » plutôt que « plafond de Points de Foi » : c'est
  // la formulation que les écrans employaient déjà.
  return cible.aspect === 'plafond' ? `${nom} maximum` : nom
}

// ---------------------------------------------------------------------------
// Rétroactivité
// ---------------------------------------------------------------------------

/**
 * L'ancienne forme, telle qu'elle dort encore dans les documents Firestore.
 *
 * Exportée : c'est le contrat de rétroactivité, et les tests s'en servent pour
 * fabriquer délibérément du contenu à l'ancien format.
 */
export type CibleHeritee =
  | { kind: 'competence'; competence: Competence }
  | { kind: 'competence-sauf'; except: Competence }
  | { kind: 'competence-toutes' }
  | { kind: 'evasion' }
  | { kind: 'sixth-sens' }
  | { kind: 'energie-attaque' }
  | { kind: 'cout-sort'; filtre?: { magie?: Magie; prefixeNom?: string } }
  | { kind: 'fatigue-max' }
  | { kind: 'foi-max' }
  | { kind: 'marques-max' }
  | { kind: 'brulures-max' }

const PLAFONDS_HERITES: Record<string, CleElement> = {
  'fatigue-max': 'fatigue',
  'foi-max': 'foi',
  'marques-max': 'marques',
  'brulures-max': 'brulures',
  // Le 6th Sens ne portait pas le suffixe, mais visait déjà le maximum.
  'sixth-sens': 'sixth-sens',
}

/**
 * Convertit une cible écrite avant l'unification.
 *
 * ⚠️ Deux conversions portent une règle, pas une simple traduction :
 *
 *  - `sixth-sens` devient un **plafond**. C'est ce qu'il a toujours été
 *    (`computeSixthSens` ajoute l'agrégat au maximum) ; le nom seul ne le disait pas.
 *  - un `cout-sort` sans filtre d'élément reçoit `element: 'foi'`. Avant
 *    l'unification, `coutFoiEffectif` était le seul à consulter ces
 *    modificateurs et renvoyait `null` pour tout autre coût : un filtre vide
 *    signifiait donc « la Foi ». Ne pas l'inscrire ferait silencieusement
 *    déborder le passif Conteur sur les coûts en brûlures.
 *
 * Idempotente : une cible déjà au nouveau format la traverse inchangée.
 */
export function normaliserCible(brut: Cible | CibleHeritee): Cible {
  if ('element' in brut && 'aspect' in brut) {
    const cible = brut as Cible
    return cible.element.kind === 'cout-sort'
      ? { ...cible, element: avecElementDeCout(cible.element) }
      : cible
  }

  const heritee = brut as CibleHeritee
  const plafond = PLAFONDS_HERITES[heritee.kind]
  if (plafond) return { element: { kind: plafond } as ElementVariable, aspect: 'plafond' }

  if (heritee.kind === 'cout-sort') {
    return { element: avecElementDeCout({ kind: 'cout-sort', filtre: heritee.filtre }), aspect: 'valeur' }
  }

  return { element: heritee as ElementVariable, aspect: 'valeur' }
}

function avecElementDeCout(
  element: Extract<ElementVariable, { kind: 'cout-sort' }>,
): ElementVariable {
  const filtre = element.filtre ?? {}
  return {
    kind: 'cout-sort',
    filtre: {
      ...filtre,
      element: filtre.element ?? 'foi',
      // `magie` portait une union fermée ; son nom est devenu l'identifiant du
      // type magique, et les trois d'origine gardent les leurs.
      ...(filtre.magieId ?? filtre.magie ? { magieId: filtre.magieId ?? filtre.magie } : {}),
    },
  }
}

/** Les compétences, pour les écrans qui composent une cible. Ré-export de confort. */
export { COMPETENCES }
