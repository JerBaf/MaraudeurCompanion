import { describe, expect, it } from 'vitest'

import { SEED } from '../content/seed.ts'
import { resoudreCampPourPersonnage, TAILLE_GRIMOIRE } from './campfire.ts'
import { createCatalog } from './catalog.ts'
import {
  appliquerProfil,
  creerPersonnage,
  cyclesNonRenseignes,
  maitrisesSuiventLeProfil,
  secretVierge,
} from './character.ts'
import {
  ACTIONS_ALTERNATIVES,
  appliquerDegats,
  echeanceDiversion,
  echeanceEsquive,
  estSonTour,
  estTombe,
  evasionAffichee,
  indexMoment,
  instancierAdversaire,
  prochaineActivation,
  repartirParInitiative,
  resoudreAttaque,
  sousGroupeInitiative,
} from './combat.ts'
import {
  actionsRapidesMax,
  computeBonusEnergieAttaque,
  computeCompetence,
  computeEvasion,
  computeSixthSens,
} from './competences.ts'
import { effetsActifs, facesDuDeDeVies, precisionPersonnalite, vieActive } from './effets.ts'
import {
  cyclesRestants,
  effectuerDetachement,
  poolDetachement,
  resoudreGrillePleine,
} from './fatigue.ts'
import {
  appliquerGainBrulures,
  combustionVolontaire,
  coutAdditionnel,
  coutFoiEffectif,
  disponibiliteSort,
  estHorsEmplacement,
  grimoireEffectif,
  resoudreArcane,
} from './magie.ts'
import {
  derivedModifiers,
  expireModifiers,
  modificateurDiversion,
  modificateurEsquive,
  modificateurFardeau,
  modificateurSerment,
  paliersFlammeAtteints,
} from './modifiers.ts'
import { seededRng, tirerEffetAleatoire, tirerOsselets } from './random.ts'
import type {
  Character,
  EtatCombat,
  ModeleAdversaire,
  Sort,
  VieSoulshifter,
} from './types.ts'
import type { SousGroupe } from './combat.ts'

const catalog = createCatalog(SEED)

function nouveauPerso(classeId: string, patch: Partial<Character> = {}): Character {
  const char = creerPersonnage(
    {
      id: 'pj-test',
      nom: 'Maya',
      classeId,
      maitrises: appliquerProfil(['physique', 'roublardise'], 'esprit'),
    },
    catalog,
    0,
  )
  return { ...char, ...patch }
}

// ---------------------------------------------------------------------------

describe('création de personnage', () => {
  it('applique les Points de Fatigue de la classe', () => {
    expect(nouveauPerso('dusk-hunter').fatigue.max).toBe(5)
    expect(nouveauPerso('soulshifter').fatigue.max).toBe(4)
    expect(nouveauPerso('trickster').fatigue.max).toBe(4)
  })

  it('démarre à 2 Points de Foi et 1 point de 6th Sens', () => {
    const char = nouveauPerso('trickster')
    expect(char.foi).toBe(2)
    expect(computeSixthSens(char, catalog).max).toBe(1)
  })

  it('accorde les sorts de classe mais n’en met que 3 au Grimoire', () => {
    const char = nouveauPerso('dusk-hunter')
    expect(char.possede.sorts).toHaveLength(4)
    expect(char.grimoire).toHaveLength(3)
  })

  it('ne fait jamais transiter les cycles par la fiche', () => {
    const char = creerPersonnage(
      { id: 'x', nom: 'Lila', classeId: 'trickster', maitrises: appliquerProfil(['esprit', 'social'], 'physique') },
      catalog,
      0,
    )
    // La création n'a lieu que sur l'appareil de la joueuse : rien qui touche
    // aux cycles ne doit s'y trouver, ni dans la fiche, ni en mémoire.
    expect(JSON.stringify(char)).not.toContain('cycle')
  })

  it('démarre avec des cycles non renseignés, à saisir par la MJ', () => {
    const vierge = secretVierge('x')
    expect(vierge.cyclesTotal).toBe(0)
    expect(cyclesNonRenseignes(vierge)).toBe(true)
    expect(cyclesNonRenseignes(null)).toBe(true)
    expect(cyclesNonRenseignes({ ...vierge, cyclesTotal: 4 })).toBe(false)
  })

  it('valide le profil de maîtrise type', () => {
    expect(maitrisesSuiventLeProfil(appliquerProfil(['physique', 'social'], 'esprit'))).toBe(true)
    expect(maitrisesSuiventLeProfil({ physique: 2, roublardise: 2, esprit: 2, social: 2 })).toBe(false)
  })
})

// ---------------------------------------------------------------------------

