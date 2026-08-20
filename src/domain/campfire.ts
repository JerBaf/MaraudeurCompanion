import type { Catalog } from './catalog.ts'
import { expireModifiers, FOI_DE_DEPART } from './modifiers.ts'
import type { Rng } from './random.ts'
import {
  PHASES_CAMPFIRE,
  type Campfire,
  type Character,
  type EntreeCatalogue,
  type Investissement,
  type JetonsCamp,
  type PhaseCampfire,
  type TypeCamp,
} from './types.ts'

// ---------------------------------------------------------------------------
// Les deux natures de camp
// ---------------------------------------------------------------------------

export interface ProfilCamp {
  libelle: string
  /** Les phases que ce camp ouvre, dans l'ordre où la MJ les pilote. */
  phases: PhaseCampfire[]
  /** Cases de Fatigue rendues à l'ouverture du camp. */
  fatigueRendue: number
  /**
   * Vrai si ce camp marque une frontière de session. Il rend alors le 6th Sens
   * et les Actions Rapides, lève les Fardeaux, Serments et Marques engagés, et
   * rouvre les gains de Foi — trois conséquences d'une même bascule, d'où un
   * seul drapeau plutôt que trois qui pourraient diverger.
   */
  frontiereDeSession: boolean
}

/**
 * Feu de Camp.
 *
 * Décision arrêtée avec la MJ : la notion de journée de fiction est abandonnée
 * au profit de deux natures de camp explicites. Un camp **initial** ouvre la
 * session — il ne rend qu'un point de Fatigue, mais il restaure le 6th Sens,
 * lève les effets de la session écoulée et donne accès à la Banque, au Brief et
 * aux gains de Foi. Un **repos court** est une halte : on y achète, on réétudie
 * ses cristaux, on refait son Grimoire et son Armurerie, rien d'autre.
 *
 * Tout ce qui les sépare tient dans cette table. Ajouter une nature de camp,
 * c'est ajouter une ligne — aucun écran n'a à connaître la différence.
 */
export const PROFILS_CAMP: Record<TypeCamp, ProfilCamp> = {
  initial: {
    libelle: 'Feu de camp initial',
    phases: ['banque', 'brief', 'boutique', 'grimoire', 'armurerie'],
    fatigueRendue: 1,
    frontiereDeSession: true,
  },
  'repos-court': {
    libelle: 'Repos court',
    phases: ['boutique', 'grimoire', 'armurerie'],
    fatigueRendue: 0,
    frontiereDeSession: false,
  },
}

export function profilCamp(type: TypeCamp): ProfilCamp {
  return PROFILS_CAMP[type]
}

export interface ResultatCamp {
  char: Character
  effets: string[]
}

export function resoudreCampPourPersonnage(char: Character, type: TypeCamp): ResultatCamp {
  const profil = PROFILS_CAMP[type]
  const effets: string[] = []

  // --- Toujours, quel que soit le type de camp ---
  // Les cristaux se réétudient « après un feu de camp », dit le PDF, sans
  // distinguer : c'est la seule vertu mécanique du repos court.
  const cristauxRendus = char.sortsEpuises.length
  if (cristauxRendus > 0) effets.push(`${cristauxRendus} cristal/cristaux étudiés et réutilisables`)

  const fatigueRendue = Math.min(profil.fatigueRendue, char.fatigue.coches)
  if (fatigueRendue > 0) effets.push(`Fatigue restaurée (${fatigueRendue} case(s))`)

  let suivant: Character = {
    ...char,
    fatigue: { ...char.fatigue, coches: char.fatigue.coches - fatigueRendue },
    sortsEpuises: [],
    modifiers: expireModifiers(char.modifiers, {
      kind: 'camp',
      frontiereDeSession: profil.frontiereDeSession,
    }),
  }

  // --- Uniquement au camp initial, qui clôt la session écoulée ---
  if (profil.frontiereDeSession) {
    if (char.sixthSensUtilises > 0) effets.push('6th Sens restauré')
    if (char.actionsRapidesUtilisees > 0) effets.push('Actions Rapides restaurées')

    const leves = char.modifiers.length - suivant.modifiers.length
    if (leves > 0) effets.push(`${leves} effet(s) levé(s) — Fardeau, Serment, Marque`)

    // Décision de la MJ : la Foi ne se reporte pas d'une session à l'autre,
    // contre le PDF qui la conservait « de jour en jour ». Le solde est remis
    // à 2 — les gains de la phase Grimoire viendront s'y ajouter ensuite,
    // puisque le camp se résout à son ouverture.
    if (char.foi !== FOI_DE_DEPART) effets.push(`Points de Foi remis à ${FOI_DE_DEPART}`)

    suivant = {
      ...suivant,
      sixthSensUtilises: 0,
      actionsRapidesUtilisees: 0,
      foi: FOI_DE_DEPART,
    }
  }

  return { char: suivant, effets }
}

