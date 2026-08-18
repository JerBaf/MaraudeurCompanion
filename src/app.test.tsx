// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Tests de rendu.
 *
 * Les règles du jeu sont couvertes par `src/domain/rules.test.ts` ; ici on
 * vérifie seulement que les écrans se montent sans exploser et que
 * l'aiguillage par rôle fonctionne. C'est ce que les tests du domaine ne
 * peuvent pas attraper.
 *
 * `store/index.ts` fige le rôle au chargement du module : on réinitialise donc
 * le registre de modules entre deux montages pour pouvoir changer de rôle.
 */

async function monter() {
  vi.resetModules()
  const { App } = await import('./App.tsx')
  return render(<App />)
}

/** Les clés d'un Storage se lisent par `key(i)`, pas par `Object.keys()`. */
function clesStockage(): string[] {
  return Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i)).filter(
    (k): k is string => k !== null,
  )
}

describe('aiguillage de l’application', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(cleanup)

  it('demande le code de table quand personne n’est connecté', async () => {
    await monter()
    expect(screen.getByRole('heading', { name: 'Maraudeur' })).toBeTruthy()
    expect(screen.getByText('Code de table')).toBeTruthy()
  })

  it('ouvre l’écran MJ et amorce le catalogue', async () => {
    localStorage.setItem('maraudeur:role', 'mj')
    await monter()

    expect(screen.getByText('Écran MJ')).toBeTruthy()

    // L'amorçage écrit les 3 classes livrées avec l'app.
    await waitFor(() => {
      const entrees = clesStockage().filter((k) =>
        k.startsWith('maraudeur:tables/entre-monde/catalog/'),
      )
      expect(entrees.length).toBeGreaterThan(0)
    })
  })

  it('propose de créer un personnage à une joueuse une fois la table amorcée', async () => {
    // La MJ passe d'abord pour installer le contenu…
    localStorage.setItem('maraudeur:role', 'mj')
    await monter()
    await waitFor(() =>
      expect(clesStockage().some((k) => k.includes('catalog/dusk-hunter'))).toBe(true),
    )
    cleanup()

    // … puis la joueuse arrive sur le roster.
    localStorage.setItem('maraudeur:role', 'joueuse')
    await monter()

    await waitFor(() => expect(screen.getByText('Créer un personnage')).toBeTruthy())
    expect(screen.getByRole('heading', { name: 'Qui êtes-vous ce soir ?' })).toBeTruthy()
  })

  it('prévient la joueuse quand la table n’est pas encore initialisée', async () => {
    localStorage.setItem('maraudeur:role', 'joueuse')
    await monter()

    await waitFor(() =>
      expect(screen.getByText(/table n'est pas encore initialisée/i)).toBeTruthy(),
    )
  })
})

describe('parcours de création', () => {
  beforeEach(() => localStorage.clear())
  afterEach(cleanup)

  /** Installe le catalogue en passant une première fois par l'écran MJ. */
  async function amorcerLaTable() {
    localStorage.setItem('maraudeur:role', 'mj')
    await monter()
    await waitFor(() =>
      expect(clesStockage().some((k) => k.includes('catalog/dusk-hunter'))).toBe(true),
    )
    cleanup()
  }

  it('crée un Dusk Hunter et ouvre sa fiche avec les bonnes valeurs', async () => {
    await amorcerLaTable()

    localStorage.setItem('maraudeur:role', 'joueuse')
    await monter()

    fireEvent.click(await screen.findByText('Créer un personnage'))

    fireEvent.change(screen.getByPlaceholderText('Maya'), { target: { value: 'Ilma' } })
    fireEvent.click(await screen.findByText('Dusk Hunter'))

    // Deux points forts, puis un point faible.
    fireEvent.click(screen.getByRole('button', { name: 'Physique en point fort' }))
    fireEvent.click(screen.getByRole('button', { name: 'Roublardise en point fort' }))
    fireEvent.click(screen.getByRole('button', { name: 'Esprit en point faible' }))

    fireEvent.click(screen.getByText('Entrer dans l’Entre-Monde'))

    // La fiche s'ouvre sur le personnage fraîchement créé.
    await waitFor(() => expect(screen.getByText('Ilma')).toBeTruthy())

    // Le Dusk Hunter a 5 Points de Fatigue, et la classe accorde 4 sorts
    // dont seuls 3 tiennent dans le Grimoire.
    expect(screen.getByText('0 / 5')).toBeTruthy()
    expect(screen.getByText('5 restant(s)')).toBeTruthy()

    // Les Points de Foi démarrent à 2, l'Évasion de base vaut 1.
    expect(screen.getByText('2 / 9')).toBeTruthy()
    expect(screen.getByText(/Évasion 1/)).toBeTruthy()

    // Le Grimoire ne retient que les 3 premiers sorts de la classe ; le
    // quatrième reste en réserve dans le sac à dos.
    fireEvent.click(screen.getByRole('tab', { name: 'Sorts' }))
    await waitFor(() => expect(screen.getByText('Burst')).toBeTruthy())
    expect(screen.getByText('Heat track')).toBeTruthy()
    expect(screen.getByText('First Aid')).toBeTruthy()
    expect(screen.queryByText('Prey Impulse')).toBeNull()

    fireEvent.click(screen.getByRole('tab', { name: 'Sac à dos' }))
    await waitFor(() => expect(screen.getByText('Prey Impulse')).toBeTruthy())
  })
})
