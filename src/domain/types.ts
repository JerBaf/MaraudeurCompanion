/**
 * Types du domaine « Entre-Monde ».
 *
 * Ce module — et tout `src/domain/` — ne connaît ni React ni Firebase.
 * C'est volontaire : les règles du jeu se testent sans navigateur ni réseau.
 */

// Import de type uniquement : `elements.ts` importe des valeurs d'ici
// (`COMPETENCES`, `LIBELLE_COMPETENCE`), et un `import type` s'efface à la
// compilation — le cycle n'existe donc pas à l'exécution.
import type { Cout } from './couts.ts'
import type { Cible, ElementVariable } from './elements.ts'

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

/** Maîtrise par compétence. Profil type : deux +3, un 0, un -3. */
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

export type ModifierOp =
  | { kind: 'add'; value: number }
  | { kind: 'avantage' }
  | { kind: 'desavantage' }

/**
 * Quand le modificateur disparaît.
 *
 * `fin-de-camp` = au prochain feu de camp, quel qu'il soit.
 * `fin-de-session` = uniquement à un feu de camp **initial**, qui ouvre une session.
 * `fin-tour-suivant` = Actions Alternatives ; `turnId` identifie le tour de combat
 * pendant lequel le modificateur a été posé, pour qu'il survive exactement un tour.
 */
export type ModifierExpiry =
  | { kind: 'jamais' }
  | { kind: 'fin-de-camp' }
  | { kind: 'fin-de-session' }
  /**
   * Ancien nom de `fin-de-session`, du temps où le système comptait les journées
   * de fiction. Des Serments et des Fardeaux écrits sous cette forme dorment en
   * base : le conserver ici évite qu'`expireModifiers` ne les efface au premier
   * camp faute de savoir les reconnaître.
   */
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
  /** Ce qu'il ajuste : un Élément Variable, sous l'aspect valeur ou plafond. */
  target: Cible
  op: ModifierOp
  expires: ModifierExpiry
  /** Rempli quand une joueuse pose un modificateur sur une autre (Faire diversion). */
  posePar?: string
}

// ---------------------------------------------------------------------------
// Coûts de sorts
// ---------------------------------------------------------------------------

/**
 * Les six formes de coût de sort d'avant l'unification.
 *
 * ⚠️ **Ancien format, conservé pour la seule relecture.** `Sort.cout` est
 * désormais un `Cout` générique, qui les couvre toutes et sait en plus exprimer
 * un « OU ». `normaliserEntree` (`catalog.ts`) fait la conversion à la lecture :
 * des sorts écrits sous cette forme dorment en base, et l'amorçage ne les
 * réécrira jamais.
 */
export type CoutSort =
  | { kind: 'aucun' }
  | { kind: 'foi'; valeur: number }
  | { kind: 'foi-plus-variable'; base: number }
  | { kind: 'brulures'; valeur: number }
  | { kind: 'brulures-variable' }
  | { kind: 'marques-variable'; max: number }

// ---------------------------------------------------------------------------
// Effets et Actifs
// ---------------------------------------------------------------------------

/**
 * Ce qu'une opération fait à sa cible.
 *
 * ⚠️ **Plus riche que `ModifierOp`, et c'est voulu.** `set` et `add-x` n'ont de
 * sens qu'au moment où l'effet s'applique : `agreger` somme les `add` en un
 * scalaire, où un `set` dépendrait de l'ordre et un `add-x` n'aurait pas encore
 * de X. Un passif permanent, qui se compile en `Modifier`, n'accepte donc que
 * les trois opérations de `ModifierOp`.
 */
export type OperationValeur =
  | { kind: 'add'; value: number }
  /** Le X payé au lancement. Réservé aux effets déclenchés. */
  | { kind: 'add-x' }
  | { kind: 'set'; value: number }
  | { kind: 'avantage' }
  | { kind: 'desavantage' }

/**
 * Une opération concrète : ce que le moteur applique vraiment.
 *
 * Où elle atterrit ne se choisit pas, cela se déduit de la cible : une jauge
 * (Foi, Lumens, Marques…) reçoit une **écriture immédiate**, une statistique
 * calculée ou un plafond reçoit un **modificateur**. Voir `estEcritureDirecte`
 * dans `passifs.ts`.
 */
