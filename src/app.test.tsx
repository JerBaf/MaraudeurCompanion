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

describe('outillage de table', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
  })
  afterEach(cleanup)

  /** Amorce la table et y crée un personnage de la classe demandée. */
  async function tablePreteAvecPersonnage(classe = 'Dusk Hunter') {
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
    fireEvent.click(await screen.findByText(classe))
    fireEvent.click(screen.getByRole('button', { name: 'Physique en point fort' }))
    fireEvent.click(screen.getByRole('button', { name: 'Roublardise en point fort' }))
    fireEvent.click(screen.getByRole('button', { name: 'Esprit en point faible' }))
    fireEvent.click(screen.getByText('Entrer dans l’Entre-Monde'))
    await waitFor(() => expect(screen.getByText('Ilma')).toBeTruthy())
    cleanup()
  }

  /**
   * Le cristal ne s'épuise que sur un sort d'Arcane préparé : c'est le seul qui
   * puisse être lancé, et la joueuse tire son d6 à table — l'app ne fait
   * qu'enregistrer le résultat.
   */
  it('la joueuse marque un cristal d’Arcane épuisé', async () => {
    await tablePreteAvecPersonnage('Trickster')

    sessionStorage.setItem('maraudeur:role', 'joueuse')
    await monter()
    fireEvent.click(await screen.findByRole('tab', { name: 'Sorts' }))
    await waitFor(() => expect(screen.getByText('Polymorph')).toBeTruthy())

    const cases = screen.getAllByRole('checkbox')
    expect(cases.length).toBeGreaterThan(0)
    fireEvent.click(cases[0] as HTMLElement)
    await waitFor(() => expect((cases[0] as HTMLInputElement).checked).toBe(true))
  })

  it('n’offre pas d’épuiser un cristal aux magies qui n’en ont pas', async () => {
    await tablePreteAvecPersonnage()

    sessionStorage.setItem('maraudeur:role', 'joueuse')
    await monter()
    fireEvent.click(await screen.findByRole('tab', { name: 'Sorts' }))

    // Le Dusk Hunter ne prépare que du Sang et du Miracle.
    await waitFor(() => expect(screen.getByText('Burst')).toBeTruthy())
    expect(screen.queryByText(/Cristal épuisé/)).toBeNull()
  })

  it('la MJ accorde un sort, la joueuse le voit arriver', async () => {
    await tablePreteAvecPersonnage()

    sessionStorage.setItem('maraudeur:role', 'mj')
    await monter()
    fireEvent.click(await screen.findByText('Ilma'))

    // « Polymorph » appartient au Trickster : la MJ peut l'accorder malgré tout.
    const accorder = await screen.findByLabelText('Accorder un sort')
    fireEvent.change(accorder, { target: { value: 'polymorph' } })
    cleanup()

    sessionStorage.setItem('maraudeur:role', 'joueuse')
    await monter()
    fireEvent.click(await screen.findByRole('tab', { name: 'Sorts' }))
    await waitFor(() => expect(screen.getByText('Polymorph')).toBeTruthy())
    // Accordé hors boutique, il rejoint le répertoire sans être préparé.
    expect(screen.getByText('Sorts connus')).toBeTruthy()
  })

  it('la MJ pose un désavantage qui se cumule avec un ajustement chiffré', async () => {
    await tablePreteAvecPersonnage()

    sessionStorage.setItem('maraudeur:role', 'mj')
    await monter()
    fireEvent.click(await screen.findByText('Ilma'))

    // Le d4 tourne : neutre → avantage → désavantage.
    const d4Physique = await screen.findByLabelText(/^Physique : /)
    fireEvent.click(d4Physique)
    await waitFor(() => expect(screen.getByLabelText('Physique : avantage')).toBeTruthy())
    fireEvent.click(screen.getByLabelText('Physique : avantage'))
    await waitFor(() => expect(screen.getByLabelText('Physique : desavantage')).toBeTruthy())
    cleanup()

    sessionStorage.setItem('maraudeur:role', 'joueuse')
    await monter()
    await waitFor(() => expect(screen.getByText('−d4')).toBeTruthy())
  })
})

