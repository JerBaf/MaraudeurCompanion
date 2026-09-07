// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
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

  /** Ajoute un second personnage à une table déjà amorcée. */
  async function ajouterPersonnage(nom: string) {
    sessionStorage.setItem('maraudeur:role', 'joueuse')
    await monter()
    fireEvent.click(await screen.findByRole('button', { name: 'Changer de personnage' }))
    fireEvent.click(await screen.findByText('Créer un personnage'))
    fireEvent.change(screen.getByPlaceholderText('Maya'), { target: { value: nom } })
    fireEvent.click(await screen.findByText('Dusk Hunter'))
    fireEvent.click(screen.getByRole('button', { name: 'Physique en point fort' }))
    fireEvent.click(screen.getByRole('button', { name: 'Roublardise en point fort' }))
    fireEvent.click(screen.getByRole('button', { name: 'Esprit en point faible' }))
    fireEvent.click(screen.getByText('Entrer dans l’Entre-Monde'))
    await waitFor(() => expect(screen.getByText(nom)).toBeTruthy())
    cleanup()
  }

  /**
   * Régression : le formulaire d'édition vivait en bas de la liste, monté une
   * fois pour toutes. Son brouillon vit en `useState` initialisé sur la prop —
   * passer de l'objet A à l'objet B réutilisait donc le même composant, et
   * l'écran continuait d'afficher A. Il fallait cliquer « Annuler » pour en
   * sortir, ce que rien n'indiquait.
   *
   * Le formulaire est désormais **sous la ligne qu'on corrige** : changer
   * d'entrée le remonte, et le brouillon repart du bon objet.
   */
  it('passe d’un objet à l’autre sans rester bloqué sur le premier', async () => {
    await tablePreteAvecPersonnage()

    sessionStorage.setItem('maraudeur:role', 'mj')
    await monter()
    fireEvent.click(await screen.findByRole('tab', { name: 'Réglages' }))

    // Deux équipements, créés d'affilée depuis l'atelier.
    for (const nom of ['Dague brève', 'Masse lourde']) {
      fireEvent.click(await screen.findByRole('button', { name: 'Équipement' }))
      fireEvent.change(await screen.findByLabelText('Nom'), { target: { value: nom } })
      fireEvent.click(screen.getByText('Enregistrer'))
      await waitFor(() => expect(screen.getByText(new RegExp(`« ${nom} » créé`))).toBeTruthy())
    }

    fireEvent.click(screen.getByRole('tab', { name: 'Équipements' }))
    await waitFor(() => expect(screen.getByText('Dague brève')).toBeTruthy())

    /** Le champ « Nom » du formulaire ouvert, s'il y en a un. */
    const nomAffiche = () =>
      (screen.queryByLabelText('Nom') as HTMLInputElement | null)?.value ?? null

    /** Le bouton « Modifier » de la ligne qui porte ce nom — la liste est triée. */
    const modifier = (nom: string) => {
      const ligne = screen.getByText(nom).closest('.objet') as HTMLElement
      return within(ligne).getByRole('button', { name: 'Modifier' })
    }

    // On ouvre la première…
    fireEvent.click(modifier('Dague brève'))
    await waitFor(() => expect(nomAffiche()).toBe('Dague brève'))

    // …puis la seconde, sans passer par « Annuler ».
    fireEvent.click(modifier('Masse lourde'))
    await waitFor(() => expect(nomAffiche()).toBe('Masse lourde'))
  })

  /**
   * Le parcours complet du nouvel atelier : la MJ fabrique une **classe
   * entière** — champs de base, sorts fournis, et un choix à deux options —
   * depuis le seul onglet Création, et la joueuse peut aussitôt s'en servir.
   *
   * C'était le dernier trou du modèle : rien ne permettait de créer une classe
   * sans toucher au code.
   */
  it('la MJ compose une classe entière depuis l’onglet Création', async () => {
    await tablePreteAvecPersonnage()

    sessionStorage.setItem('maraudeur:role', 'mj')
    await monter()
    fireEvent.click(await screen.findByRole('tab', { name: 'Réglages' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Classe' }))

    fireEvent.change(await screen.findByLabelText('Nom'), { target: { value: 'Arpenteuse' } })

    // Un choix à deux options, chacune avec son verrou et son effet.
    fireEvent.click(screen.getByText('Ajouter un choix'))
    fireEvent.change(await screen.findByLabelText('Libellé du choix'), {
      target: { value: 'Démarche' },
    })
    fireEvent.change(screen.getByLabelText('Nom de l’option'), {
      target: { value: 'Silencieuse' },
    })
    fireEvent.click(screen.getByText('Ajouter une option'))
    await waitFor(() =>
      expect(screen.getAllByLabelText('Nom de l’option')).toHaveLength(2),
    )
    fireEvent.change(screen.getAllByLabelText('Nom de l’option')[1] as HTMLElement, {
      target: { value: 'Assurée' },
    })

    fireEvent.click(screen.getByText('Enregistrer'))
    await waitFor(() => expect(screen.getByText(/« Arpenteuse » créé/)).toBeTruthy())

    // Elle figure dans l'onglet qui liste les classes.
    fireEvent.click(screen.getByRole('tab', { name: 'Classes' }))
    await waitFor(() => expect(screen.getByText('Arpenteuse')).toBeTruthy())
    cleanup()

    // Et la joueuse peut créer un personnage dessus.
    localStorage.removeItem('maraudeur:personnage')
    sessionStorage.setItem('maraudeur:role', 'joueuse')
    await monter()
    // Sans personnage retenu, on arrive sur le roster.
    fireEvent.click(await screen.findByText('Créer un personnage'))
    await waitFor(() => expect(screen.getByText('Arpenteuse')).toBeTruthy())
  })

  /**
   * Le parcours complet d'une réaction croisée : la MJ compose « quand une
   * alliée prend une brûlure, gagnez un Point de Foi », et le passif part sur la
   * fiche de sa porteuse quand *quelqu'un d'autre* bouge la jauge.
   *
   * C'est le test qui couvre le câblage : `resoudrePassifs` reçoit le roster
   * depuis `repo.ts`, et la fiche de l'alliée est écrite en plus de celle de
   * l'actrice.
   */
  it('un passif réactif s’arme sur le geste d’une alliée', async () => {
    await tablePreteAvecPersonnage()
    await ajouterPersonnage('Nael')

    // --- La MJ compose l'amélioration ---
    sessionStorage.setItem('maraudeur:role', 'mj')
    await monter()
    fireEvent.click(await screen.findByRole('tab', { name: 'Réglages' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Amélioration' }))

    fireEvent.change(await screen.findByLabelText('Nom'), { target: { value: 'Lien de sang' } })
    fireEvent.click(screen.getByText('Ajouter un passif'))
    fireEvent.change(await screen.findByLabelText('Déclenchement'), {
      target: { value: 'reaction' },
    })
    fireEvent.change(screen.getByLabelText('Jauge surveillée'), { target: { value: 'brulures' } })
    fireEvent.change(screen.getByLabelText('Sens du changement'), { target: { value: 'augmente' } })
    fireEvent.change(screen.getByLabelText('Chez qui'), { target: { value: 'un-allie' } })
    fireEvent.change(screen.getByLabelText('Cible du passif'), { target: { value: 'foi|valeur' } })
    fireEvent.click(screen.getByText('Enregistrer'))

    // --- Elle l'accorde à Nael ---
    fireEvent.click(await screen.findByRole('tab', { name: 'Table' }))
    fireEvent.click(await screen.findByText('Nael'))
    const accorder = await screen.findByLabelText('Accorder une amélioration')
    const option = within(accorder).getByRole('option', { name: /Lien de sang/ })
    fireEvent.change(accorder, { target: { value: (option as HTMLOptionElement).value } })
    // Le nom apparaît dans l'inventaire de Nael et dans ses effets en cours.
    await waitFor(() => expect(screen.getAllByText('Lien de sang').length).toBeGreaterThan(0))
    cleanup()

    // --- Ilma prend une brûlure ---
    localStorage.removeItem('maraudeur:personnage')
    sessionStorage.setItem('maraudeur:role', 'joueuse')
    await monter()
    fireEvent.click(await screen.findByText('Ilma'))
    fireEvent.click(await screen.findByRole('button', { name: 'Brûlures : 1' }))
    cleanup()

    // --- La Foi de Nael a monté, sans qu'elle ait rien touché ---
    sessionStorage.setItem('maraudeur:role', 'mj')
    await monter()
    await waitFor(() => {
      const ligne = screen.getByText('Nael').closest('button')
      expect(ligne?.textContent).toContain('Foi 3')
    })
  })

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

  /**
   * Le parcours que le lot B rend possible : la MJ compose un passif en données,
   * sans qu'aucune ligne de code ne connaisse ce talisman. Le moteur de
   * modificateurs le relit comme n'importe quelle armure.
   */
  it('un passif saisi au catalogue remonte sur la fiche de la joueuse', async () => {
    await tablePreteAvecPersonnage()

    sessionStorage.setItem('maraudeur:role', 'mj')
    await monter()
    fireEvent.click(await screen.findByRole('tab', { name: 'Réglages' }))
    // L'onglet Création est ouvert d'emblée : on y choisit ce qu'on fabrique.
    fireEvent.click(await screen.findByRole('button', { name: 'Équipement' }))

    fireEvent.change(await screen.findByLabelText('Nom'), {
      target: { value: 'Talisman de protection' },
    })
    fireEvent.change(screen.getByLabelText('Emplacement'), { target: { value: 'bibelot' } })
    fireEvent.change(screen.getByLabelText('Évasion'), { target: { value: '2' } })

    // Et un passif composé à la main : avantage en Social.
    fireEvent.click(screen.getByText('Ajouter un passif'))
    fireEvent.change(await screen.findByLabelText('Cible du passif'), {
      target: { value: 'competence|valeur' },
    })
    fireEvent.change(screen.getByLabelText('Compétence visée'), { target: { value: 'social' } })
    fireEvent.change(screen.getByLabelText('Effet du passif'), { target: { value: 'avantage' } })
    fireEvent.click(screen.getByText('Enregistrer'))

    // La MJ l'accorde à la joueuse, puis le lui fait porter.
    fireEvent.click(await screen.findByRole('tab', { name: 'Table' }))
    fireEvent.click(await screen.findByText('Ilma'))

    const accorder = await screen.findByLabelText('Accorder un équipement')
    const option = within(accorder).getByRole('option', { name: /Talisman de protection/ })
    fireEvent.change(accorder, { target: { value: (option as HTMLOptionElement).value } })

    const slotBibelot = await screen.findByLabelText('Bibelot')
    await waitFor(() =>
      expect(
        within(slotBibelot).queryByRole('option', { name: /Talisman de protection/ }),
      ).toBeTruthy(),
    )
    fireEvent.change(slotBibelot, { target: { value: (option as HTMLOptionElement).value } })
    cleanup()

    // Côté joueuse : Évasion 1 + 2, et l'avantage en Social, sans qu'aucune
    // ligne de code ne connaisse ce talisman.
    sessionStorage.setItem('maraudeur:role', 'joueuse')
    await monter()
    await waitFor(() => expect(screen.getByText('Ilma')).toBeTruthy())

    const vignette = screen.getByText('Évasion').closest('.vignette')
    expect(vignette?.textContent).toContain('3')

    const social = screen.getByText('Social').closest('.competence')
    expect(social?.textContent).toContain('+d4')
  })

  /**
   * Le parcours complet du lot C : la MJ compose un passif réactif en données,
   * et il s'arme tout seul quand la joueuse bouge la jauge surveillée.
   */
  it('un passif réactif saisi au catalogue s’arme sur la fiche', async () => {
    await tablePreteAvecPersonnage()

    sessionStorage.setItem('maraudeur:role', 'mj')
    await monter()
    fireEvent.click(await screen.findByRole('tab', { name: 'Réglages' }))
    // L'onglet Création est ouvert d'emblée : on y choisit ce qu'on fabrique.
    fireEvent.click(await screen.findByRole('button', { name: 'Équipement' }))

    fireEvent.change(await screen.findByLabelText('Nom'), {
      target: { value: 'Sceau du Martyr' },
    })
    fireEvent.change(screen.getByLabelText('Emplacement'), { target: { value: 'bibelot' } })

    // « Quand les Marques augmentent, gagne un Point de Foi. » Un seul
    // formulaire : le passif se compose, puis on dit ce qui le déclenche.
    fireEvent.click(screen.getByText('Ajouter un passif'))
    fireEvent.change(await screen.findByLabelText('Déclenchement'), {
      target: { value: 'reaction' },
    })
    fireEvent.change(screen.getByLabelText('Jauge surveillée'), { target: { value: 'marques' } })
    fireEvent.change(screen.getByLabelText('Sens du changement'), {
      target: { value: 'augmente' },
    })
    fireEvent.change(screen.getByLabelText('Cible du passif'), { target: { value: 'foi|valeur' } })
    fireEvent.click(screen.getByText('Enregistrer'))

    fireEvent.click(await screen.findByRole('tab', { name: 'Table' }))
    fireEvent.click(await screen.findByText('Ilma'))

    const accorder = await screen.findByLabelText('Accorder un équipement')
    const option = within(accorder).getByRole('option', { name: /Sceau du Martyr/ })
    fireEvent.change(accorder, { target: { value: (option as HTMLOptionElement).value } })

    const slot = await screen.findByLabelText('Bibelot')
    await waitFor(() =>
      expect(within(slot).queryByRole('option', { name: /Sceau du Martyr/ })).toBeTruthy(),
    )
    fireEvent.change(slot, { target: { value: (option as HTMLOptionElement).value } })
    cleanup()

    // Côté joueuse : la Foi part de 2 ; prendre une Marque doit la porter à 3.
    sessionStorage.setItem('maraudeur:role', 'joueuse')
    await monter()
    await waitFor(() => expect(screen.getByText('2 / 9')).toBeTruthy())

    fireEvent.click(screen.getByRole('button', { name: 'Marques : 1' }))
    await waitFor(() => expect(screen.getByText('3 / 9')).toBeTruthy())
  })

  /**
   * Le libellé du passif était figé au moment de son ajout : composer les
   * passifs avant de nommer l'objet — l'ordre naturel — laissait un « Objet »
   * générique sur la fiche de la joueuse.
   */
  it('nomme le passif d’après l’objet, même si on le compose avant de le nommer', async () => {
    await tablePreteAvecPersonnage()

    sessionStorage.setItem('maraudeur:role', 'mj')
    await monter()
    fireEvent.click(await screen.findByRole('tab', { name: 'Réglages' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Amélioration' }))

    // Le passif d'abord…
    fireEvent.click(await screen.findByText('Ajouter un passif'))
    fireEvent.change(await screen.findByLabelText('Cible du passif'), {
      target: { value: 'evasion|valeur' },
    })
    fireEvent.change(screen.getByLabelText('Valeur du passif'), { target: { value: '2' } })

    // …le nom ensuite.
    fireEvent.change(screen.getByLabelText('Nom'), { target: { value: 'Peau de pierre' } })
    fireEvent.click(screen.getByText('Enregistrer'))

    // La MJ l'accorde — une amélioration ne s'obtenait qu'en boutique.
    fireEvent.click(await screen.findByRole('tab', { name: 'Table' }))
    fireEvent.click(await screen.findByText('Ilma'))
    const accorder = await screen.findByLabelText('Accorder une amélioration')
    const option = within(accorder).getByRole('option', { name: /Peau de pierre/ })
    fireEvent.change(accorder, { target: { value: (option as HTMLOptionElement).value } })
    cleanup()

    sessionStorage.setItem('maraudeur:role', 'joueuse')
    await monter()
    await waitFor(() => expect(screen.getByText('Ilma')).toBeTruthy())

    // Le passif porte le nom de l'amélioration, pas un « Amélioration » générique.
    const effets = screen.getByText('Effets en cours').closest('section')
    expect(effets?.textContent).toContain('Peau de pierre')
    expect(effets?.textContent).not.toContain('Amélioration :')

    const vignette = screen.getByText('Évasion').closest('.vignette')
    expect(vignette?.textContent).toContain('3')
  })

  it('la joueuse utilise un objet sans recharge, qui reste au sac une fois vide', async () => {
    await tablePreteAvecPersonnage()

    sessionStorage.setItem('maraudeur:role', 'mj')
    await monter()
    fireEvent.click(await screen.findByRole('tab', { name: 'Réglages' }))
    // L'onglet Création est ouvert d'emblée : on y choisit ce qu'on fabrique.
    fireEvent.click(await screen.findByRole('button', { name: 'Équipement' }))

    fireEvent.change(await screen.findByLabelText('Nom'), {
      target: { value: 'Potion de brume' },
    })
    fireEvent.change(screen.getByLabelText('Emplacement'), { target: { value: 'bibelot' } })

    fireEvent.click(screen.getByText('Ajouter un effet actif'))
    fireEvent.change(await screen.findByLabelText('Faces'), { target: { value: '1' } })
    fireEvent.change(await screen.findByLabelText('Effet'), {
      target: { value: 'Un brouillard vous dérobe aux regards.' },
    })
    fireEvent.change(screen.getByLabelText('Nom de l’effet actif'), {
      target: { value: 'Briser le flacon' },
    })
    // Une seule charge, et rien qui la rende.
    fireEvent.change(screen.getByLabelText('Charges'), { target: { value: '1' } })
    fireEvent.change(screen.getByLabelText('Recharge'), { target: { value: 'aucune' } })
    fireEvent.click(screen.getByText('Enregistrer'))

    fireEvent.click(await screen.findByRole('tab', { name: 'Table' }))
    fireEvent.click(await screen.findByText('Ilma'))
    const accorder = await screen.findByLabelText('Accorder un équipement')
    const option = within(accorder).getByRole('option', { name: /Potion de brume/ })
    fireEvent.change(accorder, { target: { value: (option as HTMLOptionElement).value } })

    // Un objet ne s'utilise que porté : le PDF limite la joueuse à ses trois
    // emplacements pendant la session.
    const slot = await screen.findByLabelText('Bibelot')
    await waitFor(() =>
      expect(within(slot).queryByRole('option', { name: /Potion de brume/ })).toBeTruthy(),
    )
    fireEvent.change(slot, { target: { value: (option as HTMLOptionElement).value } })
    cleanup()

    sessionStorage.setItem('maraudeur:role', 'joueuse')
    await monter()
    // L'usage se fait depuis la fiche : toucher l'emplacement de l'avatar,
    // puis l'objet qui s'affiche dessous pour en déplier la description.
    await waitFor(() => expect(screen.getByText('Ilma')).toBeTruthy())
    // Le premier bouton portant ce nom est l'emplacement de l'avatar ; le
    // second, l'objet qu'il révèle, dont le clic déplie la description.
    fireEvent.click(screen.getAllByRole('button', { name: /Potion de brume/ })[0] as HTMLElement)
    await waitFor(() =>
      expect(screen.getAllByRole('button', { name: /Potion de brume/ })).toHaveLength(2),
    )
    fireEvent.click(screen.getAllByRole('button', { name: /Potion de brume/ })[1] as HTMLElement)

    fireEvent.click(await screen.findByRole('button', { name: 'Briser le flacon' }))
    // Le texte apparaît aussi dans la description dépliée de l'objet.
    await waitFor(() => expect(screen.getAllByText(/brouillard vous dérobe/).length).toBeGreaterThan(0))

    // Épuisé, il ne part plus — mais il reste au sac : c'est à la MJ ou à la
    // joueuse de l'en retirer, pas à l'application de le faire disparaître.
    await waitFor(() =>
      expect(
        (screen.getByRole('button', { name: 'Plus de charge' }) as HTMLButtonElement).disabled,
      ).toBe(true),
    )
    fireEvent.click(screen.getByRole('tab', { name: 'Équipement' }))
    await waitFor(() => expect(screen.getByText('Potion de brume')).toBeTruthy())
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
    expect(onglets?.textContent).toBe('BoutiqueSortsArmurerie')
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

// ---------------------------------------------------------------------------

describe('Combat rapide', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
  })
  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  /** Amorce la table, puis crée les personnages demandés en une seule session. */
  async function tableAvec(noms: string[]) {
    sessionStorage.setItem('maraudeur:role', 'mj')
    await monter()
    await waitFor(() =>
      expect(clesStockage().some((k) => k.includes('catalog/dusk-hunter'))).toBe(true),
    )
    cleanup()

    sessionStorage.setItem('maraudeur:role', 'joueuse')
    await monter()
    for (const nom of noms) {
      fireEvent.click(await screen.findByText('Créer un personnage'))
      fireEvent.change(screen.getByPlaceholderText('Maya'), { target: { value: nom } })
      fireEvent.click(await screen.findByText('Dusk Hunter'))
      fireEvent.click(screen.getByRole('button', { name: 'Physique en point fort' }))
      fireEvent.click(screen.getByRole('button', { name: 'Roublardise en point fort' }))
      fireEvent.click(screen.getByRole('button', { name: 'Esprit en point faible' }))
      fireEvent.click(screen.getByText('Entrer dans l’Entre-Monde'))
      await waitFor(() => expect(screen.getByText(nom)).toBeTruthy())
      fireEvent.click(screen.getByRole('button', { name: 'Changer de personnage' }))
    }
    cleanup()
  }

  /** Compose et lance un duel depuis l'écran MJ. Laisse cet écran monté. */
  async function lancerDuelMJ(motif: string[]) {
    sessionStorage.setItem('maraudeur:role', 'mj')
    await monter()
    fireEvent.click(await screen.findByRole('tab', { name: 'Combat rapide' }))
    fireEvent.click(await screen.findByText('Préparer un combat rapide'))

    fireEvent.change(await screen.findByPlaceholderText('Carcasse'), {
      target: { value: 'Carcasse' },
    })

    const bloc = (await screen.findByText(/Motif de l'adversaire/)).closest('section')
    for (const action of motif) {
      fireEvent.click(within(bloc as HTMLElement).getByRole('button', { name: action }))
    }

    fireEvent.click(await screen.findByText('Lancer le combat rapide'))
    await waitFor(() => expect(screen.getByText(/Ouvrir la manche 1/)).toBeTruthy())
  }

  /**
   * Monte l'écran joueuse sur l'onglet du duel. `nom` n'est utile qu'au premier
   * passage : ensuite l'appareil retrouve tout seul la fiche qu'il a réclamée.
   */
  async function jouerLeDuel(nom?: string) {
    sessionStorage.setItem('maraudeur:role', 'joueuse')
    await monter()
    if (nom) fireEvent.click(await screen.findByText(nom))
    fireEvent.click(await screen.findByRole('tab', { name: 'Combat rapide' }))
  }

  /**
   * Le pendant, pour le duel, du test qui garde le seuil de Fatigue des
   * adversaires : on n'assure pas le secret en regardant l'écran — les cinq
   * actions y sont toutes affichées, forcément — mais en relisant le document
   * réellement écrit.
   */
  it('garde le motif du PNJ hors du document que les joueuses lisent', async () => {
    await tableAvec(['Ilma'])
    await lancerDuelMJ(['Pression', 'Feinte'])

    const clePublique = clesStockage().find((k) => k.includes('/duels/'))
    const cleSecrete = clesStockage().find((k) => k.includes('/secrets/duel'))
    expect(clePublique).toBeDefined()
    expect(cleSecrete).toBeDefined()

    const publique = localStorage.getItem(clePublique as string) as string
    expect(publique).not.toContain('motif')
    expect(publique).not.toContain('override')
    // Le motif choisi évite volontairement l'action par défaut, qui elle est
    // publique : la joueuse doit savoir ce qui se joue si son chrono expire.
    expect(publique).not.toContain('pression')
    expect(publique).not.toContain('feinte')
    expect(publique).toContain('"actionParDefaut":"garde"')

    // …et il est bien quelque part, dans le document refusé aux joueuses.
    expect(localStorage.getItem(cleSecrete as string)).toContain('pression')
  })

  it('résout la manche que la duelliste verrouille, et fait monter le score', async () => {
    await tableAvec(['Ilma'])
    await lancerDuelMJ(['Garde'])

    fireEvent.click(screen.getByText(/Ouvrir la manche 1/))
    await waitFor(() => expect(screen.getByText(/Ilma choisit/)).toBeTruthy())
    cleanup()

    // --- La duelliste prépare, puis verrouille ---
    await jouerLeDuel('Ilma')

    fireEvent.click(await screen.findByRole('button', { name: 'Contre' }))
    // Un premier appui ne fait que préparer : rien n'est encore parti.
    expect(screen.getByText('Verrouiller Contre')).toBeTruthy()
    const cleDuel = clesStockage().find((k) => k.includes('/duels/')) as string
    expect(localStorage.getItem(cleDuel)).toContain('"choixJoueuse":null')

    fireEvent.click(screen.getByText('Verrouiller Contre'))
    await waitFor(() => expect(screen.getByText(/verrouillée/)).toBeTruthy())
    cleanup()

    // --- La MJ est le seul écran qui puisse lire le motif, donc arbitrer ---
    sessionStorage.setItem('maraudeur:role', 'mj')
    await monter()
    fireEvent.click(await screen.findByRole('tab', { name: 'Combat rapide' }))

    // Contre bat Garde : la duelliste marque 1 point (pas de Flow en manche 1).
    await waitFor(() => expect(screen.getAllByText(/Ilma marque 1/).length).toBeGreaterThan(0))
    expect(screen.getByText(/Ouvrir la manche 2/)).toBeTruthy()
    cleanup()

    // --- Et la duelliste voit le résultat arriver sur son écran ---
    await jouerLeDuel()
    await waitFor(() => expect(screen.getAllByText(/Vous marque 1/).length).toBeGreaterThan(0))
    expect(screen.getByLabelText('1 point(s)')).toBeTruthy()
  })

  /**
   * On ne fige que `Date` : `setInterval` reste réel, si bien que le battement
   * du chrono continue de tourner pendant qu'on avance l'horloge.
   */
  async function laisserExpirerLeChrono() {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(Date.now() + 60_000)
  }

  it('verrouille la sélection en cours quand le chrono expire', async () => {
    await tableAvec(['Ilma'])
    await lancerDuelMJ(['Garde'])
    fireEvent.click(screen.getByText(/Ouvrir la manche 1/))
    await waitFor(() => expect(screen.getByText(/Ilma choisit/)).toBeTruthy())
    cleanup()

    await jouerLeDuel('Ilma')
    // Préparée sans être verrouillée : c'est elle que le chrono doit engager,
    // et non l'action par défaut. Un doigt posé ne doit pas être perdu.
    fireEvent.click(await screen.findByRole('button', { name: 'Contre' }))

    const cleDuel = clesStockage().find((k) => k.includes('/duels/')) as string
    expect(localStorage.getItem(cleDuel)).toContain('"choixJoueuse":null')

    await laisserExpirerLeChrono()
    await waitFor(() => expect(screen.getByText(/Contre verrouillée/)).toBeTruthy())
    expect(localStorage.getItem(cleDuel)).toContain('"choixJoueuse":"contre"')
  })

  it('joue l’action par défaut quand le chrono expire sans rien de préparé', async () => {
    await tableAvec(['Ilma'])
    await lancerDuelMJ(['Pression'])
    fireEvent.click(screen.getByText(/Ouvrir la manche 1/))
    await waitFor(() => expect(screen.getByText(/Ilma choisit/)).toBeTruthy())
    cleanup()

    await jouerLeDuel('Ilma')
    await screen.findByText(/Touchez une action/)

    await laisserExpirerLeChrono()
    // Rien n'a été touché : la Garde, repli par défaut, part à sa place.
    await waitFor(() => expect(screen.getByText(/Garde verrouillée/)).toBeTruthy())
    const cleDuel = clesStockage().find((k) => k.includes('/duels/')) as string
    expect(localStorage.getItem(cleDuel)).toContain('"choixJoueuse":"garde"')
  })

  it('montre le plateau aux autres joueuses, sans leur donner de choix', async () => {
    await tableAvec(['Ilma', 'Maya'])
    await lancerDuelMJ(['Garde'])
    fireEvent.click(screen.getByText(/Ouvrir la manche 1/))
    await waitFor(() => expect(screen.getByText(/Ilma choisit/)).toBeTruthy())
    cleanup()

    // C'est Ilma qui se bat — le duel vise la première fiche par ordre alphabétique.
    await jouerLeDuel('Maya')

    expect(await screen.findByText(/Ilma affronte Carcasse/)).toBeTruthy()
    // Le plateau est là, mais aucune des cinq actions n'est cliquable.
    expect(screen.getByText('Contre')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Contre' })).toBeNull()
    expect(screen.queryByText(/Verrouiller/)).toBeNull()
  })
})

describe('Notifications', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
  })
  afterEach(cleanup)

  /** Amorce la table et crée une joueuse, comme pour le Combat rapide. */
  async function tableAvec(nom: string) {
    sessionStorage.setItem('maraudeur:role', 'mj')
    await monter()
    await waitFor(() =>
      expect(clesStockage().some((k) => k.includes('catalog/dusk-hunter'))).toBe(true),
    )
    cleanup()

    sessionStorage.setItem('maraudeur:role', 'joueuse')
    await monter()
    fireEvent.click(await screen.findByText('Créer un personnage'))
    fireEvent.change(screen.getByPlaceholderText('Maya'), { target: { value: nom } })
    fireEvent.click(await screen.findByText('Dusk Hunter'))
    fireEvent.click(screen.getByRole('button', { name: 'Physique en point fort' }))
    fireEvent.click(screen.getByRole('button', { name: 'Roublardise en point fort' }))
    fireEvent.click(screen.getByRole('button', { name: 'Esprit en point faible' }))
    fireEvent.click(screen.getByText('Entrer dans l’Entre-Monde'))
    await waitFor(() => expect(screen.getByText(nom)).toBeTruthy())
    cleanup()
  }

  /** Compose et envoie une notification depuis l'écran MJ. Laisse l'écran monté. */
  async function envoyerMJ(type: string, nom: string, texte: string) {
    sessionStorage.setItem('maraudeur:role', 'mj')
    await monter()
    fireEvent.click(await screen.findByRole('tab', { name: 'Notifications' }))
    fireEvent.click(await screen.findByRole('button', { name: type }))
    fireEvent.click(await screen.findByLabelText(nom))
    fireEvent.change(screen.getByRole('textbox'), { target: { value: texte } })
  }

  function ficheDe(nom: string): string {
    const cle = clesStockage().find(
      (k) => k.includes('/characters/') && (localStorage.getItem(k) ?? '').includes(`"${nom}"`),
    )
    return localStorage.getItem(cle as string) as string
  }

  it('pousse un 6th Sens, consomme le point sur Écouter, et le remonte à la MJ', async () => {
    await tableAvec('Ilma')
    await envoyerMJ('6th Sens', 'Ilma', "Un courant d'air froid vient du couloir de gauche.")
    fireEvent.click(screen.getByRole('button', { name: 'Envoyer' }))
    await waitFor(() => expect(screen.getByText('En attente…')).toBeTruthy())
    cleanup()

    // --- La carte arrive sur l'écran de la joueuse, sans qu'elle change d'onglet ---
    sessionStorage.setItem('maraudeur:role', 'joueuse')
    await monter()
    fireEvent.click(await screen.findByText('Ilma'))

    const carte = await screen.findByRole('dialog')
    expect(within(carte).getByText(/courant d'air froid/)).toBeTruthy()
    // Le coût est annoncé sur le bouton, pas caché derrière l'appui.
    expect(within(carte).getByText(/1 6th Sens/)).toBeTruthy()

    fireEvent.click(within(carte).getByRole('button', { name: /Écouter/ }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(ficheDe('Ilma')).toContain('"sixthSensUtilises":1')
    cleanup()

    // --- Et la MJ voit la réponse, pour donner l'information à l'oreille ---
    sessionStorage.setItem('maraudeur:role', 'mj')
    await monter()
    fireEvent.click(await screen.findByRole('tab', { name: 'Notifications' }))

    // Restreint à la carte de suivi : « Écouter » figure aussi dans le texte
    // d'aide du composeur, qui décrit les deux réponses possibles.
    const suivi = (await screen.findByText(/courant d'air froid/)).closest('section') as HTMLElement
    await waitFor(() => expect(within(suivi).getByText('Écouter')).toBeTruthy())
    expect(within(suivi).queryByText('En attente…')).toBeNull()
  })

  /**
   * Le parcours complet d'une quête : la MJ la compose dans son onglet, la
   * propose par notification, la joueuse l'accepte et la retrouve dans son
   * onglet, puis la validation verse la récompense et la fait passer.
   */
  it('propose une quête, la verse à la validation, et la range dans Passées', async () => {
    await tableAvec('Ilma')

    // --- La MJ compose la quête dans son propre onglet ---
    sessionStorage.setItem('maraudeur:role', 'mj')
    await monter()
    fireEvent.click(await screen.findByRole('tab', { name: 'Quêtes' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Nouvelle quête' }))

    fireEvent.change(await screen.findByLabelText('Nom'), {
      target: { value: 'Le collier de Vhal' },
    })
    fireEvent.change(screen.getByLabelText('Description'), {
      target: { value: 'Retrouver le collier volé dans les canaux.' },
    })
    fireEvent.change(screen.getByLabelText('Récompense — Lumens'), { target: { value: '15' } })
    fireEvent.change(screen.getByLabelText('Ajouter au butin'), {
      target: { value: 'lame-simple' },
    })
    fireEvent.click(screen.getByText('Enregistrer'))

    // Elle n'a encore été proposée à personne, et l'écran le dit.
    expect(await screen.findByText(/Proposée à personne/)).toBeTruthy()
    cleanup()

    // --- Elle la propose par notification ---
    await envoyerMJ('Quête', 'Ilma', 'Une vieille femme vous arrête sur le pont.')
    const selecteur = await screen.findByLabelText('La quête proposée')
    const option = within(selecteur).getByRole('option', { name: 'Le collier de Vhal' })
    fireEvent.change(selecteur, { target: { value: (option as HTMLOptionElement).value } })
    fireEvent.click(screen.getByRole('button', { name: 'Envoyer' }))
    await waitFor(() => expect(screen.getByText('En attente…')).toBeTruthy())
    cleanup()

    // --- La joueuse voit tout avant de s'engager, puis accepte ---
    sessionStorage.setItem('maraudeur:role', 'joueuse')
    await monter()
    fireEvent.click(await screen.findByText('Ilma'))

    const carte = await screen.findByRole('dialog')
    expect(within(carte).getByText('Le collier de Vhal')).toBeTruthy()
    expect(within(carte).getByText(/canaux/)).toBeTruthy()
    expect(within(carte).getByText(/15 ʟ · Lame simple/)).toBeTruthy()

    fireEvent.click(within(carte).getByRole('button', { name: 'Accepter' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())

    // Elle la retrouve dans son onglet, sous « En Cours ».
    fireEvent.click(await screen.findByRole('tab', { name: 'Quêtes' }))
    const enCours = (await screen.findByText('En Cours')).closest('section') as HTMLElement
    expect(within(enCours).getByText('Le collier de Vhal')).toBeTruthy()
    // La ligne n'annonce que la récompense ; la description attend le toucher.
    expect(within(enCours).queryByText(/canaux/)).toBeNull()
    fireEvent.click(within(enCours).getByText('Le collier de Vhal'))
    expect(await within(enCours).findByText(/canaux/)).toBeTruthy()
    cleanup()

    // --- La MJ valide : la récompense part, la quête se clôt ---
    const confirmer = vi.spyOn(window, 'confirm').mockReturnValue(true)
    sessionStorage.setItem('maraudeur:role', 'mj')
    await monter()
    fireEvent.click(await screen.findByRole('tab', { name: 'Quêtes' }))
    expect(await screen.findByText(/Portée par Ilma/)).toBeTruthy()
    fireEvent.click(await screen.findByRole('button', { name: 'Valider' }))

    await waitFor(() => expect(ficheDe('Ilma')).toContain('lame-simple'))
    expect(ficheDe('Ilma')).toContain('"lumens":15')
    // Plus rien à valider : le geste est définitif.
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Valider' })).toBeNull())
    confirmer.mockRestore()
    cleanup()

    // --- Et côté joueuse, elle est passée ---
    sessionStorage.setItem('maraudeur:role', 'joueuse')
    await monter()
    fireEvent.click(await screen.findByText('Ilma'))
    fireEvent.click(await screen.findByRole('tab', { name: 'Quêtes' }))
    const passees = (await screen.findByText('Passées')).closest('section') as HTMLElement
    expect(within(passees).getByText('Le collier de Vhal')).toBeTruthy()
  })

  it('remet un équipement dans le sac, sans l’équiper', async () => {
    await tableAvec('Ilma')
    await envoyerMJ('Nouvel équipement', 'Ilma', 'La forgeronne vous tend une lame.')
    fireEvent.change(screen.getByLabelText("L'objet remis"), { target: { value: 'lame-simple' } })
    fireEvent.click(screen.getByRole('button', { name: 'Envoyer' }))
    await waitFor(() => expect(screen.getByText('En attente…')).toBeTruthy())
    cleanup()

    sessionStorage.setItem('maraudeur:role', 'joueuse')
    await monter()
    fireEvent.click(await screen.findByText('Ilma'))

    const carte = await screen.findByRole('dialog')
    // La joueuse voit l'objet avant de le prendre.
    expect(within(carte).getByText('Lame simple')).toBeTruthy()
    expect(ficheDe('Ilma')).not.toContain('lame-simple')

    fireEvent.click(within(carte).getByRole('button', { name: 'Prendre' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())

    const fiche = ficheDe('Ilma')
    expect(fiche).toContain('lame-simple')
    // Dans le sac, pas au bras : les échanges se font au feu de camp.
    expect(fiche).toContain('"equipe":{"arme":null')
  })
})
