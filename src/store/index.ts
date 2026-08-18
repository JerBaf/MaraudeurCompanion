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
 * Choisit l'implémentation une fois pour toutes au démarrage.
 * Tant que `FIREBASE_CONFIG` vaut `null`, l'app tourne entièrement en local.
 */
function creer(): { store: Store; auth: Auth } {
  if (MODE_LOCAL || FIREBASE_CONFIG === null) {
    return { store: localStore, auth: createLocalAuth(CODE_TABLE_LOCAL, PIN_MJ_LOCAL) }
  }
  initFirebase(FIREBASE_CONFIG)
  return { store: firestoreStore, auth: createFirebaseAuth(EMAIL_JOUEUSES, EMAIL_MJ) }
}

const instance = creer()

export const store = instance.store
export const auth = instance.auth

export type { Auth, Role, Store, Unsubscribe } from './types.ts'
export { ErreurAuth } from './types.ts'