export type Operation = {
  kind: 'ajuster'
  cible: Cible
  op: OperationValeur
  /**
   * Quand l'effet cesse, s'il devient un modificateur.
   *
   * ⚠️ **L'application n'a aucune horloge de fiction** : elle ne saura jamais
   * qu'une heure en jeu s'est écoulée. `Sort.duree` reste donc du texte lu à
   * table, et seule cette échéance — parmi celles que le moteur sait tenir —
   * est appliquée. Absente, l'effet dure jusqu'à ce qu'on le dissipe.
   */
  expire?: ModifierExpiry
}

/**
 * Un Effet : ce qui se produit.
 *
 * `texte` est toujours là — c'est ce qu'on lit à table. Un effet **abstrait**
 * n'a que lui : matérialiser un avion en papier ne change aucune valeur que
 * l'application tienne. Un effet **concret** porte en plus des opérations que
 * le moteur applique.
 */
export interface Effet {
  texte: string
  /** Absent ou vide = effet abstrait, que la MJ arbitre à table. */
  operations?: Operation[]
}

// ---------------------------------------------------------------------------
// Passifs
// ---------------------------------------------------------------------------

/**
 * Ce qui arme un passif réactif.
 *
 * `chez` porte la portée : « Obtenez une brûlure chaque fois qu'un allié prend
 * une brûlure » se lit `{ element: brulures, sens: 'augmente', chez: 'un-allie' }`.
 */
export interface ConditionReaction {
  element: ElementVariable
  sens: 'augmente' | 'diminue'
  chez: 'soi' | 'un-allie' | 'quiconque'
}

export type Declenchement =
  /**
   * En vigueur tant que la source l'est — objet porté, amélioration possédée.
   * `condition` le suspend en dessous d'un seuil : c'est ce qui permet
   * d'exprimer « +1 6th Sens à partir de 4 brûlures » sans l'écrire en dur.
   */
  | { kind: 'permanent'; condition?: { element: ElementVariable; seuil: number } }
  /** Armé par un changement d'Élément Variable. */
  | { kind: 'reaction'; quand: ConditionReaction }

/**
 * Un Passif : un changement qui se produit sans que la joueuse l'actionne.
 *
 * Un seul type pour les deux régimes qui coexistaient — les `modificateurs`,
 * qui ajustaient une valeur en permanence, et les `declencheurs`, qui
 * réagissaient à un changement. Ils ne différaient que par leur déclenchement,
 * jamais par leur effet : les réunir, c'est permettre à une réaction d'accorder
 * un bonus d'Évasion, ce qu'aucun des deux ne savait faire.
 */
export interface Passif {
  id: string
  /** Ce que la joueuse lit dans ses effets en cours. */
  libelle: string
  declenchement: Declenchement
  effet: Effet
}

/** Une table d'effets. Une seule face rend l'effet déterministe. */
export interface TableAleatoire {
  /** 1, 4, 6, 8… : la table se lance au d{faces}. */
  faces: number
  /** Un effet par face, dans l'ordre des résultats. */
  entrees: Effet[]
}

/** Comment un Actif épuisé retrouve ses utilisations. */
export type Recharge =
  /** Un geste de fiction que la MJ valide : bain de pleine lune, sang de Carcasse. */
  | { kind: 'rituel'; description: string }
  /** Payer pour tout récupérer d'un coup. */
  | { kind: 'cout'; cout: Cout }
  /**
   * Rien ne le recharge. À zéro, l'objet reste en inventaire, marqué et
   * inutilisable : c'est à la MJ ou à la joueuse de l'en retirer.
   */
  | { kind: 'aucune' }

export interface Usages {
  max: number
  recharge: Recharge
}

/**
 * Un Actif : ce qu'on déclenche volontairement.
 *
 * Vaut pour l'Attaque Spéciale d'une arme comme pour une potion ou le
 * lancement d'un sort. Un Actif se borne par un **coût**, par un **nombre
 * d'utilisations**, ou par les deux — un Actif sans l'un ni l'autre est
 * simplement gratuit et illimité.
 */
export interface Actif {
  id: string
  nom: string
  cout?: Cout
  usages?: Usages
  table: TableAleatoire
}

