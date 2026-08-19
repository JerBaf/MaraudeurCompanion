import type { FirebaseOptions } from 'firebase/app'

/**
 * Configuration de la table.
 *
 * ── Pourquoi ce fichier peut être commité dans un repo public ──────────────
 * La configuration web Firebase (`apiKey`, `projectId`…) **n'est pas un secret**.
 * Elle est publique par conception et se lit de toute façon dans le JavaScript
 * livré au navigateur. Ce qui protège vos données, ce sont les règles de sécurité
 * de `firebase/firestore.rules`, jamais l'obscurité de ces valeurs.
 *
 * Ce qui doit rester secret, ce sont le **code de table** et le **PIN MJ** :
 * ce sont les mots de passe des deux comptes Firebase, et ils ne figurent
 * nulle part dans le code — ils sont saisis à l'écran de connexion.
 */

/**
 * Renseignez ceci après avoir créé le projet sur console.firebase.google.com.
 * Laissez `null` pour travailler en mode local (voir plus bas).
 */
export const FIREBASE_CONFIG: FirebaseOptions | null = {
  apiKey: "AIzaSyCrJ4z2lmdsrId5Hw0FdOtzr9VgG7EcafM",
  authDomain: "maraudeurcompanion.firebaseapp.com",
  projectId: "maraudeurcompanion",
  storageBucket: "maraudeurcompanion.firebasestorage.app",
  messagingSenderId: "977081855630",
  appId: "1:977081855630:web:e9301981f4a556be7223df"
};

/**
 * Les deux comptes Firebase Auth (Email/Password) à créer dans la console.
 * Leur *mot de passe* est respectivement le code de table et le PIN MJ.
 * Les règles Firestore distinguent les rôles sur ces adresses.
 */
export const EMAIL_JOUEUSES = 'table@maraudeur.local'
export const EMAIL_MJ = 'mj@maraudeur.local'

/** Identifiant de la table. Une seule suffit ; le modèle en supporte plusieurs. */
export const TABLE_ID = 'entre-monde'

/**
 * Mode local — actif tant que `FIREBASE_CONFIG` vaut `null`.
 *
 * Les données vivent dans le localStorage du navigateur et se synchronisent
 * entre onglets. Ouvrez deux onglets, connectez-vous en MJ dans l'un et en
 * joueuse dans l'autre : vous verrez l'app fonctionner pour de bon, sans avoir
 * rien configuré. Ces identifiants ne servent qu'à ce mode.
 */
export const CODE_TABLE_LOCAL = 'ENTREMONDE'
export const PIN_MJ_LOCAL = '1234'

export const MODE_LOCAL = FIREBASE_CONFIG === null
