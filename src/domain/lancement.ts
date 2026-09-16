import type { Catalog } from './catalog.ts'
import { payerCout, type ChoixPaiement, type Cout } from './couts.ts'
import { decrireCible } from './elements.ts'
import {
  DE_REUSSITE_AUTOMATIQUE,
  disponibiliteSort,
  resoudreArcane,
  sortAUnCristal,
  type RaisonIndisponible,
  type ResultatArcane,
} from './magie.ts'
import { estEcritureDirecte, regleActive, resoudreOperation } from './passifs.ts'
import { appliquerEcriture } from './reactions.ts'
import type { Des, Rng } from './random.ts'
import type { Character, Modifier, ModifierExpiry, Operation, Sort } from './types.ts'

/**
 * Lancer un sort.
 *
 * L'application ne résolvait rien : elle affichait le coût, et la joueuse
 * ajustait ses compteurs à la main. Maintenant que le Coût et l'Effet sont
 * structurés, un seul geste enchaîne les trois temps — **payer**, **tirer** si
 * le sort porte un dé, **appliquer** ce qui est concret.
 *
 * ⚠️ Ce qui reste hors de portée, et volontairement : l'application ne connaît
 * aucune horloge de fiction. Un effet « pendant 1 heure » ne peut donc pas
 * expirer tout seul. `Sort.duree` reste du texte lu à table, doublé d'une
 * échéance structurée que le moteur, lui, sait tenir — et la joueuse peut
 * dissiper l'effet à la main quand la fiction l'a consommé.
 */

export interface DemandeLancement {
  sortId: string
  /** Index de la branche de coût retenue, quand le sort en offre plusieurs. */
  brancheCout?: number
  /** La valeur choisie pour le « X » d'un coût variable. */
  x?: number
  /**
   * Réussir le Jet d'Arcane d'office, au prix que fixe la règle : le dé vaut
   * alors 5, sans être lancé.
   */
  reussiteAutomatique?: boolean
}

export interface ResultatLancement {
  char: Character
  sort: Sort
  /** Ce qui a été prélevé et ce que le paiement a entraîné (Combustion…). */
  recits: string[]
  /** Le résultat du dé du sort, s'il en porte un. */
  de: number | null
  /** Les effets appliqués, en toutes lettres. */
  effets: string[]
  /** La lecture du dé d'un sort à cristal — le Jet d'Arcane —, sinon `null`. */
  arcane: ResultatArcane | null
  reussiteAutomatique: boolean
}

/**
 * La réussite automatique que ce sort offre à cette joueuse, et son prix.
 *
 * Il faut la règle, et un Jet d'Arcane à réussir : un sort à cristal qui porte
 * un dé. Un Miracle ne se rate pas, il n'y a rien à réussir d'office.
 */
export function reussiteAutomatiqueOfferte(
  sort: Sort,
  char: Character,
  catalog: Catalog,
): { cout: Cout; source: string } | null {
  if (!sort.de || !sortAUnCristal(sort, catalog)) return null
  const active = regleActive(char, catalog, 'reussite-automatique')
  return active ? { cout: active.regle.cout, source: active.source } : null
}

/**
 * L'échéance d'un effet posé par un sort.
 *
 * `jamais` par défaut : sans horloge de fiction, l'application ne peut pas
 * décider seule qu'une heure a passé. L'effet reste donc jusqu'à sa dissipation
 * — par le bouton de la joueuse, ou par le prochain feu de camp si l'auteur du
 * sort l'a précisé.
 */
function echeanceDe(operation: Operation): ModifierExpiry {
  return operation.expire ?? { kind: 'jamais' }
}

let compteur = 0
function nouvelId(sortId: string): string {
  compteur += 1
  return `sort:${sortId}:${compteur}`
}

/**
 * Les dés que `lancerSort` va consommer, **dans le même ordre**.
 *
 * Vit ici, collé à la fonction qui les consomme, et non dans l'écran : c'est la
 * seule façon de garantir qu'une joueuse qui saisit ses dés physiques en saisit
 * exactement autant qu'il en faut.
 *
 * Un dé à une seule face n'est jamais demandé : son résultat ne peut être que 1,
 * et `rngManuel` le rend sans rien consommer. C'est le cas d'une table
 * déterministe comme d'un `Sort.de` illisible, que `facesDuDe` ramène à 1.
 *
 * Une réussite automatique ne lance pas le dé du sort — il vaut 5 d'office —,
 * mais ses tables, si.
 */
export function desDuSort(sort: Sort, options: { reussiteAutomatique?: boolean } = {}): Des[] {
  const des: Des[] = []

  if (sort.de && !options.reussiteAutomatique) {
    const faces = facesDuDe(sort.de)
    if (faces > 1) des.push({ nombre: 1, faces })
  }

  for (const actif of sort.actifs ?? []) {
    if (actif.table.faces > 1) des.push({ nombre: 1, faces: actif.table.faces })
  }

  return des
}

/**
 * Vérifie, paie, tire et applique.
 *
 * Lève si le sort n'est pas lançable : les écrans le désactivent déjà, mais la
 * règle ne peut pas dépendre d'un écran.
 */
