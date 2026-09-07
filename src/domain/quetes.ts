import { ajouterAuPossede } from './campfire.ts'
import type { Catalog } from './catalog.ts'
import type { Character, Quete, Recompense } from './types.ts'

/**
 * Les Quêtes.
 *
 * Une quête est une **entrée de catalogue** : la MJ la compose à l'avance, avec
 * un nom, une description et une récompense. Elle la propose ensuite par une
 * notification — c'est l'acceptation de la joueuse qui la lui donne — puis la
 * valide quand la fiction l'a résolue, ce qui verse la récompense à toutes les
 * porteuses d'un seul geste.
 *
 * ⚠️ **L'état est porté par la quête, pas par la joueuse.** La fiche ne retient
 * que la possession (`possede.quetes`) ; « en cours » ou « validée » se lit sur
 * l'entrée de catalogue. C'est ce qui rend la validation collective sans avoir à
 * tenir un état par joueuse, et c'est aussi ce qui fait qu'une quête validée est
 * consommée : pour la rejouer, on en recrée une.
 */

/** Les quêtes que porte ce personnage. Un identifiant orphelin est ignoré. */
export function quetesDe(char: Character, catalog: Catalog): Quete[] {
  return char.possede.quetes
    .map((id) => catalog.quete(id))
    .filter((q): q is Quete => q !== undefined)
}

/** Celles qui ont accepté la quête — les bénéficiaires de sa validation. */
export function porteusesDe(quete: Quete, personnages: readonly Character[]): Character[] {
  return personnages.filter((c) => c.possede.quetes.includes(quete.id))
}

export function recompenseVide(recompense: Recompense): boolean {
  return !recompense.lumens && recompense.entrees.length === 0
}

/**
 * La récompense en toutes lettres — l'aperçu de l'onglet et de la carte.
 *
 * Une entrée supprimée du catalogue laisse un identifiant orphelin : on l'affiche
 * tel quel plutôt que de le taire, sans quoi une récompense amputée passerait
 * inaperçue.
 */
export function decrireRecompense(recompense: Recompense, catalog: Catalog): string {
  const parts = [
    recompense.lumens ? `${recompense.lumens} ʟ` : null,
    ...recompense.entrees.map((id) => catalog.entree(id)?.nom ?? id),
  ].filter((p): p is string => p !== null)

  return parts.length > 0 ? parts.join(' · ') : 'Aucune récompense'
}

/**
 * Verse la récompense sur une fiche.
 *
 * Le rangement des entrées passe par `ajouterAuPossede`, partagé avec l'achat en
 * boutique : c'est le même geste, et il est idempotent — une récompense peut
 * nommer un sort que la joueuse possède déjà.
 */
export function appliquerRecompense(
  char: Character,
  recompense: Recompense,
  catalog: Catalog,
): Character {
  const credite = recompense.lumens
    ? { ...char, lumens: char.lumens + recompense.lumens }
    : char

  return recompense.entrees.reduce((c, id) => {
    const entree = catalog.entree(id)
    return entree ? ajouterAuPossede(c, entree) : c
  }, credite)
}