/**
 * Comble les champs absents d'un camp lu en base.
 *
 * ⚠️ Même piège que `normaliserPersonnage` : un camp écrit avant la refonte
 * porte `finDeJournee` et `debutDeSession` et ignore `type`. Appliquée dans
 * `surCampfire` et `surBrouillonCampfire` (`data/repo.ts`), seuls chemins par
 * lesquels un camp entre dans l'application.
 *
 * Contraindre la phase au profil règle au passage une incohérence de l'ancienne
 * version : la MJ pouvait fermer la Banque d'un brouillon resté en phase
 * `banque`, et se retrouvait alors sans aucun onglet actif.
 */
export function normaliserCampfire(
  brut: Campfire & { finDeJournee?: boolean; debutDeSession?: boolean },
): Campfire {
  const type: TypeCamp = brut.type ?? (brut.debutDeSession ? 'initial' : 'repos-court')
  const phases = PROFILS_CAMP[type].phases

  return {
    ...brut,
    type,
    phase: phases.includes(brut.phase) ? brut.phase : (phases[0] as PhaseCampfire),
    brief: brut.brief ?? '',
    offres: brut.offres ?? {},
    investissementsProposes: brut.investissementsProposes ?? [],
    lanceLe: brut.lanceLe ?? null,
  }
}

/** L'ordre canonique des phases, restreint à celles que ce camp ouvre. */
export function phasesDuCamp(type: TypeCamp): PhaseCampfire[] {
  return PHASES_CAMPFIRE.filter((p) => PROFILS_CAMP[type].phases.includes(p))
}

// ---------------------------------------------------------------------------
// Disponibilité des actions de Feu de Camp
// ---------------------------------------------------------------------------

/** Aucune action encore consommée. */
export function jetonsCampVierges(): JetonsCamp {
  return { recueillir: null, fardeau: null, serment: null, achat: null }
}

export interface ContexteCamp {
  jetons: JetonsCamp
  type: TypeCamp
  /** Identifiant du camp en cours : c'est lui qui borne la limite d'achat. */
  campfireId: string
  sessionNumero: number
}

/**
 * Recueillir, Fardeau et Serment sont limités à une fois par session, et le PDF
 * les réserve au premier feu de camp — c'est-à-dire, dans ce modèle, au camp
 * initial. La comparaison au numéro de session tient lieu de remise à zéro.
 */
export function peutRecueillir(ctx: ContexteCamp): boolean {
  return ctx.type === 'initial' && ctx.jetons.recueillir !== ctx.sessionNumero
}

export function peutPrendreFardeau(ctx: ContexteCamp): boolean {
  return ctx.type === 'initial' && ctx.jetons.fardeau !== ctx.sessionNumero
}

export function peutPrononcerSerment(ctx: ContexteCamp): boolean {
  return ctx.type === 'initial' && ctx.jetons.serment !== ctx.sessionNumero
}

/**
 * Un seul investissement par session, et seulement au camp initial.
 *
 * Se dérive de `char.investissements`, qui date déjà chaque prise : un jeton
 * séparé aurait été une seconde source de vérité à tenir synchronisée.
 */
export function peutInvestir(ctx: ContexteCamp, char: Character): boolean {
  return (
    ctx.type === 'initial' &&
    !char.investissements.some((i) => i.sessionNumero === ctx.sessionNumero)
  )
}

/**
 * Le Fardeau « prendre un Point de Fatigue à la place d'une autre PJ ».
 *
 * Encore faut-il qu'elle en ait un à céder : sans case cochée, le sacrifice n'a
 * pas d'objet.
 */
export function peutCouvrirLeFardeau(cible: Character): boolean {
  return cible.fatigue.coches > 0
}

/**
 * Déplace une case de Fatigue de la couverte vers la porteuse.
 *
 * Renvoie les **deux** fiches : la case change de personnage, elle ne se
 * duplique pas. N'oublier la seconde revenait à faire payer la porteuse sans
 * soulager personne.
 */