/** Ce qu'une entrée de catalogue peut faire faire volontairement à sa porteuse. */
export interface PorteurActifs {
  actifs?: Actif[]
}

/**
 * Ce qu'une entrée de catalogue accorde et déclenche.
 *
 * ⚠️ `Sort` reçoit `PorteurActifs` mais **pas** `passifs` : décision actée en
 * `docs/PASSATION.md` §5 — un passif permanent se modélise par une amélioration,
 * ce qui évite un troisième régime d'activation (sort connu ? préparé ? lancé ?).
 */
export interface PorteurEffets extends PorteurActifs {
  passifs?: Passif[]
}

// ---------------------------------------------------------------------------
// Catalogue — contenu éditable, jamais codé en dur dans les écrans
// ---------------------------------------------------------------------------

export interface EntreeCatalogueBase {
  id: string
  nom: string
  /** Nom du SVG dans public/icons (sans extension). */
  icone: string
  description?: string
  /**
   * Teinte de rareté, façon inventaire de jeu vidéo. Absent = commun.
   *
   * Sur la base et non sur le seul équipement : une joueuse à qui l'on propose un
   * sort en boutique a le même besoin d'en jauger le palier.
   */
  rarete?: Rarete
  /** Contenu livré avec l'app, non supprimable depuis l'écran MJ. */
  seed?: boolean
  /**
   * Dossier de rangement, ou absent pour « non classé ».
   *
   * Un seul par entrée : le dossier « ALL » n'est jamais stocké, il se dérive.
   */
  dossierId?: string
  /**
   * Date de création, pour le tri. Absente sur tout ce qui a été écrit avant
   * son existence : ces entrées se trient comme les plus anciennes.
   */
  creeLe?: number
}

/**
 * Un choix de classe : des options mutuellement exclusives, dont la joueuse
 * retient une.
 *
 * Généralise les configurations d'Hexcore du Dusk Hunter et les voies du
 * Trickster, jusqu'ici deux champs codés en dur avec chacun sa liste. Créer une
 * classe complète depuis l'écran MJ demandait de pouvoir les écrire en données.
 */
export interface ChoixClasse {
  id: string
  libelle: string
  /**
   * Quand le choix peut changer.
   *
   * ⚠️ **Ce verrou porte une règle, pas une commodité d'écran.** La voie du
   * Trickster s'engage au Feu de Camp et vaut jusqu'au suivant ; l'Hexcore du
   * Dusk Hunter se bascule quand on veut, au prix d'un tour. Les datifier sans
   * ce champ déverrouillerait silencieusement la voie du Trickster.
   */
  verrou: 'libre' | 'feu-de-camp'
  options: OptionChoixClasse[]
}

export interface OptionChoixClasse {
  id: string
  nom: string
  /** Ce que l'option fait, en toutes lettres. */
  effet: string
  /** Ce qu'elle accorde mécaniquement. Vide pour une option purement narrative. */
  passifs?: Passif[]
}

export interface Classe extends EntreeCatalogueBase, PorteurEffets {
  kind: 'classe'
  /** Choix offerts par la classe, résolus dans `Character.passifs.choix`. */
  choix?: ChoixClasse[]
  /** Points de Fatigue de départ. Dusk Hunter 5, Soulshifter 4, Trickster 4. */
  fatigueMax: number
  /** Points de 6th Sens de base. Défaut 1 (Rules_For_Agents.pdf). */
  sixthSensBase: number
  lore: string
  passifTexte: string
  /** Sorts fournis d'office par la classe. */
  sortsIds: string[]
  /** Identifiant du comportement de passif câblé dans le moteur, si la classe en a un. */
  /**
   * Comportement de passif câblé dans le moteur, si la classe en a un.
   *
   * ⚠️ **Il n'en reste qu'un : `soulshifter-vies`.** Un dé dont les faces sont
   * les vies connues, un jeton d'invocation rendu par la MJ, des précisions par
   * sort — rien de cela ne se ramène à un choix parmi des options.
   *
   * `dusk-hexcore` et `trickster-voie` sont passés en données (`choix`) et ne
   * servent plus qu'à poser le défaut à la création. Les deux valeurs restent
   * acceptées : des fiches de classe en base les portent encore.
   */
  passifMoteur?: 'dusk-hexcore' | 'trickster-voie' | 'soulshifter-vies'
}

