import { expireModifiers } from './modifiers.ts'
import type { Character } from './types.ts'

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
 * Ce qui a déjà été consommé pendant la session en cours.
 * Recueillir, Fardeau et Serment sont limités à une fois par session ;
 * Recueillir et Serment exigent en plus le **premier** feu de camp de la journée.
 */
export interface JetonsSession {
  recueillirUtilise: boolean
  fardeauUtilise: boolean
  sermentUtilise: boolean
  /** Un investissement au maximum par session. */
  investissementPris: string | null
  /** Une acquisition en boutique au maximum par feu de camp. */
  achatFaitCeCamp: boolean
}

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
// Grimoire et Armurerie
// ---------------------------------------------------------------------------

export const TAILLE_GRIMOIRE = 3

export function grimoireValide(sorts: readonly string[]): boolean {
  return sorts.length <= TAILLE_GRIMOIRE && new Set(sorts).size === sorts.length
}