describe('Serment', () => {
  it('épargne la compétence tirée et inflige -4 aux trois autres', () => {
    const char = nouveauPerso('trickster', { modifiers: [modificateurSerment('roublardise')] })

    expect(computeCompetence(char, catalog, 'roublardise').bonus).toBe(0)
    expect(computeCompetence(char, catalog, 'physique').bonus).toBe(-4)
    expect(computeCompetence(char, catalog, 'esprit').bonus).toBe(-4)
    expect(computeCompetence(char, catalog, 'social').bonus).toBe(-4)
  })

  it('survit à un repos court mais tombe en fin de journée', () => {
    const char = nouveauPerso('trickster', { modifiers: [modificateurSerment('esprit')] })

    const court = resoudreCampPourPersonnage(char, { finDeJournee: false })
    expect(court.char.modifiers).toHaveLength(1)

    const jour = resoudreCampPourPersonnage(char, { finDeJournee: true })
    expect(jour.char.modifiers).toHaveLength(0)
  })
})

describe('Fardeau et Marque', () => {
  it('posent un désavantage sur une seule compétence', () => {
    const char = nouveauPerso('trickster', { modifiers: [modificateurFardeau('social')] })
    expect(computeCompetence(char, catalog, 'social').net).toBe('desavantage')
    expect(computeCompetence(char, catalog, 'physique').net).toBe('neutre')
  })
})

describe('Actions Rapides', () => {
  it('vaut 2 avec un Physique à +2, 1 sinon', () => {
    expect(actionsRapidesMax(nouveauPerso('trickster'), catalog)).toBe(2)

    const faible = nouveauPerso('trickster', {
      maitrises: appliquerProfil(['esprit', 'social'], 'physique'),
    })
    expect(actionsRapidesMax(faible, catalog)).toBe(1)
  })

  it('retombe à 1 quand un Serment écrase le Physique', () => {
    const char = nouveauPerso('trickster', { modifiers: [modificateurSerment('social')] })
    expect(actionsRapidesMax(char, catalog)).toBe(1)
  })
})

// ---------------------------------------------------------------------------

describe('Voie de la Flamme', () => {
  it('franchit les seuils 4 puis 7', () => {
    expect(paliersFlammeAtteints(0).map((p) => p.id)).toEqual([])
    expect(paliersFlammeAtteints(3).map((p) => p.id)).toEqual([])
    expect(paliersFlammeAtteints(4).map((p) => p.id)).toEqual(['perception'])
    expect(paliersFlammeAtteints(6).map((p) => p.id)).toEqual(['perception'])
    expect(paliersFlammeAtteints(7).map((p) => p.id)).toEqual(['perception', 'fureur'])
  })

  it('accorde +1 6th Sens dès 4 brûlures, sans rien persister', () => {
    const calme = nouveauPerso('dusk-hunter', { brulures: 3 })
    const chaud = nouveauPerso('dusk-hunter', { brulures: 5 })

    expect(computeSixthSens(calme, catalog).max).toBe(1)
    expect(computeSixthSens(chaud, catalog).max).toBe(2)
    expect(chaud.modifiers).toHaveLength(0)
    expect(derivedModifiers(chaud, catalog).some((m) => m.target.kind === 'sixth-sens')).toBe(true)
  })

  it('cumule les paliers : à 8 brûlures, 6th Sens ET avantage en Physique', () => {
    const brasier = nouveauPerso('dusk-hunter', { brulures: 8 })
    expect(computeCompetence(brasier, catalog, 'physique').net).toBe('avantage')
    // Le palier 7 ne remplace pas le palier 4 : le point de 6th Sens reste acquis.
    expect(computeSixthSens(brasier, catalog).max).toBe(2)
  })

  it('retire les deux bonus en redescendant sous 4', () => {
    const refroidi = nouveauPerso('dusk-hunter', { brulures: 2 })
    expect(computeSixthSens(refroidi, catalog).max).toBe(1)
    expect(computeCompetence(refroidi, catalog, 'physique').net).toBe('neutre')
  })

  it('ne produit jamais un reste de 6th Sens négatif', () => {
    const char = nouveauPerso('dusk-hunter', { brulures: 0, sixthSensUtilises: 3 })
    expect(computeSixthSens(char, catalog).restants).toBe(0)
  })
})

describe('Combustion', () => {
  it('prend 1 Fatigue et remet à zéro en franchissant 9', () => {
    const char = nouveauPerso('soulshifter', { brulures: 7 })
    const r = appliquerGainBrulures(char, 3)
    expect(r.combustion).toBe(true)
    expect(r.brulures).toBe(0)
    expect(r.fatigueAjoutee).toBe(1)
  })

  it('ne déclenche rien sous le seuil', () => {
    const r = appliquerGainBrulures(nouveauPerso('soulshifter', { brulures: 2 }), 3)
    expect(r.combustion).toBe(false)
    expect(r.brulures).toBe(5)
  })

  it('volontaire : paie 1 Fatigue et conserve les 9 brûlures', () => {
    const r = combustionVolontaire()
    expect(r.brulures).toBe(9)
    expect(r.fatigueAjoutee).toBe(1)
  })

  it('Overheat transforme un gain de 2 en 3', () => {
    const dusk = nouveauPerso('dusk-hunter', { brulures: 0, passifs: { hexcore: 'overheat' } })
    expect(appliquerGainBrulures(dusk, 2).gainEffectif).toBe(3)

    const overdrive = nouveauPerso('dusk-hunter', { brulures: 0, passifs: { hexcore: 'overdrive' } })
    expect(appliquerGainBrulures(overdrive, 2).gainEffectif).toBe(2)
  })
})

