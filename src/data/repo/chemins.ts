import { TABLE_ID } from '../../config.ts'

// ---------------------------------------------------------------------------
// Chemins
// ---------------------------------------------------------------------------

const racine = `tables/${TABLE_ID}`

export const chemins = {
  etat: `${racine}/state/current`,
  personnages: `${racine}/characters`,
  personnage: (id: string) => `${racine}/characters/${id}`,
  /** 🔒 Refusé aux joueuses par les règles Firestore. */
  secret: (id: string) => `${racine}/secrets/${id}`,
  adversaires: `${racine}/adversaries`,
  adversaire: (id: string) => `${racine}/adversaries/${id}`,
  /** 🔒 Bestiaire de la MJ : Évasions et seuils, refusés aux joueuses. */
  bestiaire: `${racine}/bestiary`,
  modele: (id: string) => `${racine}/bestiary/${id}`,
  /** 🔒 Seuils de Fatigue des adversaires en jeu, en un seul document. */
  seuilsAdversaires: `${racine}/secrets/adversaires`,
  sessions: `${racine}/sessions`,
  session: (id: string) => `${racine}/sessions/${id}`,
  campfires: `${racine}/campfires`,
  campfire: (id: string) => `${racine}/campfires/${id}`,
  /**
   * 🔒 Le camp en préparation.
   *
   * Rangé dans `secrets/` et non dans `campfires/` : les joueuses ont accès en
   * lecture à toute la collection publique des camps, et y écrire une
   * préparation leur livrerait le brief de mission et les offres de boutique
   * avant l'annonce. Lancer un camp consiste à publier ce brouillon.
   */
  brouillonCampfire: `${racine}/secrets/campfire-brouillon`,
  duels: `${racine}/duels`,
  duel: (id: string) => `${racine}/duels/${id}`,
  /**
   * 🔒 Le motif du PNJ, et la préparation du duel.
   *
   * Un duel dont le motif est lisible est un duel déjà résolu : il ne peut pas
   * vivre dans le document public, que toute la table lit pour suivre le
   * plateau. Lancer un duel consiste à publier la moitié que les joueuses ont le
   * droit de voir.
   */
  duelPrive: `${racine}/secrets/duel`,
  /**
   * Les notifications en cours.
   *
   * Publique, comme les duels : les joueuses partagent un compte, et un
   * document rangé dans `secrets/` leur serait refusé en lecture — donc
   * invisible pour sa propre destinataire. Le « secret » d'un Choix secret est
   * social, pas cryptographique.
   */
  notifications: `${racine}/notifications`,
  notification: (id: string) => `${racine}/notifications/${id}`,
  catalogue: `${racine}/catalog`,
  entreeCatalogue: (id: string) => `${racine}/catalog/${id}`,
  journal: `${racine}/log`,
  evenement: (id: string) => `${racine}/log/${id}`,
}
