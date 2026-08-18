/**
 * Abstraction de stockage temps réel.
 *
 * Deux implémentations partagent cette interface :
 *  - `local`     : localStorage + BroadcastChannel. Aucune configuration, et la
 *                  synchronisation entre deux onglets du même navigateur est
 *                  réelle — de quoi tester l'écran MJ et l'écran joueuse côte à
 *                  côte avant même d'avoir créé le projet Firebase.
 *  - `firestore` : la vraie table, synchronisée entre les téléphones.
 *
 * Les écrans ne connaissent que cette interface : passer de l'un à l'autre ne
 * change pas une ligne d'interface utilisateur.
 */

export type Unsubscribe = () => void

/** Chemin de document ou de collection, à la Firestore : `tables/ma-table/characters/pj-1`. */
export type Chemin = string

export interface Store {
  readonly kind: 'local' | 'firestore'

  subscribeDoc<T>(chemin: Chemin, cb: (valeur: T | null) => void): Unsubscribe
  subscribeCollection<T>(chemin: Chemin, cb: (valeurs: T[]) => void): Unsubscribe

  getDoc<T>(chemin: Chemin): Promise<T | null>
  getCollection<T>(chemin: Chemin): Promise<T[]>

  setDoc<T>(chemin: Chemin, valeur: T): Promise<void>
  updateDoc(chemin: Chemin, patch: Record<string, unknown>): Promise<void>
  deleteDoc(chemin: Chemin): Promise<void>
}

export type Role = 'mj' | 'joueuse'

export interface Auth {
  readonly role: Role | null
  connecterJoueuse(codeTable: string): Promise<void>
  connecterMJ(pin: string): Promise<void>
  deconnecter(): Promise<void>
  onChange(cb: (role: Role | null) => void): Unsubscribe
}

/** Erreur d'authentification présentable telle quelle à l'écran. */
export class ErreurAuth extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ErreurAuth'
  }
}
