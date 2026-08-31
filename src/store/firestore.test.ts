import { describe, expect, it } from 'vitest'

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