export interface Sort extends EntreeCatalogueBase, PorteurActifs {
  kind: 'sort'
  /**
   * Identifiant de son type magique — une entrée `TypeMagique` du catalogue.
   *
   * Les trois types d'origine gardent leurs identifiants historiques
   * (`arcane`, `sang`, `miracle`), si bien que les sorts déjà en base s'y
   * rattachent sans conversion.
   */
  magieId: string
  /** ⚠️ **Ancien nom**, du temps où les types magiques étaient une union fermée. */
  magie?: Magie
  /**
   * Ce qu'il faut payer pour le lancer. `{ branches: [] }` = gratuit.
   *
   * Un sort gratuit doit avoir un dé : sans coût ni aléa, rien ne le borne.
   */
  cout: Cout
  /** '1d6', '1d4'… ou null quand le sort ne demande aucun jet. */
  de: string | null
  duree: string
  effet: string
  /**
   * Classes autorisées à le lancer. Vide ou absent = ouvert à toutes.
   *
   * Se lit par `classesDuSort` (`magie.ts`), qui absorbe l'ancien champ
   * `classeId` — des sorts au singulier dorment encore en base.
   */
  classesIds?: string[]
  /** Ancien nom, au singulier. Conservé pour relire le contenu déjà saisi. */
  classeId?: string
  /**
   * Option de classe qui donne accès à ce sort — l'identifiant d'une
   * `OptionChoixClasse`.
   *
   * Le sort est alors utilisable **hors des 3 emplacements** du Grimoire, et
   * n'apparaît ni en boutique ni au tirage de Détachement : la voie y « donne
   * accès », elle ne le fait pas posséder. Généralise le drapeau `illusion`,
   * qui ne savait décrire que le cas de l'Illusionniste.
   */
  requiertPassif?: string
  /** ⚠️ **Ancien champ** — illusion d'Illusionniste. */
  illusion?: boolean
  /** Prix en Lumens s'il peut apparaître en boutique. */
  prix?: number
}

export interface Equipement extends EntreeCatalogueBase, PorteurEffets {
  kind: 'equipement'
  slot: SlotEquipement
  /** Bonus d'Évasion apporté quand l'objet est équipé (armures surtout). */
  bonusEvasion?: number
  /** ⚠️ **Ancien format** : converti en `passifs` permanents à la lecture. */
  modificateurs?: Omit<Modifier, 'id' | 'expires'>[]
  /** ⚠️ **Ancien format** : converti en `passifs` réactifs à la lecture. */
  declencheurs?: Declencheur[]
  prix?: number
  /**
   * Matériel de base (rations, catalyseur, paquetage) : hors des 3 slots
   * et exclu du tirage de Détachement.
   */
  materielDeBase?: boolean
  /**
   * ⚠️ **Ancien format, conservé pour la seule relecture.** Remplacé par
   * `actifs`, qui en accepte plusieurs par objet. `normaliserEntree` convertit.
   */
  effetsActifs?: EffetsActifs
}

/** Les jauges d'un personnage qu'un déclencheur peut lire ou faire varier. */
export type Ressource = 'fatigue' | 'marques' | 'foi' | 'brulures' | 'lumens'

/**
 * Passif réactif : « quand telle ressource bouge, telle autre varie ».
 *
 * S'arme au même régime que les modificateurs — équipement porté, amélioration
 * possédée. La résolution vit dans `domain/declencheurs.ts`.
 */
export interface Declencheur {
  quand: Ressource
  sens: 'augmente' | 'diminue'
  alors: Ressource
  delta: number
}

/**
 * Ce que coûtait l'usage d'un objet à effets actifs.
 *
 * ⚠️ **Ancien format, conservé pour la seule relecture** — voir `Recharge`.
 */
export type CoutUsage =
  /** Charges rechargeables par un rituel, que la MJ applique à la main. */
  | { kind: 'charges'; max: number; rituel: string }
  /** Charges non rechargeables : à zéro, l'objet est détruit. */
  | { kind: 'consommable'; max: number }
  /** Ni compteur ni recharge : la contrepartie s'applique à table. */
  | { kind: 'paiement'; description: string }

