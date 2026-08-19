/**
 * Types du domaine « Entre-Monde ».
 *
 * Ce module — et tout `src/domain/` — ne connaît ni React ni Firebase.
 * C'est volontaire : les règles du jeu se testent sans navigateur ni réseau.
 */

// ---------------------------------------------------------------------------
// Compétences
// ---------------------------------------------------------------------------

export const COMPETENCES = ['physique', 'roublardise', 'esprit', 'social'] as const
export type Competence = (typeof COMPETENCES)[number]

export const LIBELLE_COMPETENCE: Record<Competence, string> = {
  physique: 'Physique',
  roublardise: 'Roublardise',
  esprit: 'Esprit',
  social: 'Social',
}

/** Maîtrise par compétence. Profil type : deux +2, un 0, un -2. */
export type Maitrises = Record<Competence, number>

// ---------------------------------------------------------------------------
// Magie
// ---------------------------------------------------------------------------

export const MAGIES = ['arcane', 'sang', 'miracle'] as const
export type Magie = (typeof MAGIES)[number]

export const LIBELLE_MAGIE: Record<Magie, string> = {
  arcane: 'Arcane',
  sang: 'Magie du Sang',
  miracle: 'Miracle',
}

export const PORTEES = ['proche', 'moyenne', 'distante'] as const
export type Portee = (typeof PORTEES)[number]

// ---------------------------------------------------------------------------
// Équipement
// ---------------------------------------------------------------------------

export const SLOTS_EQUIPEMENT = ['arme', 'armure', 'bibelot'] as const
export type SlotEquipement = (typeof SLOTS_EQUIPEMENT)[number]

export const LIBELLE_SLOT: Record<SlotEquipement, string> = {
  arme: 'Arme',
  armure: 'Armure',
  bibelot: 'Bibelot',
}

// ---------------------------------------------------------------------------
// Modificateurs — le cœur du système
// ---------------------------------------------------------------------------

/**
 * Ce qu'un modificateur affecte.
 *
 * `competence-sauf` existe pour le Serment : « toutes les compétences sauf celle
 * tirée au sort subissent -4 ». L'exprimer en une seule entrée plutôt qu'en trois
 * évite d'avoir à les recalculer si la compétence épargnée change.
 */
export type ModifierTarget =
  | { kind: 'competence'; competence: Competence }
  | { kind: 'competence-sauf'; except: Competence }
  | { kind: 'competence-toutes' }
  | { kind: 'evasion' }
  | { kind: 'sixth-sens' }
  | { kind: 'energie-attaque' }
  | { kind: 'cout-sort'; filtre?: { magie?: Magie; prefixeNom?: string } }

export type ModifierOp =
  | { kind: 'add'; value: number }
  | { kind: 'avantage' }
  | { kind: 'desavantage' }

/**
 * Quand le modificateur disparaît.
 *
 * `fin-de-camp` = au prochain feu de camp, quel qu'il soit.
 * `fin-de-journee` = uniquement à un feu de camp qualifié « fin de journée ».
 * `fin-tour-suivant` = Actions Alternatives ; `turnId` identifie le tour de combat
 * pendant lequel le modificateur a été posé, pour qu'il survive exactement un tour.
 */
export type ModifierExpiry =
  | { kind: 'jamais' }
  | { kind: 'fin-de-camp' }
  | { kind: 'fin-de-journee' }
  /**
   * Disparaît quand le combat atteint ce moment de l'horloge (voir
   * `indexMoment` dans `combat.ts`). L'échéance dépend du bénéficiaire et de la
   * nature de l'effet — un bonus défensif et un bonus offensif ne vivent pas
   * jusqu'au même instant.
   */
  | { kind: 'moment-combat'; momentFin: number }
  | { kind: 'fin-de-combat' }

export type ModifierSourceKind =
  | 'maitrise'
  | 'fardeau'
  | 'serment'
  | 'marque'
  | 'equipement'
  | 'action-alt'
  | 'passif'
  | 'personnalite'
  | 'voie-flamme'
  | 'cicatrice'
  | 'mj'

export interface Modifier {
  id: string
  source: {
    kind: ModifierSourceKind
    /** id de l'élément de catalogue à l'origine du modificateur, si applicable. */
    ref?: string
    /** Libellé affiché à la joueuse : « Serment », « Cotte de mailles »… */
    label: string
  }
  target: ModifierTarget
  op: ModifierOp
  expires: ModifierExpiry
  /** Rempli quand une joueuse pose un modificateur sur une autre (Faire diversion). */
  posePar?: string
}

// ---------------------------------------------------------------------------
// Coûts de sorts
// ---------------------------------------------------------------------------

/**
 * Les coûts observés dans Classes.pdf couvrent exactement ces six formes.
 * `*-variable` = la joueuse choisit X au lancement (Burst, Word: Baboum, Sundown).
 */
export type CoutSort =
  | { kind: 'aucun' }
  | { kind: 'foi'; valeur: number }
  | { kind: 'foi-plus-variable'; base: number }
  | { kind: 'brulures'; valeur: number }
  | { kind: 'brulures-variable' }
  | { kind: 'marques-variable'; max: number }

