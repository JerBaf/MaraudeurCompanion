import type { Catalog } from '../../domain/catalog.ts'
import { type KindNotification, type Notification, contenuVierge, libelleOption, libelleType, repondre } from '../../domain/notifications.ts'
import { nouvelIdentifiant } from '../../domain/random.ts'
import type { Character } from '../../domain/types.ts'
import { store } from '../../store/index.ts'
import { chemins } from './chemins.ts'
import { journaliser, modifierPersonnage } from './table.ts'

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

export const surNotifications = (cb: (n: Notification[]) => void) =>
  store.subscribeCollection<Notification>(chemins.notifications, cb)

export function nouvelleNotification(kind: KindNotification): Notification {
  return {
    id: nouvelIdentifiant(),
    cibles: [],
    texte: '',
    contenu: contenuVierge(kind),
    reponses: {},
    envoyeeLe: 0,
  }
}

export async function envoyerNotification(
  notif: Notification,
  personnages: Character[],
): Promise<void> {
  const envoyee: Notification = { ...notif, reponses: {}, envoyeeLe: Date.now() }
  await store.setDoc(chemins.notification(envoyee.id), envoyee)

  const noms = envoyee.cibles
    .map((id) => personnages.find((c) => c.id === id)?.nom ?? id)
    .join(', ')
  // Le texte est facultatif pour une Illustration : pas de « : » orphelin.
  await journaliser(
    'MJ',
    'notification',
    `${libelleType(envoyee)} → ${noms}` + (envoyee.texte ? ` : ${envoyee.texte}` : ''),
  )
}

/**
 * Verrouille la réponse d'une joueuse.
 *
 * On **paie d'abord** : si le coût est impayable, `repondre` lève et rien n'est
 * enregistré. Le paiement passe par `modifierPersonnage` pour que les passifs
 * réactifs s'arment, exactement comme un lancement de sort.
 *
 * ⚠️ Les deux écritures ne sont pas transactionnelles — c'est la faiblesse déjà
 * connue du dépôt. L'écran garde un verrou local pour ne pas envoyer deux fois.
 */
export async function repondreNotification(
  char: Character,
  catalog: Catalog,
  notif: Notification,
  optionId: string,
  branche = 0,
): Promise<string[]> {
  let recits: string[] = []
  await modifierPersonnage(char, (c) => {
    const r = repondre(c, catalog, notif, optionId, branche)
    recits = r.recits
    return r.char
  })

  // Un seul champ touché : c'est tout ce que les règles Firestore autorisent à
  // une joueuse sur ce document (même geste que `definirInitiative`).
  await store.updateDoc(chemins.notification(notif.id), {
    reponses: { ...notif.reponses, [char.id]: { optionId, repondueLe: Date.now() } },
  })

  await journaliser(
    char.nom,
    'notification',
    `${libelleType(notif)} — ${libelleOption(notif, optionId)}` +
      (recits.length ? ` (${recits.join(' · ')})` : ''),
  )

  return recits
}

/** Range une notification : le journal en garde la trace, la collection reste courte. */
export async function rangerNotification(id: string): Promise<void> {
  await store.deleteDoc(chemins.notification(id))
}