// ---------------------------------------------------------------------------

describe('Arcane', () => {
  it('donne des Points d’Énergie égaux au résultat du d6', () => {
    for (let d = 1; d <= 6; d += 1) expect(resoudreArcane(d).pointsEnergie).toBe(d)
  })

  it('épuise le cristal sur 1 et sur 2', () => {
    expect(resoudreArcane(1).cristalEpuise).toBe(true)
    expect(resoudreArcane(2).cristalEpuise).toBe(true)
    expect(resoudreArcane(3).cristalEpuise).toBe(false)
  })

  it('déclenche l’Effet Aléatoire uniquement sur un 6', () => {
    expect(resoudreArcane(5).effetAleatoire).toBe(false)
    expect(resoudreArcane(6).effetAleatoire).toBe(true)
  })

  it('cumule les coûts additionnels', () => {
    expect(coutAdditionnel({})).toBe(0)
    // Grande zone (3) + distante (1) + 1 heure (2) + invisible (2)
    expect(coutAdditionnel({ zone: 'grande', portee: 'distante', duree: 'heure', discretion: 'invisible' })).toBe(8)
    expect(coutAdditionnel({ ciblesSupplementaires: 2 })).toBe(2)
  })

  it('marque une Cicatrice sur un double au 2d4', () => {
    const r = tirerEffetAleatoire(seededRng(3))
    expect(r.cicatrice).toBe(r.blanc === r.noir)
    expect(r.puissance).toBe(Math.max(r.blanc, r.noir))
  })
})

describe('Miracle et passif Conteur', () => {
  const wordCrackers = catalog.sort('word-crackers') as Sort

  it('coûte 2 Points de Foi par défaut', () => {
    const char = nouveauPerso('trickster', { passifs: { voieTrickster: 'illusionniste' } })
    expect(coutFoiEffectif(wordCrackers, char, catalog)).toBe(2)
  })

  it('tombe à 1 pour un Conteur', () => {
    const char = nouveauPerso('trickster', { passifs: { voieTrickster: 'conteur' } })
    expect(coutFoiEffectif(wordCrackers, char, catalog)).toBe(1)
  })

  it('n’affecte pas les sorts hors « Word: »', () => {
    const char = nouveauPerso('dusk-hunter', { passifs: { voieTrickster: 'conteur' } })
    const firstAid = catalog.sort('first-aid') as Sort
    expect(coutFoiEffectif(firstAid, char, catalog)).toBe(3)
  })

  it('renvoie null pour un sort qui ne se paie pas en Foi', () => {
    expect(coutFoiEffectif(catalog.sort('polymorph') as Sort, nouveauPerso('trickster'), catalog)).toBeNull()
  })
})

describe('disponibilité des sorts', () => {
  it('refuse un sort hors Grimoire', () => {
    const char = nouveauPerso('dusk-hunter')
    const horsGrimoire = char.possede.sorts.find((s) => !char.grimoire.includes(s)) as string
    const r = disponibiliteSort(catalog.sort(horsGrimoire) as Sort, char, catalog)
    expect(r.raisons).toContain('hors-grimoire')
  })

  it('refuse un cristal épuisé', () => {
    const char = nouveauPerso('trickster', { grimoire: ['polymorph'], sortsEpuises: ['polymorph'] })
    expect(disponibiliteSort(catalog.sort('polymorph') as Sort, char, catalog).raisons).toContain('cristal-epuise')
  })

  it('laisse un Illusionniste lancer ses illusions hors Grimoire', () => {
    const char = nouveauPerso('trickster', { grimoire: [], passifs: { voieTrickster: 'illusionniste' } })
    expect(disponibiliteSort(catalog.sort('mage-hand') as Sort, char, catalog).disponible).toBe(true)
  })

  it('refuse un Miracle sans assez de Foi', () => {
    const char = nouveauPerso('dusk-hunter', { foi: 1, grimoire: ['first-aid'] })
    expect(disponibiliteSort(catalog.sort('first-aid') as Sort, char, catalog).raisons).toContain('foi-insuffisante')
  })
})

// ---------------------------------------------------------------------------