/** ⚠️ **Ancien format, conservé pour la seule relecture** — voir `Actif`. */
export interface EffetsActifs {
  faces: number
  effets: string[]
  cout: CoutUsage
}

/** Les tailles de table proposées par le PDF. */
export const FACES_TABLE = [1, 4, 6, 8] as const

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

export interface Amelioration extends EntreeCatalogueBase, PorteurEffets {
  kind: 'amelioration'
  prix: number
  effetTexte: string
  /** ⚠️ **Ancien format** : converti en `passifs` permanents à la lecture. */
  modificateurs?: Omit<Modifier, 'id' | 'expires'>[]
  /** ⚠️ **Ancien format** : converti en `passifs` réactifs à la lecture. */
  declencheurs?: Declencheur[]
}

/**
 * Un type de magie — Arcane, Sang, Miracle, et ceux que la MJ créera.
 *
 * Entrée de catalogue et non plus union fermée : un nouveau type magique se
 * crée depuis l'écran MJ. Les trois d'origine sont semés sous leurs
 * identifiants historiques (`arcane`, `sang`, `miracle`) pour que les sorts
 * déjà en base continuent de s'y rattacher.
 */
export interface TypeMagique extends EntreeCatalogueBase, PorteurEffets {
  kind: 'type-magique'
  /** L'Élément Variable dans lequel ses sorts se paient d'ordinaire. */
  elementCoutParDefaut?: string
  /** Le dé qui lui est associé — « 1d6 » pour l'Arcane. */
  deParDefaut?: string | null
  /**
   * Ses sorts consomment un cristal, épuisable jusqu'au prochain camp.
   * C'est la mécanique « Hexite épuisé », jusqu'ici câblée sur l'Arcane.
   */
  cristal?: boolean
  teinte?: string
}

/**
 * Une quête.
 *
 * Entrée de catalogue et non collection à part : la MJ les prépare à l'avance
 * dans l'onglet Création, avec les mêmes nom, icône, description et rareté que
 * le reste du contenu. Les joueuses lisent déjà le catalogue en temps réel, et
 * les règles Firestore y disent exactement ce qu'il faut — lecture pour la
 * table, écriture pour la MJ seule, qui est la seule à changer l'état.
 *
 * ⚠️ L'état est porté par la **quête**, pas par chaque porteuse : la valider,
 * c'est la clore pour toutes celles qui l'ont acceptée, et leur verser la
 * récompense d'un seul geste. Une quête validée est donc consommée ; pour la
 * rejouer, on en recrée une.
 */
export interface Quete extends EntreeCatalogueBase {
  kind: 'quete'
  etat: EtatQuete
  recompense: Recompense
}

export type EtatQuete = 'en-cours' | 'validee'

/**
 * Ce que la validation d'une quête verse à chaque porteuse.
 *
 * `entrees` porte des identifiants de catalogue : l'entrée sait déjà si elle est
 * un sort, un équipement ou une amélioration, si bien qu'un seul champ couvre
 * les trois familles. Les Lumens, eux, ne sont pas une entrée de catalogue —
 * d'où le champ à part.
 */
export interface Recompense {
  lumens?: number
  entrees: string[]
}

/**
 * Un dossier de rangement.
 *
 * ⚠️ **Polyvalent** : un même dossier range indifféremment des sorts, des
 * équipements et des améliorations. Il portait d'abord une `cible` qui le
 * limitait à une famille — c'était une erreur de lecture : un dossier de table
 * est thématique (« Poisons », « Butin du donjon ») et mêle naturellement les
 * trois. La `cible` des documents déjà écrits est retirée à la lecture par
 * `normaliserEntree`.
 *
 * Le dossier « ALL » n'existe pas en base — il se dérive de l'absence de filtre.
 */
export interface Dossier extends EntreeCatalogueBase {
  kind: 'dossier'
  ordre: number
}

/** Aucun filtre de dossier : le « ALL » virtuel, qui n'est jamais stocké. */
export const DOSSIER_TOUS = ''

