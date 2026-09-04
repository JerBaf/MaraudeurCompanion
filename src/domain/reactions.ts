import type { Catalog } from './catalog.ts'
import { plafondElement } from './competences.ts'
import { decrireCible, descripteur, ecrireElement, lireElement, type ElementVariable } from './elements.ts'
import {
  conditionArmee,
  estEcritureDirecte,
  passifsActifs,
  valeurVisee,
} from './passifs.ts'
import type { Character, Operation } from './types.ts'

/**
 * Résolution des passifs réactifs.
 *
 * Séparé de `passifs.ts` par contrainte de couche : borner une jauge demande
 * son plafond dérivé, donc `competences.ts`, qui s'appuie sur `modifiers.ts`,
 * lequel appelle `passifsActifs`. `passifs.ts` dit *ce que sont* les passifs,
 * ce module dit *ce qu'ils font* — et le cycle ne se referme pas.
 *
 * Deux invariants, rappelés ici parce que c'est ici qu'ils se tiennent :
 * **une seule passe** (une réaction ne peut pas en réveiller une autre) et
 * **résultat borné** par les plafonds dérivés.
 */

/** Écrit une valeur de jauge en la bornant à zéro et à son plafond dérivé. */
export function ecrireBorne(
  char: Character,
  catalog: Catalog,
  element: ElementVariable,
  valeur: number,
): Character {
  const plafond = descripteur(element).plafondBase
    ? plafondElement(char, catalog, element).max
    : // Les Lumens n'ont pas de plafond : c'est une bourse, pas une jauge.
      Number.POSITIVE_INFINITY

  return ecrireElement(char, element, Math.max(0, Math.min(plafond, valeur)))
}

/**
 * Applique une opération d'écriture directe.
 *
 * Renvoie ce qui a **réellement** bougé : un gain absorbé par un plafond ne
 * mérite pas de récit, et l'annoncer à table serait un mensonge.
 */
export function appliquerEcriture(
  char: Character,
  catalog: Catalog,
  operation: Operation,
): { char: Character; applique: number } {
  const avant = lireElement(char, operation.cible.element)
  const vise = valeurVisee(operation, avant)
  if (vise === null) return { char, applique: 0 }

  const apres = ecrireBorne(char, catalog, operation.cible.element, vise)
  return { char: apres, applique: lireElement(apres, operation.cible.element) - avant }
}

/** Un récit, et la fiche à laquelle il se rapporte. */
export interface RecitPassif {
  /** Nom du personnage chez qui l'effet s'est produit. */
  chez: string
  texte: string
}

export interface ResultatPassifs {
  char: Character
  /** Les alliées dont la fiche a **réellement** changé, à persister aussi. */
  autres: Character[]
  /** Un récit par passif armé, à montrer et à journaliser. */
  recits: RecitPassif[]
}

/**
 * Applique à une fiche les réactions qu'un changement a armées.
 *
 * `acteur` est celui chez qui la jauge a bougé, `cible` celui dont on résout
 * les passifs — les deux sont le même personnage pour une réaction `soi`.
 */
function reactionsPour(
  cible: Character,
  acteurAvant: Character,
  acteurApres: Character,
  catalog: Catalog,
): { char: Character; recits: RecitPassif[] } {
  const recits: RecitPassif[] = []
  let char = cible
  const surSoi = cible.id === acteurApres.id

  for (const { passif, source } of passifsActifs(cible, catalog)) {
    const d = passif.declenchement
    if (d.kind !== 'reaction') continue

    // `soi` ne s'arme que sur son propre changement ; `un-allie` uniquement sur
    // celui d'un autre ; `quiconque` sur les deux.
    const portee = d.quand.chez
    if (portee === 'soi' && !surSoi) continue
    if (portee === 'un-allie' && surSoi) continue

    if (!conditionArmee(d.quand, acteurAvant, acteurApres)) continue

    for (const operation of passif.effet.operations ?? []) {
      if (!estEcritureDirecte(operation.cible)) continue

      // Appliqué sur `char` et non sur `cible` : deux réactions visant la même
      // jauge s'additionnent au lieu de s'écraser.
      const r = appliquerEcriture(char, catalog, operation)
      char = r.char
      if (r.applique === 0) continue

      recits.push({
        chez: cible.nom,
        texte: `${source} — ${decrireCible(operation.cible)} ${r.applique > 0 ? '+' : ''}${r.applique}`,
      })
    }
  }

  return { char, recits }
}

/**
 * Applique les réactions armées par le passage de `avant` à `apres`.
 *
 * Les passifs sont lus sur l'état **d'après** : équiper un talisman et prendre
 * une Marque dans le même geste doit armer le talisman.
 *
 * ⚠️ **« Une seule passe » se lit désormais sur le roster, pas sur une fiche.**
 * Chaque personnage est armé une fois, par le seul changement d'origine — celui
 * de l'acteur. Ce que les réactions produisent chez une alliée n'en réveille
 * aucune autre : sans cette borne, « une brûlure quand une alliée en prend une »
 * ferait le tour de la table indéfiniment, et personne à table ne pourrait
 * suivre la cascade.
 *
 * L'ordre du roster est trié par identifiant, pour que deux appareils qui
 * résolvent le même geste arrivent au même résultat.
 */
export function resoudrePassifs(
  avant: Character,
  apres: Character,
  catalog: Catalog,
  roster: readonly Character[] = [],
): ResultatPassifs {
  const propre = reactionsPour(apres, avant, apres, catalog)
  const recits = [...propre.recits]
  const autres: Character[] = []

  const allies = roster
    .filter((c) => c.id !== apres.id)
    .slice()
    .sort((a, b) => a.id.localeCompare(b.id))

  for (const allie of allies) {
    const r = reactionsPour(allie, avant, apres, catalog)
    // N'écrire que ce qui a bougé : une fiche réécrite à l'identique coûterait
    // un aller-retour réseau et un rendu à toute la table pour rien.
    if (r.recits.length === 0) continue
    autres.push(r.char)
    recits.push(...r.recits)
  }

  return { char: propre.char, autres, recits }
}