describe('Illusions hors emplacement', () => {
  const illusionniste = () =>
    nouveauPerso('trickster', {
      grimoire: ['polymorph', 'tame', 'word-baboum'],
      possede: {
        sorts: ['polymorph', 'tame', 'word-baboum', 'word-crackers', 'ya-gat-fooled', 'mage-hand'],
        equipements: [],
        ameliorations: [],
      },
      passifs: { voieTrickster: 'illusionniste' },
    })

  it('ajoute les illusions au Grimoire sans consommer d’emplacement', () => {
    const grimoire = grimoireEffectif(illusionniste(), catalog)
    const prepares = grimoire.filter((e) => !e.horsEmplacement)
    const permanents = grimoire.filter((e) => e.horsEmplacement)

    expect(prepares).toHaveLength(TAILLE_GRIMOIRE)
    expect(permanents.map((e) => e.sort.id).sort()).toEqual(['mage-hand', 'ya-gat-fooled'])
    // Le sort simplement possédé mais non préparé reste au sac à dos.
    expect(grimoire.some((e) => e.sort.id === 'word-crackers')).toBe(false)
  })

  /**
   * Régression : les illusions étaient absentes des sorts accordés à la
   * création, donc un Trickster tout neuf ne les voyait nulle part.
   */
  it('accorde les illusions dès la création, sans qu’elles occupent un emplacement', () => {
    const neuf = nouveauPerso('trickster')

    expect(neuf.possede.sorts).toContain('ya-gat-fooled')
    expect(neuf.possede.sorts).toContain('mage-hand')
    expect(neuf.grimoire).not.toContain('ya-gat-fooled')
    expect(neuf.grimoire).toHaveLength(TAILLE_GRIMOIRE)

    const grimoire = grimoireEffectif(neuf, catalog)
    expect(grimoire.filter((e) => e.horsEmplacement).map((e) => e.sort.id).sort()).toEqual([
      'mage-hand',
      'ya-gat-fooled',
    ])
  })

  it('n’ajoute rien pour un Conteur', () => {
    const conteur = { ...illusionniste(), passifs: { voieTrickster: 'conteur' as const } }
    expect(grimoireEffectif(conteur, catalog).every((e) => !e.horsEmplacement)).toBe(true)
  })

  it('rend toute illusion acquise plus tard disponible d’office', () => {
    // Le catalogue ne contient que deux illusions ; on vérifie que la règle
    // porte bien sur le marqueur du sort, pas sur une liste figée.
    const base = illusionniste()
    const sansIllusions = {
      ...base,
      possede: { ...base.possede, sorts: ['polymorph', 'tame', 'word-baboum'] },
    }
    expect(grimoireEffectif(sansIllusions, catalog).some((e) => e.horsEmplacement)).toBe(false)

    const avecUne = {
      ...base,
      possede: { ...base.possede, sorts: ['polymorph', 'tame', 'word-baboum', 'mage-hand'] },
    }
    expect(grimoireEffectif(avecUne, catalog).filter((e) => e.horsEmplacement)).toHaveLength(1)
  })

  it('laisse lancer une illusion absente des 3 emplacements', () => {
    const mageHand = catalog.sort('mage-hand') as Sort
    expect(estHorsEmplacement(mageHand, illusionniste())).toBe(true)
    expect(disponibiliteSort(mageHand, illusionniste(), catalog).disponible).toBe(true)
  })
})

describe('précisions de personnalité', () => {
  const vies: VieSoulshifter[] = [
    { face: 1, nom: 'Abaddon', precisions: { element: 'Boule de gravitation.' } },
    { face: 2, nom: 'T-rexcité', precisions: { element: 'Une liane.', tribue: '+1 Évasion.' } },
  ]

  it('renvoie le texte de la vie incarnée', () => {
    const char = nouveauPerso('soulshifter', { passifs: { viesConnues: [1, 2], vieActive: 2 } })
    expect(precisionPersonnalite('element', char, vies)).toBe('Une liane.')
    expect(precisionPersonnalite('tribue', char, vies)).toBe('+1 Évasion.')
  })

  it('renvoie null pour un sort que la vie ne précise pas', () => {
    const char = nouveauPerso('soulshifter', { passifs: { viesConnues: [1, 2], vieActive: 1 } })
    expect(precisionPersonnalite('tribue', char, vies)).toBeNull()
  })

  it('renvoie null quand aucune vie n’est incarnée', () => {
    const char = nouveauPerso('soulshifter', { passifs: { viesConnues: [1, 2], vieActive: null } })
    expect(precisionPersonnalite('element', char, vies)).toBeNull()
    expect(vieActive(char, vies)).toBeNull()
  })
})