/**
 * Ce qui n'a été rangé nulle part.
 *
 * Une valeur sentinelle, et non l'absence de valeur : « non classé » est un
 * choix qu'on peut cocher, au même titre qu'un dossier. Vit ici plutôt que dans
 * `filtres.ts` parce que `campfire.ts` en a besoin lui aussi, et qu'il ne peut
 * pas importer `filtres.ts` — celui-ci lui prend déjà `prixDe`.
 */
export const SANS_DOSSIER = 'sans-dossier'

/**
 * Vrai si l'entrée tombe dans l'un des dossiers retenus.
 *
 * Une liste **vide ne filtre rien** : c'est le « ALL » virtuel, et non « aucun
 * dossier ». Sans cette lecture, préparer un camp sans rien cocher ne
 * proposerait jamais la moindre offre.
 */
export function dansLesDossiers(entree: EntreeCatalogueBase, dossiers: readonly string[]): boolean {
  if (dossiers.length === 0) return true
  return entree.dossierId
    ? dossiers.includes(entree.dossierId)
    : dossiers.includes(SANS_DOSSIER)
}

/**
 * Rareté d'un objet, et sa teinte.
 *
 * La couleur veut dire quelque chose à table : un objet garde la sienne partout
 * — avatar, inventaire, boutique, catalogue. Ajouter un niveau, c'est ajouter
 * une ligne à `RARETES`.
 */
export type Rarete = 'commun' | 'rare' | 'epique' | 'legendaire' | 'unique'

export const RARETES: Record<Rarete, { libelle: string; teinte: string }> = {
  commun: { libelle: 'Commun', teinte: '#b9b2a4' },
  rare: { libelle: 'Rare', teinte: '#5b9bd5' },
  epique: { libelle: 'Épique', teinte: '#a06cd5' },
  legendaire: { libelle: 'Légendaire', teinte: '#d97a2b' },
  unique: { libelle: 'Unique', teinte: '#d4af37' },
}

export type EntreeCatalogue =
  | Classe
  | Sort
  | Equipement
  | Investissement
  | Amelioration
  | TypeMagique
  | Dossier
  | Quete

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
  /**
   * Options retenues parmi les `choix` de la classe, par identifiant de choix.
   *
   * Remplace les champs `hexcore` et `voieTrickster`, qui obligeaient à coder
   * une classe pour lui donner un passif à options. Ceux-ci s'y replient à la
   * lecture, comme `classeId` s'est replié dans `classesIds`.
   */
  choix?: Record<string, string>
  /** ⚠️ **Ancien champ** — Dusk Hunter, configuration Hexcore active. */
  hexcore?: 'overheat' | 'overdrive'
  /** ⚠️ **Ancien champ** — Trickster, voie choisie à la phase Grimoire. */
  voieTrickster?: 'conteur' | 'illusionniste'
  /** Soulshifter — vies passées connues (numéros de face du dé). */
  viesConnues?: number[]
  /** Soulshifter — vie actuellement incarnée. */
  vieActive?: number | null
  /**
   * Soulshifter — instant du dernier tirage. **Sa présence est le jeton
   * d'invocation consommé** : absent = le dé est disponible. Seule la MJ le
   * retire, quand l'heure de jeu est passée (voir `peutTirerUneVie`).
   */
  vieTireeA?: number
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

  /**
   * Brûlures **acquises**, plafonnées à 9.
   *
   * Elles ne disparaissent pas quand on les dépense : la marque reste sur la
   * peau. C'est sur ce total que se lisent les paliers de la Voie de la Flamme.
   */
  brulures: number
  /**
   * Brûlures déjà dépensées. `brulures - bruluresConsommees` donne ce qui reste
   * utilisable ; à la neuvième consommée, c'est la Combustion.
   */
  bruluresConsommees: number

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
    /** Quêtes acceptées, en cours comme passées. L'état se lit sur la quête. */
    quetes: string[]
  }

  /**
   * Registre des investissements acquis, toutes sessions confondues.
   *
   * C'est lui qui porte les limites du type « 3 chambres toutes sessions
   * confondues » : on compte les entrées plutôt que de tenir un compteur
   * séparé, qui finirait par diverger.
   */
  investissements: InvestissementPris[]

  /** Ce qui a déjà été consommé au Feu de Camp, et jusqu'à quand. */
  jetonsCamp: JetonsCamp

  /**
   * Charges restantes, par identifiant d'équipement.
   *
   * Une clé absente signifie « objet au complet » : sans ce repli, il faudrait
   * initialiser les charges à chaque acquisition — achat en boutique, don de la
   * MJ, fiche écrite avant l'existence du champ. `chargesRestantes`
   * (`domain/objets.ts`) porte la règle une fois pour toutes.
   */
  chargesObjets: Record<string, number>

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