// ---------------------------------------------------------------------------
// Catalogue — contenu éditable, jamais codé en dur dans les écrans
// ---------------------------------------------------------------------------

export interface EntreeCatalogueBase {
  id: string
  nom: string
  /** Nom du SVG dans public/icons (sans extension). */
  icone: string
  description?: string
  /** Contenu livré avec l'app, non supprimable depuis l'écran MJ. */
  seed?: boolean
}

export interface Classe extends EntreeCatalogueBase {
  kind: 'classe'
  /** Points de Fatigue de départ. Dusk Hunter 5, Soulshifter 4, Trickster 4. */
  fatigueMax: number
  /** Points de 6th Sens de base. Défaut 1 (Rules_For_Agents.pdf). */
  sixthSensBase: number
  lore: string
  passifTexte: string
  /** Sorts fournis d'office par la classe. */
  sortsIds: string[]
  /** Identifiant du comportement de passif câblé dans le moteur, si la classe en a un. */
  passifMoteur?: 'dusk-hexcore' | 'trickster-voie' | 'soulshifter-vies'
}

export interface Sort extends EntreeCatalogueBase {
  kind: 'sort'
  magie: Magie
  cout: CoutSort
  /** '1d6', '1d4'… ou null quand le sort ne demande aucun jet. */
  de: string | null
  duree: string
  effet: string
  /** Renseigné pour les sorts propres à une classe. */
  classeId?: string
  /** Illusion d'Illusionniste : gratuite et hors des 3 slots du Grimoire. */
  illusion?: boolean
  /** Prix en Lumens s'il peut apparaître en boutique. */
  prix?: number
}

export interface Equipement extends EntreeCatalogueBase {
  kind: 'equipement'
  slot: SlotEquipement
  /** Bonus d'Évasion apporté quand l'objet est équipé (armures surtout). */
  bonusEvasion?: number
  /** Modificateurs accordés tant que l'objet est équipé. */
  modificateurs?: Omit<Modifier, 'id' | 'expires'>[]
  prix?: number
  /**
   * Matériel de base (rations, catalyseur, paquetage) : hors des 3 slots
   * et exclu du tirage de Détachement.
   */
  materielDeBase?: boolean
  /** Attaque Spéciale : table d'effets propre à l'arme. */
  attaqueSpeciale?: {
    de: string
    /** Effets indexés par résultat du dé. */
    effets: Record<string, string>
    cout: { kind: 'paiement'; description: string } | { kind: 'charges'; max: number; rituel: string }
  }
}

export interface Investissement extends EntreeCatalogueBase {
  kind: 'investissement'
  cout: number
  beneficeTexte: string
  risqueTexte: string
  limiteTexte: string
  /** Gain immédiat en Lumens si le tirage de risque réussit. */
  gainImmediat?: number
  /** Gain versé au début de chaque session suivante. */
  gainRecurrent?: number
  /** Gain versé une seule fois, au début de la session suivante. */
  gainProchainSession?: number
  /** Probabilité que le risque se déclenche, entre 0 et 1. */
  probabiliteRisque?: number
  /** Coût prélevé quand le risque se déclenche (rénovation de chambre). */
  coutRisque?: number
  /** Nombre maximal de fois où l'investissement peut être pris, toutes sessions confondues. */
  limiteTotale?: number
  /** Nombre maximal de fois par session. */
  limiteParSession?: number
}

export interface Amelioration extends EntreeCatalogueBase {
  kind: 'amelioration'
  prix: number
  effetTexte: string
  /** Modificateurs permanents accordés par l'amélioration. */
  modificateurs?: Omit<Modifier, 'id' | 'expires'>[]
}

export type EntreeCatalogue = Classe | Sort | Equipement | Investissement | Amelioration

// ---------------------------------------------------------------------------
// Personnage
// ---------------------------------------------------------------------------

/**
 * État des passifs de classe.
 *
 * Champs explicites plutôt qu'un sac générique : ajouter une classe ajoute un
 * champ, ce qui reste vérifié par le compilateur au lieu de casser silencieusement.
 */
export interface EtatPassifs {
  /** Dusk Hunter — configuration Hexcore active. */
  hexcore?: 'overheat' | 'overdrive'
  /** Trickster — voie choisie à la phase Grimoire. */
  voieTrickster?: 'conteur' | 'illusionniste'
  /** Soulshifter — vies passées connues (numéros de face du dé). */
  viesConnues?: number[]
  /** Soulshifter — vie actuellement incarnée. */
  vieActive?: number | null
}

/**
 * Vie passée du Soulshifter.
 *
 * La personnalité incarnée recolore les quatre sorts de la classe et porte ses
 * propres effets. Le type vit dans le domaine, les données dans le catalogue.
 */
export interface VieSoulshifter {
  /** Face du dé qui la désigne. */
  face: number
  nom: string
  /**
   * Précision apportée à chaque sort, indexée par identifiant de sort.
   *
   * Indexer par `id` plutôt que par des champs fixes permet à une vie de ne
   * préciser qu'une partie des sorts, et à un sort ajouté plus tard d'être
   * couvert sans toucher au code.
   */
  precisions: Record<string, string>
}

