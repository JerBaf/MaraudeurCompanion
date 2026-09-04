import { describe, expect, it } from 'vitest'

import { SEED } from '../content/seed.ts'
import { coutAuChoix, coutDe, fixe, variable } from '../domain/couts.ts'
import { sansUndefined } from './firestore.ts'

/**
 * Régression vécue à table : décocher « Illusion » sur un sort écrivait
 * `illusion: undefined`, que Firestore refuse — le sort restait donc illusion en
 * base et ne pouvait plus quitter le Grimoire.
 */
describe('sansUndefined', () => {
  it('retire les clés valant undefined', () => {
    const purge = sansUndefined({ nom: 'Companion', illusion: undefined, prix: undefined })
    expect(purge).toEqual({ nom: 'Companion' })
    expect('illusion' in purge).toBe(false)
  })

  it('conserve null, qui est une valeur du domaine', () => {
    expect(sansUndefined({ vieActive: null, arme: null })).toEqual({ vieActive: null, arme: null })
  })

  it('descend dans les objets imbriqués et les tableaux', () => {
    expect(
      sansUndefined({
        equipe: { arme: 'dague', armure: undefined },
        modificateurs: [{ bonus: 1, expires: undefined }],
      }),
    ).toEqual({ equipe: { arme: 'dague' }, modificateurs: [{ bonus: 1 }] })
  })

  it('laisse intactes les valeurs simples et les faux positifs', () => {
    expect(sansUndefined({ illusion: false, prix: 0, nom: '' })).toEqual({
      illusion: false,
      prix: 0,
      nom: '',
    })
  })
})

/**
 * ⚠️ **Firestore refuse un tableau dont les éléments sont des tableaux.**
 *
 * Le piège est qu'aucun autre test ne peut l'attraper : sous `SOUS_TEST`,
 * l'application tourne sur le store local, qui sérialise en JSON et accepte
 * n'importe quelle forme. Un `Cout` modélisé en tableau de tableaux passerait
 * donc toute la suite au vert et n'exploserait qu'à la première sauvegarde de
 * la MJ, en production.
 *
 * D'où cette assertion de forme, faute d'émulateur : elle vaut pour tout ce
 * qu'on écrit en base, et c'est le prix des `{ branches: [...] }` et
 * `{ parts: [...] }` qui enveloppent chaque niveau du modèle de coût.
 */
describe('formes acceptées par Firestore', () => {
  function tableauDeTableaux(valeur: unknown, chemin = ''): string | null {
    if (Array.isArray(valeur)) {
      for (const [i, item] of valeur.entries()) {
        if (Array.isArray(item)) return `${chemin}[${i}]`
        const trouve = tableauDeTableaux(item, `${chemin}[${i}]`)
        if (trouve) return trouve
      }
      return null
    }
    if (valeur && typeof valeur === 'object') {
      for (const [cle, v] of Object.entries(valeur)) {
        const trouve = tableauDeTableaux(v, chemin ? `${chemin}.${cle}` : cle)
        if (trouve) return trouve
      }
    }
    return null
  }

  it('repère un tableau de tableaux — le garde-fou lui-même fonctionne', () => {
    expect(tableauDeTableaux({ branches: [[{ valeur: 1 }]] })).toBe('branches[0]')
    expect(tableauDeTableaux({ ok: [{ parts: [{ valeur: 1 }] }] })).toBeNull()
  })

  it('n’en produit aucun sur les coûts, quelle que soit leur forme', () => {
    const couts = [
      coutDe(fixe('foi', 2)),
      coutDe(fixe('foi', 1), variable('foi')),
      coutAuChoix([fixe('foi', 2)], [fixe('lumens', 10)]),
      coutDe(variable('marques', { max: 3 })),
    ]
    for (const cout of couts) {
      expect(tableauDeTableaux(sansUndefined({ cout }))).toBeNull()
    }
  })

  it('n’en produit aucun sur le contenu livré avec l’app', () => {
    for (const entree of SEED) {
      expect(tableauDeTableaux(sansUndefined(entree as unknown as Record<string, unknown>))).toBeNull()
    }
  })
})
