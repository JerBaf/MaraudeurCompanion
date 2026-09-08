import { type BilanInvestissements, PROFILS_CAMP, resoudreCampPourPersonnage, resoudreInvestissements } from '../../domain/campfire.ts'
import { createCatalog } from '../../domain/catalog.ts'
import { cryptoRng, nouvelIdentifiant } from '../../domain/random.ts'
import type { Campfire, Character, EntreeCatalogue, EtatTable, PhaseCampfire, Session, TypeCamp } from '../../domain/types.ts'
import { store } from '../../store/index.ts'
import { chemins } from './chemins.ts'
import { enregistrerPersonnage, journaliser } from './table.ts'

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

/** Ce qu'un investissement a rapporté ou coûté à une joueuse, à l'ouverture. */
export interface LigneOuverture {
  char: Character
  bilan: BilanInvestissements
}

/** Numéro qu'aurait la prochaine session — pour l'annoncer avant de lancer. */
export async function prochainNumeroDeSession(): Promise<number> {
  const anterieures = await store.getCollection<Session>(chemins.sessions)
  return anterieures.reduce((max, s) => Math.max(max, s.numero), 0) + 1
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
 * Prépare un brouillon.
 *
 * Propose un camp **initial** tant qu'aucune session n'est ouverte, un repos
 * court ensuite. Ce n'est qu'une proposition : la MJ choisit la nature du camp
 * sur son écran, et c'est ce choix qui décide si une session s'ouvre.
 */
export async function creerBrouillon(sessionEnCours: Session | null): Promise<Campfire> {
  const numero = sessionEnCours?.numero ?? (await prochainNumeroDeSession())
  return nouveauBrouillon(numero, sessionEnCours ? 'repos-court' : 'initial')
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

export interface ResultatLancement {
  campfire: Campfire
  /** Renseigné pour un camp initial : ce que les investissements ont rendu. */
  session: Session | null
  ouverture: LigneOuverture[]
}

/**
 * Publie le brouillon : le camp devient visible et la table y bascule.
 *
 * **Un camp initial ouvre la session dans le même geste** — nouveau numéro,
 * investissements réglés, Foi remise à 2. Les deux étaient séparées, et rien
 * n'obligeait à les enchaîner : on pouvait lancer deux camps initiaux de suite
 * sans changer de session, et les joueuses restaient bloquées à la Banque avec
 * « vous avez déjà investi cette session ».
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
): Promise<ResultatLancement> {
  const ouvreUneSession = brouillon.type === 'initial'

  const sessionNumero = ouvreUneSession
    ? await prochainNumeroDeSession()
    : brouillon.sessionNumero

  const session: Session | null = ouvreUneSession
    ? { id: nouvelIdentifiant(), numero: sessionNumero, ouverteLe: Date.now() }
    : null

  const campfire: Campfire = { ...brouillon, sessionNumero, lanceLe: Date.now() }
  await store.setDoc(chemins.campfire(campfire.id), campfire)
  if (session) await store.setDoc(chemins.session(session.id), session)

  const catalog = ouvreUneSession
    ? createCatalog(await store.getCollection<EntreeCatalogue>(chemins.catalogue))
    : null

  const ouverture: LigneOuverture[] = []
  for (const char of personnages) {
    let fiche = char

    // Les investissements rendent leurs comptes avant que le camp ne soit
    // résolu, pour que tout parte en une seule écriture par fiche.
    if (catalog) {
      const bilan = resoudreInvestissements(fiche, catalog, sessionNumero, cryptoRng)
      if (bilan.lignes.length > 0) ouverture.push({ char, bilan })
      fiche = { ...fiche, lumens: Math.max(0, fiche.lumens + bilan.total) }
    }

    const { char: resolu, effets } = resoudreCampPourPersonnage(fiche, campfire.type)
    await enregistrerPersonnage(resolu)
    if (effets.length > 0) {
      await journaliser('MJ', 'camp', `${char.nom} — ${effets.join(' · ')}`)
    }
  }

  await store.setDoc(chemins.etat, {
    ...etat,
    mode: 'campfire',
    campfireId: campfire.id,
    ...(session ? { sessionId: session.id } : {}),
  })
  await abandonnerBrouillon()

  await journaliser('MJ', 'camp', `Feu de camp — ${PROFILS_CAMP[campfire.type].libelle}.`)
  if (session) await journaliser('MJ', 'session', `Ouverture de la session ${sessionNumero}.`)
  for (const { char, bilan } of ouverture) {
    for (const ligne of bilan.lignes) {
      await journaliser('MJ', 'investissement', `${char.nom} — ${ligne.nom} : ${ligne.recit}`)
    }
  }

  return { campfire, session, ouverture }
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
