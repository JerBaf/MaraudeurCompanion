/**
 * Le dépôt — **le seul écrivain** de la table.
 *
 * Tout ce qui touche la base passe par ici, et par nulle part ailleurs : c'est
 * cette règle qui permet à `modifierPersonnage` d'être le point unique où les
 * passifs réactifs se résolvent, et aux chemins 🔒 de rester au même endroit
 * que les règles Firestore qui les protègent.
 *
 * Le fichier portait ses quinze sections d'un seul tenant. Elles vivent
 * maintenant dans `data/repo/`, une par sujet, et ce module les rassemble :
 * aucun des écrans qui importent `data/repo.ts` n'a eu à changer de ligne.
 *
 * Les modules s'empilent dans cet ordre, sans jamais remonter :
 *
 *   chemins        les chemins de documents. Ne dépend de rien.
 *   table          amorçage, abonnements, journal, personnages, Détachement.
 *                  Porte les deux caches — roster et catalogue — que
 *                  `modifierPersonnage` lit pour armer les passifs croisés.
 *   catalogue      les entrées, et l'export JSON
 *   combat         bestiaire, adversaires, horloge de combat
 *   campfire       sessions et Feu de Camp
 *   duel           le Combat rapide
 *   notifications  ce que la MJ pousse sur un écran
 *   quetes         acceptées, refusées, validées
 */

export * from './repo/chemins.ts'
export * from './repo/table.ts'
export * from './repo/catalogue.ts'
export * from './repo/combat.ts'
export * from './repo/campfire.ts'
export * from './repo/duel.ts'
export * from './repo/notifications.ts'
export * from './repo/quetes.ts'
