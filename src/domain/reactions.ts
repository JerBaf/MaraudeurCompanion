import type { Catalog } from './catalog.ts'
import { aUnPlafond, plafondElement } from './competences.ts'
import {
  decrireCible,
  descripteur,
  ecrireElement,
  lireElement,
  type ElementVariable,
} from './elements.ts'
import {
  deltaArme,
  estEcritureDirecte,
  optionAccessible,
  optionRetenue,
  passifsActifs,
  resoudreOperation,
  valeurVisee,
} from './passifs.ts'
import type { Character, ConditionBascule, Operation } from './types.ts'

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
  const plafond = aUnPlafond(element)
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

    const delta = deltaArme(d.quand, acteurAvant, acteurApres)
    if (delta === 0) continue

    for (const operation of passif.effet.operations ?? []) {
      if (!estEcritureDirecte(operation.cible)) continue

      // Appliqué sur `char` et non sur `cible` : deux réactions visant la même
      // jauge s'additionnent au lieu de s'écraser. Le « X » d'une réaction est
      // l'ampleur du changement : deux Marques d'un coup, deux Points de Foi.
      const r = appliquerEcriture(
        char,
        catalog,
        resoudreOperation(operation, { x: Math.abs(delta) }),
      )
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

// ---------------------------------------------------------------------------
// Bascules des choix automatiques
// ---------------------------------------------------------------------------

/** La condition tient-elle sur cette fiche ? Faux sur tout ce qui n'est pas une jauge. */
function basculeTenue(char: Character, catalog: Catalog, condition: ConditionBascule): boolean {
  if (!descripteur(condition.element).lire) return false

  let seuil = condition.seuil
  if (seuil === 'plafond') {
    if (!aUnPlafond(condition.element)) return false
    seuil = plafondElement(char, catalog, condition.element).max
  }

  const valeur = lireElement(char, condition.element)
  return condition.comparaison === 'au-moins' ? valeur >= seuil : valeur <= seuil
}

/**
 * Fait basculer les choix automatiques que la fiche finale impose.
 *
 * L'état se lit à **chaque** écriture, et non au seul franchissement : une
 * Eclipsed passe en Ombre dès que ses Marques sont au plafond, et revient en
 * Lumière dès qu'elles sont à zéro ; entre les deux, rien ne bouge. Lire l'état
 * rattrape aussi ce qu'aucun geste n'a provoqué — un plafond qui baisse quand on
 * range un objet, une écriture passée sans résolution.
 *
 * Trois bornes :
 *  - un choix que l'écriture a elle-même changé est respecté : c'est la MJ qui
 *    force un état, et la règle ne reprend la main qu'à l'écriture suivante ;
 *  - l'option courante garde la main tant que sa propre condition tient ;
 *  - une bascule n'arme aucune réaction — une seule passe.
 */
export function appliquerBascules(
  avant: Character,
  apres: Character,
  catalog: Catalog,
): { char: Character; recits: RecitPassif[] } {
  const recits: RecitPassif[] = []
  let char = apres

  for (const choix of catalog.classe(apres.classeId)?.choix ?? []) {
    if (choix.verrou !== 'automatique') continue
    if (avant.passifs.choix?.[choix.id] !== apres.passifs.choix?.[choix.id]) continue

    const courante = optionRetenue(char, choix)
    if (courante?.bascule && basculeTenue(char, catalog, courante.bascule)) continue

    const suivante = choix.options.find(
      (o) =>
        o.id !== courante?.id &&
        o.bascule !== undefined &&
        optionAccessible(char, o) &&
        basculeTenue(char, catalog, o.bascule),
    )
    if (!suivante) continue

    char = {
      ...char,
      passifs: { ...char.passifs, choix: { ...(char.passifs.choix ?? {}), [choix.id]: suivante.id } },
    }
    recits.push({ chez: char.nom, texte: `${choix.libelle} — ${suivante.nom}` })
  }

  return { char, recits }
}

/**
 * Applique les réactions armées par le passage de `avant` à `apres`, puis les
 * bascules des choix automatiques, lues sur la fiche qui en résulte.
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
  const reactions = reactionsPour(apres, avant, apres, catalog)
  // Les bascules se lisent sur la fiche finale, réactions comprises.
  const propre = appliquerBascules(avant, reactions.char, catalog)
  const recits = [...reactions.recits, ...propre.recits]
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
    const bascules = appliquerBascules(allie, r.char, catalog)
    autres.push(bascules.char)
    recits.push(...r.recits, ...bascules.recits)
  }

  return { char: propre.char, autres, recits }
}
