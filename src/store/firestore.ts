import { initializeApp, type FirebaseOptions } from 'firebase/app'
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type Auth as FirebaseAuth,
} from 'firebase/auth'
import {
  collection,
  deleteDoc as fsDeleteDoc,
  doc,
  getDoc as fsGetDoc,
  getDocs,
  getFirestore,
  onSnapshot,
  setDoc as fsSetDoc,
  updateDoc as fsUpdateDoc,
  type Firestore,
} from 'firebase/firestore'

import { signalerErreur } from './erreurs.ts'
import { ErreurAuth, type Auth, type Chemin, type Role, type Store, type Unsubscribe } from './types.ts'

/**
 * Implémentation Firestore.
 *
 * Les chemins sont déjà à la forme Firestore (`tables/x/characters/y`), donc
 * `doc()` et `collection()` les acceptent tels quels. Le temps réel passe par
 * `onSnapshot`, qui pousse chaque modification vers tous les écrans connectés.
 */

let firestore: Firestore | null = null
let firebaseAuth: FirebaseAuth | null = null

export function initFirebase(config: FirebaseOptions): void {
  const app = initializeApp(config)
  firestore = getFirestore(app)
  firebaseAuth = getAuth(app)
}

function db(): Firestore {
  if (!firestore) throw new Error('Firebase n’est pas initialisé (voir src/config.ts).')
  return firestore
}

export const firestoreStore: Store = {
  kind: 'firestore',

  subscribeDoc<T>(chemin: Chemin, cb: (valeur: T | null) => void): Unsubscribe {
    return onSnapshot(
      doc(db(), chemin),
      (snap) => cb(snap.exists() ? (snap.data() as T) : null),
      (err) => {
        signalerErreur(chemin, 'lecture', err)
        cb(null)
      },
    )
  },

  subscribeCollection<T>(chemin: Chemin, cb: (valeurs: T[]) => void): Unsubscribe {
    return onSnapshot(
      collection(db(), chemin),
      (snap) => cb(snap.docs.map((d) => d.data() as T)),
      (err) => {
        signalerErreur(chemin, 'lecture', err)
        cb([])
      },
    )
  },

  async getDoc<T>(chemin: Chemin): Promise<T | null> {
    return surveiller(chemin, 'lecture', async () => {
      const snap = await fsGetDoc(doc(db(), chemin))
      return snap.exists() ? (snap.data() as T) : null
    })
  },

  async getCollection<T>(chemin: Chemin): Promise<T[]> {
    return surveiller(chemin, 'lecture', async () => {
      const snap = await getDocs(collection(db(), chemin))
      return snap.docs.map((d) => d.data() as T)
    })
  },

  async setDoc<T>(chemin: Chemin, valeur: T): Promise<void> {
    return surveiller(chemin, 'écriture', () => fsSetDoc(doc(db(), chemin), valeur as object))
  },

  async updateDoc(chemin: Chemin, patch: Record<string, unknown>): Promise<void> {
    return surveiller(chemin, 'écriture', () => fsUpdateDoc(doc(db(), chemin), patch))
  },

  async deleteDoc(chemin: Chemin): Promise<void> {
    return surveiller(chemin, 'écriture', () => fsDeleteDoc(doc(db(), chemin)))
  },
}

/**
 * Signale l'échec à l'écran puis le relaie à l'appelant.
 * On ne l'avale pas : un `await` qui échoue doit continuer d'échouer.
 */
async function surveiller<T>(
  chemin: Chemin,
  operation: 'lecture' | 'écriture',
  action: () => Promise<T>,
): Promise<T> {
  try {
    return await action()
  } catch (e) {
    signalerErreur(chemin, operation, e)
    throw e
  }
}

// ---------------------------------------------------------------------------
// Authentification
// ---------------------------------------------------------------------------

/**
 * Deux comptes Email/Password, dont le mot de passe est le code de table ou le
 * PIN MJ. Le rôle se déduit de l'adresse du compte connecté, et c'est cette
 * même adresse que vérifient les règles Firestore — l'écran ne peut donc pas
 * s'auto-proclamer MJ.
 */
export function createFirebaseAuth(emailJoueuses: string, emailMJ: string): Auth {
  const ecouteurs = new Set<(r: Role | null) => void>()
  let role: Role | null = null

  const auth = () => {
    if (!firebaseAuth) throw new Error('Firebase n’est pas initialisé (voir src/config.ts).')
    return firebaseAuth
  }

  onAuthStateChanged(auth(), (user) => {
    const email = user?.email ?? null
    role = email === emailMJ ? 'mj' : email === emailJoueuses ? 'joueuse' : null
    for (const cb of ecouteurs) cb(role)
  })

  const connecter = async (email: string, motDePasse: string, quoi: string) => {
    try {
      await signInWithEmailAndPassword(auth(), email, motDePasse)
    } catch (e) {
      const code = (e as { code?: string }).code ?? ''
      if (code.includes('too-many-requests')) {
        throw new ErreurAuth('Trop de tentatives. Patientez une minute avant de réessayer.')
      }
      throw new ErreurAuth(`${quoi} incorrect.`)
    }
  }

  return {
    get role() {
      return role
    },
    connecterJoueuse: (code) => connecter(emailJoueuses, code.trim(), 'Code de table'),
    connecterMJ: (pin) => connecter(emailMJ, pin.trim(), 'PIN MJ'),
    async deconnecter() {
      await signOut(auth())
    },
    onChange(cb) {
      ecouteurs.add(cb)
      cb(role)
      return () => ecouteurs.delete(cb)
    },
  }
}
