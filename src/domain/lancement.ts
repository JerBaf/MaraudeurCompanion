import type { Catalog } from './catalog.ts'
import { payerCout, type ChoixPaiement, type Cout } from './couts.ts'
import { decrireCible } from './elements.ts'
import {
  DE_REUSSITE_AUTOMATIQUE,
  EFFET_B_ABSENT,
  disponibiliteSort,
  jetMagiqueDuSort,
  resoudreJetMagique,
  type RaisonIndisponible,
  type ResultatJetMagique,
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
   * S'assurer l'Effet A sans lancer, au prix que fixe la règle : le jet est
   * alors tenu pour un `DE_REUSSITE_AUTOMATIQUE` unique.
   */
  reussiteAutomatique?: boolean
}

export interface ResultatLancement {
  char: Character
  sort: Sort
  /** Ce qui a été prélevé et ce que le paiement a entraîné (Combustion…). */
  recits: string[]
  /** Les dés du sort tels qu'ils sont tombés. Vide s'il n'en porte aucun. */
  des: number[]
  /** Les effets appliqués, en toutes lettres — l'Effet B compris. */
  effets: string[]
  /** La lecture du Jet Magique, pour un sort dont le type en porte un. */
  jetMagique: ResultatJetMagique | null
  reussiteAutomatique: boolean
}

/**
 * La réussite automatique que ce sort offre à cette joueuse, et son prix.
 *
 * Il faut la règle, et quelque chose à s'assurer : un jet qui pourrait basculer
 * en Effet B. Un Miracle ne se rate pas, il n'y a rien à réussir d'office.
 *
 * ⚠️ La condition portait sur `sortAUnCristal` : un Jet d'Arcane était réputé
 * ratable parce qu'il épuisait le cristal. L'Arcane ayant perdu son cristal,
 * l'offre se serait évaporée sans qu'aucun test ne s'en plaigne. Ce qu'elle
 * garantit désormais nomme sa propre condition.
 */
export function reussiteAutomatiqueOfferte(
  sort: Sort,
  char: Character,
  catalog: Catalog,
): { cout: Cout; source: string } | null {
  if (jetMagiqueDuSort(sort, catalog)?.seuilEffetB === undefined) return null
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
 * déterministe comme d'un dé illisible, que `parserDes` ramène à 1 face.
 *
 * Une réussite automatique ne lance pas le jet du sort — il est tenu pour un 5
 * —, mais ses tables, si.
 *
 * ⚠️ Le jet vient du **type magique** quand il en porte un : un sort d'Arcane
 * annonce donc `2d6`, même s'il n'a aucun `Sort.de`.
 */
export function desDuSort(
  sort: Sort,
  catalog: Catalog,
  options: { reussiteAutomatique?: boolean } = {},
): Des[] {
  const des: Des[] = []

  const jet = jetMagiqueDuSort(sort, catalog)
  if (jet && !options.reussiteAutomatique) {
    const lot = parserDes(jet.de)
    if (lot.faces > 1) des.push(lot)
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
  // Les dés du sort sont lancés par l'application : c'est un aléa dont l'effet
  // dépend, et non un jet de compétence — ceux-là restent physiques, à table.
  //
  // Une réussite automatique ne lance rien : un dé unique tenu pour 5, ce qui
  // suffit à donner sa puissance au sort sans pouvoir basculer en Effet B.
  const jet = jetMagiqueDuSort(sort, catalog)
  const lot = jet ? parserDes(jet.de) : null
  const des = offre ? [DE_REUSSITE_AUTOMATIQUE] : lot ? rng.roll(lot.nombre, lot.faces) : []

  // Le jet se lit dès que le type magique en porte un : c'est le Jet Magique,
  // et c'est lui qui décide de l'Effet A ou de l'Effet B.
  const jetMagique = jet
    ? resoudreJetMagique(des, jet, regleActive(char, catalog, 'ame-de-geant') !== null)
    : null

  // --- Appliquer ---
  const effets: string[] = []
  const modifiers: Modifier[] = []

  // Quel effet survient est une règle, et c'est donc ici qu'on en décide ; les
  // écrans ne font que le raconter. L'Effet A n'est pas répété : il est déjà
  // sous les yeux, dans le texte du sort.
  if (jetMagique?.effetB) effets.push(`Effet B — ${sort.effetB ?? EFFET_B_ABSENT}`)

  for (const actif of sort.actifs ?? []) {
    const face = actif.table.faces > 1 ? rng.int(1, actif.table.faces) : 1
    const effet = actif.table.entrees[face - 1]
    if (!effet) continue

    if (effet.texte) effets.push(effet.texte)

    for (const brute of effet.operations ?? []) {
      // Le X payé et le jet donnent leur valeur aux opérations variables.
      // `add-de` vaut les Points d'Énergie — le plus haut dé, et non leur
      // somme : c'est la décision de la MJ sur la puissance d'un sort.
      const operation = resoudreOperation(brute, { x, de: jetMagique?.pointsEnergie ?? null })

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

  /*
   * Plus rien n'épuise un cristal d'office : le 1-2 qui le faisait était la
   * règle d'Arcane d'avant les 2d6. L'état subsiste pour un type magique à
   * cristal, mais c'est la MJ ou la joueuse qui le déclare, depuis la case de
   * la ligne du sort.
   */

  return {
    char: courant,
    sort,
    recits,
    des,
    effets,
    jetMagique,
    reussiteAutomatique: offre !== null,
  }
}

/**
 * « 2d6 » → deux dés à six faces.
 *
 * Lit le **nombre** de dés, qu'on ignorait du temps où tout jet de sort était
 * unique. Sans face lisible, on s'en tient à un dé à une face : l'effet est
 * alors déterministe, et aucune saisie n'est demandée.
 */
export function parserDes(de: string): Des {
  const [avant, apres] = de.split(/d/i)
  const faces = Number(apres ?? '')
  const nombre = Number(avant ?? '')
  return {
    nombre: Number.isInteger(nombre) && nombre > 0 ? nombre : 1,
    faces: Number.isFinite(faces) && faces > 0 ? faces : 1,
  }
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