export type ModeTable = 'standard' | 'combat' | 'campfire' | 'duel'

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

// ---------------------------------------------------------------------------
// Combat rapide — le duel « Flow »
// ---------------------------------------------------------------------------

/**
 * Les cinq actions du duel.
 *
 * ⚠️ **L'ordre de ce tableau est l'anneau, et l'anneau est toute la règle.**
 * Résolution, Flow, Anti-Flow et Appât s'y déduisent tous d'un décalage d'index
 * (`domain/duel.ts`), et le pentagone affiché à l'écran s'en dessine. Réordonner
 * cette liste change le jeu ; y insérer une action met tout à jour d'un coup.
 */
export const ACTIONS_DUEL = ['pression', 'feinte', 'placement', 'contre', 'garde'] as const
export type ActionDuel = (typeof ACTIONS_DUEL)[number]

export const LIBELLE_ACTION_DUEL: Record<ActionDuel, string> = {
  pression: 'Pression',
  feinte: 'Feinte',
  placement: 'Placement',
  contre: 'Contre',
  garde: 'Garde',
}

export type IssueEchange = 'joueuse' | 'adversaire' | 'clash'

/** Une manche révélée. La suite de ces manches porte tout l'état du duel. */
export interface MancheJouee {
  actionJoueuse: ActionDuel
  actionAdversaire: ActionDuel
  issue: IssueEchange
  points: number
  /** La gagnante a complété son Flow. */
  flow: boolean
  /** La manche valait 2 grâce à un Clash antérieur. */
  bonusClash: boolean
}

export type IssueDuel =
  | {
      kind: 'victoire'
      vainqueur: 'joueuse' | 'adversaire'
      /** `objectif` = 4 points ; `points` = meilleur score ; `derniere-marque` = départage. */
      motif: 'objectif' | 'points' | 'derniere-marque'
    }
  /** Personne n'a marqué : le PNJ qui fuyait s'échappe, l'assaut échoue. */
  | { kind: 'statu-quo' }

/**
 * Un duel en cours.
 *
 * Ce document est **lisible par toute la table** : les joueuses qui ne se
 * battent pas suivent le plateau. Il ne contient donc que ce qui a été révélé —
 * le motif du PNJ vit dans `DuelPrive`.
 *
 * Ni score ni action précédente : `etatDuel` (`domain/duel.ts`) les recalcule
 * depuis `historique`, si bien que rien ne peut se désynchroniser.
 */
export interface Duel {
  id: string
  /** La duelliste. Les autres joueuses regardent. */
  characterId: string
  adversaireNom: string
  adversaireIcone: string
  /** Ce qui se joue, annoncé à la table ; c'est le statu quo si personne ne marque. */
  enjeu: string
  dureeChoixMs: number
  /** Jouée pour la duelliste si le chrono expire sans rien de sélectionné. */
  actionParDefaut: ActionDuel
  historique: MancheJouee[]
  /** Départ du chrono de la manche en cours ; `null` = manche pas encore ouverte. */
  debutManche: number | null
  /** Le choix **verrouillé** de la duelliste — le seul champ qu'elle a le droit d'écrire. */
  choixJoueuse: ActionDuel | null
  issue: IssueDuel | null
  lanceLe: number | null
}

/**
 * La préparation du duel, et le motif du PNJ.
 *
 * 🔒 Vit dans un document refusé aux joueuses. **Un duel dont le motif est
 * lisible est un duel déjà résolu** : Firestore ne sait pas cacher un champ, et
 * masquer la valeur à l'écran ne protégerait rien.
 *
 * Le même document sert de brouillon puis de secret vivant — `duelId` distingue
 * les deux : `null` tant que rien n'est lancé.
 */
