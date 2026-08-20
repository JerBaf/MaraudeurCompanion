import { TABLE_ID } from '../config.ts'
import { SEED } from '../content/seed.ts'
import {
  normaliserCampfire,
  PROFILS_CAMP,
  resoudreCampPourPersonnage,
  resoudreInvestissements,
  type BilanInvestissements,
} from '../domain/campfire.ts'
import { createCatalog, type Catalog } from '../domain/catalog.ts'
import { etatCombatInitial, indexMoment, sousGroupeSuivant } from '../domain/combat.ts'
import { creerPersonnage, normaliserPersonnage, type DemandeCreation } from '../domain/character.ts'
import { effectuerDetachement, type ElementDetachable } from '../domain/fatigue.ts'
import { expireModifiers, type EvenementExpiration } from '../domain/modifiers.ts'
import { cryptoRng } from '../domain/random.ts'
import type {
  Adversaire,
  Character,
  CharacterSecret,
  EntreeCatalogue,
  EtatTable,
  EvenementJournal,
  Campfire,
  ModeleAdversaire,
  ModeTable,
  PhaseCampfire,
  SeuilsAdversaires,
  Session,
  TypeCamp,
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
  return { mode: 'standard', combat: null, campfireId: null, sessionId: null, overlay: null }
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
/**
 * Seul chemin par lequel une fiche entre dans l'application.
 *
 * La normalisation y est appliquée une fois pour toutes : les fiches écrites
 * avant l'ajout d'un champ n'en contiennent pas, et les écrans ne doivent pas
 * avoir à s'en méfier. Voir `normaliserPersonnage`.
 */
export const surPersonnages = (cb: (c: Character[]) => void) =>
  store.subscribeCollection<Character>(chemins.personnages, (bruts) =>
    cb(bruts.map(normaliserPersonnage)),
  )
export const surAdversaires = (cb: (a: Adversaire[]) => void) =>
  store.subscribeCollection<Adversaire>(chemins.adversaires, cb)
export const surCatalogue = (cb: (c: Catalog) => void) =>
  store.subscribeCollection<EntreeCatalogue>(chemins.catalogue, (entrees) => cb(createCatalog(entrees)))
/** 🔒 Réservé à la MJ par les règles Firestore. */
export const surBestiaire = (cb: (m: ModeleAdversaire[]) => void) =>
  store.subscribeCollection<ModeleAdversaire>(chemins.bestiaire, (modeles) =>
    cb([...modeles].sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))),
  )

/** 🔒 Réservé à la MJ par les règles Firestore. */
export const surSeuilsAdversaires = (cb: (s: SeuilsAdversaires) => void) =>
  store.subscribeDoc<SeuilsAdversaires>(chemins.seuilsAdversaires, (s) => cb(s ?? {}))

export const surSession = (id: string, cb: (s: Session | null) => void) =>
  store.subscribeDoc<Session>(chemins.session(id), cb)

export const surCampfire = (id: string, cb: (c: Campfire | null) => void) =>
  store.subscribeDoc<Campfire>(chemins.campfire(id), (c) => cb(c && normaliserCampfire(c)))

/** 🔒 Réservé à la MJ par les règles Firestore. */
export const surBrouillonCampfire = (cb: (c: Campfire | null) => void) =>
  store.subscribeDoc<Campfire>(chemins.brouillonCampfire, (c) => cb(c && normaliserCampfire(c)))

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

/**
 * Crée un personnage depuis l'écran joueuse.
 *
 * 🔒 N'écrit **que** la fiche. Les cycles vivent dans `secrets/`, une collection
 * réservée à la MJ : les y écrire depuis le navigateur d'une joueuse serait à la
 * fois refusé par les règles et contraire au but recherché — son appareil
 * connaîtrait la valeur. La MJ les saisit depuis son écran quand elle le veut.
 */
