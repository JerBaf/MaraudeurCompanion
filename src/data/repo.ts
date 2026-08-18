import { TABLE_ID } from '../config.ts'
import { SEED } from '../content/seed.ts'
import { createCatalog, type Catalog } from '../domain/catalog.ts'
import { creerPersonnage, type DemandeCreation } from '../domain/character.ts'
import { effectuerDetachement, type ElementDetachable } from '../domain/fatigue.ts'
import { cryptoRng } from '../domain/random.ts'
import type {
  Adversaire,
  Character,
  CharacterSecret,
  EntreeCatalogue,
  EtatTable,
  EvenementJournal,
  ModeTable,
} from '../domain/types.ts'
import { store } from '../store/index.ts'

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
  catalogue: `${racine}/catalog`,
  entreeCatalogue: (id: string) => `${racine}/catalog/${id}`,
  journal: `${racine}/log`,
  evenement: (id: string) => `${racine}/log/${id}`,
}

function nouvelIdentifiant(): string {
  return globalThis.crypto?.randomUUID?.() ?? `id-${Date.now()}-${Math.floor(Math.random() * 1e6)}`
}

// ---------------------------------------------------------------------------
// Amorçage
// ---------------------------------------------------------------------------

export function etatInitial(): EtatTable {
  return { mode: 'standard', combat: null, campfireId: null, jour: 1, sessionId: null, overlay: null }
}

/**
 * Écrit la graine de contenu et l'état initial s'ils n'existent pas encore.
 * Idempotent : relancer ne remplace jamais une entrée déjà modifiée par la MJ.
 */
export async function amorcerSiNecessaire(): Promise<{ entreesAjoutees: number; etatCree: boolean }> {
  const existantes = await store.getCollection<EntreeCatalogue>(chemins.catalogue)
  const connues = new Set(existantes.map((e) => e.id))

  let entreesAjoutees = 0
  for (const entree of SEED) {
    if (connues.has(entree.id)) continue
    await store.setDoc(chemins.entreeCatalogue(entree.id), entree)
    entreesAjoutees += 1
  }

  const etat = await store.getDoc<EtatTable>(chemins.etat)
  const etatCree = etat === null
  if (etatCree) await store.setDoc(chemins.etat, etatInitial())

  return { entreesAjoutees, etatCree }
}

/** Réécrit toute la graine par-dessus l'existant. Destructif : réservé à la MJ. */
export async function reinitialiserCatalogue(): Promise<void> {
  for (const entree of SEED) await store.setDoc(chemins.entreeCatalogue(entree.id), entree)
}

// ---------------------------------------------------------------------------
// Abonnements
// ---------------------------------------------------------------------------

export const surEtat = (cb: (e: EtatTable | null) => void) => store.subscribeDoc<EtatTable>(chemins.etat, cb)
export const surPersonnages = (cb: (c: Character[]) => void) =>
  store.subscribeCollection<Character>(chemins.personnages, cb)
export const surAdversaires = (cb: (a: Adversaire[]) => void) =>
  store.subscribeCollection<Adversaire>(chemins.adversaires, cb)
export const surCatalogue = (cb: (c: Catalog) => void) =>
  store.subscribeCollection<EntreeCatalogue>(chemins.catalogue, (entrees) => cb(createCatalog(entrees)))
export const surJournal = (cb: (e: EvenementJournal[]) => void) =>
  store.subscribeCollection<EvenementJournal>(chemins.journal, (evts) =>
    cb([...evts].sort((a, b) => b.ts - a.ts)),
  )

// ---------------------------------------------------------------------------
// Journal
// ---------------------------------------------------------------------------

/**
 * Journalise une action. 🔒 Lisible par la MJ seulement (règles Firestore) :
 * les joueuses y écrivent leurs actions mais ne peuvent pas le relire.
 */
export async function journaliser(
  acteur: string,
  type: string,
  resume: string,
  payload?: Record<string, unknown>,
): Promise<void> {
  const id = nouvelIdentifiant()
  const evenement: EvenementJournal = {
    id,
    ts: Date.now(),
    acteur,
    type,
    resume,
    ...(payload ? { payload } : {}),
  }
  await store.setDoc(chemins.evenement(id), evenement)
}

// ---------------------------------------------------------------------------
// Personnages
// ---------------------------------------------------------------------------