describe('combat', () => {
  it('inflige E − N quand le jet passe l’Évasion', () => {
    const r = resoudreAttaque(2, 1)
    expect(r.touche).toBe(true)
    expect(r.degats).toBe(1)
  })

  it('impose une Action Alternative quand le jet n’atteint pas l’Évasion', () => {
    const r = resoudreAttaque(1, 1)
    expect(r.touche).toBe(false)
    expect(r.degats).toBe(0)
    expect(r.actionAlternativeRequise).toBe(true)
  })

  it('répartit les initiatives en deux sous-groupes', () => {
    expect(sousGroupeInitiative(6)).toBe('avant-mj')
    expect(sousGroupeInitiative(4)).toBe('avant-mj')
    expect(sousGroupeInitiative(3)).toBe('apres-mj')
    expect(sousGroupeInitiative(1)).toBe('apres-mj')
  })

  it('sait qui attend encore son initiative', () => {
    const a = { ...nouveauPerso('trickster'), id: 'a' }
    const b = { ...nouveauPerso('trickster'), id: 'b' }
    const c = { ...nouveauPerso('trickster'), id: 'c' }
    const r = repartirParInitiative([a, b, c], { a: 5, b: 2 })
    expect(r.avantMJ.map((x) => x.id)).toEqual(['a'])
    expect(r.apresMJ.map((x) => x.id)).toEqual(['b'])
    expect(r.enAttente.map((x) => x.id)).toEqual(['c'])
  })

  it('indique à la joueuse que c’est son tour', () => {
    const char = { ...nouveauPerso('trickster'), id: 'a' }
    const combat = { tour: 1, sousGroupeActif: 'avant-mj' as const, initiatives: { a: 5 } }
    expect(estSonTour(char, combat)).toBe(true)
    expect(estSonTour(char, { ...combat, sousGroupeActif: 'mj' })).toBe(false)
  })

  it('propose exactement les deux Actions Alternatives du PDF', () => {
    expect(ACTIONS_ALTERNATIVES.map((a) => a.id)).toEqual(['esquiver', 'diversion'])
  })
})

describe('bestiaire et adversaires', () => {
  const carcasse: ModeleAdversaire = {
    id: 'carcasse',
    nom: 'Carcasse',
    evasion: 1,
    fatigueMax: 6,
    icone: 'spectre',
  }

  it('numérote les homonymes et laisse un nom unique intact', () => {
    const a = instancierAdversaire(carcasse, [], 'a')
    expect(a.nom).toBe('Carcasse')

    const b = instancierAdversaire(carcasse, [a], 'b')
    expect(b.nom).toBe('Carcasse 2')

    const c = instancierAdversaire(carcasse, [a, b], 'c')
    expect(c.nom).toBe('Carcasse 3')
  })

  it('ne réattribue pas le nom d’une créature retirée', () => {
    const a = instancierAdversaire(carcasse, [], 'a')
    const b = instancierAdversaire(carcasse, [a], 'b')
    // « Carcasse » tombe, on en dépose une nouvelle : elle ne doit pas
    // reprendre un nom qui vient d'être libéré, sous peine de confusion.
    const c = instancierAdversaire(carcasse, [b], 'c')
    expect(c.nom).toBe('Carcasse 3')
  })

  it('n’expose jamais le seuil de Fatigue dans le document public', () => {
    const adv = instancierAdversaire(carcasse, [], 'a')
    expect(JSON.stringify(adv)).not.toContain('fatigueMax')
    expect(JSON.stringify(adv)).not.toContain('6')
    expect(adv.evasionPublique).toBe(false)
  })

  it('incrémente l’ordre d’affichage', () => {
    const a = instancierAdversaire(carcasse, [], 'a')
    const b = instancierAdversaire(carcasse, [a], 'b')
    expect(b.ordre).toBeGreaterThan(a.ordre)
  })

  it('cumule les dégâts et détecte la chute au seuil', () => {
    let adv = instancierAdversaire(carcasse, [], 'a')
    adv = appliquerDegats(adv, 4)
    expect(adv.degatsSubis).toBe(4)
    expect(estTombe(adv, 6)).toBe(false)

    adv = appliquerDegats(adv, 2)
    expect(estTombe(adv, 6)).toBe(true)
  })

  it('laisse la MJ juger quand le seuil n’est pas renseigné', () => {
    const adv = appliquerDegats(instancierAdversaire(carcasse, [], 'a'), 99)
    expect(estTombe(adv, 0)).toBe(false)
    expect(estTombe(adv, undefined)).toBe(false)
  })

  it('masque l’Évasion aux joueuses tant qu’elle n’est pas publique', () => {
    const adv = instancierAdversaire(carcasse, [], 'a')
    expect(evasionAffichee(adv, false)).toBe('?')
    expect(evasionAffichee(adv, true)).toBe('1')
    expect(evasionAffichee({ ...adv, evasionPublique: true }, false)).toBe('1')
  })

  it('échappe les caractères spéciaux d’un nom de créature', () => {
    const bizarre: ModeleAdversaire = { ...carcasse, nom: 'Chose (?)' }
    const a = instancierAdversaire(bizarre, [], 'a')
    const b = instancierAdversaire(bizarre, [a], 'b')
    expect(b.nom).toBe('Chose (?) 2')
  })
})

