import { SEED } from '../../content/seed.ts'
import { normaliserCampfire } from '../../domain/campfire.ts'
import { type Catalog, createCatalog } from '../../domain/catalog.ts'
import { type DemandeCreation, creerPersonnage, normaliserPersonnage } from '../../domain/character.ts'
import { type ElementDetachable, effectuerDetachement } from '../../domain/fatigue.ts'
import { cryptoRng, nouvelIdentifiant } from '../../domain/random.ts'
import { type RecitPassif, resoudrePassifs } from '../../domain/reactions.ts'
import type { Adversaire, Campfire, Character, CharacterSecret, EntreeCatalogue, EtatTable, EvenementJournal, ModeTable, ModeleAdversaire, Session, SeuilsAdversaires } from '../../domain/types.ts'
import { store } from '../../store/index.ts'
import { chemins } from './chemins.ts'

// ---------------------------------------------------------------------------
// Amorçage
// ---------------------------------------------------------------------------

export function etatInitial(): EtatTable {
  return {
    mode: 'standard',
    combat: null,
    campfireId: null,
    duelId: null,
    sessionId: null,
    overlay: null,
  }
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
  store.subscribeCollection<Character>(chemins.personnages, (bruts) => {
    personnagesCourants = bruts.map(normaliserPersonnage)
    cb(personnagesCourants)
  })

/**
 * Dernier roster reçu.
 *
 * Même raison que `catalogueCourant` : une réaction croisée — « gagne une
 * brûlure quand une alliée en prend une » — doit connaître les autres fiches, et
 * `modifierPersonnage` ne peut pas s'offrir une lecture réseau à chaque
 * écriture. Vide tant que la souscription n'a pas répondu, ce qui est le bon
 * comportement : aucune alliée n'est touchée sur un roster inconnu.
 *
 * ⚠️ Volontairement **hors du domaine** : `resoudrePassifs` reçoit le roster en
 * paramètre. Un cache lu depuis `src/domain/` briserait la règle de couche et
 * rendrait les règles intestables.
 */
let personnagesCourants: Character[] = []
export const surAdversaires = (cb: (a: Adversaire[]) => void) =>
  store.subscribeCollection<Adversaire>(chemins.adversaires, cb)
/**
 * Dernier catalogue reçu.
 *
 * Les déclencheurs sont résolus dans `modifierPersonnage`, qui n'a pas de
 * catalogue sous la main et ne peut pas s'offrir une lecture réseau à chaque
 * écriture. On garde donc le dernier connu : `surCatalogue` est souscrit dès
 * l'ouverture de l'app (`hooks/useTable.ts`) et le tient à jour.
 *
 * Tant qu'il est nul — avant la première réponse —, aucun déclencheur ne part.
 * C'est le bon comportement : rien ne doit s'appliquer sur un catalogue inconnu.
 */
let catalogueCourant: Catalog | null = null

export const surCatalogue = (cb: (c: Catalog) => void) =>
  store.subscribeCollection<EntreeCatalogue>(chemins.catalogue, (entrees) => {
    catalogueCourant = createCatalog(entrees)
    cb(catalogueCourant)
  })
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

/**
 * Écrit une fiche **sans résoudre les passifs réactifs**.
 *
 * ⚠️ **Réservé aux écritures en masse et déjà résolues par le domaine** :
 * résolution d'un camp, expiration des modificateurs, Détachement. Tous les
 * gestes de fiction — une Marque prise, un achat, un gain de Foi — passent par
 * `modifierPersonnage`, faute de quoi les réactions partent ou non selon
 * l'écran qui a bougé la jauge.
 *
 * La résolution d'un camp est le cas limite : elle remet la Foi et la Fatigue
 * de **toute la table** d'un coup. Y armer les réactions ferait partir chaque
 * passif de chaque joueuse dans la même seconde, sans que personne ne puisse
 * suivre — c'est une remise à zéro, pas un événement.
 */
export async function enregistrerPersonnage(char: Character): Promise<void> {
  await store.setDoc(chemins.personnage(char.id), { ...char, updatedAt: Date.now() })
}

/** Applique une transformation pure du domaine et persiste le résultat. */
/**
 * Modifie une fiche — **le seul chemin qui résout les passifs réactifs**.
 *
 * C'est ici, et nulle part ailleurs, qu'on dispose à la fois de l'état d'avant
 * et de celui d'après. Les brancher plus haut, dans chaque écran, aurait produit
 * des déclencheurs qui partent ou non selon qui a bougé la ressource.
 */
export async function modifierPersonnage(
  char: Character,
  transformer: (c: Character) => Character,
): Promise<Character> {
  const apres = transformer(char)

  /*
   * L'actrice est prise dans `char` — la fiche telle qu'elle est arrivée à
   * l'écran — et jamais dans le cache : celui-ci peut être plus ancien que la
   * prop, et repartir de lui perdrait le geste en cours. Les alliées, elles, ne
   * peuvent venir que du cache.
   */
  const { char: reactif, autres, recits } = catalogueCourant
    ? resoudrePassifs(char, apres, catalogueCourant, personnagesCourants)
    : { char: apres, autres: [] as Character[], recits: [] as RecitPassif[] }

  const suivant = { ...reactif, updatedAt: Date.now() }
  await store.setDoc(chemins.personnage(char.id), suivant)

  // Les alliées touchées par une réaction croisée. Seules celles dont la fiche
  // a réellement changé figurent ici — `resoudrePassifs` écarte les autres.
  for (const allie of autres) {
    await store.setDoc(chemins.personnage(allie.id), { ...allie, updatedAt: Date.now() })
  }

  // Journalisé sous le nom de **celle chez qui l'effet s'est produit**, et non
  // de l'actrice : à relire, « Ilma — Points de Foi +1 » doit désigner Ilma.
  for (const recit of recits) {
    await journaliser(recit.chez, 'passif', recit.texte)
  }

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