export interface DuelPrive {
  duelId: string | null
  characterId: string
  adversaireNom: string
  adversaireIcone: string
  enjeu: string
  dureeChoixMs: number
  actionParDefaut: ActionDuel
  /** La suite d'actions du PNJ, répétée jusqu'à la fin du duel. */
  motif: ActionDuel[]
  /** Remplace la prochaine action scriptée, une seule fois. */
  override: ActionDuel | null
}

export type PhaseCampfire = 'banque' | 'brief' | 'boutique' | 'grimoire' | 'armurerie'

/**
 * Les deux natures de Feu de Camp.
 *
 * `initial` ouvre une session : c'est lui qui rend le 6th Sens et les Actions
 * Rapides, lève les Fardeaux et Serments engagés, et donne accès à la Banque et
 * au Brief. `repos-court` est une halte en cours de session — on y achète, on
 * réétudie ses cristaux, on refait son Grimoire et son Armurerie, rien de plus.
 *
 * Ce qui les distingue est rassemblé dans `PROFILS_CAMP` (`campfire.ts`) plutôt
 * qu'éparpillé en booléens : ajouter une nature de camp, c'est ajouter une ligne.
 */
export type TypeCamp = 'initial' | 'repos-court'

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
  grimoire: 'Sorts',
  armurerie: 'Armurerie',
}

// ---------------------------------------------------------------------------
// Sessions et Feux de Camp
// ---------------------------------------------------------------------------

/**
 * Ce que la joueuse a déjà consommé au Feu de Camp.
 *
 * Chaque jeton porte sa **portée dans sa valeur** plutôt que d'être un booléen :
 * on y range le moment où l'action a été faite, et la disponibilité se dérive en
 * comparant avec le moment courant. Rien n'a donc à être remis à zéro — c'est
 * exactement ce qui manquait à la version précédente, où « une acquisition par
 * feu de camp » se comportait en « une par session » faute de réinitialisation.
 *
 * Vit sur la fiche du personnage, seul document que la joueuse a le droit
 * d'écrire : les jetons rangés dans le document de session étaient refusés par
 * les règles Firestore, et la limite n'était jamais posée.
 */
export interface JetonsCamp {
  /** Numéro de session où l'action a été consommée. */
  recueillir: number | null
  fardeau: number | null
  serment: number | null
  /** Identifiant du camp où l'acquisition en boutique a été faite. */
  achat: string | null
}

export interface Session {
  id: string
  numero: number
  ouverteLe: number
}

/** Un investissement acquis, et la session où il l'a été. */
export interface InvestissementPris {
  investissementId: string
  sessionNumero: number
}

/**
 * Un Feu de Camp.
 *
 * Le même type sert au brouillon que la MJ prépare (rangé dans la collection
 * qui lui est réservée) et au camp publié que les joueuses lisent. Lancer un
 * camp, c'est recopier le brouillon dans la collection publique — le brief et
 * les offres ne peuvent donc pas fuiter avant l'annonce.
 */
export interface Campfire {
  id: string
  sessionNumero: number
  /** Ce que ce camp restaure et quelles phases il ouvre — voir `PROFILS_CAMP`. */
  type: TypeCamp
  /** Phase pilotée par la MJ ; l'écran des joueuses suit. */
  phase: PhaseCampfire
  brief: string
  /** Les offres tirées, par identifiant de personnage. */
  offres: Record<string, string[]>
  /**
   * Dossiers où puiser les offres. **Vide = tout le catalogue.**
   *
   * Préparer une boutique thématique — « Poisons » et « Reliques » avant une
   * descente — demandait jusqu'ici de remplacer chaque offre à la main, joueuse
   * par joueuse. Le tirage seul en tient compte : les listes de remplacement
   * restent ouvertes à tout, pour que la MJ puisse toujours glisser une pièce
   * hors thème.
   */
  dossiersOffres?: string[]
  /** Investissements ouverts à la Banque. */
  investissementsProposes: string[]
  lanceLe: number | null
}

export interface EtatTable {
  mode: ModeTable
  combat: EtatCombat | null
  campfireId: string | null
  /** Le combat rapide en cours, s'il y en a un. */
  duelId: string | null
  sessionId: string | null
  /** Réservé aux upgrades futures (QTE) : un overlay poussé sur des écrans. */
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
