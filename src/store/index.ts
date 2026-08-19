import {
  CODE_TABLE_LOCAL,
  EMAIL_JOUEUSES,
  EMAIL_MJ,
  FIREBASE_CONFIG,
  MODE_LOCAL,
  PIN_MJ_LOCAL,
} from '../config.ts'
import { createFirebaseAuth, firestoreStore, initFirebase } from './firestore.ts'
import { createLocalAuth, localStore } from './local.ts'
import type { Auth, Store } from './types.ts'

/**
 * Les tests utilisent toujours le stockage local, quelle que soit la
 * configuration du projet.
 *
 * Sans cela, la suite de tests dépendrait de la présence d'une configuration
 * Firebase : elle passerait sur une machine et échouerait sur une autre, et
 * surtout elle casserait dès que `src/config.ts` est renseigné — ce qui
 * bloquerait le déploiement, puisque GitHub Actions lance les tests avant le
 * build.
 */
const SOUS_TEST =
  import.meta.env?.MODE === 'test' || Boolean((globalThis as { process?: { env?: Record<string, string> } }).process?.env?.VITEST)

/**
 * Choisit l'implémentation une fois pour toutes au démarrage.
 * Tant que `FIREBASE_CONFIG` vaut `null`, l'app tourne entièrement en local.
 */
function creer(): { store: Store; auth: Auth } {
  if (SOUS_TEST || MODE_LOCAL || FIREBASE_CONFIG === null) {
    return { store: localStore, auth: createLocalAuth(CODE_TABLE_LOCAL, PIN_MJ_LOCAL) }
  }
  initFirebase(FIREBASE_CONFIG)
  return { store: firestoreStore, auth: createFirebaseAuth(EMAIL_JOUEUSES, EMAIL_MJ) }
}

const instance = creer()

export const store = instance.store
export const auth = instance.auth

/**
 * Vrai quand les données vivent dans le navigateur plutôt que dans Firestore.
 * Les écrans s'appuient sur cette valeur — et non sur la configuration — pour
 * n'afficher les avertissements « mode local » que s'il est réellement actif.
 */
export const EN_MODE_LOCAL = instance.store.kind === 'local'

export type { Auth, Role, Store, Unsubscribe } from './types.ts'
export { ErreurAuth } from './types.ts'