export function lancerSort(
  char: Character,
  catalog: Catalog,
  demande: DemandeLancement,
  rng: Rng,
): ResultatLancement {
  const sort = catalog.sort(demande.sortId)
  if (!sort) throw new Error(`Sort inconnu : ${demande.sortId}`)

  const x = demande.x ?? 0
  const dispo = disponibiliteSort(sort, char, catalog, x)
  if (!dispo.disponible) {
    throw new Error(`« ${sort.nom} » n'est pas lançable : ${dispo.raisons.join(', ')}`)
  }

  const offre = demande.reussiteAutomatique ? reussiteAutomatiqueOfferte(sort, char, catalog) : null
  if (demande.reussiteAutomatique && !offre) {
    throw new Error(`« ${sort.nom} » ne peut pas réussir d'office.`)
  }

  // --- Payer ---
  const choix: ChoixPaiement = { branche: demande.brancheCout ?? 0, x }
  const paiement = payerCout(char, catalog, sort.cout, choix, sort)
  let courant = paiement.char
  const recits = [...paiement.recits]

  // Le prix de la réussite se paie après le coût du sort : les deux peuvent
  // tirer sur la même jauge, et `payerCout` lève s'il ne reste plus de quoi.
  if (offre) {
    const prix = payerCout(courant, catalog, offre.cout)
    courant = prix.char
    recits.push(...prix.recits)
  }

  // --- Tirer ---
  // Le dé du sort est lancé par l'application : c'est un aléa dont l'effet
  // dépend, et non un jet de compétence — ceux-là restent physiques, à table.
  const de = offre ? DE_REUSSITE_AUTOMATIQUE : sort.de ? rng.int(1, facesDuDe(sort.de)) : null

  // Le dé d'un sort à cristal se lit : c'est le Jet d'Arcane. Un type magique
  // créé par la MJ hérite de la mécanique dès qu'il porte `cristal`.
  const arcane =
    de !== null && sortAUnCristal(sort, catalog)
      ? resoudreArcane(de, regleActive(char, catalog, 'ame-de-geant') !== null)
      : null

  // --- Appliquer ---
  const effets: string[] = []
  const modifiers: Modifier[] = []

  for (const actif of sort.actifs ?? []) {
    const face = actif.table.faces > 1 ? rng.int(1, actif.table.faces) : 1
    const effet = actif.table.entrees[face - 1]
    if (!effet) continue

    if (effet.texte) effets.push(effet.texte)

    for (const brute of effet.operations ?? []) {
      // Le X payé et le dé tiré donnent leur valeur aux opérations variables.
      const operation = resoudreOperation(brute, { x, de })

      if (estEcritureDirecte(operation.cible)) {
        // Une jauge se met à jour d'un cran, tout de suite.
        const r = appliquerEcriture(courant, catalog, operation)
        courant = r.char
        if (r.applique !== 0) {
          effets.push(
            `${decrireCible(operation.cible)} ${r.applique > 0 ? '+' : ''}${r.applique}`,
          )
        }
      } else {
        // Une statistique dérivée ne se stocke jamais : elle reçoit un
        // modificateur, porteur de son échéance. `set` n'en fait pas partie —
        // `agreger` somme les `add`, et une valeur imposée y dépendrait de
        // l'ordre — ni une opération variable restée sans valeur.
        const { op } = operation
        if (op.kind !== 'add' && op.kind !== 'avantage' && op.kind !== 'desavantage') continue
        modifiers.push({
          id: nouvelId(sort.id),
          source: { kind: 'personnalite', label: sort.nom, ref: sort.id },
          target: operation.cible,
          op,
          expires: echeanceDe(operation),
        })
        // Le chiffre se dit : un « + d6 » n'a de sens qu'une fois le dé tombé.
        const chiffre = op.kind === 'add' ? ` ${op.value > 0 ? '+' : ''}${op.value}` : ''
        effets.push(`${decrireCible(operation.cible)}${chiffre} — ${sort.duree}`)
      }
    }
  }

  if (modifiers.length) courant = { ...courant, modifiers: [...courant.modifiers, ...modifiers] }

  // Sur 1 et 2, l'Hexite ne répond plus jusqu'à l'avoir réétudié au camp. La
  // règle vivait dans l'écran ; la réussite automatique, qui l'épargne, a
  // besoin qu'elle vive ici.
  if (arcane?.cristalEpuise && !courant.sortsEpuises.includes(sort.id)) {
    courant = { ...courant, sortsEpuises: [...courant.sortsEpuises, sort.id] }
  }

  return {
    char: courant,
    sort,
    recits,
    de,
    effets,
    arcane,
    reussiteAutomatique: offre !== null,
  }
}

/** « 1d6 » → 6. Sans face lisible, on s'en tient à 1 : l'effet est déterministe. */
export function facesDuDe(de: string): number {
  const faces = Number(de.split(/d/i)[1] ?? '')
  return Number.isFinite(faces) && faces > 0 ? faces : 1
}

/**
 * Retire un effet posé par un sort.
 *
 * Le pendant du bouton « dissiper » : sans horloge de fiction, c'est la joueuse
 * qui déclare que l'heure est passée.
 */
export function dissiperEffet(char: Character, modifierId: string): Character {
  return { ...char, modifiers: char.modifiers.filter((m) => m.id !== modifierId) }
}

/** Vrai si ce modificateur a été posé par un sort, et peut donc être dissipé. */
export function estPoseParUnSort(m: Modifier): boolean {
  return m.id.startsWith('sort:')
}

export type { RaisonIndisponible }