export interface Character {
  id: string
  nom: string
  classeId: string
  /** Graine de génération de l'avatar abstrait. */
  avatarSeed: string

  maitrises: Maitrises

  fatigue: { max: number; coches: number }
  brulures: number
  foi: number
  marques: number

  sixthSensBase: number
  sixthSensUtilises: number

  lumens: number
  actionsRapidesUtilisees: number

  /** Les 3 emplacements de l'Armurerie. */
  equipe: Record<SlotEquipement, string | null>
  /** Les 3 sorts choisis au Grimoire, actifs jusqu'au prochain feu de camp. */
  grimoire: string[]

  possede: {
    sorts: string[]
    equipements: string[]
    ameliorations: string[]
  }

  /** Sorts Arcane dont le cristal est épuisé (d6 à 1 ou 2), jusqu'au prochain camp. */
  sortsEpuises: string[]

  /** Cicatrices accumulées, décrites librement par la MJ. */
  cicatrices: string[]

  passifs: EtatPassifs
  modifiers: Modifier[]

  /** Identifiant d'appareil ayant « réclamé » ce personnage. */
  claimedBy: string | null

  createdAt: number
  updatedAt: number
}

/**
 * Données réservées à la MJ.
 *
 * 🔒 Vit dans une collection Firestore distincte, refusée aux joueuses par les
 * règles de sécurité. Firestore ne sait pas restreindre la lecture champ par
 * champ : masquer ces valeurs dans l'UI ne suffirait pas à les garder secrètes.
 */
export interface CharacterSecret {
  characterId: string
  /** 1d4+2 tiré à la création. La joueuse ne doit jamais le voir. */
  cyclesTotal: number
  cyclesConsommes: number
  notesMJ: string
}

// ---------------------------------------------------------------------------
// État partagé de la table
// ---------------------------------------------------------------------------

export type ModeTable = 'standard' | 'combat' | 'campfire'

/**
 * Fiche réutilisable d'une créature, écrite par la MJ.
 *
 * 🔒 Vit dans une collection refusée aux joueuses : y figurent l'Évasion et le
 * seuil de Fatigue de chaque créature, y compris celles dont l'Évasion reste
 * masquée en combat. Un modèle n'est pas un adversaire en jeu — voir `Adversaire`.
 */
export interface ModeleAdversaire {
  id: string
  nom: string
  evasion: number
  /** Points de Fatigue encaissés avant de tomber. 0 = non renseigné. */
  fatigueMax: number
  icone: string
}

/**
 * Un exemplaire d'adversaire présent dans le combat en cours.
 *
 * Ce document est **lisible par les joueuses** : il ne contient donc que ce
 * qu'elles ont le droit de voir. Le seuil de Fatigue est ailleurs.
 */
export interface Adversaire {
  id: string
  nom: string
  evasion: number
  /** Quand false, les joueuses voient « ? » à la place de l'Évasion. */
  evasionPublique: boolean
  degatsSubis: number
  icone: string
  /** Ordre d'affichage. */
  ordre: number
}

/**
 * Seuils de Fatigue des adversaires en jeu, indexés par identifiant d'adversaire.
 *
 * 🔒 Regroupés dans un seul document réservé à la MJ : une seule souscription,
 * et surtout aucune chance qu'un seuil se retrouve dans le document public.
 */
export type SeuilsAdversaires = Record<string, number>

export interface EtatCombat {
  /** Numéro du tour, incrémenté par la MJ. Sert d'ancre aux Actions Alternatives. */
  tour: number
  /** Sous-groupe qui agit : [4-6] avant la MJ, [1-3] après. */
  sousGroupeActif: 'avant-mj' | 'mj' | 'apres-mj'
  /** Initiative saisie par chaque joueuse (résultat du d6). */
  initiatives: Record<string, number>
}

export type PhaseCampfire = 'banque' | 'brief' | 'boutique' | 'grimoire' | 'armurerie'

export const PHASES_CAMPFIRE: PhaseCampfire[] = [
  'banque',
  'brief',
  'boutique',
  'grimoire',
  'armurerie',
]

export const LIBELLE_PHASE: Record<PhaseCampfire, string> = {
  banque: 'Banque',
  brief: 'Brief de Mission',
  boutique: 'Boutique',
  grimoire: 'Grimoire',
  armurerie: 'Armurerie',
}

export interface EtatTable {
  mode: ModeTable
  combat: EtatCombat | null
  campfireId: string | null
  /** Numéro de journée de fiction, incrémenté à chaque feu de camp « fin de journée ». */
  jour: number
  sessionId: string | null
  /** Réservé aux upgrades futures (QTE, combat rapide) : un overlay poussé sur des écrans. */
  overlay: { kind: string; cibles: string[]; payload: unknown } | null
}

// ---------------------------------------------------------------------------
// Journal
// ---------------------------------------------------------------------------

export interface EvenementJournal {
  id: string
  ts: number
  /** Nom du personnage ou « MJ ». */
  acteur: string
  type: string
  /** Phrase déjà rédigée, prête à afficher. */
  resume: string
  payload?: Record<string, unknown>
}