describe('Feu de Camp', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
  })
  afterEach(cleanup)

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

  /** Prépare un camp, sans le lancer. Le premier est proposé « initial ». */
  async function prepareUnCamp() {
    sessionStorage.setItem('maraudeur:role', 'mj')
    await monter()
    fireEvent.click(await screen.findByRole('tab', { name: 'Feu de camp' }))
    fireEvent.click(await screen.findByText('Préparer un feu de camp'))
    await waitFor(() => expect(screen.getByText('non lancé')).toBeTruthy())
  }

  /** Le libellé du bouton de lancement dépend de la nature du camp. */
  function lancer() {
    fireEvent.click(screen.getByRole('button', { name: /^Lancer / }))
  }

  /** Le brief n'est persisté qu'à la perte du focus, pas à chaque frappe. */
  function ecrireBrief(texte: string) {
    const champ = screen.getByPlaceholderText(/teaser de la session/i)
    fireEvent.change(champ, { target: { value: texte } })
    fireEvent.blur(champ)
  }

  it('garde la préparation hors de portée des joueuses', async () => {
    await tablePreteAvecPersonnage()
    await prepareUnCamp()

    ecrireBrief('Une infiltration au Bone-Fire.')

    // Le brouillon vit dans la collection réservée à la MJ…
    await waitFor(() =>
      expect(clesStockage().some((k) => k.includes('secrets/campfire-brouillon'))).toBe(true),
    )
    // …et aucun camp public n'existe encore.
    expect(clesStockage().some((k) => k.includes('/campfires/'))).toBe(false)
    cleanup()

    sessionStorage.setItem('maraudeur:role', 'joueuse')
    await monter()
    await waitFor(() => expect(screen.getByText('Ilma')).toBeTruthy())

    // Ni onglet, ni brief : la joueuse ne sait rien.
    expect(screen.queryByRole('tab', { name: 'Feu de camp' })).toBeNull()
    expect(document.body.textContent).not.toContain('infiltration')
  })

  it('rend un seul Point de Fatigue au camp initial et ouvre l’onglet côté joueuse', async () => {
    await tablePreteAvecPersonnage()

    // La joueuse encaisse deux Points de Fatigue.
    sessionStorage.setItem('maraudeur:role', 'joueuse')
    await monter()
    await waitFor(() => expect(screen.getByText('Points de Fatigue')).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: 'Points de Fatigue : 2' }))
    await waitFor(() => expect(screen.getByText('3 restant(s)')).toBeTruthy())
    cleanup()

    await prepareUnCamp()
    lancer()
    await waitFor(() => expect(screen.getByText('Terminer le feu de camp')).toBeTruthy())
    cleanup()

    sessionStorage.setItem('maraudeur:role', 'joueuse')
    await monter()

    // L'onglet s'ouvre de lui-même, et une seule case est rendue : 3 → 4.
    await waitFor(() => expect(screen.getByRole('tab', { name: 'Feu de camp' })).toBeTruthy())
    fireEvent.click(screen.getByRole('tab', { name: 'Fiche' }))
    await waitFor(() => expect(screen.getByText('4 restant(s)')).toBeTruthy())
  })

  it('n’ouvre au repos court que trois phases, et pas le Brief', async () => {
    await tablePreteAvecPersonnage()
    await prepareUnCamp()

    fireEvent.click(screen.getByRole('button', { name: 'Repos court' }))

    // Le Brief et la Banque disparaissent de la préparation…
    await waitFor(() => expect(screen.queryByPlaceholderText(/teaser de la session/i)).toBeNull())

    lancer()
    await waitFor(() => expect(screen.getByText('Terminer le feu de camp')).toBeTruthy())

    // …comme des onglets de phase que la MJ peut piloter.
    const onglets = screen.getAllByRole('group', { name: 'Phase du feu de camp' })[0]
    expect(onglets?.textContent).toBe('BoutiqueGrimoireArmurerie')
  })

  it('suit la phase pilotée par la MJ', async () => {
    await tablePreteAvecPersonnage()
    await prepareUnCamp()
    ecrireBrief('Une infiltration au Bone-Fire.')
    lancer()
    await waitFor(() => expect(screen.getByText('Terminer le feu de camp')).toBeTruthy())

    fireEvent.click(screen.getByRole('button', { name: 'Brief de Mission' }))
    cleanup()

    sessionStorage.setItem('maraudeur:role', 'joueuse')
    await monter()
    await waitFor(() => expect(screen.getByText(/infiltration au Bone-Fire/)).toBeTruthy())
    // Elle ne peut pas acheter pendant le brief.
    expect(screen.queryByText('Boutique')).toBeNull()
  })

  /**
   * La régression qui rendait le lot injouable en production : l'achat était
   * écrit d'abord, puis le jeton — rangé dans le document de session, que les
   * règles refusent aux joueuses. L'objet partait, la limite non, et l'écran
   * affichait « Achat impossible ». Le jeton vit désormais sur la fiche et part
   * dans la même écriture.
   */
  it('débite l’achat et pose la limite en une seule écriture', async () => {
    await tablePreteAvecPersonnage()

    // La MJ crédite la joueuse pour qu'elle puisse acheter.
    sessionStorage.setItem('maraudeur:role', 'mj')
    await monter()
    fireEvent.click(await screen.findByText('Ilma'))
    const lumens = await screen.findByLabelText('Lumens')
    fireEvent.change(lumens, { target: { value: '100' } })

    fireEvent.click(screen.getByRole('tab', { name: 'Feu de camp' }))
    fireEvent.click(await screen.findByText('Préparer un feu de camp'))
    await waitFor(() => expect(screen.getByText('non lancé')).toBeTruthy())
    fireEvent.click(screen.getByText('Tirer les offres'))
    lancer()
    await waitFor(() => expect(screen.getByText('Terminer le feu de camp')).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: 'Boutique' }))
    cleanup()

    sessionStorage.setItem('maraudeur:role', 'joueuse')
    await monter()
    const offres = await screen.findAllByRole('button', { name: /^Acquérir — / })
    fireEvent.click(offres[0] as HTMLElement)

    // L'objet est acquis, et la limite du camp est bien posée.
    await waitFor(() => expect(screen.getByText(/est à vous/)).toBeTruthy())
    expect(screen.queryByText('Achat impossible')).toBeNull()
    await waitFor(() =>
      expect(screen.getByText(/déjà fait votre acquisition à ce feu de camp/)).toBeTruthy(),
    )
    // Plus aucune offre n'est achetable à ce camp.
    expect(screen.queryAllByRole('button', { name: /^Acquérir — / })).toHaveLength(0)
  })

  /**
   * Le blocage rencontré à table : deux camps initiaux d'affilée ne changeaient
   * pas de session, et la Banque répondait « vous avez déjà investi cette
   * session ». Lancer un camp initial ouvre désormais la session.
   */
  it('ouvre une nouvelle session à chaque camp initial', async () => {
    await tablePreteAvecPersonnage()

    await prepareUnCamp()
    expect(screen.getByRole('button', { name: /ouvrir la session 1$/i })).toBeTruthy()
    lancer()
    await waitFor(() => expect(screen.getByText(/session 1 ·/)).toBeTruthy())

    // Fermer le camp passe par une confirmation, absente de jsdom.
    const confirmer = vi.spyOn(window, 'confirm').mockReturnValue(true)
    fireEvent.click(screen.getByText('Terminer le feu de camp'))
    await waitFor(() => expect(screen.getByText('Préparer un feu de camp')).toBeTruthy())
    confirmer.mockRestore()

    // Le camp suivant est proposé en repos court, au sein de la session 1…
    fireEvent.click(screen.getByText('Préparer un feu de camp'))
    await waitFor(() => expect(screen.getByText('non lancé')).toBeTruthy())
    expect(screen.getByRole('button', { name: 'Lancer le repos court' })).toBeTruthy()

    // …et le basculer sur « initial » annonce bien la session 2.
    fireEvent.click(screen.getByRole('button', { name: 'Feu de camp initial' }))
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /ouvrir la session 2$/i })).toBeTruthy(),
    )
    lancer()
    await waitFor(() => expect(screen.getByText(/session 2 ·/)).toBeTruthy())
  })

  it('montre à la MJ l’écran de la joueuse, et lui laisse retoucher le brief', async () => {
    await tablePreteAvecPersonnage()
    await prepareUnCamp()
    ecrireBrief('Une infiltration au Bone-Fire.')
    lancer()
    await waitFor(() => expect(screen.getByText('Terminer le feu de camp')).toBeTruthy())

    // Le miroir affiche la phase en cours pour la joueuse observée.
    fireEvent.click(screen.getByRole('button', { name: 'Brief de Mission' }))
    await waitFor(() => expect(screen.getByText('Écran de la joueuse')).toBeTruthy())

    // Et la MJ peut corriger le brief sur un camp déjà lancé.
    const champ = screen.getByDisplayValue('Une infiltration au Bone-Fire.')
    fireEvent.change(champ, { target: { value: 'Changement de plan : une évasion.' } })
    fireEvent.blur(champ)
    cleanup()

    sessionStorage.setItem('maraudeur:role', 'joueuse')
    await monter()
    await waitFor(() => expect(screen.getByText(/Changement de plan/)).toBeTruthy())
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

    // L'onglet Sorts montre tout ce que la joueuse connaît, en trois sections :
    // les 3 préparés en haut, le reste du répertoire rangé par magie en bas.
    // Chaque sort n'apparaît qu'une fois.
    fireEvent.click(screen.getByRole('tab', { name: 'Sorts' }))
    await waitFor(() => expect(screen.getByText('Burst')).toBeTruthy())
    expect(screen.getByText('Heat track')).toBeTruthy()
    expect(screen.getByText('First Aid')).toBeTruthy()
    expect(screen.getByText('Prey Impulse')).toBeTruthy()

    const prepares = screen.getByText('Sorts préparés').closest('section')
    expect(prepares?.textContent).toContain('Burst')
    expect(prepares?.textContent).not.toContain('Prey Impulse')

    const connus = screen.getByText('Sorts connus').closest('section')
    expect(connus?.textContent).toContain('Prey Impulse')
    expect(connus?.textContent).toContain('Miracle')
  })
})
