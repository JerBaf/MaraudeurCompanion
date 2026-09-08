import { createCatalog } from '../../domain/catalog.ts'
import type { EntreeCatalogue } from '../../domain/types.ts'
import { store } from '../../store/index.ts'
import { chemins } from './chemins.ts'

// ---------------------------------------------------------------------------
// Catalogue
// ---------------------------------------------------------------------------

export async function enregistrerEntreeCatalogue(entree: EntreeCatalogue): Promise<void> {
  await store.setDoc(chemins.entreeCatalogue(entree.id), entree)
}

/**
 * Retire une entrée du catalogue, **y compris celles livrées avec l'app**.
 *
 * Les entrées `seed` étaient protégées ; la MJ doit pouvoir nettoyer mes
 * exemples. Le drapeau ne sert donc plus qu'à une chose : « Réinitialiser le
 * catalogue » les fera revenir.
 *
 * Une entrée supprimée que des fiches possèdent laisse un identifiant orphelin ;
 * `catalog.equipement(id)` renvoie alors `undefined` et les écrans le filtrent
 * déjà — l'objet disparaît proprement plutôt que de casser l'affichage.
 */
export async function supprimerEntreeCatalogue(entree: EntreeCatalogue): Promise<void> {
  await store.deleteDoc(chemins.entreeCatalogue(entree.id))
}

/**
 * Export JSON complet du catalogue, pour sauvegarde hors de Firebase.
 *
 * Passe par `createCatalog` plutôt que d'émettre les documents bruts : c'est là
 * que vit `normaliserEntree`, et l'archive contient donc le format courant même
 * si la base porte encore d'anciennes entrées. La lecture brute rendait le
 * contraire, alors que `domain/catalog.ts` cite l'export pour justifier que la
 * normalisation vive à cet endroit.
 */
export async function exporterCatalogue(): Promise<string> {
  const entrees = await store.getCollection<EntreeCatalogue>(chemins.catalogue)
  return JSON.stringify(createCatalog(entrees).toutes(), null, 2)
}