export function resoudreFardeauFatigue(
  porteuse: Character,
  couverte: Character,
): { porteuse: Character; couverte: Character } {
  return {
    porteuse: {
      ...porteuse,
      fatigue: {
        ...porteuse.fatigue,
        coches: Math.min(porteuse.fatigue.max, porteuse.fatigue.coches + 1),
      },
    },
    couverte: {
      ...couverte,
      fatigue: { ...couverte.fatigue, coches: Math.max(0, couverte.fatigue.coches - 1) },
    },
  }
}

export function peutAcheter(ctx: ContexteCamp, char: Character, prix: number): boolean {
  // « La maison ne fait pas crédit », et une seule acquisition par feu de camp —
  // d'où la comparaison à l'identifiant du camp, et non à la session.
  return ctx.jetons.achat !== ctx.campfireId && char.lumens >= prix
}

// ---------------------------------------------------------------------------
// Investissements
// ---------------------------------------------------------------------------

/**
 * Convention de lecture d'un investissement, valable pour les trois du PDF :
 *
 *  - `probabiliteRisque` est la probabilité que **le mauvais dénouement** survienne ;
 *  - s'il s'accompagne d'un `coutRisque`, ce dénouement coûte des Lumens
 *    (la rénovation d'une chambre) ;
 *  - sinon, il annule purement et simplement le bénéfice (cargaison perdue, loto perdu).
 *
 * Les tirages sont faits par l'app : c'est un des cas où l'impartialité compte
 * plus que le plaisir de lancer un dé.
 */

export interface LigneBilan {
  investissementId: string
  nom: string
  lumens: number
  recit: string
}

export interface BilanInvestissements {
  lignes: LigneBilan[]
  total: number
}

/**
 * Résout ce que les investissements déjà pris rapportent — ou coûtent — à
 * l'ouverture d'une session.
 *
 * Rien n'est versé pendant la session de l'achat : le PDF dit « à partir de la
 * suivante » pour la chambre, et « au début de la prochaine session » pour le
 * transport.
 */
export function resoudreInvestissements(
  char: Character,
  catalog: Catalog,
  sessionQuiSOuvre: number,
  rng: Rng,
): BilanInvestissements {
  const lignes: LigneBilan[] = []

  for (const pris of char.investissements) {
    const inv = catalog.investissement(pris.investissementId)
    if (!inv) continue

    const sessionsEcoulees = sessionQuiSOuvre - pris.sessionNumero
    if (sessionsEcoulees < 1) continue // acquis cette session-ci : rien encore

    // --- Bénéfice versé une seule fois, à la session suivante ---
    if (inv.gainProchainSession !== undefined && sessionsEcoulees === 1) {
      const perdu = inv.probabiliteRisque !== undefined && rng.chance(inv.probabiliteRisque)
      lignes.push({
        investissementId: inv.id,
        nom: inv.nom,
        lumens: perdu ? 0 : inv.gainProchainSession,
        recit: perdu ? 'Perdu en route.' : `Arrivé à bon port : +${inv.gainProchainSession} ʟ.`,
      })
    }

    // --- Bénéfice récurrent, à partir de la session suivante ---
    if (inv.gainRecurrent !== undefined) {
      lignes.push({
        investissementId: inv.id,
        nom: inv.nom,
        lumens: inv.gainRecurrent,
        recit: `Revenu de la session : +${inv.gainRecurrent} ʟ.`,
      })

      // Le risque se tire pour chaque exemplaire, indépendamment des autres.
      if (inv.coutRisque !== undefined && inv.probabiliteRisque !== undefined) {
        if (rng.chance(inv.probabiliteRisque)) {
          lignes.push({
            investissementId: inv.id,
            nom: inv.nom,
            lumens: -inv.coutRisque,
            recit: `Rénovation nécessaire : −${inv.coutRisque} ʟ.`,
          })
        }
      }
    }
  }

  return { lignes, total: lignes.reduce((s, l) => s + l.lumens, 0) }
}

/**
 * Résout la part immédiate d'un investissement au moment de l'acheter.
 * C'est le cas du Loto : on paie, on tire, on sait tout de suite.
 */
export function resoudrePriseInvestissement(
  inv: Investissement,
  rng: Rng,
): { lumens: number; recit: string } {
  const lumens = -inv.cout
  if (inv.gainImmediat === undefined) {
    return { lumens, recit: `${inv.nom} : −${inv.cout} ʟ.` }
  }

  const perdu = inv.probabiliteRisque !== undefined && rng.chance(inv.probabiliteRisque)
  return {
    lumens: lumens + (perdu ? 0 : inv.gainImmediat),
    recit: perdu
      ? `${inv.nom} : perdu, −${inv.cout} ʟ.`
      : `${inv.nom} : gagné ! +${inv.gainImmediat - inv.cout} ʟ net.`,
  }
}