describe('horloge de combat', () => {
  it('numérote les moments sur une seule ligne du temps', () => {
    expect(indexMoment(1, 'avant-mj')).toBe(0)
    expect(indexMoment(1, 'mj')).toBe(1)
    expect(indexMoment(1, 'apres-mj')).toBe(2)
    expect(indexMoment(2, 'avant-mj')).toBe(3)
  })

  it('trouve la prochaine activation, le moment courant compris', () => {
    // On est au moment 2 (tour 1, après-MJ).
    expect(prochaineActivation(2, 'apres-mj')).toBe(2) // c'est déjà son tour
    expect(prochaineActivation(2, 'avant-mj')).toBe(3) // déjà passé : au tour suivant
    expect(prochaineActivation(0, 'apres-mj')).toBe(2) // plus loin dans le même tour
  })
})

describe('Esquiver', () => {
  const combat = (tour: number, sousGroupeActif: SousGroupe): EtatCombat => ({
    tour,
    sousGroupeActif,
    initiatives: {},
  })

  it('ajoute +1 à l’Évasion', () => {
    const char = nouveauPerso('trickster', {
      modifiers: [modificateurEsquive(echeanceEsquive(combat(1, 'apres-mj'), 'apres-mj'))],
    })
    expect(computeEvasion(char, catalog).total).toBe(2)
  })

  /**
   * Une Esquive est défensive : elle doit couvrir le moment de la MJ, sinon
   * elle ne protège de rien. Elle tombe quand la joueuse rejoue.
   */
  it('couvre le tour de la MJ et tombe à la prochaine activation de la joueuse', () => {
    // Joueuse « avant-MJ » qui esquive au tour 1 (moment 0).
    const mods = [modificateurEsquive(echeanceEsquive(combat(1, 'avant-mj'), 'avant-mj'))]

    expect(expireModifiers(mods, { kind: 'moment', moment: indexMoment(1, 'mj') })).toHaveLength(1)
    expect(expireModifiers(mods, { kind: 'moment', moment: indexMoment(1, 'apres-mj') })).toHaveLength(1)
    // Elle rejoue : l'esquive est consommée.
    expect(expireModifiers(mods, { kind: 'moment', moment: indexMoment(2, 'avant-mj') })).toHaveLength(0)
    expect(expireModifiers(mods, { kind: 'fin-combat' })).toHaveLength(0)
  })
})

describe('Faire diversion', () => {
  const combat = (tour: number, sousGroupeActif: SousGroupe): EtatCombat => ({
    tour,
    sousGroupeActif,
    initiatives: {},
  })

  /**
   * Le cas décrit par la MJ : une joueuse « après-MJ » aide une alliée
   * « avant-MJ ». Celle-ci a déjà joué ce tour-ci, donc le bonus est pour son
   * activation du tour suivant — et doit y survivre.
   */
  it('vaut pour le tour suivant quand la bénéficiaire a déjà joué', () => {
    const echeance = echeanceDiversion(combat(1, 'apres-mj'), 'avant-mj')
    const mods = [modificateurDiversion(echeance, 'Ilma')]

    // Le combat passe au tour 2 : la bénéficiaire va jouer, le bonus est là.
    expect(expireModifiers(mods, { kind: 'moment', moment: indexMoment(2, 'avant-mj') })).toHaveLength(1)
    // Elle a joué : le bonus disparaît.
    expect(expireModifiers(mods, { kind: 'moment', moment: indexMoment(2, 'mj') })).toHaveLength(0)
  })

  /**
   * L'autre cas : on aide quelqu'un de son propre sous-groupe. Elle joue dans
   * le même moment que nous, donc le bonus ne vaut que pour ce tour-ci.
   */
  it('ne vaut que pour le tour en cours dans son propre sous-groupe', () => {
    const echeance = echeanceDiversion(combat(1, 'apres-mj'), 'apres-mj')
    const mods = [modificateurDiversion(echeance, 'Ilma')]

    // Toujours actif pendant l'activation en cours.
    expect(expireModifiers(mods, { kind: 'moment', moment: indexMoment(1, 'apres-mj') })).toHaveLength(1)
    // Le combat avance : le bonus n'est pas reporté au tour suivant.
    expect(expireModifiers(mods, { kind: 'moment', moment: indexMoment(2, 'avant-mj') })).toHaveLength(0)
  })

  it('vaut pour ce tour-ci quand la bénéficiaire n’a pas encore joué', () => {
    // Joueuse « avant-MJ » qui aide une alliée « après-MJ » : celle-ci joue
    // plus tard dans le même tour.
    const echeance = echeanceDiversion(combat(1, 'avant-mj'), 'apres-mj')
    const mods = [modificateurDiversion(echeance, 'Ilma')]

    expect(expireModifiers(mods, { kind: 'moment', moment: indexMoment(1, 'apres-mj') })).toHaveLength(1)
    expect(expireModifiers(mods, { kind: 'moment', moment: indexMoment(2, 'avant-mj') })).toHaveLength(0)
  })

  it('donne bien +1 Point d’Énergie à la bénéficiaire', () => {
    const echeance = echeanceDiversion(combat(1, 'avant-mj'), 'apres-mj')
    const char = nouveauPerso('trickster', { modifiers: [modificateurDiversion(echeance, 'Ilma')] })
    expect(computeBonusEnergieAttaque(char, catalog).bonus).toBe(1)
  })
})

