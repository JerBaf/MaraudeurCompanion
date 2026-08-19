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
    sessionStorage.clear()
  })

  afterEach(cleanup)

  it('demande le code de table quand personne n’est connecté', async () => {
    await monter()
    expect(screen.getByRole('heading', { name: 'Maraudeur' })).toBeTruthy()
    expect(screen.getByText('Code de table')).toBeTruthy()
  })

  /**
   * Régression : l'app s'abonnait à Firestore dès son chargement, avant toute
   * connexion. Les règles refusaient — à juste titre — et l'écran affichait une
   * volée de « permission-denied » à quelqu'un qui n'avait pas encore eu
   * l'occasion de saisir un identifiant.
   */
  it('n’ouvre aucun abonnement tant que personne n’est connecté', async () => {
    vi.resetModules()
    const { store } = await import('./store/index.ts')
    const surCollection = vi.spyOn(store, 'subscribeCollection')
    const surDocument = vi.spyOn(store, 'subscribeDoc')

    const { App } = await import('./App.tsx')
    render(<App />)

    expect(screen.getByText('Code de table')).toBeTruthy()
    expect(surCollection).not.toHaveBeenCalled()
    expect(surDocument).not.toHaveBeenCalled()

    surCollection.mockRestore()
    surDocument.mockRestore()
  })

  it('ouvre les abonnements une fois le rôle connu', async () => {
    // Le rôle doit être posé AVANT d'importer le store : `createLocalAuth` lit
    // sessionStorage au chargement du module, une seule fois.
    sessionStorage.setItem('maraudeur:role', 'joueuse')

    vi.resetModules()
    const { store } = await import('./store/index.ts')
    const surCollection = vi.spyOn(store, 'subscribeCollection')

    const { App } = await import('./App.tsx')
    render(<App />)

    await waitFor(() => expect(surCollection).toHaveBeenCalled())
    surCollection.mockRestore()
  })

  it('ouvre l’écran MJ et amorce le catalogue', async () => {
    sessionStorage.setItem('maraudeur:role', 'mj')
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
    sessionStorage.setItem('maraudeur:role', 'mj')
    await monter()
    await waitFor(() =>
      expect(clesStockage().some((k) => k.includes('catalog/dusk-hunter'))).toBe(true),
    )
    cleanup()

    // … puis la joueuse arrive sur le roster.
    sessionStorage.setItem('maraudeur:role', 'joueuse')
    await monter()

    await waitFor(() => expect(screen.getByText('Créer un personnage')).toBeTruthy())
    expect(screen.getByRole('heading', { name: 'Qui êtes-vous ce soir ?' })).toBeTruthy()
  })

  it('prévient la joueuse quand la table n’est pas encore initialisée', async () => {
    sessionStorage.setItem('maraudeur:role', 'joueuse')
    await monter()

    await waitFor(() =>
      expect(screen.getByText(/table n'est pas encore initialisée/i)).toBeTruthy(),
    )
  })
})

