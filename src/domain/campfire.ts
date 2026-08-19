import type { Catalog } from './catalog.ts'
import { expireModifiers } from './modifiers.ts'
import type { Rng } from './random.ts'
import type {
  Character,
  EntreeCatalogue,
  Investissement,
  JetonsSession,
} from './types.ts'

/**
 * Feu de Camp.
 *
 * Décision arrêtée avec la MJ : chaque feu de camp est qualifié **repos court**
 * ou **fin de journée**. Le PDF distingue en effet deux horloges — la Fatigue
 * revient « après un repos à un feu de camp », mais le 6th Sens seulement « à la
 * fin d'une journée, après un feu de camp », de même que l'expiration des
 * Fardeaux et des Serments.
 */
export interface OptionsCamp {
  finDeJournee: boolean
}

export interface ResultatCamp {
  char: Character
  effets: string[]
}

export function resoudreCampPourPersonnage(char: Character, options: OptionsCamp): ResultatCamp {
  const effets: string[] = []

  // --- Toujours, quel que soit le type de camp ---
  const fatigueRendue = char.fatigue.coches
  if (fatigueRendue > 0) effets.push(`Fatigue restaurée (${fatigueRendue} case(s))`)

  const cristauxRendus = char.sortsEpuises.length
  if (cristauxRendus > 0) effets.push(`${cristauxRendus} cristal/cristaux étudiés et réutilisables`)

  let suivant: Character = {
    ...char,
    fatigue: { ...char.fatigue, coches: 0 },
    sortsEpuises: [],
    modifiers: expireModifiers(char.modifiers, { kind: 'camp', finDeJournee: options.finDeJournee }),
  }

  // --- Uniquement en fin de journée ---
  if (options.finDeJournee) {
    if (char.sixthSensUtilises > 0) effets.push('6th Sens restauré')
    if (char.actionsRapidesUtilisees > 0) effets.push('Actions Rapides restaurées')

    const leves = char.modifiers.length - suivant.modifiers.length
    if (leves > 0) effets.push(`${leves} effet(s) journalier(s) levé(s) — Fardeau, Serment, Marque`)

    suivant = { ...suivant, sixthSensUtilises: 0, actionsRapidesUtilisees: 0 }
  }

  return { char: suivant, effets }
}

// ---------------------------------------------------------------------------
// Disponibilité des actions de Feu de Camp
// ---------------------------------------------------------------------------

/**
 * Jetons de session : Recueillir, Fardeau et Serment sont limités à une fois
 * par session ; Recueillir et Serment exigent en plus le **premier** feu de
 * camp de la journée. Le type vit dans `types.ts` (le document de session le
 * transporte).
 */
export function jetonsSessionVierges(): JetonsSession {
  return {
    recueillirUtilise: false,
    fardeauUtilise: false,
    sermentUtilise: false,
    investissementPris: null,
    achatFaitCeCamp: false,
  }
}

export interface ContexteCamp {
  jetons: JetonsSession
  /** Vrai si aucun feu de camp n'a encore eu lieu dans la journée en cours. */
  premierCampDuJour: boolean
  /** La Banque n'est accessible qu'au tout premier camp de la session. */
  debutDeSession: boolean
}

export function peutRecueillir(ctx: ContexteCamp): boolean {
  return !ctx.jetons.recueillirUtilise && ctx.premierCampDuJour
}

export function peutPrendreFardeau(ctx: ContexteCamp): boolean {
  return !ctx.jetons.fardeauUtilise
}

/**
 * Le Fardeau « désavantage sur une compétence » est réservé au premier feu de
 * camp de la journée ; l'autre option (prendre un Point de Fatigue à la place
 * d'une autre PJ) reste disponible à tout moment.
 */
export function peutPrendreFardeauDesavantage(ctx: ContexteCamp): boolean {
  return peutPrendreFardeau(ctx) && ctx.premierCampDuJour
}

export function peutPrononcerSerment(ctx: ContexteCamp): boolean {
  return !ctx.jetons.sermentUtilise && ctx.premierCampDuJour
}

export function peutInvestir(ctx: ContexteCamp): boolean {
  return ctx.debutDeSession && ctx.jetons.investissementPris === null
}

export function peutAcheter(ctx: ContexteCamp, char: Character, prix: number): boolean {
  // « La maison ne fait pas crédit », et une seule acquisition par feu de camp.
  return !ctx.jetons.achatFaitCeCamp && char.lumens >= prix
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
