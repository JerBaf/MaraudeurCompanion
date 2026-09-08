import { etatCombatInitial, indexMoment, sousGroupeSuivant } from '../../domain/combat.ts'
import { type EvenementExpiration, expireModifiers } from '../../domain/modifiers.ts'
import { nouvelIdentifiant } from '../../domain/random.ts'
import type { Adversaire, Character, EtatTable, ModeleAdversaire, SeuilsAdversaires } from '../../domain/types.ts'
import { store } from '../../store/index.ts'
import { chemins } from './chemins.ts'
import { enregistrerPersonnage, journaliser } from './table.ts'

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