describe('Évasion', () => {
  it('vaut 1 de base et monte avec l’armure', () => {
    const nu = nouveauPerso('trickster')
    expect(computeEvasion(nu, catalog).total).toBe(1)

    const blinde = nouveauPerso('trickster', {
      equipe: { arme: null, armure: 'cuirasse-usee', bibelot: null },
    })
    expect(computeEvasion(blinde, catalog).total).toBe(2)
  })
})

// ---------------------------------------------------------------------------

describe('Détachement', () => {
  const equipe = {
    possede: {
      sorts: ['polymorph', 'tame', 'word-baboum', 'word-crackers'],
      equipements: ['lame-simple', 'cuirasse-usee', 'catalyseur', 'rations'],
      ameliorations: ['une-amelioration'],
    },
  }

  it('inclut le sac à dos et exclut le matériel de base et les améliorations', () => {
    const char = nouveauPerso('trickster', equipe)
    const ids = poolDetachement(char, catalog).map((e) => e.id)

    expect(ids).toContain('word-crackers')
    expect(ids).toContain('lame-simple')
    expect(ids).toContain('cuirasse-usee')
    expect(ids).not.toContain('catalyseur')
    expect(ids).not.toContain('rations')
    expect(ids).not.toContain('une-amelioration')
    expect(ids).toHaveLength(6)
  })

  it('retire définitivement l’élément tiré, slots actifs compris', () => {
    const char = nouveauPerso('trickster', {
      ...equipe,
      grimoire: ['polymorph', 'tame', 'word-baboum'],
      equipe: { arme: 'lame-simple', armure: 'cuirasse-usee', bibelot: null },
    })

    const r = effectuerDetachement(char, catalog, seededRng(42))
    expect(r.perdu).not.toBeNull()

    const perduId = r.perdu!.id
    expect(r.char.possede.sorts).not.toContain(perduId)
    expect(r.char.possede.equipements).not.toContain(perduId)
    expect(r.char.grimoire).not.toContain(perduId)
    expect(Object.values(r.char.equipe)).not.toContain(perduId)
  })

  it('ne casse pas sur un personnage sans rien à perdre', () => {
    const char = nouveauPerso('trickster', {
      possede: { sorts: [], equipements: ['rations'], ameliorations: [] },
    })
    expect(effectuerDetachement(char, catalog, seededRng(1)).perdu).toBeNull()
  })
})

describe('grille de Fatigue pleine', () => {
  const secret = { characterId: 'pj-test', cyclesTotal: 3, cyclesConsommes: 0, notesMJ: '' }

  it('consomme un cycle, détache, cicatrise et restaure la Fatigue', () => {
    const char = nouveauPerso('trickster', {
      fatigue: { max: 4, coches: 4 },
      possede: { sorts: ['polymorph', 'tame'], equipements: ['lame-simple'], ameliorations: [] },
    })

    const r = resoudreGrillePleine(char, secret, catalog, seededRng(5))
    expect(r.finDuPersonnage).toBe(false)
    expect(r.secret.cyclesConsommes).toBe(1)
    expect(cyclesRestants(r.secret)).toBe(2)
    expect(r.detachement?.perdu).not.toBeNull()
    expect(r.cicatriceObtenue).toBe(true)
    expect(r.char.cicatrices).toHaveLength(1)
    expect(r.char.fatigue.coches).toBe(0)
  })

  it('achève le personnage au dernier cycle', () => {
    const char = nouveauPerso('trickster', { fatigue: { max: 4, coches: 4 } })
    const dernier = { ...secret, cyclesConsommes: 2 }

    const r = resoudreGrillePleine(char, dernier, catalog, seededRng(5))
    expect(r.finDuPersonnage).toBe(true)
    expect(r.detachement).toBeNull()
    expect(cyclesRestants(r.secret)).toBe(0)
  })
})

// ---------------------------------------------------------------------------