describe('mode Combat', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
  })
  afterEach(cleanup)

  /** Amorce la table et y crée un personnage, puis rend la main. */
  async function tablePreteAvecPersonnage() {
    sessionStorage.setItem('maraudeur:role', 'mj')
    await monter()
    await waitFor(() =>
      expect(clesStockage().some((k) => k.includes('catalog/dusk-hunter'))).toBe(true),
    )
    cleanup()

    sessionStorage.setItem('maraudeur:role', 'joueuse')
    await monter()
    fireEvent.click(await screen.findByText('Créer un personnage'))
    fireEvent.change(screen.getByPlaceholderText('Maya'), { target: { value: 'Ilma' } })
    fireEvent.click(await screen.findByText('Dusk Hunter'))
    fireEvent.click(screen.getByRole('button', { name: 'Physique en point fort' }))
    fireEvent.click(screen.getByRole('button', { name: 'Roublardise en point fort' }))
    fireEvent.click(screen.getByRole('button', { name: 'Esprit en point faible' }))
    fireEvent.click(screen.getByText('Entrer dans l’Entre-Monde'))
    await waitFor(() => expect(screen.getByText('Ilma')).toBeTruthy())
    cleanup()
  }

  it('n’affiche l’onglet Combat côté MJ qu’une fois le combat lancé', async () => {
    await tablePreteAvecPersonnage()

    sessionStorage.setItem('maraudeur:role', 'mj')
    await monter()

    // Hors combat, l'onglet n'encombre pas la barre.
    expect(screen.queryByRole('tab', { name: 'Combat' })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Combat' }))
    await waitFor(() => expect(screen.getByRole('tab', { name: 'Combat' })).toBeTruthy())

    fireEvent.click(screen.getByRole('tab', { name: 'Combat' }))
    await waitFor(() => expect(screen.getByText('Démarrer un combat')).toBeTruthy())
  })

  it('dépose un adversaire visible de la joueuse, sans lui livrer le seuil', async () => {
    await tablePreteAvecPersonnage()

    // --- La MJ démarre le combat et crée une Carcasse à la volée ---
    sessionStorage.setItem('maraudeur:role', 'mj')
    await monter()
    fireEvent.click(screen.getByRole('button', { name: 'Combat' }))
    fireEvent.click(await screen.findByRole('tab', { name: 'Combat' }))
    fireEvent.click(await screen.findByText('Démarrer un combat'))

    fireEvent.change(await screen.findByPlaceholderText('Carcasse'), {
      target: { value: 'Carcasse' },
    })
    const champs = screen.getAllByRole('spinbutton')
    fireEvent.change(champs[0] as HTMLElement, { target: { value: '1' } })
    fireEvent.change(champs[1] as HTMLElement, { target: { value: '6' } })
    fireEvent.click(screen.getByText('Ajouter au combat'))

    await waitFor(() => expect(screen.getByText(/dégâts 0 \/ 6/)).toBeTruthy())
    cleanup()

    // --- La joueuse ne voit rien tant qu'elle n'a pas déposé son initiative ---
    sessionStorage.setItem('maraudeur:role', 'joueuse')
    await monter()
    fireEvent.click(await screen.findByRole('tab', { name: 'Combat' }))

    await waitFor(() => expect(screen.getByText('Votre initiative')).toBeTruthy())
    expect(screen.queryByText('Carcasse')).toBeNull()
    expect(screen.queryByText('Résoudre')).toBeNull()
    expect(screen.queryByText('G pas touchão')).toBeNull()

    // --- Une fois l'initiative posée, la créature apparaît ---
    fireEvent.click(screen.getByRole('button', { name: '5' }))
    await waitFor(() => expect(screen.getByText('Carcasse')).toBeTruthy())

    // L'Évasion reste masquée tant que la MJ ne l'a pas rendue publique,
    // et le seuil de Fatigue ne quitte jamais l'écran de la MJ.
    expect(screen.getByText(/Évasion \? · 0 dégât/)).toBeTruthy()
    expect(document.body.textContent).not.toContain('/ 6')

    // Le document public de l'adversaire ne contient pas le seuil.
    const docAdversaire = clesStockage().find((k) => k.includes('/adversaries/'))
    expect(docAdversaire).toBeDefined()
    expect(localStorage.getItem(docAdversaire as string)).not.toContain('fatigueMax')
  })

  /**
   * Demande explicite de la MJ : une joueuse dont ce n'est pas le sous-groupe
   * ne doit pas avoir l'impression de pouvoir agir. Elle consulte les
   * adversaires, rien de plus.
   */
  it('n’offre aucune saisie à une joueuse dont ce n’est pas le tour', async () => {
    await tablePreteAvecPersonnage()

    sessionStorage.setItem('maraudeur:role', 'mj')
    await monter()
    fireEvent.click(screen.getByRole('button', { name: 'Combat' }))
    fireEvent.click(await screen.findByRole('tab', { name: 'Combat' }))
    fireEvent.click(await screen.findByText('Démarrer un combat'))
    cleanup()

    sessionStorage.setItem('maraudeur:role', 'joueuse')
    await monter()
    fireEvent.click(await screen.findByRole('tab', { name: 'Combat' }))

    // Un 1 la place « après la MJ », alors que le tour actif est « avant la MJ ».
    fireEvent.click(await screen.findByRole('button', { name: '1' }))

    await waitFor(() => expect(screen.getByText('Patientez.')).toBeTruthy())
    expect(screen.queryByText('Attaquer')).toBeNull()
    expect(screen.queryByText('Résoudre')).toBeNull()
    expect(screen.queryByText('G pas touchão')).toBeNull()
    // Elle garde en revanche la vue sur les adversaires.
    expect(screen.getByText('Adversaires')).toBeTruthy()
  })

  it('laisse la joueuse déposer son initiative et lui dit quand c’est son tour', async () => {
    await tablePreteAvecPersonnage()

    sessionStorage.setItem('maraudeur:role', 'mj')
    await monter()
    fireEvent.click(screen.getByRole('button', { name: 'Combat' }))
    fireEvent.click(await screen.findByRole('tab', { name: 'Combat' }))
    fireEvent.click(await screen.findByText('Démarrer un combat'))
    cleanup()

    sessionStorage.setItem('maraudeur:role', 'joueuse')
    await monter()
    fireEvent.click(await screen.findByRole('tab', { name: 'Combat' }))

    // Un 5 la place « avant la MJ », qui est le sous-groupe actif au premier tour.
    fireEvent.click(await screen.findByRole('button', { name: '5' }))
    await waitFor(() => expect(screen.getByText("C'est à vous de jouer.")).toBeTruthy())
  })
})

describe('parcours de création', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
  })
  afterEach(cleanup)

  /** Installe le catalogue en passant une première fois par l'écran MJ. */
  async function amorcerLaTable() {
    sessionStorage.setItem('maraudeur:role', 'mj')
    await monter()
    await waitFor(() =>
      expect(clesStockage().some((k) => k.includes('catalog/dusk-hunter'))).toBe(true),
    )
    cleanup()
  }

  it('crée un Dusk Hunter et ouvre sa fiche avec les bonnes valeurs', async () => {
    await amorcerLaTable()

    sessionStorage.setItem('maraudeur:role', 'joueuse')
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

    // Les Points de Foi démarrent à 2.
    expect(screen.getByText('2 / 9')).toBeTruthy()

    // L'Évasion a sa vignette dédiée, à 1 sans armure équipée.
    const vignetteEvasion = screen.getByText('Évasion').closest('.vignette')
    expect(vignetteEvasion?.textContent).toContain('1')
    expect(vignetteEvasion?.textContent).toContain('aucun bonus')

    // Actions Rapides : 2 pour un Physique à +2.
    expect(screen.getByText('Actions Rapides')).toBeTruthy()
    expect(screen.getByText('2 / 2')).toBeTruthy()

    // Les Marques plafonnent à 3.
    const marques = screen.getByText('Marques').closest('.compteur')
    expect(marques?.textContent).toContain('/ 3')

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
