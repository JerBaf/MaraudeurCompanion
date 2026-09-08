import { useSyncExternalStore } from 'react'

/**
 * Qui lance les dés, sur cet appareil.
 *
 * Une joueuse a ses dés ou ne les a pas, et ça ne change pas trois fois dans la
 * soirée : la préférence vaut donc pour **tous** les jets à la fois. C'est ce
 * qui permet de garder un seul bouton par jet sur un téléphone, au lieu de
 * répéter partout le choix « lancer / saisir ».
 *
 * Elle vit dans le `localStorage` de l'appareil, et **jamais sur la fiche** :
 * ce n'est pas un fait de fiction, deux joueuses partageant un personnage
 * n'auraient pas à partager leurs dés, et `Character` n'a pas de champ de plus
 * à normaliser.
 *
 * Le micro-store reprend le motif de `store/erreurs.ts` : les boutons de jet
 * sont dispersés dans tout l'arbre de la Fiche — compétences, sorts,
 * équipement, combat — et faire descendre la préférence en props traverserait
 * six composants pour une case à cocher.
 */

export type ModeDes = 'app' | 'main'

const CLE = 'maraudeur:des'

const ecouteurs = new Set<() => void>()

/**
 * Relu à chaque rendu plutôt que gardé en mémoire.
 *
 * `useSyncExternalStore` l'autorise — la valeur est une chaîne, donc stable par
 * identité — et ça évite un cache qui survivrait à un `localStorage` vidé.
 */
function lire(): ModeDes {
  return localStorage.getItem(CLE) === 'main' ? 'main' : 'app'
}

export function definirModeDes(nouveau: ModeDes): void {
  if (nouveau === lire()) return
  localStorage.setItem(CLE, nouveau)
  for (const cb of ecouteurs) cb()
}

/** L'app tire, à moins que la joueuse n'ait déclaré lancer ses propres dés. */
export function useModeDes(): ModeDes {
  return useSyncExternalStore((cb) => {
    ecouteurs.add(cb)
    return () => {
      ecouteurs.delete(cb)
    }
  }, lire)
}
