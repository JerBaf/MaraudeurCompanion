import { actionScriptee, etatDuel, issueDuel, jouerManche } from '../../domain/duel.ts'
import { nouvelIdentifiant } from '../../domain/random.ts'
import type { ActionDuel, Duel, DuelPrive, EtatTable } from '../../domain/types.ts'
import { store } from '../../store/index.ts'
import { chemins } from './chemins.ts'
import { journaliser } from './table.ts'

// ---------------------------------------------------------------------------
// Combat rapide — le duel « Flow »
// ---------------------------------------------------------------------------

export const surDuel = (id: string, cb: (d: Duel | null) => void) =>
  store.subscribeDoc<Duel>(chemins.duel(id), cb)

/** 🔒 Réservé à la MJ par les règles Firestore : contient le motif du PNJ. */
export const surDuelPrive = (cb: (d: DuelPrive | null) => void) =>
  store.subscribeDoc<DuelPrive>(chemins.duelPrive, cb)

/** Durée de réflexion par défaut. Le doc de playtest demande 10 à 15 secondes. */
export const DUREE_CHOIX_MS = 12_000

export function nouveauDuelPrive(characterId: string): DuelPrive {
  return {
    duelId: null,
    characterId,
    adversaireNom: '',
    adversaireIcone: 'spectre',
    enjeu: '',
    dureeChoixMs: DUREE_CHOIX_MS,
    // La Garde est le repli conservateur : ne rien décider, c'est se couvrir.
    actionParDefaut: 'garde',
    motif: [],
    override: null,
  }
}

/** 🔒 Écrit dans la collection réservée à la MJ : le motif ne fuite jamais. */
export async function enregistrerDuelPrive(prive: DuelPrive): Promise<void> {
  await store.setDoc(chemins.duelPrive, prive)
}

export async function abandonnerDuelPrive(): Promise<void> {
  await store.deleteDoc(chemins.duelPrive)
}

/**
 * Publie la moitié publique du duel et bascule la table en mode Duel.
 *
 * Le geste est celui de `lancerCampfire` : ce que les joueuses ont le droit de
 * voir part dans la collection publique, le reste — ici le motif du PNJ — ne
 * bouge pas de `secrets/`.
 */
export async function lancerDuel(etat: EtatTable, prive: DuelPrive): Promise<Duel> {
  const duel: Duel = {
    id: nouvelIdentifiant(),
    characterId: prive.characterId,
    adversaireNom: prive.adversaireNom,
    adversaireIcone: prive.adversaireIcone,
    enjeu: prive.enjeu,
    dureeChoixMs: prive.dureeChoixMs,
    actionParDefaut: prive.actionParDefaut,
    historique: [],
    debutManche: null,
    choixJoueuse: null,
    issue: null,
    lanceLe: Date.now(),
  }

  await store.setDoc(chemins.duel(duel.id), duel)
  await store.setDoc(chemins.duelPrive, { ...prive, duelId: duel.id, override: null })
  await store.setDoc(chemins.etat, { ...etat, mode: 'duel', duelId: duel.id })
  await journaliser(
    'MJ',
    'duel',
    `Combat rapide contre ${duel.adversaireNom} — motif ${prive.motif.join(' · ')}.`,
  )

  return duel
}

/** Ouvre une manche : c'est ce geste qui lance le chrono sur l'écran de la duelliste. */
export async function ouvrirManche(duel: Duel): Promise<void> {
  await store.setDoc(chemins.duel(duel.id), {
    ...duel,
    debutManche: Date.now(),
    choixJoueuse: null,
  })
}

/**
 * Verrouille le choix de la duelliste.
 *
 * ⚠️ Seul appel écrit depuis l'écran d'une joueuse, et il ne touche qu'un champ :
 * les règles Firestore n'autorisent que `choixJoueuse` (voir
 * `firebase/firestore.rules`). Tout le reste lui est refusé.
 */
export async function choisirActionDuel(duel: Duel, action: ActionDuel): Promise<void> {
  await store.updateDoc(chemins.duel(duel.id), { choixJoueuse: action })
}

/**
 * Révèle la manche et l'inscrit dans l'historique.
 *
 * 🔒 Ne s'exécute que sur l'écran MJ : c'est le seul qui a le droit de lire le
 * motif du PNJ. L'action jouée par la créature est journalisée — le journal est
 * lui aussi réservé à la MJ, donc rien ne fuite.
 */
export async function revelerManche(
  duel: Duel,
  prive: DuelPrive,
  choixJoueuse: ActionDuel,
): Promise<void> {
  const etat = etatDuel(duel.historique)
  const actionAdversaire = prive.override ?? actionScriptee(prive.motif, etat.manche)
  const manche = jouerManche(etat, choixJoueuse, actionAdversaire)
  const historique = [...duel.historique, manche]

  await store.setDoc(chemins.duel(duel.id), {
    ...duel,
    historique,
    choixJoueuse: null,
    debutManche: null,
    issue: issueDuel(historique),
  })

  // L'override ne vaut que pour une manche : on le consomme au moment où il sert.
  if (prive.override) await store.setDoc(chemins.duelPrive, { ...prive, override: null })

  await journaliser(
    'MJ',
    'duel',
    `Manche ${etat.manche} — ${manche.actionJoueuse} contre ${manche.actionAdversaire} : ` +
      (manche.issue === 'clash' ? 'Clash.' : `${manche.issue} marque ${manche.points}.`),
  )
}

/** Termine le duel : la table repart en Standard et le motif disparaît. */
export async function terminerDuel(etat: EtatTable, duel: Duel | null): Promise<void> {
  await store.setDoc(chemins.etat, { ...etat, mode: 'standard', duelId: null })
  await abandonnerDuelPrive()
  if (duel) await journaliser('MJ', 'duel', `Fin du combat rapide contre ${duel.adversaireNom}.`)
}