export async function creerEtEnregistrerPersonnage(
  demande: Omit<DemandeCreation, 'id'>,
  catalog: Catalog,
): Promise<Character> {
  const id = nouvelIdentifiant()
  const { char, secret } = creerPersonnage({ ...demande, id }, catalog, cryptoRng, Date.now())

  await store.setDoc(chemins.personnage(id), char)
  // 🔒 Les cycles partent dans une collection distincte, jamais dans la fiche.
  await store.setDoc(chemins.secret(id), secret)
  await journaliser(char.nom, 'creation', `${char.nom} rejoint la table (${char.classeId}).`)

  return char
}

export async function enregistrerPersonnage(char: Character): Promise<void> {
  await store.setDoc(chemins.personnage(char.id), { ...char, updatedAt: Date.now() })
}

/** Applique une transformation pure du domaine et persiste le résultat. */
export async function modifierPersonnage(
  char: Character,
  transformer: (c: Character) => Character,
): Promise<Character> {
  const suivant = { ...transformer(char), updatedAt: Date.now() }
  await store.setDoc(chemins.personnage(char.id), suivant)
  return suivant
}

export async function supprimerPersonnage(char: Character): Promise<void> {
  await store.deleteDoc(chemins.personnage(char.id))
  await store.deleteDoc(chemins.secret(char.id))
  await journaliser('MJ', 'suppression', `${char.nom} a été retiré de la table.`)
}

/** Associe le personnage à l'appareil courant (« cliquer sur son personnage »). */
export async function reclamerPersonnage(char: Character, deviceId: string): Promise<void> {
  await store.updateDoc(chemins.personnage(char.id), { claimedBy: deviceId, updatedAt: Date.now() })
}

export const surSecret = (id: string, cb: (s: CharacterSecret | null) => void) =>
  store.subscribeDoc<CharacterSecret>(chemins.secret(id), cb)

export async function enregistrerSecret(secret: CharacterSecret): Promise<void> {
  await store.setDoc(chemins.secret(secret.characterId), secret)
}

// ---------------------------------------------------------------------------
// Détachement
// ---------------------------------------------------------------------------

/**
 * Effectue un Détachement et le persiste.
 * Le tirage est fait par l'app — c'est un des cas où l'impartialité compte.
 */
export async function detacher(
  char: Character,
  catalog: Catalog,
): Promise<{ perdu: ElementDetachable | null; pool: ElementDetachable[] }> {
  const resultat = effectuerDetachement(char, catalog, cryptoRng)
  if (!resultat.perdu) return { perdu: null, pool: resultat.pool }

  await enregistrerPersonnage(resultat.char)
  await journaliser(
    'MJ',
    'detachement',
    `Détachement sur ${char.nom} : « ${resultat.perdu.nom} » est perdu à jamais.`,
    { characterId: char.id, perduId: resultat.perdu.id, taillePool: resultat.pool.length },
  )
  return { perdu: resultat.perdu, pool: resultat.pool }
}

// ---------------------------------------------------------------------------
// État de la table
// ---------------------------------------------------------------------------

export async function definirMode(etat: EtatTable, mode: ModeTable): Promise<void> {
  await store.setDoc(chemins.etat, { ...etat, mode })
  await journaliser('MJ', 'mode', `Passage en mode ${mode}.`)
}

export async function enregistrerEtat(etat: EtatTable): Promise<void> {
  await store.setDoc(chemins.etat, etat)
}

// ---------------------------------------------------------------------------
// Catalogue
// ---------------------------------------------------------------------------

export async function enregistrerEntreeCatalogue(entree: EntreeCatalogue): Promise<void> {
  await store.setDoc(chemins.entreeCatalogue(entree.id), entree)
}

export async function supprimerEntreeCatalogue(entree: EntreeCatalogue): Promise<void> {
  if (entree.seed) throw new Error('Une entrée livrée avec l’app ne peut pas être supprimée.')
  await store.deleteDoc(chemins.entreeCatalogue(entree.id))
}

/** Export JSON complet du catalogue, pour sauvegarde hors de Firebase. */
export async function exporterCatalogue(): Promise<string> {
  const entrees = await store.getCollection<EntreeCatalogue>(chemins.catalogue)
  return JSON.stringify(entrees, null, 2)
}

export async function importerCatalogue(json: string): Promise<number> {
  const entrees = JSON.parse(json) as EntreeCatalogue[]
  if (!Array.isArray(entrees)) throw new Error('Le fichier ne contient pas une liste d’entrées.')
  for (const entree of entrees) await store.setDoc(chemins.entreeCatalogue(entree.id), entree)
  return entrees.length
}