export function nombreDetenu(char: Character, investissementId: string): number {
  return char.investissements.filter((i) => i.investissementId === investissementId).length
}

/** Applique les limites propres à un investissement, et le prix. */
export function peutPrendreInvestissement(
  char: Character,
  inv: Investissement,
  sessionNumero: number,
): { possible: boolean; raison?: string } {
  if (char.lumens < inv.cout) return { possible: false, raison: 'Lumens insuffisants.' }

  if (inv.limiteTotale !== undefined && nombreDetenu(char, inv.id) >= inv.limiteTotale) {
    return { possible: false, raison: `Limite atteinte (${inv.limiteTotale} au total).` }
  }

  if (inv.limiteParSession !== undefined) {
    const cetteSession = char.investissements.filter(
      (i) => i.investissementId === inv.id && i.sessionNumero === sessionNumero,
    ).length
    if (cetteSession >= inv.limiteParSession) {
      return { possible: false, raison: 'Déjà pris cette session.' }
    }
  }

  return { possible: true }
}

// ---------------------------------------------------------------------------
// Boutique
// ---------------------------------------------------------------------------

export function prixDe(entree: EntreeCatalogue): number | null {
  switch (entree.kind) {
    case 'sort':
    case 'equipement':
      return entree.prix ?? null
    case 'amelioration':
      return entree.prix
    default:
      return null
  }
}

function dejaPossede(char: Character, entree: EntreeCatalogue): boolean {
  switch (entree.kind) {
    case 'sort':
      return char.possede.sorts.includes(entree.id)
    case 'equipement':
      return char.possede.equipements.includes(entree.id)
    case 'amelioration':
      return char.possede.ameliorations.includes(entree.id)
    default:
      return true
  }
}

/**
 * Ce que la boutique peut proposer à cette joueuse : tout ce qui porte un prix
 * et qu'elle ne possède pas déjà. Les illusions en sont exclues — un passif y
 * donne accès, elles ne s'achètent pas.
 */
export function entreesAchetables(char: Character, catalog: Catalog): EntreeCatalogue[] {
  return catalog
    .toutes()
    .filter((e) => prixDe(e) !== null)
    .filter((e) => !(e.kind === 'sort' && e.illusion === true))
    .filter((e) => !(e.kind === 'equipement' && e.materielDeBase === true))
    .filter((e) => !dejaPossede(char, e))
}

/** Tire des offres distinctes pour une joueuse. Renvoie moins que `taille` si le catalogue est court. */
export function tirerOffres(
  char: Character,
  catalog: Catalog,
  rng: Rng,
  taille = 3,
): string[] {
  const pool = [...entreesAchetables(char, catalog)]
  const offres: string[] = []
  while (offres.length < taille && pool.length > 0) {
    const [tire] = pool.splice(rng.int(0, pool.length - 1), 1)
    if (tire) offres.push(tire.id)
  }
  return offres
}

/**
 * Achat : débite les Lumens et range l'acquisition au bon endroit.
 * L'appelant a déjà vérifié `peutAcheter` — ici on refuse simplement de
 * produire un solde négatif.
 */
export function acheter(char: Character, entree: EntreeCatalogue): Character {
  const prix = prixDe(entree)
  if (prix === null) throw new Error(`« ${entree.nom} » n'est pas en vente.`)
  if (prix > char.lumens) throw new Error('La maison ne fait pas crédit.')

  const possede = { ...char.possede }
  if (entree.kind === 'sort') possede.sorts = [...possede.sorts, entree.id]
  else if (entree.kind === 'equipement') possede.equipements = [...possede.equipements, entree.id]
  else if (entree.kind === 'amelioration')
    possede.ameliorations = [...possede.ameliorations, entree.id]

  return { ...char, lumens: char.lumens - prix, possede }
}

// ---------------------------------------------------------------------------
// Grimoire et Armurerie
// ---------------------------------------------------------------------------

export const TAILLE_GRIMOIRE = 3

export function grimoireValide(sorts: readonly string[]): boolean {
  return sorts.length <= TAILLE_GRIMOIRE && new Set(sorts).size === sorts.length
}