describe('Feu de Camp', () => {
  const use = () =>
    nouveauPerso('dusk-hunter', {
      fatigue: { max: 5, coches: 3 },
      sixthSensUtilises: 1,
      actionsRapidesUtilisees: 2,
      sortsEpuises: ['burst'],
      modifiers: [modificateurSerment('esprit')],
    })

  it('repos court : Fatigue et cristaux, rien d’autre', () => {
    const r = resoudreCampPourPersonnage(use(), { finDeJournee: false })
    expect(r.char.fatigue.coches).toBe(0)
    expect(r.char.sortsEpuises).toHaveLength(0)
    expect(r.char.sixthSensUtilises).toBe(1)
    expect(r.char.actionsRapidesUtilisees).toBe(2)
    expect(r.char.modifiers).toHaveLength(1)
  })

  it('fin de journée : tout est remis à neuf', () => {
    const r = resoudreCampPourPersonnage(use(), { finDeJournee: true })
    expect(r.char.fatigue.coches).toBe(0)
    expect(r.char.sortsEpuises).toHaveLength(0)
    expect(r.char.sixthSensUtilises).toBe(0)
    expect(r.char.actionsRapidesUtilisees).toBe(0)
    expect(r.char.modifiers).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------

describe('effets actifs', () => {
  const vies: VieSoulshifter[] = [
    {
      face: 2,
      nom: 'T-rexcité',
      precisions: { companion: 'Un dinosaure.', element: 'Une liane.', tribue: '+1 Évasion.' },
    },
  ]

  it('regroupe les modificateurs par source et nomme leur origine', () => {
    const char = nouveauPerso('trickster', { modifiers: [modificateurSerment('esprit')] })
    const serment = effetsActifs(char, catalog).find((e) => e.nom === 'Serment')

    expect(serment).toBeDefined()
    expect(serment?.origine).toBe('temporaire')
    expect(serment?.resume).toContain('-4')
    expect(serment?.detail).toContain('feu de camp')
  })

  it('expose Overheat alors qu’il ne produit aucun modificateur', () => {
    // Overheat transforme le *gain* de brûlures : il n'existe aucune
    // statistique à modifier, mais la joueuse doit tout de même le voir.
    const char = nouveauPerso('dusk-hunter', { passifs: { hexcore: 'overheat' } })
    const effet = effetsActifs(char, catalog).find((e) => e.nom === 'Overheat')

    expect(effet).toBeDefined()
    expect(effet?.origine).toBe('choisi')
    expect(effet?.modificateurs).toHaveLength(0)
  })

  it('marque la voie du Trickster comme engagée jusqu’au feu de camp', () => {
    const char = nouveauPerso('trickster', { passifs: { voieTrickster: 'illusionniste' } })
    const effet = effetsActifs(char, catalog).find((e) => e.nom === 'Illusionniste')
    expect(effet?.origine).toBe('feu-de-camp')
  })

  it('attribue la Voie de la Flamme à l’état, pas à un choix', () => {
    const char = nouveauPerso('dusk-hunter', { brulures: 5 })
    const effet = effetsActifs(char, catalog).find((e) => e.nom.startsWith('Voie de la Flamme'))

    expect(effet?.origine).toBe('derive')
    expect(effet?.detail).toContain('5 brûlures')
  })

  it('liste les deux paliers de la Flamme quand ils sont tous deux atteints', () => {
    const char = nouveauPerso('dusk-hunter', { brulures: 8 })
    const flamme = effetsActifs(char, catalog).filter((e) => e.nom.startsWith('Voie de la Flamme'))

    expect(flamme).toHaveLength(2)
    expect(flamme.every((e) => e.detail.includes('se cumulent'))).toBe(true)
  })

  it('décrit la personnalité incarnée par le Soulshifter', () => {
    const char = nouveauPerso('soulshifter', {
      passifs: { viesConnues: [1, 2], vieActive: 2 },
    })
    const effet = effetsActifs(char, catalog, vies).find((e) => e.nom === 'T-rexcité')

    expect(effet?.origine).toBe('choisi')
    expect(effet?.detail).toContain('liane')
  })

  it('donne au dé de vies autant de faces que de vies connues', () => {
    expect(facesDuDeDeVies(nouveauPerso('soulshifter'))).toBe(2)
    expect(facesDuDeDeVies(nouveauPerso('trickster'))).toBe(0)
  })

  it('n’affiche que l’armure portée, pas celle du sac à dos', () => {
    const range = nouveauPerso('trickster', {
      possede: { sorts: [], equipements: ['cuirasse-usee'], ameliorations: [] },
    })
    expect(effetsActifs(range, catalog).some((e) => e.nom === 'Cuirasse usée')).toBe(false)

    const porte = nouveauPerso('trickster', {
      equipe: { arme: null, armure: 'cuirasse-usee', bibelot: null },
    })
    const effet = effetsActifs(porte, catalog).find((e) => e.nom === 'Cuirasse usée')
    expect(effet?.origine).toBe('equipement')
    expect(effet?.resume).toContain('Évasion : +1')
  })
})

describe('tirages', () => {
  it('les osselets ne comptent que les faces marquées', () => {
    const { des, brulures } = tirerOsselets(seededRng(11))
    expect(des).toHaveLength(4)
    expect(brulures).toBe(des.filter((d) => d === 1).length)
    expect(brulures).toBeLessThanOrEqual(4)
  })

  it('la même graine produit la même suite', () => {
    expect(seededRng(9).roll(5, 20)).toEqual(seededRng(9).roll(5, 20))
  })
})