export async function creerEtEnregistrerPersonnage(
  demande: Omit<DemandeCreation, 'id'>,
  catalog: Catalog,
): Promise<Character> {
  const id = nouvelIdentifiant()
  const char = creerPersonnage({ ...demande, id }, catalog, Date.now())

  await store.setDoc(chemins.personnage(id), char)
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

// ---------------------------------------------------------------------------
// Bestiaire — 🔒 écriture MJ
// ---------------------------------------------------------------------------

export async function enregistrerModele(modele: ModeleAdversaire): Promise<void> {
  await store.setDoc(chemins.modele(modele.id), modele)
}

export async function supprimerModele(id: string): Promise<void> {
  await store.deleteDoc(chemins.modele(id))
}

export function nouveauModele(): ModeleAdversaire {
  return { id: nouvelIdentifiant(), nom: '', evasion: 1, fatigueMax: 0, icone: 'spectre' }
}

// ---------------------------------------------------------------------------
// Adversaires en jeu
// ---------------------------------------------------------------------------

/**
 * Dépose un exemplaire dans le combat.
 *
 * Le seuil de Fatigue part dans le document réservé à la MJ, jamais dans la
 * fiche d'adversaire que les joueuses lisent.
 */
export async function ajouterAdversaire(
  adv: Adversaire,
  seuil: number,
  seuilsActuels: SeuilsAdversaires,
): Promise<void> {
  await store.setDoc(chemins.adversaire(adv.id), adv)
  if (seuil > 0) {
    await store.setDoc(chemins.seuilsAdversaires, { ...seuilsActuels, [adv.id]: seuil })
  }
  await journaliser('MJ', 'adversaire', `${adv.nom} entre en jeu (Évasion ${adv.evasion}).`)
}

export async function enregistrerAdversaire(adv: Adversaire): Promise<void> {
  await store.setDoc(chemins.adversaire(adv.id), adv)
}

export async function supprimerAdversaire(
  adv: Adversaire,
  seuilsActuels: SeuilsAdversaires,
): Promise<void> {
  await store.deleteDoc(chemins.adversaire(adv.id))
  if (adv.id in seuilsActuels) {
    const { [adv.id]: _retire, ...reste } = seuilsActuels
    await store.setDoc(chemins.seuilsAdversaires, reste)
  }
  await journaliser('MJ', 'adversaire', `${adv.nom} quitte le combat (${adv.degatsSubis} dégâts).`)
}

// ---------------------------------------------------------------------------
// Pilotage du combat
// ---------------------------------------------------------------------------

export async function demarrerCombat(etat: EtatTable): Promise<void> {
  await store.setDoc(chemins.etat, { ...etat, mode: 'combat', combat: etatCombatInitial() })
  await journaliser('MJ', 'combat', 'Début du combat.')
}

/**
 * Une joueuse dépose son initiative.
 *
 * N'écrit que la carte `initiatives` : les règles Firestore refusent toute
 * écriture qui modifierait le tour ou le sous-groupe actif.
 */
export async function definirInitiative(
  etat: EtatTable,
  characterId: string,
  d6: number,
): Promise<void> {
  const combat = etat.combat ?? etatCombatInitial()
  await store.updateDoc(chemins.etat, {
    combat: { ...combat, initiatives: { ...combat.initiatives, [characterId]: d6 } },
  })
}

/**
 * Passe au sous-groupe suivant, et au tour suivant après « Après la MJ ».
 *
 * ⚠️ C'est ici que tombent les Esquives et les Diversions. L'expiration est
 * évaluée à **chaque** activation et non au seul changement de tour : une
 * Esquive doit couvrir le moment de la MJ, une Diversion peut n'être valable
 * que pour l'activation en cours. Elle s'applique à **tous** les personnages,
 * car une Diversion posée par une joueuse vit sur la fiche d'une autre.
 */
export async function avancerSousGroupe(
  etat: EtatTable,
  personnages: readonly Character[],
): Promise<void> {
  const combat = etat.combat ?? etatCombatInitial()
  const { sousGroupe, nouveauTour } = sousGroupeSuivant(combat.sousGroupeActif)
  const tour = nouveauTour ? combat.tour + 1 : combat.tour

  await store.setDoc(chemins.etat, {
    ...etat,
    combat: { ...combat, sousGroupeActif: sousGroupe, tour },
  })

  await expirerSurTousLesPersonnages(personnages, {
    kind: 'moment',
    moment: indexMoment(tour, sousGroupe),
  })
}

/**
 * Termine le combat : adversaires, initiatives et effets de tour disparaissent.
 * Choix arrêté avec la MJ — l'écran repart propre au prochain affrontement.
 */
export async function terminerCombat(
  etat: EtatTable,
  personnages: readonly Character[],
  adversaires: readonly Adversaire[],
): Promise<void> {
  for (const adv of adversaires) await store.deleteDoc(chemins.adversaire(adv.id))
  await store.setDoc(chemins.seuilsAdversaires, {})
  await store.setDoc(chemins.etat, { ...etat, mode: 'standard', combat: null })
  await expirerSurTousLesPersonnages(personnages, { kind: 'fin-combat' })
  await journaliser('MJ', 'combat', 'Fin du combat.')
}

/** N'écrit que les fiches réellement modifiées par l'expiration. */
async function expirerSurTousLesPersonnages(
  personnages: readonly Character[],
  evenement: EvenementExpiration,
): Promise<void> {
  for (const char of personnages) {
    const modifiers = expireModifiers(char.modifiers, evenement)
    if (modifiers.length !== char.modifiers.length) {
      await enregistrerPersonnage({ ...char, modifiers })
    }
  }
}

export async function enregistrerEtat(etat: EtatTable): Promise<void> {
  await store.setDoc(chemins.etat, etat)
}

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

export interface BilanOuverture {
  session: Session
  /** Bilan des investissements, par personnage. */
  bilans: { char: Character; bilan: BilanInvestissements }[]
}

/**
 * Ouvre une nouvelle session.
 *
 * C'est le moment où les investissements rendent leurs comptes : loyers versés,
 * cargaisons arrivées ou perdues, rénovations à payer. Les tirages sont faits
 * ici, une fois, et le résultat est persisté — relancer l'écran ne rejoue pas
 * la chance.
 */
export async function ouvrirSession(etat: EtatTable, personnages: readonly Character[]): Promise<BilanOuverture> {
  const anterieures = await store.getCollection<Session>(chemins.sessions)
  const numero = anterieures.reduce((max, s) => Math.max(max, s.numero), 0) + 1

  const catalog = createCatalog(await store.getCollection<EntreeCatalogue>(chemins.catalogue))

  const bilans: BilanOuverture['bilans'] = []
  for (const char of personnages) {
    const bilan = resoudreInvestissements(char, catalog, numero, cryptoRng)
    if (bilan.total !== 0) {
      await enregistrerPersonnage({ ...char, lumens: Math.max(0, char.lumens + bilan.total) })
    }
    bilans.push({ char, bilan })
  }

  const session: Session = {
    id: nouvelIdentifiant(),
    numero,
    ouverteLe: Date.now(),
  }

  await store.setDoc(chemins.session(session.id), session)
  await store.setDoc(chemins.etat, { ...etat, sessionId: session.id })
  await journaliser('MJ', 'session', `Ouverture de la session ${numero}.`)

  for (const { char, bilan } of bilans) {
    for (const ligne of bilan.lignes) {
      await journaliser('MJ', 'investissement', `${char.nom} — ${ligne.nom} : ${ligne.recit}`)
    }
  }

  return { session, bilans }
}

// Les jetons de Feu de Camp vivaient ici, dans le document de session, et
// c'était l'écran des joueuses qui les posait — or les règles réservent
// l'écriture de `sessions/` à la MJ, si bien qu'en production chaque limite
// était refusée et jamais enregistrée. Ils sont désormais portés par la fiche,
// seul document que la joueuse a le droit d'écrire (`Character.jetonsCamp`).

// ---------------------------------------------------------------------------
// Feu de Camp
// ---------------------------------------------------------------------------

/**
 * Prépare un brouillon pour la session en cours.
 *
 * Le camp **initial** est celui qui ouvre la session, ce qui se lit en regardant
 * si un camp a déjà été lancé pour ce numéro de session. La MJ peut toujours
 * corriger la nature du camp depuis son écran ; ce n'est qu'une proposition.
 */
export async function creerBrouillonPourSession(sessionNumero: number): Promise<Campfire> {
  const camps = await store.getCollection<Campfire>(chemins.campfires)
  const dejaLance = camps.some((c) => c.sessionNumero === sessionNumero && c.lanceLe !== null)
  return nouveauBrouillon(sessionNumero, dejaLance ? 'repos-court' : 'initial')
}

export function nouveauBrouillon(sessionNumero: number, type: TypeCamp): Campfire {
  return {
    id: nouvelIdentifiant(),
    sessionNumero,
    type,
    // La phase de départ vient du profil : elle ne peut donc pas désigner une
    // phase que ce camp n'ouvre pas.
    phase: PROFILS_CAMP[type].phases[0] as PhaseCampfire,
    brief: '',
    offres: {},
    investissementsProposes: [],
    lanceLe: null,
  }
}

/** 🔒 Écrit dans la collection réservée à la MJ : rien ne fuite avant le lancement. */
export async function enregistrerBrouillon(brouillon: Campfire): Promise<void> {
  await store.setDoc(chemins.brouillonCampfire, brouillon)
}

export async function abandonnerBrouillon(): Promise<void> {
  await store.deleteDoc(chemins.brouillonCampfire)
}

/**
 * Publie le brouillon : le camp devient visible et la table y bascule.
 *
 * ⚠️ C'est **ici** que le camp est résolu pour chaque personnage — Fatigue
 * rendue, cristaux étudiés, effets de la session écoulée levés. Le faire à la
 * fermeture effacerait le Serment que la joueuse vient d'engager à la phase
 * Grimoire, alors qu'il vaut pour la session qui commence.
 */
export async function lancerCampfire(
  etat: EtatTable,
  brouillon: Campfire,
  personnages: readonly Character[],
): Promise<Campfire> {
  const campfire: Campfire = { ...brouillon, lanceLe: Date.now() }
  await store.setDoc(chemins.campfire(campfire.id), campfire)

  for (const char of personnages) {
    const { char: resolu, effets } = resoudreCampPourPersonnage(char, campfire.type)
    await enregistrerPersonnage(resolu)
    if (effets.length > 0) {
      await journaliser('MJ', 'camp', `${char.nom} — ${effets.join(' · ')}`)
    }
  }

  await store.setDoc(chemins.etat, { ...etat, mode: 'campfire', campfireId: campfire.id })
  await abandonnerBrouillon()
  await journaliser('MJ', 'camp', `Feu de camp — ${PROFILS_CAMP[campfire.type].libelle}.`)

  return campfire
}

export async function definirPhase(campfire: Campfire, phase: PhaseCampfire): Promise<void> {
  await store.setDoc(chemins.campfire(campfire.id), { ...campfire, phase })
}

export async function terminerCampfire(etat: EtatTable): Promise<void> {
  await store.setDoc(chemins.etat, { ...etat, mode: 'standard', campfireId: null })
  await journaliser('MJ', 'camp', 'Fin du feu de camp.')
}

export async function enregistrerCampfire(campfire: Campfire): Promise<void> {
  await store.setDoc(chemins.campfire(campfire.id), campfire)
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
