import { describe, expect, it } from 'vitest'

import { SEED } from '../content/seed.ts'
import {
  acheter,
  entreesAchetables,
  grimoireValide,
  jetonsCampVierges,
  normaliserCampfire,
  peutAcheter,
  peutCouvrirLeFardeau,
  peutInvestir,
  peutPrendreFardeau,
  peutPrendreInvestissement,
  peutPrononcerSerment,
  peutRecueillir,
  phasesDuCamp,
  prixDe,
  resoudreCampPourPersonnage,
  resoudreFardeauFatigue,
  resoudreInvestissements,
  resoudrePriseInvestissement,
  TAILLE_GRIMOIRE,
  tirerOffres,
  type ContexteCamp,
} from './campfire.ts'
import { createCatalog } from './catalog.ts'
import {
  appliquerProfil,
  convertirAncienProfil,
  creerPersonnage,
  cyclesNonRenseignes,
  maitrisesSuiventLeProfil,
  maitrisesVierges,
  normaliserPersonnage,
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
  computeBruluresMax,
  computeEvasion,
  computeFatigueMax,
  computeFoiMax,
  computeMarquesMax,
  computeSixthSens,
  tailleGrimoire,
  tailleInvestissements,
  tailleOffres,
} from './competences.ts'
import {
  effetsActifs,
  facesDuDeDeVies,
  peutTirerUneVie,
  precisionPersonnalite,
  rendreInvocationDeVie,
  vieActive,
} from './effets.ts'
import {
  ajusterFatigue,
  cyclesRestants,
  effectuerDetachement,
  fatigueRestante,
  poolDetachement,
  resoudreGrillePleine,
} from './fatigue.ts'
import {
  appliquerGainBrulures,
  basculerCaseBrulure,
  bruluresDisponibles,
  classesDuSort,
  etatCaseBrulure,
  combustionVolontaire,
  consommerBrulures,
  coutAdditionnel,
  sortOuvertA,
  coutFoiEffectif,
  decrireCoutSort,
  disponibiliteSort,
  estHorsEmplacement,
  grimoireEffectif,
  resoudreArcane,
  sortsHorsEmplacement,
} from './magie.ts'
import {
  derivedModifiers,
  EVASION_DE_BASE,
  expireModifiers,
  MAX_FOI,
  MAX_MARQUES,
  SEUIL_COMBUSTION,
  FOI_DE_DEPART,
  modificateurDiversion,
  modificateurEsquive,
  modificateurFardeau,
  modificateurSerment,
  paliersFlammeAtteints,
} from './modifiers.ts'
import { resoudrePassifs } from './reactions.ts'
import { dissiperEffet, estPoseParUnSort, lancerSort } from './lancement.ts'
import { normaliserCible, type Cible, type CibleHeritee, type CleElement } from './elements.ts'
import {
  DOSSIER_TOUS,
  FILTRES_VIERGES,
  filtrerEntrees,
  poidsCout,
  SANS_DOSSIER,
  type FiltresCatalogue,
} from './filtres.ts'
import {
  branchesPayables,
  COUT_GRATUIT,
  coutAuChoix,
  coutDe,
  decrireCout,
  disponiblePour,
  estGratuit,
  fixe,
  payerCout,
  peutPayer,
  variable,
} from './couts.ts'

/**
 * Une cible telle qu'elle dort en base, écrite avant l'unification des Éléments
 * Variables. Les fixtures qui l'emploient ne sont pas en retard sur le modèle :
 * elles vérifient que `normaliserCible` les relit encore.
 */
const ancienneCible = (c: CibleHeritee): Cible => c as unknown as Cible
import {
  actionScriptee,
  appatDe,
  bat,
  briseFlow,
  etatDuel,
  flowDe,
  issueDuel,
  issueEchange,
  jouerManche,
  MANCHES_MAX,
  OBJECTIF_POINTS,
  perdContre,
} from './duel.ts'
import {
  actifsDe,
  chargesRestantes,
  detailObjet,
  estEpuise,
  peutUtiliser,
  rechargerActif,
  retirerObjet,
  utiliserActif,
} from './objets.ts'
import {
  choixProposes,
  enAttente,
  libelleOption,
  optionCouteuse,
  optionsDe,
  repondre,
  type ContenuNotification,
  type Notification,
} from './notifications.ts'
import { seededRng, tirerEffetAleatoire, tirerOsselets } from './random.ts'
import { ACTIONS_DUEL } from './types.ts'
import type {
  ActionDuel,
  Actif,
  Classe,
  Amelioration,
  Character,
  Competence,
  CoutUsage,
  EntreeCatalogue,
  Equipement,
  EtatCombat,
  Investissement,
  MancheJouee,
  ModeleAdversaire,
  Modifier,
  Passif,
  Sort,
  VieSoulshifter,
} from './types.ts'
import type { Rng } from './random.ts'
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
  /*
   * Passe par `normaliserPersonnage`, comme toute fiche qui entre dans
   * l'application (`surPersonnages`). Les fixtures peuvent ainsi rester à
   * l'ancien format — `passifs: { hexcore: … }`, `voieTrickster` — et servent
   * du même coup de garde-fou à la conversion.
   */
  return normaliserPersonnage({ ...char, ...patch })
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

  /**
   * Les fiches jouées avant le passage à ±3 dorment en base à l'ancienne échelle.
   * La conversion se fait à la lecture, pas par une migration en masse — mais
   * elle ne doit toucher que les fiches restées sur le profil type.
   */
  describe('conversion des maîtrises ±2 → ±3', () => {
    it('remonte une fiche restée à l’ancien profil', () => {
      expect(convertirAncienProfil({ physique: 2, roublardise: 2, esprit: 0, social: -2 })).toEqual({
        physique: 3,
        roublardise: 3,
        esprit: 0,
        social: -3,
      })
    })

    it('laisse intacte une répartition que la MJ a réglée à la main', () => {
      const arbitrage = { physique: 2, roublardise: 1, esprit: 0, social: -2 }
      expect(convertirAncienProfil(arbitrage)).toEqual(arbitrage)
    })

    it('ne retouche pas une fiche déjà à la nouvelle échelle', () => {
      const neuve = appliquerProfil(['physique', 'social'], 'esprit')
      expect(convertirAncienProfil(neuve)).toEqual(neuve)
    })

    it('rend une fiche convertie conforme au profil type', () => {
      const converti = convertirAncienProfil({
        physique: -2,
        roublardise: 2,
        esprit: 2,
        social: 0,
      })
      expect(maitrisesSuiventLeProfil(converti)).toBe(true)
    })

    /** Le chemin réel : une fiche lue en base ressort convertie. */
    it('s’applique à la normalisation d’une fiche', () => {
      const ancienne = nouveauPerso('trickster')
      const relue = normaliserPersonnage({
        ...ancienne,
        maitrises: { physique: 2, roublardise: 2, esprit: 0, social: -2 },
      })
      expect(relue.maitrises).toEqual({ physique: 3, roublardise: 3, esprit: 0, social: -3 })
    })
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

  it('survit à un repos court mais tombe au camp initial', () => {
    const char = nouveauPerso('trickster', { modifiers: [modificateurSerment('esprit')] })

    const court = resoudreCampPourPersonnage(char, 'repos-court')
    expect(court.char.modifiers).toHaveLength(1)

    const initial = resoudreCampPourPersonnage(char, 'initial')
    expect(initial.char.modifiers).toHaveLength(0)
  })

  // Les Serments écrits avant la refonte portent `fin-de-journee`. Sans le cas
  // hérité, aucun `case` ne les reconnaîtrait et le `filter` les effacerait
  // dès le premier repos court venu.
  it('reconnaît encore les modificateurs écrits sous l’ancien nom d’échéance', () => {
    const ancien = { ...modificateurSerment('esprit'), expires: { kind: 'fin-de-journee' } as const }
    const char = nouveauPerso('trickster', { modifiers: [ancien] })

    expect(resoudreCampPourPersonnage(char, 'repos-court').char.modifiers).toHaveLength(1)
    expect(resoudreCampPourPersonnage(char, 'initial').char.modifiers).toHaveLength(0)
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
  it('vaut 2 avec un Physique à +3, 1 sinon', () => {
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
    // Le palier hausse le **plafond** de 6th Sens, pas sa valeur courante :
    // s'y tromper ferait taire le bonus sans que rien ne le signale.
    expect(
      derivedModifiers(chaud, catalog).some(
        (m) => m.target.element.kind === 'sixth-sens' && m.target.aspect === 'plafond',
      ),
    ).toBe(true)
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
  /**
   * Règle corrigée avec la MJ : une brûlure dépensée **ne disparaît pas**, elle
   * devient inactive. C'est la neuvième *consommée* qui brûle, pas la neuvième
   * acquise — accumuler neuf marques sans en dépenser aucune ne coûte rien.
   */
  it('gagner des brûlures ne déclenche jamais la Combustion', () => {
    const char = nouveauPerso('soulshifter', { brulures: 7 })
    const r = appliquerGainBrulures(char, 3)
    expect(r.brulures).toBe(9)
  })

  it('plafonne les acquises à 9 et perd le surplus', () => {
    const r = appliquerGainBrulures(nouveauPerso('soulshifter', { brulures: 8 }), 4)
    expect(r.brulures).toBe(9)
  })

  it('consommer la neuvième prend 1 Fatigue et efface les marques', () => {
    const char = nouveauPerso('soulshifter', { brulures: 9, bruluresConsommees: 7 })
    const r = consommerBrulures(char, 2)
    expect(r.combustion).toBe(true)
    expect(r.fatigueAjoutee).toBe(1)
    expect(r.brulures).toBe(0)
    expect(r.bruluresConsommees).toBe(0)
  })

  it('consommer sans atteindre le seuil garde les marques acquises', () => {
    const char = nouveauPerso('soulshifter', { brulures: 6, bruluresConsommees: 1 })
    const r = consommerBrulures(char, 2)
    expect(r.combustion).toBe(false)
    expect(r.brulures).toBe(6)
    expect(r.bruluresConsommees).toBe(3)
  })

  it('ne laisse pas dépenser plus que le disponible', () => {
    const char = nouveauPerso('soulshifter', { brulures: 5, bruluresConsommees: 3 })
    expect(bruluresDisponibles(char)).toBe(2)
    expect(() => consommerBrulures(char, 3)).toThrow(/disponibles/)
  })

  /**
   * Le passif se lit sur les marques **acquises** : la brûlure est physiquement
   * là même dépensée, donc la Voie de la Flamme tient.
   */
  it('garde les paliers de la Voie de la Flamme après avoir tout dépensé', () => {
    const char = nouveauPerso('soulshifter', { brulures: 8, bruluresConsommees: 8 })
    expect(bruluresDisponibles(char)).toBe(0)
    expect(paliersFlammeAtteints(char.brulures).map((p) => p.id)).toEqual(['perception', 'fureur'])
  })

  /**
   * La barre de brûlures se pilote case par case : un clic marque la brûlure
   * acquise, un deuxième la marque dépensée, un troisième l'efface.
   */
  it('fait tourner une case : vierge, disponible, consommée, vierge', () => {
    const vide = nouveauPerso('soulshifter', { brulures: 0, bruluresConsommees: 0 })
    expect(etatCaseBrulure(vide, 0)).toBe('vierge')

    const apresUn = { ...vide, ...basculerCaseBrulure(vide, 0) }
    expect(apresUn.brulures).toBe(1)
    expect(etatCaseBrulure(apresUn, 0)).toBe('disponible')

    const apresDeux = { ...apresUn, ...basculerCaseBrulure(apresUn, 0) }
    expect(apresDeux.bruluresConsommees).toBe(1)
    expect(etatCaseBrulure(apresDeux, 0)).toBe('consommee')

    const apresTrois = { ...apresDeux, ...basculerCaseBrulure(apresDeux, 0) }
    expect(apresTrois.brulures).toBe(0)
    expect(apresTrois.bruluresConsommees).toBe(0)
    expect(etatCaseBrulure(apresTrois, 0)).toBe('vierge')
  })

  it('cliquer une case vierge remplit jusqu’à elle', () => {
    const vide = nouveauPerso('soulshifter', { brulures: 0, bruluresConsommees: 0 })
    expect(basculerCaseBrulure(vide, 4).brulures).toBe(5)
  })

  it('consommer la neuvième case déclenche la Combustion', () => {
    const char = nouveauPerso('soulshifter', { brulures: 9, bruluresConsommees: 8 })
    const r = basculerCaseBrulure(char, 8)
    expect(r.combustion).toBe(true)
    expect(r.fatigueAjoutee).toBe(1)
    expect(r.brulures).toBe(0)
  })

  it('effacer une case efface aussi celles qui la suivent', () => {
    // Les deux compteurs sont des préfixes : une barre trouée n'aurait pas de sens.
    const char = nouveauPerso('soulshifter', { brulures: 6, bruluresConsommees: 4 })
    const r = basculerCaseBrulure(char, 1)
    expect(r.brulures).toBe(1)
    expect(r.bruluresConsommees).toBe(1)
  })

  it('volontaire : paie 1 Fatigue et rend les 9 brûlures dépensables', () => {
    const r = combustionVolontaire()
    expect(r.brulures).toBe(9)
    expect(r.bruluresConsommees).toBe(0)
    expect(r.fatigueAjoutee).toBe(1)
  })

  it('Overheat transforme un gain de 2 en 3', () => {
    const dusk = nouveauPerso('dusk-hunter', { brulures: 0, passifs: { hexcore: 'overheat' } })
    expect(appliquerGainBrulures(dusk, 2).gainEffectif).toBe(3)

    const overdrive = nouveauPerso('dusk-hunter', { brulures: 0, passifs: { hexcore: 'overdrive' } })
    expect(appliquerGainBrulures(overdrive, 2).gainEffectif).toBe(2)
  })

  /**
   * Overheat ajoute 1 au **total** d'un jet d'osselets, pas 1 par dé marqué :
   * « à chaque fois qu'une source devrait générer X brûlures, elle en génère
   * X+1 ». Un jet est une source, pas quatre.
   */
  it('n’ajoute qu’une brûlure au total d’un jet d’osselets, pas une par dé', () => {
    const dusk = nouveauPerso('dusk-hunter', { brulures: 0, passifs: { hexcore: 'overheat' } })
    // Un jet 1·2·3·4 vaut 3 brûlures brutes.
    expect(appliquerGainBrulures(dusk, 3).gainEffectif).toBe(4)
  })

  it('ne transforme pas un gain nul', () => {
    const dusk = nouveauPerso('dusk-hunter', { brulures: 0, passifs: { hexcore: 'overheat' } })
    // Quatre 4 : aucune source de brûlure, donc rien à majorer.
    expect(appliquerGainBrulures(dusk, 0).gainEffectif).toBe(0)
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

  /**
   * Les deux anciennes raisons — `foi-insuffisante`, `brulures-insuffisantes` —
   * ont fusionné en `cout-impayable` : avec un coût qui admet un « OU », ce
   * n'est plus telle monnaie qui manque, mais toutes les façons de payer qui
   * sont fermées.
   */
  it('refuse un Miracle sans assez de Foi', () => {
    const first = catalog.sort('first-aid') as Sort
    const demunie = nouveauPerso('dusk-hunter', { foi: 1, grimoire: ['first-aid'] })
    expect(disponibiliteSort(first, demunie, catalog).raisons).toContain('cout-impayable')

    const riche = nouveauPerso('dusk-hunter', { foi: 3, grimoire: ['first-aid'] })
    expect(disponibiliteSort(first, riche, catalog).disponible).toBe(true)
  })

  it('refuse un sort de Sang dont les brûlures ont déjà été dépensées', () => {
    const heat = catalog.sort('heat-track') as Sort
    // Neuf marques sur la peau, mais toutes consommées : rien à dépenser.
    const vidée = nouveauPerso('dusk-hunter', {
      grimoire: ['heat-track'],
      brulures: 9,
      bruluresConsommees: 9,
    })
    expect(disponibiliteSort(heat, vidée, catalog).raisons).toContain('cout-impayable')

    const marquee = nouveauPerso('dusk-hunter', {
      grimoire: ['heat-track'],
      brulures: 2,
      bruluresConsommees: 1,
    })
    expect(disponibiliteSort(heat, marquee, catalog).disponible).toBe(true)
  })
})

// ---------------------------------------------------------------------------

describe('lancer un sort', () => {
  /** Un sort à effet concret : « 2 Foi OU 10 Lumens », +2 en Physique. */
  const benediction: Sort = {
    kind: 'sort',
    id: 'benediction',
    nom: 'Bénédiction',
    icone: 'healing',
    magieId: 'miracle',
    cout: coutAuChoix([fixe('foi', 2)], [fixe('lumens', 10)]),
    de: null,
    duree: '1 heure',
    effet: 'La Lumière vous porte.',
    actifs: [
      {
        id: 'principal',
        nom: 'Bénédiction',
        table: {
          faces: 1,
          entrees: [
            {
              texte: 'La Lumière vous porte.',
              operations: [
                {
                  kind: 'ajuster',
                  cible: { element: { kind: 'competence', competence: 'physique' }, aspect: 'valeur' },
                  op: { kind: 'add', value: 2 },
                },
              ],
            },
          ],
        },
      },
    ],
  }

  const avecSort = createCatalog([...SEED, benediction])
  const lanceuse = (patch: Partial<Character> = {}) =>
    nouveauPerso('trickster', { grimoire: [benediction.id], ...patch })

  it('débite la branche de coût choisie, et elle seule', () => {
    const char = lanceuse({ foi: 5, lumens: 40 })

    const parFoi = lancerSort(char, avecSort, { sortId: benediction.id, brancheCout: 0 }, seededRng(1))
    expect(parFoi.char.foi).toBe(3)
    expect(parFoi.char.lumens).toBe(40)

    const parLumens = lancerSort(char, avecSort, { sortId: benediction.id, brancheCout: 1 }, seededRng(1))
    expect(parLumens.char.lumens).toBe(30)
    expect(parLumens.char.foi).toBe(5)
  })

  it('pose l’effet concret comme un modificateur, dissipable à la main', () => {
    const char = lanceuse({ foi: 5 })
    const r = lancerSort(char, avecSort, { sortId: benediction.id }, seededRng(1))

    expect(computeCompetence(r.char, avecSort, 'physique').bonus).toBe(2)
    expect(r.effets.join(' ')).toContain('La Lumière vous porte.')

    /*
     * Sans horloge de fiction, l'effet ne peut pas expirer seul : c'est la
     * joueuse qui déclare que l'heure est passée.
     */
    const pose = r.char.modifiers.find(estPoseParUnSort)
    expect(pose).toBeTruthy()
    const apres = dissiperEffet(r.char, (pose as Modifier).id)
    expect(computeCompetence(apres, avecSort, 'physique').bonus).toBe(0)
  })

  it('refuse un sort que la joueuse ne peut pas payer', () => {
    const demunie = lanceuse({ foi: 0, lumens: 0 })
    expect(() => lancerSort(demunie, avecSort, { sortId: benediction.id }, seededRng(1))).toThrow()
  })

  it('refuse un sort absent du Grimoire', () => {
    const distraite = nouveauPerso('trickster', { grimoire: [], foi: 5 })
    expect(() => lancerSort(distraite, avecSort, { sortId: benediction.id }, seededRng(1))).toThrow()
  })

  /** Le « X » : la joueuse choisit ce qu'elle dépense, et l'effet en dépend. */
  it('prélève le X choisi, borné par la part', () => {
    const sundown = catalog.sort('sundown') as Sort
    const char = nouveauPerso('dusk-hunter', { grimoire: [sundown.id], marques: 3 })

    expect(lancerSort(char, catalog, { sortId: sundown.id, x: 2 }, seededRng(1)).char.marques).toBe(1)
    // Le maximum déclaré fait loi, même si la joueuse en demande plus.
    expect(lancerSort(char, catalog, { sortId: sundown.id, x: 9 }, seededRng(1)).char.marques).toBe(0)
  })

  it('lance le dé du sort quand il en porte un', () => {
    const polymorph = catalog.sort('polymorph') as Sort
    const char = nouveauPerso('trickster', { grimoire: [polymorph.id] })

    const r = lancerSort(char, catalog, { sortId: polymorph.id }, seededRng(3))
    expect(r.de).toBeGreaterThanOrEqual(1)
    expect(r.de).toBeLessThanOrEqual(6)
  })

  it('raconte la Combustion quand le coût en brûlures la provoque', () => {
    const heat = catalog.sort('heat-track') as Sort
    const alaLimite = nouveauPerso('dusk-hunter', {
      grimoire: [heat.id],
      brulures: 9,
      bruluresConsommees: 8,
    })

    const r = lancerSort(alaLimite, catalog, { sortId: heat.id }, seededRng(1))
    expect(r.recits.join(' ')).toContain('Combustion')
    expect(r.char.fatigue.coches).toBe(1)
  })
})

// ---------------------------------------------------------------------------

/**
 * Trois comptes qui étaient des constantes. Les rendre dérivés, c'est permettre
 * à la MJ d'écrire « cette amélioration donne un emplacement de Grimoire de
 * plus » sans toucher au code.
 */
/**
 * Une classe composée **entièrement en données**, comme la MJ en écrira depuis
 * l'onglet Création. C'était le dernier trou du modèle : rien ne permettait
 * jusqu'ici de créer une classe sans toucher au code.
 */
describe('classe composée en données', () => {
  const arpenteuse: Classe = {
    kind: 'classe',
    id: 'arpenteuse',
    nom: 'Arpenteuse',
    icone: 'crystal-shine',
    fatigueMax: 4,
    sixthSensBase: 1,
    lore: 'Elle marche les lisières.',
    passifTexte: 'Choisit sa démarche.',
    sortsIds: ['polymorph'],
    choix: [
      {
        id: 'demarche',
        libelle: 'Démarche',
        verrou: 'libre',
        options: [
          {
            id: 'silencieuse',
            nom: 'Silencieuse',
            effet: 'Avantage en Roublardise',
            passifs: [
              {
                id: 'silence',
                libelle: 'Silencieuse',
                declenchement: { kind: 'permanent' },
                effet: {
                  texte: '',
                  operations: [
                    {
                      kind: 'ajuster',
                      cible: {
                        element: { kind: 'competence', competence: 'roublardise' },
                        aspect: 'valeur',
                      },
                      op: { kind: 'avantage' },
                    },
                  ],
                },
              },
            ],
          },
          {
            id: 'assuree',
            nom: 'Assurée',
            effet: '+1 Évasion',
            passifs: [
              {
                id: 'assurance',
                libelle: 'Assurée',
                declenchement: { kind: 'permanent' },
                effet: {
                  texte: '',
                  operations: [
                    {
                      kind: 'ajuster',
                      cible: { element: { kind: 'evasion' }, aspect: 'valeur' },
                      op: { kind: 'add', value: 1 },
                    },
                  ],
                },
              },
            ],
          },
        ],
      },
    ],
  }

  const avecClasse = createCatalog([...SEED, arpenteuse])

  const arpenteur = (option?: string) =>
    normaliserPersonnage({
      ...creerPersonnage(
        { id: 'p', nom: 'Nael', classeId: 'arpenteuse', maitrises: maitrisesVierges() },
        avecClasse,
        0,
      ),
      ...(option ? { passifs: { choix: { demarche: option } } } : {}),
    } as Character)

  it('se crée sans passifMoteur, et fournit ses sorts', () => {
    const char = arpenteur()
    expect(char.fatigue.max).toBe(4)
    expect(char.sixthSensBase).toBe(1)
    expect(char.possede.sorts).toEqual(['polymorph'])
    expect(char.grimoire).toEqual(['polymorph'])
    // Sans `passifMoteur` ni choix retenu, aucun passif de classe ne s'applique.
    expect(char.passifs.choix).toEqual({})
  })

  it('accorde le passif de l’option retenue, et elle seule', () => {
    const silencieuse = arpenteur('silencieuse')
    expect(computeCompetence(silencieuse, avecClasse, 'roublardise').net).toBe('avantage')
    expect(computeEvasion(silencieuse, avecClasse).total).toBe(EVASION_DE_BASE)

    const assuree = arpenteur('assuree')
    expect(computeEvasion(assuree, avecClasse).total).toBe(EVASION_DE_BASE + 1)
    expect(computeCompetence(assuree, avecClasse, 'roublardise').net).toBe('neutre')
  })

  /**
   * Le repli sur la première option serait tentant, mais l'ordre de la liste
   * est un détail de rédaction : s'y fier accorderait un passif que personne
   * n'a choisi.
   */
  it('n’accorde rien tant qu’aucune option n’est retenue', () => {
    const indecise = arpenteur()
    expect(computeEvasion(indecise, avecClasse).total).toBe(EVASION_DE_BASE)
    expect(computeCompetence(indecise, avecClasse, 'roublardise').net).toBe('neutre')
  })
})

// ---------------------------------------------------------------------------

describe('emplacements dérivés', () => {
  const ameliorationQuiAjoute = (element: CleElement, id: string): Amelioration => ({
    kind: 'amelioration',
    id,
    nom: `Don — ${id}`,
    icone: 'crystal-shine',
    prix: 100,
    effetTexte: 'Un emplacement de plus.',
    passifs: [
      {
        id: 'slot',
        libelle: '',
        declenchement: { kind: 'permanent' },
        effet: {
          texte: '',
          operations: [
            {
              kind: 'ajuster',
              cible: { element: { kind: element } as never, aspect: 'valeur' },
              op: { kind: 'add', value: 1 },
            },
          ],
        },
      },
    ],
  })

  const avec = (element: CleElement, id: string) => {
    const am = ameliorationQuiAjoute(element, id)
    const catalogue = createCatalog([...SEED, am])
    const char = nouveauPerso('trickster', {
      possede: { sorts: [], equipements: [], ameliorations: [am.id] },
    })
    return { catalogue, char }
  }

  it('part des bases quand rien ne les modifie', () => {
    const nu = nouveauPerso('trickster')
    expect(tailleGrimoire(nu, catalog)).toBe(TAILLE_GRIMOIRE)
    expect(tailleOffres(nu, catalog)).toBe(3)
    expect(tailleInvestissements(nu, catalog)).toBe(3)
  })

  it('suit un passif qui accorde un emplacement de Grimoire', () => {
    const { catalogue, char } = avec('slots-grimoire', 'grimoire-plus')
    expect(tailleGrimoire(char, catalogue)).toBe(TAILLE_GRIMOIRE + 1)
    // Et la validation suit : un quatrième sort devient acceptable.
    expect(grimoireValide(['a', 'b', 'c', 'd'], char, catalogue)).toBe(true)
  })

  it('suit un passif qui accorde une offre en boutique', () => {
    const am = ameliorationQuiAjoute('slots-boutique', 'boutique-plus')

    // De quoi remplir la boutique : le catalogue livré ne compte que trois
    // entrées à vendre, ce qui bornerait le tirage avant le passif.
    const bibelots = Array.from({ length: 6 }, (_, i) => ({
      kind: 'equipement' as const,
      id: `bibelot-${i}`,
      nom: `Bibelot ${i}`,
      icone: 'crystal-shine',
      slot: 'bibelot' as const,
      prix: 10,
    }))

    const catalogue = createCatalog([...SEED, am, ...bibelots])
    const char = nouveauPerso('trickster', {
      possede: { sorts: [], equipements: [], ameliorations: [am.id] },
    })

    expect(tailleOffres(char, catalogue)).toBe(4)
    // `tirerOffres` en tire d'autant plus, sans qu'on ait à lui dire combien.
    expect(tirerOffres(char, catalogue, seededRng(1)).length).toBe(4)

    // Sans le passif, la même boutique n'en propose que trois.
    const sansPassif = nouveauPerso('trickster')
    expect(tirerOffres(sansPassif, catalogue, seededRng(1)).length).toBe(3)
  })

  /**
   * Le plancher porte une règle : un Grimoire sans emplacement rendrait tout
   * sort inlançable, ce qu'aucun contenu ne devrait pouvoir provoquer.
   */
  it('garde au moins un emplacement de Grimoire', () => {
    const punitif: Amelioration = {
      kind: 'amelioration',
      id: 'grimoire-moins',
      nom: 'Mémoire trouée',
      icone: 'crystal-shine',
      prix: 0,
      effetTexte: 'Neuf emplacements en moins — bien plus qu’il n’en existe.',
      passifs: [
        {
          id: 'slot',
          libelle: '',
          declenchement: { kind: 'permanent' },
          effet: {
            texte: '',
            operations: [
              {
                kind: 'ajuster',
                cible: { element: { kind: 'slots-grimoire' }, aspect: 'valeur' },
                op: { kind: 'add', value: -9 },
              },
            ],
          },
        },
      ],
    }
    const catalogue = createCatalog([...SEED, punitif])
    const char = nouveauPerso('trickster', {
      possede: { sorts: [], equipements: [], ameliorations: [punitif.id] },
    })
    expect(tailleGrimoire(char, catalogue)).toBe(1)
  })
})

// ---------------------------------------------------------------------------

describe('filtres du catalogue', () => {
  const entree = (patch: Partial<Equipement> & { id: string; nom: string }): Equipement => ({
    kind: 'equipement',
    icone: 'crystal-shine',
    slot: 'arme',
    ...patch,
  })

  const lot: Equipement[] = [
    entree({ id: 'a', nom: 'Épée courte', rarete: 'commun', prix: 30, creeLe: 300, slot: 'arme' }),
    entree({ id: 'b', nom: 'Cuirasse', rarete: 'rare', prix: 10, creeLe: 100, slot: 'armure', dossierId: 'd1' }),
    entree({ id: 'c', nom: 'Amulette', rarete: 'legendaire', creeLe: 200, slot: 'bibelot', dossierId: 'd1' }),
  ]

  const avec = (patch: Partial<FiltresCatalogue>) => filtrerEntrees(lot, { ...FILTRES_VIERGES, ...patch })
  const ids = (r: EntreeCatalogue[]) => r.map((e) => e.id)

  it('cherche sans se soucier des accents ni de la casse', () => {
    // « epee » doit trouver « Épée » : sans cela le filtre serait inutilisable
    // en français à une main, sur téléphone.
    expect(ids(avec({ texte: 'epee' }))).toEqual(['a'])
    expect(ids(avec({ texte: 'ÉPÉE' }))).toEqual(['a'])
    expect(ids(avec({ texte: 'zzz' }))).toEqual([])
  })

  it('filtre par dossier, et sait isoler ce qui n’est rangé nulle part', () => {
    expect(ids(avec({ dossierId: 'd1' })).sort()).toEqual(['b', 'c'])
    expect(ids(avec({ dossierId: SANS_DOSSIER }))).toEqual(['a'])
    // « Tous » n'est pas un dossier : c'est l'absence de filtre.
    expect(ids(avec({ dossierId: DOSSIER_TOUS })).length).toBe(3)
  })

  /**
   * ⚠️ **Un dossier est polyvalent.** Il portait d'abord une `cible` qui le
   * limitait à une famille — une erreur de lecture : un dossier de table est
   * thématique (« Poisons »), et mêle naturellement les trois.
   */
  it('range dans un même dossier un sort, une amélioration et un équipement', () => {
    const melange: EntreeCatalogue[] = [
      {
        kind: 'sort',
        id: 's',
        nom: 'Venin',
        icone: 'crystal-shine',
        magieId: 'arcane',
        cout: COUT_GRATUIT,
        de: null,
        duree: 'Instantané',
        effet: '',
        dossierId: 'poisons',
      },
      {
        kind: 'amelioration',
        id: 'a',
        nom: 'Accoutumance',
        icone: 'crystal-shine',
        prix: 60,
        effetTexte: '',
        dossierId: 'poisons',
      },
      entree({ id: 'e', nom: 'Fiole', dossierId: 'poisons' }),
      entree({ id: 'hors', nom: 'Épée' }),
    ]

    const dansLeDossier = filtrerEntrees(melange, { ...FILTRES_VIERGES, dossierId: 'poisons' })
    expect(dansLeDossier.map((e) => e.kind).sort()).toEqual([
      'amelioration',
      'equipement',
      'sort',
    ])
  })

  it('retire la cible d’un dossier écrit à l’ancien format', () => {
    // Le champ limitait le dossier à une famille. Le laisser mourir en base ne
    // suffisait pas : le formulaire l'aurait recopié à chaque enregistrement.
    const ancien = {
      kind: 'dossier',
      id: 'poisons',
      nom: 'Poisons',
      icone: 'crystal-shine',
      ordre: 0,
      cible: 'equipement',
    } as unknown as EntreeCatalogue

    const converti = createCatalog([...SEED, ancien]).dossier('poisons')
    expect(converti).toBeTruthy()
    expect('cible' in (converti as object)).toBe(false)
  })

  it('filtre par rareté, l’absence valant « commun »', () => {
    expect(ids(avec({ rarete: 'commun' }))).toEqual(['a'])
    expect(ids(avec({ rarete: 'legendaire' }))).toEqual(['c'])
  })

  it('filtre par emplacement', () => {
    expect(ids(avec({ slot: 'armure' }))).toEqual(['b'])
  })

  it('combine les axes', () => {
    expect(ids(avec({ dossierId: 'd1', rarete: 'rare' }))).toEqual(['b'])
    expect(ids(avec({ dossierId: 'd1', rarete: 'commun' }))).toEqual([])
  })

  it('trie par nom, rareté, prix et date de création', () => {
    expect(ids(avec({ tri: 'nom' }))).toEqual(['c', 'b', 'a'])
    expect(ids(avec({ tri: 'rarete' }))).toEqual(['a', 'b', 'c'])
    // Sans prix = hors boutique : rangé en fin de liste, jamais confondu
    // avec un objet gratuit.
    expect(ids(avec({ tri: 'prix' }))).toEqual(['b', 'a', 'c'])
    expect(ids(avec({ tri: 'creation' }))).toEqual(['b', 'c', 'a'])
    expect(ids(avec({ tri: 'creation', ordre: 'desc' }))).toEqual(['a', 'c', 'b'])
  })

  /**
   * Sans ce départage, l'ordre serait celui — imprévisible — des documents
   * Firestore, et la liste changerait d'aspect d'un rendu à l'autre.
   */
  it('départage par le nom quand l’axe de tri ne tranche pas', () => {
    const exaequo = [
      entree({ id: 'z', nom: 'Zeste' }),
      entree({ id: 'y', nom: 'Abricot' }),
    ]
    expect(
      filtrerEntrees(exaequo, { ...FILTRES_VIERGES, tri: 'rarete' }).map((e) => e.id),
    ).toEqual(['y', 'z'])
  })

  it('pèse un coût sur sa branche la moins chère, le X ne comptant pas', () => {
    expect(poidsCout(COUT_GRATUIT)).toBe(0)
    expect(poidsCout(coutDe(fixe('foi', 3)))).toBe(3)
    expect(poidsCout(coutAuChoix([fixe('foi', 2)], [fixe('lumens', 10)]))).toBe(2)
    // Le X est choisi au lancement : le prétendre connu tromperait le tri.
    expect(poidsCout(coutDe(variable('brulures', { min: 1 })))).toBe(0)
  })
})

// ---------------------------------------------------------------------------

describe('coûts', () => {
  const nu = () => nouveauPerso('dusk-hunter', { foi: 2, lumens: 40, marques: 0 })

  it('est gratuit quand il n’a aucune branche', () => {
    expect(peutPayer(nu(), catalog, COUT_GRATUIT)).toBe(true)
    expect(decrireCout(COUT_GRATUIT)).toBe('sans coût')
    expect(payerCout(nu(), catalog, COUT_GRATUIT).char).toEqual(nu())
  })

  /**
   * Le « OU » est ce que l'ancien modèle ne savait pas dire. Une seule branche
   * suffit à rendre le coût payable, et c'est celle qu'on choisit qui est
   * prélevée — les autres restent intactes.
   */
  it('accepte « 2 Foi OU 10 Lumens » et ne prélève que la branche choisie', () => {
    const cout = coutAuChoix([fixe('foi', 2)], [fixe('lumens', 10)])
    expect(decrireCout(cout)).toBe('2 Foi ou 10 Lumens')

    const desargentee = nouveauPerso('dusk-hunter', { foi: 2, lumens: 0 })
    expect(branchesPayables(desargentee, catalog, cout)).toEqual([0])

    const impie = nouveauPerso('dusk-hunter', { foi: 0, lumens: 40 })
    expect(branchesPayables(impie, catalog, cout)).toEqual([1])

    const aisee = nu()
    expect(branchesPayables(aisee, catalog, cout)).toEqual([0, 1])

    const parLesLumens = payerCout(aisee, catalog, cout, { branche: 1 }).char
    expect(parLesLumens.lumens).toBe(30)
    expect(parLesLumens.foi).toBe(2)
  })

  it('refuse le coût quand aucune branche n’est payable', () => {
    const cout = coutAuChoix([fixe('foi', 9)], [fixe('lumens', 999)])
    expect(peutPayer(nu(), catalog, cout)).toBe(false)
    expect(() => payerCout(nu(), catalog, cout)).toThrow()
  })

  it('paie toutes les parts d’une même branche', () => {
    const cout = coutDe(fixe('foi', 1), fixe('lumens', 5))
    const apres = payerCout(nu(), catalog, cout).char
    expect(apres.foi).toBe(1)
    expect(apres.lumens).toBe(35)
  })

  it('borne le X aux limites déclarées', () => {
    const cout = coutDe(variable('marques', { max: 3 }))
    const char = nouveauPerso('dusk-hunter', { marques: 3 })

    expect(decrireCout(cout)).toBe('X Marques (max 3)')
    // Demander 5 ne prélève que 3 : le maximum fait loi.
    expect(payerCout(char, catalog, cout, { branche: 0, x: 5 }).char.marques).toBe(0)
    expect(payerCout(char, catalog, cout, { branche: 0, x: 2 }).char.marques).toBe(1)
  })

  /**
   * ⚠️ La Fatigue a une polarité inversée : la payer, c'est **cocher** une
   * case, donc faire monter la jauge. Ce qui reste disponible est ce qui n'est
   * pas coché, pas la valeur lue.
   */
  it('coche une case quand le coût se paie en Fatigue', () => {
    const char = nouveauPerso('dusk-hunter') // 5 cases, aucune cochée
    expect(disponiblePour(char, catalog, { kind: 'fatigue' })).toBe(5)

    const apres = payerCout(char, catalog, coutDe(fixe('fatigue', 2))).char
    expect(apres.fatigue.coches).toBe(2)
    expect(disponiblePour(apres, catalog, { kind: 'fatigue' })).toBe(3)

    // Grille pleine : on ne peut plus rien encaisser.
    const epuisee = nouveauPerso('dusk-hunter', { fatigue: { max: 5, coches: 5 } })
    expect(peutPayer(epuisee, catalog, coutDe(fixe('fatigue', 1)))).toBe(false)
  })

  /**
   * ⚠️ Les brûlures se paient sur la part **non consommée**, pas sur le total
   * acquis : une marque déjà dépensée ne paie pas un second sort.
   */
  it('paie les brûlures sur ce qui reste dépensable, et brûle à la neuvième', () => {
    const marquee = nouveauPerso('dusk-hunter', { brulures: 3, bruluresConsommees: 2 })
    expect(disponiblePour(marquee, catalog, { kind: 'brulures' })).toBe(1)
    expect(peutPayer(marquee, catalog, coutDe(fixe('brulures', 2)))).toBe(false)

    const alaLimite = nouveauPerso('dusk-hunter', { brulures: 9, bruluresConsommees: 8 })
    const r = payerCout(alaLimite, catalog, coutDe(fixe('brulures', 1)))
    expect(r.char.brulures).toBe(0)
    expect(r.char.bruluresConsommees).toBe(0)
    expect(r.char.fatigue.coches).toBe(1)
    expect(r.recits.join(' ')).toContain('Combustion')
  })

  /**
   * Une part narrative n'est pas prélevée — le moteur ne prétend pas savoir la
   * appliquer — mais elle ne bloque rien non plus : c'est la MJ qui arbitre.
   */
  it('affiche une contrepartie narrative sans la prélever', () => {
    const cout = coutDe({ kind: 'narratif', description: 'Une Marque toutes les 3 utilisations' })
    expect(peutPayer(nu(), catalog, cout)).toBe(true)
    expect(payerCout(nu(), catalog, cout).char).toEqual(nu())
    expect(decrireCout(cout)).toContain('Une Marque toutes les 3 utilisations')
  })

  /**
   * Le passif Conteur du Trickster réduit le coût en Foi des sorts « Word: ».
   * C'est le même agrégat qu'avant l'unification, appliqué par part — et le
   * filtre porte désormais l'élément, si bien qu'un rabais sur la Foi ne touche
   * pas un coût en brûlures.
   */
  it('applique les modificateurs de coût sur la part visée, et sur elle seule', () => {
    const conteur = nouveauPerso('trickster', {
      foi: 5,
      passifs: { voieTrickster: 'conteur' },
    })
    const word = catalog.sort('word-crackers') as Sort
    expect(decrireCoutSort(word, conteur, catalog)).toBe('1 Foi')

    const sansPassif = nouveauPerso('trickster', { foi: 5 })
    expect(decrireCoutSort(word, sansPassif, catalog)).toBe('2 Foi')
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
   * Régression vécue à table : les illusions n'apparaissaient nulle part.
   *
   * Elles sont désormais dérivées du passif et non de l'inventaire, ce qui
   * les rend visibles pour un personnage **déjà créé** — cas qui bloquait,
   * puisqu'un correctif à la création ne l'aurait jamais atteint.
   */
  it('donne accès aux illusions sans les faire posséder', () => {
    const neuf = nouveauPerso('trickster')

    // Elles ne sont pas des biens : ni à l'inventaire, ni dans les 3 slots.
    expect(neuf.possede.sorts).not.toContain('ya-gat-fooled')
    expect(neuf.grimoire).toHaveLength(TAILLE_GRIMOIRE)

    const permanents = grimoireEffectif(neuf, catalog)
      .filter((e) => e.horsEmplacement)
      .map((e) => e.sort.id)
      .sort()
    expect(permanents).toEqual(['mage-hand', 'ya-gat-fooled'])
  })

  it('les affiche pour un personnage créé avant l’ajout du passif', () => {
    // Fiche telle qu'elle existe déjà en base : aucune illusion à l'inventaire.
    const ancien = nouveauPerso('trickster', {
      possede: { sorts: ['polymorph', 'tame', 'word-baboum'], equipements: [], ameliorations: [] },
      grimoire: ['polymorph', 'tame', 'word-baboum'],
      passifs: { voieTrickster: 'illusionniste' },
    })

    const permanents = grimoireEffectif(ancien, catalog).filter((e) => e.horsEmplacement)
    expect(permanents.map((e) => e.sort.id).sort()).toEqual(['mage-hand', 'ya-gat-fooled'])
    expect(disponibiliteSort(catalog.sort('mage-hand') as Sort, ancien, catalog).disponible).toBe(true)
  })

  it('les retire immédiatement si la voie passe à Conteur', () => {
    const conteur = nouveauPerso('trickster', { passifs: { voieTrickster: 'conteur' } })
    expect(sortsHorsEmplacement(conteur, catalog)).toHaveLength(0)
  })

  it('ne les met jamais dans le pool du Détachement', () => {
    // Ce ne sont pas des possessions : un Détachement ne peut pas les emporter.
    const char = nouveauPerso('trickster')
    expect(poolDetachement(char, catalog).map((e) => e.id)).not.toContain('mage-hand')
  })

  it('n’ajoute rien pour un Conteur', () => {
    const conteur = { ...illusionniste(), passifs: { voieTrickster: 'conteur' as const } }
    expect(grimoireEffectif(conteur, catalog).every((e) => !e.horsEmplacement)).toBe(true)
  })

  it('rend toute illusion ajoutée plus tard disponible d’office', () => {
    // Une nouvelle illusion arrive au catalogue, comme la MJ en ajoutera.
    // Aucune fiche n'est modifiée : elle doit devenir disponible d'elle-même.
    const nouvelle: Sort = {
      kind: 'sort',
      id: 'mirage-tardif',
      nom: 'Mirage tardif',
      icone: 'magic-swirl',
      classeId: 'trickster',
      magieId: 'arcane',
      cout: COUT_GRATUIT,
      de: null,
      duree: '1 minute',
      effet: 'Une illusion acquise en cours de campagne.',
      illusion: true,
    }
    const enrichi = createCatalog([...SEED, nouvelle])

    const ids = sortsHorsEmplacement(illusionniste(), enrichi)
      .map((s) => s.id)
      .sort()
    expect(ids).toEqual(['mage-hand', 'mirage-tardif', 'ya-gat-fooled'])
  })

  it('laisse lancer une illusion absente des 3 emplacements', () => {
    const mageHand = catalog.sort('mage-hand') as Sort
    expect(estHorsEmplacement(mageHand, illusionniste(), catalog)).toBe(true)
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

  /**
   * « Une fois par heure » vivait en prose : rien n'empêchait de relancer le dé
   * en rafale. L'heure étant celle de la **fiction**, le jeton se rend à la main
   * — un compte à rebours réel se serait trompé dans les deux sens.
   */
  describe('jeton d’invocation', () => {
    const T = 1_000_000_000_000

    const soulshifter = (vieTireeA?: number) =>
      nouveauPerso('soulshifter', {
        passifs: { viesConnues: [1, 2], vieActive: 1, ...(vieTireeA ? { vieTireeA } : {}) },
      })

    it('laisse tirer une fiche qui n’a encore jamais tiré', () => {
      expect(peutTirerUneVie(soulshifter())).toBe(true)
    })

    it('consomme le jeton une fois la vie tirée', () => {
      expect(peutTirerUneVie(soulshifter(T))).toBe(false)
    })

    it('ne propose rien à qui ne connaît aucune vie', () => {
      expect(peutTirerUneVie(nouveauPerso('soulshifter', { passifs: { viesConnues: [] } }))).toBe(
        false,
      )
    })

    it('rend le jeton quand la MJ l’accorde, sans toucher à la personnalité', () => {
      const rendu = rendreInvocationDeVie(soulshifter(T))
      expect(peutTirerUneVie(rendu)).toBe(true)
      expect(rendu.passifs.vieActive).toBe(1)
      // La clé doit disparaître, pas valoir `undefined` : Firestore refuse l'un
      // et pas l'autre (voir `sansUndefined`).
      expect('vieTireeA' in rendu.passifs).toBe(false)
    })

    it('reste sans effet sur une fiche qui a déjà son invocation', () => {
      expect(rendreInvocationDeVie(soulshifter()).passifs).toEqual(soulshifter().passifs)
    })
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

describe('plafonds de ressource', () => {
  const dague: Equipement = {
    kind: 'equipement',
    id: 'dague-sanglante',
    nom: 'Dague sanglante',
    icone: 'crystal-shine',
    slot: 'arme',
    modificateurs: [
      {
        source: { kind: 'equipement', label: 'Dague sanglante' },
        target: ancienneCible({ kind: 'fatigue-max' }),
        op: { kind: 'add', value: -1 },
      },
    ],
  }
  const avecDague = createCatalog([...SEED, dague])

  const armee = (patch: Partial<Character> = {}) =>
    nouveauPerso('dusk-hunter', {
      possede: { sorts: [], equipements: [dague.id], ameliorations: [] },
      equipe: { arme: dague.id, armure: null, bibelot: null },
      ...patch,
    })

  it('abaisse la grille tant que l’objet est porté, et la rend dès qu’on le range', () => {
    // Le Dusk Hunter part à 5 cases.
    expect(computeFatigueMax(armee(), avecDague).max).toBe(4)

    const rangee = nouveauPerso('dusk-hunter', {
      possede: { sorts: [], equipements: [dague.id], ameliorations: [] },
    })
    expect(computeFatigueMax(rangee, avecDague).max).toBe(5)
  })

  it('cumule deux sources', () => {
    const bibelot: Equipement = { ...dague, id: 'os-maudit', nom: 'Os maudit', slot: 'bibelot' }
    const catalogue = createCatalog([...SEED, dague, bibelot])
    const char = nouveauPerso('dusk-hunter', {
      possede: { sorts: [], equipements: [dague.id, bibelot.id], ameliorations: [] },
      equipe: { arme: dague.id, armure: null, bibelot: bibelot.id },
    })
    expect(computeFatigueMax(char, catalogue).max).toBe(3)
  })

  /** Un personnage sans aucune case ne pourrait plus rien encaisser. */
  it('ne descend jamais la Fatigue sous une case', () => {
    const ruineux: Equipement = {
      ...dague,
      modificateurs: [{ ...dague.modificateurs![0]!, op: { kind: 'add', value: -99 } }],
    }
    const catalogue = createCatalog([...SEED, ruineux])
    expect(computeFatigueMax(armee(), catalogue).max).toBe(1)
  })

  it('borne la Fatigue cochée sur le plafond calculé', () => {
    // Cinq cases cochées, puis la dague en retire une : la grille est pleine à 4.
    const r = ajusterFatigue(armee({ fatigue: { max: 5, coches: 4 } }), avecDague, 1)
    expect(r.char.fatigue.coches).toBe(4)
    expect(r.grillePleine).toBe(true)
    expect(fatigueRestante(r.char, avecDague)).toBe(0)
  })

  it('laisse les autres plafonds à leur base sans modificateur', () => {
    const nu = nouveauPerso('trickster')
    expect(computeFoiMax(nu, catalog).max).toBe(MAX_FOI)
    expect(computeMarquesMax(nu, catalog).max).toBe(MAX_MARQUES)
    expect(computeBruluresMax(nu, catalog).max).toBe(SEUIL_COMBUSTION)
  })
})

describe('passifs réactifs', () => {
  const sceau: Equipement = {
    kind: 'equipement',
    id: 'sceau-martyr',
    nom: 'Sceau du Martyr',
    icone: 'crystal-shine',
    slot: 'bibelot',
    declencheurs: [{ quand: 'marques', sens: 'augmente', alors: 'foi', delta: 1 }],
  }
  const avecSceau = createCatalog([...SEED, sceau])

  const portant = (patch: Partial<Character> = {}) =>
    nouveauPerso('trickster', {
      possede: { sorts: [], equipements: [sceau.id], ameliorations: [] },
      equipe: { arme: null, armure: null, bibelot: sceau.id },
      ...patch,
    })

  it('s’arme quand la ressource surveillée augmente', () => {
    const avant = portant({ marques: 0, foi: 2 })
    const apres = { ...avant, marques: 1 }

    const r = resoudrePassifs(avant, apres, avecSceau)
    expect(r.char.foi).toBe(3)
    expect(r.recits[0]?.texte).toContain('Sceau du Martyr')
    // Le récit nomme celle chez qui l'effet s'est produit.
    expect(r.recits[0]?.chez).toBe('Maya')
  })

  it('ne s’arme pas dans l’autre sens', () => {
    const avant = portant({ marques: 2, foi: 2 })
    const r = resoudrePassifs(avant, { ...avant, marques: 1 }, avecSceau)
    expect(r.char.foi).toBe(2)
    expect(r.recits).toEqual([])
  })

  /** Même régime que les modificateurs : au fond du sac, il ne réagit à rien. */
  it('reste muet si l’objet n’est pas porté', () => {
    const avant = nouveauPerso('trickster', {
      possede: { sorts: [], equipements: [sceau.id], ameliorations: [] },
      marques: 0,
      foi: 2,
    })
    const r = resoudrePassifs(avant, { ...avant, marques: 1 }, avecSceau)
    expect(r.char.foi).toBe(2)
  })

  /**
   * Une seule passe : sans cette borne, « +1 Foi quand la Foi augmente »
   * bouclerait à l'infini.
   */
  it('ne se réveille pas lui-même', () => {
    const boucle: Equipement = {
      ...sceau,
      declencheurs: [{ quand: 'foi', sens: 'augmente', alors: 'foi', delta: 1 }],
    }
    const catalogue = createCatalog([...SEED, boucle])
    const avant = portant({ foi: 2 })

    const r = resoudrePassifs(avant, { ...avant, foi: 3 }, catalogue)
    expect(r.char.foi).toBe(4)
  })

  it('reste borné par le plafond de la ressource visée', () => {
    const avant = portant({ marques: 0, foi: MAX_FOI })
    const r = resoudrePassifs(avant, { ...avant, marques: 1 }, avecSceau)
    expect(r.char.foi).toBe(MAX_FOI)
    // Rien n'a bougé : rien à raconter.
    expect(r.recits).toEqual([])
  })

  /**
   * Régression signalée à table : une amélioration qui n'accordait qu'un passif
   * réactif n'apparaissait nulle part. `effetsActifs` partait des modificateurs,
   * et un déclencheur n'en produit aucun — il réagit au lieu d'ajuster.
   */
  it('apparaît dans les effets en cours, même sans aucun modificateur', () => {
    const amelioration: Amelioration = {
      kind: 'amelioration',
      id: 'pacte-sang',
      nom: 'Pacte de sang',
      icone: 'crystal-shine',
      prix: 80,
      effetTexte: 'Chaque Marque nourrit la foi.',
      declencheurs: [{ quand: 'marques', sens: 'augmente', alors: 'foi', delta: 1 }],
    }
    const catalogue = createCatalog([...SEED, amelioration])
    const char = nouveauPerso('trickster', {
      possede: { sorts: [], equipements: [], ameliorations: [amelioration.id] },
    })

    const effet = effetsActifs(char, catalogue).find((e) => e.nom === 'Pacte de sang')
    expect(effet).toBeTruthy()
    expect(effet?.resume).toContain('Marques')
    expect(effet?.resume).toContain('Points de Foi')
  })

  it('disparaît des effets en cours quand l’objet n’est plus porté', () => {
    const range = nouveauPerso('trickster', {
      possede: { sorts: [], equipements: [sceau.id], ameliorations: [] },
    })
    expect(effetsActifs(range, avecSceau).some((e) => e.nom === 'Sceau du Martyr')).toBe(false)

    const porte = portant()
    expect(effetsActifs(porte, avecSceau).some((e) => e.nom === 'Sceau du Martyr')).toBe(true)
  })

  it('additionne deux déclencheurs qui visent la même ressource', () => {
    const second: Equipement = { ...sceau, id: 'autre-sceau', nom: 'Autre sceau', slot: 'arme' }
    const catalogue = createCatalog([...SEED, sceau, second])
    const avant = nouveauPerso('trickster', {
      possede: { sorts: [], equipements: [sceau.id, second.id], ameliorations: [] },
      equipe: { arme: second.id, armure: null, bibelot: sceau.id },
      marques: 0,
      foi: 2,
    })

    const r = resoudrePassifs(avant, { ...avant, marques: 1 }, catalogue)
    expect(r.char.foi).toBe(4)
    expect(r.recits).toHaveLength(2)
  })

  // -------------------------------------------------------------------------
  // Réactions croisées
  // -------------------------------------------------------------------------

  describe('chez une alliée', () => {
    /** « Gagnez une brûlure chaque fois qu'une alliée en prend une. » */
    const solidaire: Amelioration = {
      kind: 'amelioration',
      id: 'lien-de-sang',
      nom: 'Lien de sang',
      icone: 'crystal-shine',
      prix: 120,
      effetTexte: 'La douleur d’une alliée est la vôtre.',
      passifs: [
        {
          id: 'lien',
          libelle: 'Lien de sang',
          declenchement: {
            kind: 'reaction',
            quand: { element: { kind: 'brulures' }, sens: 'augmente', chez: 'un-allie' },
          },
          effet: {
            texte: '',
            operations: [
              {
                kind: 'ajuster',
                cible: { element: { kind: 'brulures' }, aspect: 'valeur' },
                op: { kind: 'add', value: 1 },
              },
            ],
          },
        },
      ],
    }
    const avecLien = createCatalog([...SEED, solidaire, sceau])

    const liee = (patch: Partial<Character> = {}) => ({
      ...nouveauPerso('trickster', {
        possede: { sorts: [], equipements: [], ameliorations: [solidaire.id] },
        ...patch,
      }),
      id: 'b-alliee',
      nom: 'Alliée',
    })

    const actrice = (patch: Partial<Character> = {}) => ({
      ...nouveauPerso('dusk-hunter', patch),
      id: 'a-actrice',
      nom: 'Actrice',
    })

    it('s’applique sur la fiche de l’alliée, et la nomme dans le récit', () => {
      const avant = actrice({ brulures: 0 })
      const alliee = liee({ brulures: 0 })

      const r = resoudrePassifs(avant, { ...avant, brulures: 1 }, avecLien, [avant, alliee])

      // L'actrice n'a pas ce passif : sa propre fiche ne bouge pas au-delà du geste.
      expect(r.char.brulures).toBe(1)
      expect(r.autres).toHaveLength(1)
      expect(r.autres[0]?.id).toBe(alliee.id)
      expect(r.autres[0]?.brulures).toBe(1)
      expect(r.recits[0]?.chez).toBe('Alliée')
    })

    /**
     * ⚠️ L'invariant « une seule passe » se lit sur le **roster** : ce qu'une
     * réaction produit chez une alliée n'en réveille aucune autre. Sans cette
     * borne, deux personnages portant ce lien se brûleraient mutuellement en
     * boucle, et la cascade serait intenable à table.
     */
    it('ne cascade pas d’une alliée à l’autre', () => {
      const avant = actrice({ brulures: 0 })
      const une = { ...liee({ brulures: 0 }), id: 'b-une', nom: 'Une' }
      const autre = { ...liee({ brulures: 0 }), id: 'c-autre', nom: 'Autre' }

      const r = resoudrePassifs(avant, { ...avant, brulures: 1 }, avecLien, [avant, une, autre])

      // Chacune réagit une fois au geste de l'actrice, jamais à celui de l'autre.
      expect(r.autres.map((c) => c.brulures)).toEqual([1, 1])
      expect(r.recits).toHaveLength(2)
    })

    it('n’écrit aucune fiche que rien n’a touchée', () => {
      const avant = actrice({ brulures: 0 })
      const indifferente = { ...nouveauPerso('trickster'), id: 'z-passante', nom: 'Passante' }

      const r = resoudrePassifs(avant, { ...avant, brulures: 1 }, avecLien, [avant, indifferente])
      expect(r.autres).toEqual([])
    })

    it('borne le gain d’une alliée par son propre plafond', () => {
      const avant = actrice({ brulures: 0 })
      const saturee = liee({ brulures: SEUIL_COMBUSTION })

      const r = resoudrePassifs(avant, { ...avant, brulures: 1 }, avecLien, [avant, saturee])
      // Rien n'a bougé : rien à écrire, rien à raconter.
      expect(r.autres).toEqual([])
    })

    /** Une réaction `soi` ne part pas sur le geste d'une autre, et réciproquement. */
    it('distingue « chez vous » de « chez une alliée »', () => {
      const avant = { ...actrice({ marques: 0, foi: 2 }), ...portant({ marques: 0, foi: 2 }) }
      const alliee = liee()

      // Le Sceau du Martyr est un passif `soi` : il part chez son porteur…
      const propre = resoudrePassifs(avant, { ...avant, marques: 1 }, avecLien, [avant, alliee])
      expect(propre.char.foi).toBe(3)

      // …et le geste d'une autre ne l'arme pas.
      const tierce = { ...actrice({ marques: 0 }), id: 'x-tierce', nom: 'Tierce' }
      const croise = resoudrePassifs(
        tierce,
        { ...tierce, marques: 1 },
        avecLien,
        [tierce, avant],
      )
      expect(croise.autres).toEqual([])
    })

    /** Deux appareils qui résolvent le même geste doivent aboutir au même état. */
    it('parcourt le roster dans un ordre déterministe', () => {
      const avant = actrice({ brulures: 0 })
      const une = { ...liee({ brulures: 0 }), id: 'b-une', nom: 'Une' }
      const autre = { ...liee({ brulures: 0 }), id: 'c-autre', nom: 'Autre' }

      const ids = (roster: Character[]) =>
        resoudrePassifs(avant, { ...avant, brulures: 1 }, avecLien, roster).autres.map((c) => c.id)

      expect(ids([avant, une, autre])).toEqual(['b-une', 'c-autre'])
      expect(ids([autre, une, avant])).toEqual(['b-une', 'c-autre'])
    })
  })
})

describe('objets à effets actifs', () => {
  /**
   * Un objet écrit à l'**ancien** format : une table unique, et une
   * « contrepartie » qui confondait le coût et le nombre d'utilisations. Des
   * objets de cette forme dorment en base, et l'amorçage ne les réécrira
   * jamais : les fixtures restent donc délibérément à l'ancien format, et
   * chaque test vérifie du même coup que la conversion tient.
   */
  const armeHeritee = (cout: CoutUsage, faces = 6): Equipement => ({
    kind: 'equipement',
    id: 'lame-runique',
    nom: 'Lame runique',
    icone: 'crystal-shine',
    slot: 'arme',
    effetsActifs: {
      faces,
      effets: Array.from({ length: faces }, (_, i) => `Effet ${i + 1}`),
      cout,
    },
  })

  /**
   * `createCatalog` est le seul chemin par lequel une entrée entre dans le
   * domaine, et donc le seul endroit où la conversion a lieu. Y passer, c'est
   * reproduire exactement ce que fait l'application.
   */
  const monte = (eq: Equipement) => {
    const catalogue = createCatalog([...SEED, eq])
    const converti = catalogue.equipement(eq.id) as Equipement
    return { catalogue, eq: converti, actif: actifsDe(converti)[0] as Actif }
  }

  const porteuse = (eq: Equipement, patch: Partial<Character> = {}) =>
    nouveauPerso('dusk-hunter', {
      possede: { sorts: [], equipements: [eq.id], ameliorations: [] },
      equipe: { arme: eq.id, armure: null, bibelot: null },
      ...patch,
    })

  it('part au complet sans que rien n’ait été initialisé', () => {
    const { eq, actif } = monte(armeHeritee({ kind: 'charges', max: 3, rituel: 'sang de Carcasse' }))
    // La fiche ne connaît pas encore l'objet : c'est le cas d'un achat en
    // boutique ou d'un don de la MJ.
    expect(chargesRestantes(porteuse(eq), eq, actif)).toBe(3)
  })

  it('décompte une charge par usage et refuse la suivante à zéro', () => {
    const { catalogue, eq, actif } = monte(
      armeHeritee({ kind: 'charges', max: 2, rituel: 'sang de Carcasse' }),
    )
    let char = porteuse(eq)

    char = utiliserActif(char, catalogue, eq, actif, seededRng(3)).char
    expect(chargesRestantes(char, eq, actif)).toBe(1)

    const r = utiliserActif(char, catalogue, eq, actif, seededRng(4))
    expect(r.restantes).toBe(0)
    char = r.char

    // L'objet reste au sac, mais ne répond plus tant qu'on ne l'a pas rechargé.
    expect(peutUtiliser(char, catalogue, eq, actif)).toBe(false)
    expect(() => utiliserActif(char, catalogue, eq, actif, seededRng(5))).toThrow()
  })

  it('tire un effet de la table, et le rend déterministe à une seule face', () => {
    const { catalogue, eq, actif } = monte(armeHeritee({ kind: 'consommable', max: 1 }, 1))
    const r = utiliserActif(porteuse(eq), catalogue, eq, actif, seededRng(7))
    expect(r.de).toBe(1)
    expect(r.effet).toBe('Effet 1')
  })

  /**
   * ⚠️ **Inversion volontaire.** Un consommable épuisé se détruisait et se
   * déséquipait tout seul. Décision arrêtée avec la MJ : il reste désormais en
   * inventaire, marqué et inutilisable, jusqu'à ce qu'on l'en retire — un
   * flacon vide se garde, se remplit, se revend.
   */
  it('n’est plus détruit quand sa dernière charge part', () => {
    const { catalogue, eq, actif } = monte(armeHeritee({ kind: 'consommable', max: 1 }, 1))
    const r = utiliserActif(porteuse(eq), catalogue, eq, actif, seededRng(1))

    expect(r.restantes).toBe(0)
    expect(r.char.possede.equipements).toContain(eq.id)
    expect(r.char.equipe.arme).toBe(eq.id)

    // C'est ce drapeau qui le marque en rouge, sans le faire disparaître.
    expect(estEpuise(r.char, eq)).toBe(true)
    expect(peutUtiliser(r.char, catalogue, eq, actif)).toBe(false)
    // Et rien ne le recharge : c'est à la MJ ou à la joueuse de le retirer.
    expect(() => rechargerActif(r.char, catalogue, eq, actif)).toThrow(/recharge/)
  })

  it('ne décompte rien sur un objet à contrepartie narrative', () => {
    const { catalogue, eq, actif } = monte(
      armeHeritee({ kind: 'paiement', description: 'une Marque toutes les 3 utilisations' }),
    )
    const r = utiliserActif(porteuse(eq), catalogue, eq, actif, seededRng(2))

    expect(r.restantes).toBeNull()
    expect(peutUtiliser(r.char, catalogue, eq, actif)).toBe(true)
    expect(estEpuise(r.char, eq)).toBe(false)
    // La contrepartie n'a pas disparu : elle est devenue une part narrative,
    // affichée sans que le moteur prétende savoir la prélever.
    expect(detailObjet(eq)).toContain('une Marque toutes les 3 utilisations')
  })

  it('se recharge à neuf, et seulement à la main', () => {
    const { catalogue, eq, actif } = monte(
      armeHeritee({ kind: 'charges', max: 3, rituel: 'sang de Carcasse' }),
    )
    const vide = porteuse(eq, { chargesObjets: { [`${eq.id}:${actif.id}`]: 0 } })

    expect(peutUtiliser(vide, catalogue, eq, actif)).toBe(false)
    expect(chargesRestantes(rechargerActif(vide, catalogue, eq, actif).char, eq, actif)).toBe(3)
  })

  /**
   * Régression de conversion : un objet dont les charges étaient déjà entamées
   * les comptait sous son seul identifiant, avant qu'un objet puisse porter
   * plusieurs Actifs. Sans le repli, il repartirait au complet — la joueuse
   * retrouverait gratuitement des charges dépensées.
   */
  it('retrouve des charges entamées sous l’ancienne clé, puis bascule sur la nouvelle', () => {
    const { catalogue, eq, actif } = monte(
      armeHeritee({ kind: 'charges', max: 3, rituel: 'sang de Carcasse' }),
    )
    const entamee = porteuse(eq, { chargesObjets: { [eq.id]: 1 } })
    expect(chargesRestantes(entamee, eq, actif)).toBe(1)

    const apres = utiliserActif(entamee, catalogue, eq, actif, seededRng(1)).char
    expect(chargesRestantes(apres, eq, actif)).toBe(0)
    // La clé nue disparaît : la laisser ferait diverger les deux compteurs.
    expect(apres.chargesObjets[eq.id]).toBeUndefined()
    expect(apres.chargesObjets[`${eq.id}:${actif.id}`]).toBe(0)
  })

  it('oublie toutes les charges quand l’objet est retiré', () => {
    const { eq, actif } = monte(armeHeritee({ kind: 'charges', max: 3, rituel: 'rituel' }))
    const char = porteuse(eq, {
      chargesObjets: { [eq.id]: 2, [`${eq.id}:${actif.id}`]: 1, 'autre-objet': 3 },
    })

    const apres = retirerObjet(char, eq.id)
    expect(apres.chargesObjets).toEqual({ 'autre-objet': 3 })
    expect(apres.equipe.arme).toBeNull()
  })

  /**
   * Le moteur de modificateurs n'a pas changé : un passif saisi au catalogue
   * remonte par le même chemin que le bonus d'Évasion d'une armure.
   */
  it('applique les modificateurs d’un objet porté, et eux seuls', () => {
    const talisman: Equipement = {
      kind: 'equipement',
      id: 'talisman',
      nom: 'Talisman de protection',
      icone: 'crystal-shine',
      slot: 'bibelot',
      bonusEvasion: 2,
      modificateurs: [
        {
          source: { kind: 'equipement', label: 'Talisman de protection' },
          target: ancienneCible({ kind: 'competence', competence: 'social' }),
          op: { kind: 'avantage' },
        },
      ],
    }
    const avecTalisman = createCatalog([...SEED, talisman])

    const porte = nouveauPerso('dusk-hunter', {
      possede: { sorts: [], equipements: ['talisman'], ameliorations: [] },
      equipe: { arme: null, armure: null, bibelot: 'talisman' },
    })
    expect(computeEvasion(porte, avecTalisman).total).toBe(EVASION_DE_BASE + 2)
    expect(computeCompetence(porte, avecTalisman, 'social').net).toBe('avantage')

    // Au fond du sac, il ne protège personne.
    const range = nouveauPerso('dusk-hunter', {
      possede: { sorts: [], equipements: ['talisman'], ameliorations: [] },
    })
    expect(computeEvasion(range, avecTalisman).total).toBe(EVASION_DE_BASE)
    expect(computeCompetence(range, avecTalisman, 'social').net).toBe('neutre')
  })
})

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

  it('repos court : les cristaux, et rien d’autre', () => {
    const r = resoudreCampPourPersonnage(use(), 'repos-court')
    expect(r.char.sortsEpuises).toHaveLength(0)
    // Un repos court ne soigne pas : les 3 cases restent cochées.
    expect(r.char.fatigue.coches).toBe(3)
    expect(r.char.sixthSensUtilises).toBe(1)
    expect(r.char.actionsRapidesUtilisees).toBe(2)
    expect(r.char.modifiers).toHaveLength(1)
  })

  it('camp initial : un seul Point de Fatigue, mais tout le reste est rendu', () => {
    const r = resoudreCampPourPersonnage(use(), 'initial')
    expect(r.char.fatigue.coches).toBe(2)
    expect(r.char.sortsEpuises).toHaveLength(0)
    expect(r.char.sixthSensUtilises).toBe(0)
    expect(r.char.actionsRapidesUtilisees).toBe(0)
    expect(r.char.modifiers).toHaveLength(0)
  })

  /**
   * Décision de la MJ, contre le PDF qui conservait la Foi « de jour en jour » :
   * chaque session repart de 2. Le camp étant résolu à son ouverture, les gains
   * de la phase Grimoire viennent bien s'ajouter après la remise à zéro.
   */
  it('ramène les Points de Foi à 2 au camp initial, jamais au repos court', () => {
    const genereuse = nouveauPerso('dusk-hunter', { foi: 7 })
    expect(resoudreCampPourPersonnage(genereuse, 'initial').char.foi).toBe(FOI_DE_DEPART)
    expect(resoudreCampPourPersonnage(genereuse, 'repos-court').char.foi).toBe(7)

    // Et le solde remonte aussi bien qu'il ne descend.
    const demunie = nouveauPerso('dusk-hunter', { foi: 0 })
    expect(resoudreCampPourPersonnage(demunie, 'initial').char.foi).toBe(FOI_DE_DEPART)
  })

  it('ne descend jamais la Fatigue sous zéro', () => {
    const repose = nouveauPerso('dusk-hunter', { fatigue: { max: 5, coches: 0 } })
    const r = resoudreCampPourPersonnage(repose, 'initial')
    expect(r.char.fatigue.coches).toBe(0)
    expect(r.effets.some((e) => e.includes('Fatigue'))).toBe(false)
  })

  it('n’ouvre au repos court que la Boutique, le Grimoire et l’Armurerie', () => {
    expect(phasesDuCamp('initial')).toEqual([
      'banque',
      'brief',
      'boutique',
      'grimoire',
      'armurerie',
    ])
    expect(phasesDuCamp('repos-court')).toEqual(['boutique', 'grimoire', 'armurerie'])
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

describe('normalisation des fiches lues en base', () => {
  /**
   * Régression : `investissements` a été ajouté au lot 3, mais les fiches déjà
   * écrites ne le contenaient pas — « Ouvrir une nouvelle session » levait une
   * erreur. Troisième occurrence de la même cause, d'où la normalisation unique
   * plutôt qu'un `?? []` par site d'appel.
   */
  it('comble les champs absents d’une fiche antérieure', () => {
    // Ce qu'un vieux document Firestore contient réellement.
    const ancienne = {
      id: 'x',
      nom: 'Ilma',
      classeId: 'trickster',
      avatarSeed: 'x:Ilma',
      maitrises: { physique: 2, roublardise: 2, esprit: 0, social: -2 },
      fatigue: { max: 4, coches: 1 },
      brulures: 0,
      foi: 2,
      marques: 0,
      sixthSensBase: 1,
      sixthSensUtilises: 0,
      lumens: 40,
      actionsRapidesUtilisees: 0,
      equipe: { arme: null, armure: null, bibelot: null },
      grimoire: ['polymorph'],
      possede: { sorts: ['polymorph'], equipements: [], ameliorations: [] },
      sortsEpuises: [],
      cicatrices: [],
      passifs: {},
      modifiers: [],
      claimedBy: null,
      createdAt: 0,
      updatedAt: 0,
    } as unknown as Character

    const normalisee = normaliserPersonnage(ancienne)
    expect(normalisee.investissements).toEqual([])
    // Ajouté à la refonte du Feu de Camp : mêmes causes, même parade.
    expect(normalisee.jetonsCamp).toEqual(jetonsCampVierges())
    // Et rien d'existant n'est écrasé au passage.
    expect(normalisee.lumens).toBe(40)
    expect(normalisee.grimoire).toEqual(['polymorph'])
  })

  it('ne fait plus lever l’ouverture de session sur une fiche antérieure', () => {
    const sansChamp = { ...nouveauPerso('trickster') } as Character
    delete (sansChamp as { investissements?: unknown }).investissements

    // Avant le correctif, cette ligne levait un TypeError.
    expect(() => resoudreInvestissements(sansChamp, catalog, 2, seededRng(1))).toThrow()
    expect(() =>
      resoudreInvestissements(normaliserPersonnage(sansChamp), catalog, 2, seededRng(1)),
    ).not.toThrow()
  })

  it('survit à une fiche presque vide', () => {
    const minimale = { id: 'y', nom: 'Test', classeId: 'trickster' } as unknown as Character
    const normalisee = normaliserPersonnage(minimale)

    expect(normalisee.possede.sorts).toEqual([])
    expect(normalisee.equipe.armure).toBeNull()
    expect(normalisee.modifiers).toEqual([])
    expect(normalisee.jetonsCamp.achat).toBeNull()
    expect(() => computeEvasion(normalisee, catalog)).not.toThrow()
  })

  /**
   * Les Serments et Fardeaux engagés vivent dans `char.modifiers`, écrits sous
   * l'ancienne forme de cible. Sans conversion à la lecture, ils cesseraient de
   * s'appliquer du jour au lendemain — et sans rien lever, puisqu'une cible qui
   * ne correspond à rien s'agrège simplement à zéro.
   */
  it('relit un Serment engagé sous l’ancienne forme de cible', () => {
    const jureuse = {
      ...nouveauPerso('trickster'),
      modifiers: [
        {
          id: 'serment-ancien',
          source: { kind: 'serment', label: 'Serment' },
          target: ancienneCible({ kind: 'competence-sauf', except: 'esprit' }),
          op: { kind: 'add', value: -4 },
          expires: { kind: 'fin-de-journee' },
        },
      ],
    } as unknown as Character

    const normalisee = normaliserPersonnage(jureuse)
    const bonus = (c: Competence) => computeCompetence(normalisee, catalog, c).bonus

    expect(bonus('esprit')).toBe(0)
    expect(bonus('physique')).toBe(-4)
    expect(bonus('roublardise')).toBe(-4)
    expect(bonus('social')).toBe(-4)
  })

  it('convertit les anciens plafonds, 6th Sens compris', () => {
    // Le 6th Sens ne portait pas le suffixe `-max`, mais visait déjà le maximum.
    expect(normaliserCible({ kind: 'sixth-sens' })).toEqual({
      element: { kind: 'sixth-sens' },
      aspect: 'plafond',
    })
    expect(normaliserCible({ kind: 'fatigue-max' })).toEqual({
      element: { kind: 'fatigue' },
      aspect: 'plafond',
    })
    expect(normaliserCible({ kind: 'evasion' })).toEqual({
      element: { kind: 'evasion' },
      aspect: 'valeur',
    })
  })

  /**
   * Avant l'unification des coûts, `coutFoiEffectif` était seul à consulter les
   * modificateurs de `cout-sort` : un filtre vide signifiait donc « la Foi ».
   * Ne pas l'inscrire ferait déborder le passif Conteur sur les autres coûts.
   */
  /**
   * `modificateurs` et `declencheurs` ne différaient que par leur
   * déclenchement. Une fois les deux types disparus du modèle, seule cette
   * conversion garde l'ancien chemin de données sous garde — et le contenu
   * déjà saisi par la MJ ne sera jamais réécrit par l'amorçage.
   */
  it('convertit les deux anciens tableaux de passifs en Passif', () => {
    const objet: Equipement = {
      kind: 'equipement',
      id: 'vieux-talisman',
      nom: 'Vieux talisman',
      icone: 'crystal-shine',
      slot: 'bibelot',
      modificateurs: [
        {
          source: { kind: 'equipement', label: 'Libellé figé d’autrefois' },
          target: ancienneCible({ kind: 'evasion' }),
          op: { kind: 'add', value: 1 },
        },
      ],
      declencheurs: [{ quand: 'marques', sens: 'augmente', alors: 'foi', delta: 1 }],
    }

    const converti = createCatalog([...SEED, objet]).equipement(objet.id) as Equipement
    const passifs = converti.passifs ?? []
    expect(passifs).toHaveLength(2)

    const [permanent, reactif] = passifs as [Passif, Passif]
    expect(permanent.declenchement).toEqual({ kind: 'permanent' })
    expect(permanent.effet.operations?.[0]?.cible).toEqual({
      element: { kind: 'evasion' },
      aspect: 'valeur',
    })

    expect(reactif.declenchement).toEqual({
      kind: 'reaction',
      // Un déclencheur ne savait viser que soi-même.
      quand: { element: { kind: 'marques' }, sens: 'augmente', chez: 'soi' },
    })

    /*
     * Les libellés restent vides à dessein : le moteur retombe alors sur le nom
     * du porteur, relu à chaque rendu. C'est ce repli qui a rendu inutile la
     * recopie des libellés à l'enregistrement — et qui répare, au passage, les
     * libellés figés déjà en base.
     */
    expect(permanent.libelle).toBe('')
    expect(reactif.libelle).toBe('')
  })

  it('inscrit « foi » sur un ajustement de coût hérité, et reste idempotent', () => {
    const converti = normaliserCible({ kind: 'cout-sort', filtre: { prefixeNom: 'Word:' } })
    expect(converti).toEqual({
      element: { kind: 'cout-sort', filtre: { prefixeNom: 'Word:', element: 'foi' } },
      aspect: 'valeur',
    })
    expect(normaliserCible(converti)).toEqual(converti)
  })
})

describe('investissements', () => {
  const chambre = catalog.investissement('location-chambre') as Investissement
  const transport = catalog.investissement('transport-materiel') as Investissement
  const loto = catalog.investissement('loto') as Investissement

  /** Un dé pipé, pour décider si le mauvais dénouement survient. */
  const des = (malchance: boolean): Rng => ({
    int: (min) => min,
    pick: (items) => items[0] as never,
    chance: () => malchance,
    roll: (n) => Array.from({ length: n }, () => 1),
  })

  function avecInvestissements(pris: { investissementId: string; sessionNumero: number }[]) {
    return nouveauPerso('trickster', { investissements: pris })
  }

  it('ne verse rien pendant la session de l’achat', () => {
    const char = avecInvestissements([{ investissementId: 'location-chambre', sessionNumero: 3 }])
    expect(resoudreInvestissements(char, catalog, 3, des(false)).total).toBe(0)
  })

  it('verse le revenu de la chambre à partir de la session suivante', () => {
    const char = avecInvestissements([{ investissementId: 'location-chambre', sessionNumero: 3 }])
    expect(resoudreInvestissements(char, catalog, 4, des(false)).total).toBe(chambre.gainRecurrent)
    expect(resoudreInvestissements(char, catalog, 9, des(false)).total).toBe(chambre.gainRecurrent)
  })

  it('tire la rénovation pour chaque chambre, indépendamment', () => {
    const trois = avecInvestissements([
      { investissementId: 'location-chambre', sessionNumero: 1 },
      { investissementId: 'location-chambre', sessionNumero: 1 },
      { investissementId: 'location-chambre', sessionNumero: 1 },
    ])

    const sereine = resoudreInvestissements(trois, catalog, 2, des(false))
    expect(sereine.total).toBe(3 * (chambre.gainRecurrent as number))

    // Toutes en rénovation : trois revenus, trois coûts.
    const ruine = resoudreInvestissements(trois, catalog, 2, des(true))
    expect(ruine.total).toBe(3 * ((chambre.gainRecurrent as number) - (chambre.coutRisque as number)))
    expect(ruine.lignes.filter((l) => l.lumens < 0)).toHaveLength(3)
  })

  it('ne verse le transport qu’une seule fois, et rien s’il se perd', () => {
    const char = avecInvestissements([{ investissementId: 'transport-materiel', sessionNumero: 2 }])

    expect(resoudreInvestissements(char, catalog, 3, des(false)).total).toBe(
      transport.gainProchainSession,
    )
    // Perdu en route.
    expect(resoudreInvestissements(char, catalog, 3, des(true)).total).toBe(0)
    // Et jamais deux fois.
    expect(resoudreInvestissements(char, catalog, 4, des(false)).total).toBe(0)
  })

  it('résout le loto immédiatement, à l’achat', () => {
    const gagne = resoudrePriseInvestissement(loto, des(false))
    expect(gagne.lumens).toBe((loto.gainImmediat as number) - loto.cout)

    const perdu = resoudrePriseInvestissement(loto, des(true))
    expect(perdu.lumens).toBe(-loto.cout)
  })

  it('refuse une 4ᵉ chambre toutes sessions confondues', () => {
    const riche = { ...avecInvestissements([]), lumens: 1000 }
    expect(peutPrendreInvestissement(riche, chambre, 1).possible).toBe(true)

    const trois = {
      ...avecInvestissements([1, 2, 3].map((s) => ({ investissementId: 'location-chambre', sessionNumero: s }))),
      lumens: 1000,
    }
    const refus = peutPrendreInvestissement(trois, chambre, 4)
    expect(refus.possible).toBe(false)
    expect(refus.raison).toContain('3')
  })

  it('refuse un second transport dans la même session, et le crédit', () => {
    const dejaPris = {
      ...avecInvestissements([{ investissementId: 'transport-materiel', sessionNumero: 5 }]),
      lumens: 1000,
    }
    expect(peutPrendreInvestissement(dejaPris, transport, 5).possible).toBe(false)
    expect(peutPrendreInvestissement(dejaPris, transport, 6).possible).toBe(true)

    const fauche = { ...avecInvestissements([]), lumens: 0 }
    expect(peutPrendreInvestissement(fauche, chambre, 1).raison).toContain('insuffisants')
  })
})

describe('boutique', () => {
  const pauvre = () => nouveauPerso('trickster', { lumens: 0 })
  const riche = () => nouveauPerso('trickster', { lumens: 500 })

  it('ne propose que ce qui a un prix et n’est pas déjà possédé', () => {
    const char = riche()
    const achetables = entreesAchetables(char, catalog)

    expect(achetables.every((e) => prixDe(e) !== null)).toBe(true)
    // Les sorts de sa classe sont déjà à elle.
    expect(achetables.map((e) => e.id)).not.toContain('polymorph')
    // Le matériel de base ne se vend pas, les illusions non plus.
    expect(achetables.map((e) => e.id)).not.toContain('catalyseur')
    expect(achetables.map((e) => e.id)).not.toContain('mage-hand')
  })

  /**
   * Un sort appartient à une ou plusieurs classes ; sans classe déclarée, il
   * reste ouvert à toutes. La boutique s'y conforme — proposer « Burst » à une
   * Trickster n'aurait aucun sens.
   */
  it('ne propose pas les sorts réservés à une autre classe', () => {
    const vendable = { ...(catalog.sort('burst') as Sort), prix: 30 }
    const avecBurst = createCatalog([...SEED.filter((e) => e.id !== 'burst'), vendable])

    expect(entreesAchetables(riche(), avecBurst).map((e) => e.id)).not.toContain('burst')

    const dusk = nouveauPerso('dusk-hunter', { lumens: 500, possede: { sorts: [], equipements: [], ameliorations: [] } })
    expect(entreesAchetables(dusk, avecBurst).map((e) => e.id)).toContain('burst')
  })

  it('propose à tout le monde un sort sans classe déclarée', () => {
    const commun: Sort = {
      ...(catalog.sort('burst') as Sort),
      id: 'sort-commun',
      nom: 'Sort commun',
      prix: 30,
      classeId: undefined,
      classesIds: [],
    }
    const avecCommun = createCatalog([...SEED, commun])
    expect(entreesAchetables(riche(), avecCommun).map((e) => e.id)).toContain('sort-commun')
  })

  it('relit un sort saisi sous l’ancien champ au singulier', () => {
    const ancien = { ...(catalog.sort('burst') as Sort), classesIds: undefined }
    expect(classesDuSort(ancien)).toEqual(['dusk-hunter'])
    expect(sortOuvertA(ancien, 'dusk-hunter')).toBe(true)
    expect(sortOuvertA(ancien, 'trickster')).toBe(false)
  })

  it('tire des offres distinctes', () => {
    const offres = tirerOffres(riche(), catalog, seededRng(4), { taille: 3 })
    expect(offres).toHaveLength(3)
    expect(new Set(offres).size).toBe(3)
  })

  it('rend moins d’offres qu’attendu plutôt que d’inventer', () => {
    const maigre = createCatalog(SEED.filter((e) => e.kind !== 'equipement' && e.kind !== 'sort'))
    expect(tirerOffres(riche(), maigre, seededRng(1), { taille: 3 }).length).toBeLessThan(3)
  })

  /**
   * Une boutique thématique : la MJ coche « Poisons » et « Reliques » avant une
   * descente, et le tirage n'y puise plus qu'à cet endroit. Le faire à la main
   * demandait de remplacer chaque offre, joueuse par joueuse.
   */
  describe('tirage restreint à des dossiers', () => {
    const marchandise = (id: string, dossierId?: string): Equipement => ({
      kind: 'equipement',
      id,
      nom: `Objet ${id}`,
      icone: 'crystal-shine',
      slot: 'bibelot',
      prix: 10,
      ...(dossierId ? { dossierId } : {}),
    })

    const boutique = createCatalog([
      ...SEED,
      marchandise('p1', 'poisons'),
      marchandise('p2', 'poisons'),
      marchandise('r1', 'reliques'),
      marchandise('libre'),
    ])

    const tire = (dossiers: string[]) =>
      tirerOffres(riche(), boutique, seededRng(7), { taille: 10, dossiers })

    it('ne puise que dans les dossiers retenus', () => {
      expect(tire(['poisons']).sort()).toEqual(['p1', 'p2'])
    })

    it('accepte plusieurs dossiers à la fois', () => {
      expect(tire(['poisons', 'reliques']).sort()).toEqual(['p1', 'p2', 'r1'])
    })

    it('sait viser ce qui n’est rangé nulle part', () => {
      // Le seed n'a que trois entrées à vendre, toutes non classées.
      expect(tire([SANS_DOSSIER])).toContain('libre')
      expect(tire([SANS_DOSSIER])).not.toContain('p1')
    })

    /**
     * ⚠️ Une liste vide **ne filtre rien**. La lire comme « aucun dossier »
     * rendrait une boutique vide à toute MJ qui n'a rien coché — c'est-à-dire
     * au cas par défaut.
     */
    it('ne filtre rien quand aucun dossier n’est coché', () => {
      const tout = tire([])
      expect(tout).toContain('p1')
      expect(tout).toContain('libre')
    })

    it('respecte les autres règles de la boutique', () => {
      // Un objet du bon dossier mais déjà possédé ne revient pas au tirage.
      const possede = { ...riche(), possede: { sorts: [], equipements: ['p1'], ameliorations: [] } }
      const offres = tirerOffres(possede, boutique, seededRng(7), {
        taille: 10,
        dossiers: ['poisons'],
      })
      expect(offres).toEqual(['p2'])
    })
  })

  it('débite les Lumens et range l’acquisition', () => {
    const cuirasse = catalog.equipement('cuirasse-usee') as EntreeCatalogue
    const apres = acheter(riche(), cuirasse)

    expect(apres.lumens).toBe(500 - 40)
    expect(apres.possede.equipements).toContain('cuirasse-usee')
  })

  it('refuse le crédit', () => {
    const cuirasse = catalog.equipement('cuirasse-usee') as EntreeCatalogue
    expect(() => acheter(pauvre(), cuirasse)).toThrow(/crédit/)
    expect(peutAcheter(ctxCamp, pauvre(), 40)).toBe(false)
  })

  it('refuse un second achat dans le même feu de camp', () => {
    const jetons = { ...jetonsCampVierges(), achat: ctxCamp.campfireId }
    expect(peutAcheter({ ...ctxCamp, jetons }, riche(), 40)).toBe(false)
  })

  /**
   * La régression qui rendait la Boutique inutilisable : le jeton d'achat était
   * un booléen que rien ne remettait à zéro, si bien qu'« une acquisition par
   * feu de camp » se comportait en « une par session ». Il retient désormais
   * l'identifiant du camp, et se périme donc tout seul au camp suivant.
   */
  it('rouvre l’achat au feu de camp suivant de la même session', () => {
    const jetons = { ...jetonsCampVierges(), achat: 'camp-precedent' }
    expect(peutAcheter({ ...ctxCamp, jetons }, riche(), 40)).toBe(true)
  })
})

const ctxCamp: ContexteCamp = {
  jetons: jetonsCampVierges(),
  type: 'initial',
  campfireId: 'camp-en-cours',
  sessionNumero: 3,
}

describe('ordonnancement du Feu de Camp', () => {
  /**
   * Le piège central du lot : la résolution du camp a lieu à son **ouverture**.
   * Un Serment prononcé ensuite, à la phase Grimoire, vaut pour la session qui
   * commence — le résoudre à la fermeture l'effacerait aussitôt.
   */
  it('un Serment pris pendant le camp survit à la fermeture du camp', () => {
    // Ouverture : la session écoulée se clôt, les anciens effets tombent.
    const arrivee = nouveauPerso('trickster', {
      modifiers: [modificateurSerment('esprit')],
      fatigue: { max: 4, coches: 3 },
    })
    const ouvert = resoudreCampPourPersonnage(arrivee, 'initial')
    expect(ouvert.char.modifiers).toHaveLength(0)
    expect(ouvert.char.fatigue.coches).toBe(2)

    // Phase Grimoire : elle engage un nouveau Serment pour la session à venir.
    const engagee = {
      ...ouvert.char,
      modifiers: [...ouvert.char.modifiers, modificateurSerment('physique')],
    }
    expect(computeCompetence(engagee, catalog, 'esprit').bonus).toBe(-4)
    expect(computeCompetence(engagee, catalog, 'physique').bonus).toBe(0)

    // Il doit encore être là aux repos courts, et ne tomber qu'au camp initial suivant.
    const repos = resoudreCampPourPersonnage(engagee, 'repos-court')
    expect(repos.char.modifiers).toHaveLength(1)
    expect(resoudreCampPourPersonnage(engagee, 'initial').char.modifiers).toHaveLength(0)
  })

  it('réserve les gains de Foi au camp initial, une fois par session', () => {
    expect(peutRecueillir(ctxCamp)).toBe(true)
    expect(peutPrendreFardeau(ctxCamp)).toBe(true)
    expect(peutPrononcerSerment(ctxCamp)).toBe(true)

    // Un repos court ne rouvre aucun des trois.
    const halte = { ...ctxCamp, type: 'repos-court' as const }
    expect(peutRecueillir(halte)).toBe(false)
    expect(peutPrendreFardeau(halte)).toBe(false)
    expect(peutPrononcerSerment(halte)).toBe(false)

    const deja = { ...ctxCamp, jetons: { ...jetonsCampVierges(), serment: ctxCamp.sessionNumero } }
    expect(peutPrononcerSerment(deja)).toBe(false)

    // …mais le jeton d'une session antérieure ne bloque plus rien.
    const vieux = { ...ctxCamp, jetons: { ...jetonsCampVierges(), serment: 1 } }
    expect(peutPrononcerSerment(vieux)).toBe(true)
  })

  it('n’ouvre la Banque qu’au camp initial, et une fois par session', () => {
    const sansRien = nouveauPerso('trickster')
    expect(peutInvestir(ctxCamp, sansRien)).toBe(true)
    expect(peutInvestir({ ...ctxCamp, type: 'repos-court' }, sansRien)).toBe(false)

    // Le registre des investissements sert lui-même de jeton.
    const dejaInvesti = nouveauPerso('trickster', {
      investissements: [{ investissementId: 'loto', sessionNumero: ctxCamp.sessionNumero }],
    })
    expect(peutInvestir(ctxCamp, dejaInvesti)).toBe(false)

    const sessionPassee = nouveauPerso('trickster', {
      investissements: [{ investissementId: 'loto', sessionNumero: 1 }],
    })
    expect(peutInvestir(ctxCamp, sessionPassee)).toBe(true)
  })

  /**
   * `Campfire` n'avait aucun normaliseur, et les camps déjà en base portent
   * `finDeJournee`/`debutDeSession` sans connaître `type`.
   */
  it('relit un camp écrit avant la refonte', () => {
    const ancienInitial = normaliserCampfire({
      id: 'c1',
      sessionNumero: 2,
      debutDeSession: true,
      finDeJournee: true,
      phase: 'banque',
    } as never)
    expect(ancienInitial.type).toBe('initial')
    expect(ancienInitial.phase).toBe('banque')

    // Une phase que le camp n'ouvre pas retombe sur la première du profil :
    // la MJ ne peut plus se retrouver sans onglet actif.
    const ancienneHalte = normaliserCampfire({
      id: 'c2',
      sessionNumero: 2,
      debutDeSession: false,
      finDeJournee: false,
      phase: 'banque',
    } as never)
    expect(ancienneHalte.type).toBe('repos-court')
    expect(ancienneHalte.phase).toBe('boutique')
    expect(ancienneHalte.offres).toEqual({})
  })

  /**
   * Le Fardeau déplace une case de Fatigue ; il n'en crée pas. La cible était
   * nommée dans le journal mais sa fiche n'était jamais touchée : la porteuse
   * payait sans que personne ne soit soulagé.
   */
  it('déplace la case de Fatigue de la couverte vers la porteuse', () => {
    const porteuse = nouveauPerso('dusk-hunter', { fatigue: { max: 5, coches: 1 } })
    const cible = nouveauPerso('trickster', { fatigue: { max: 4, coches: 3 } })

    const r = resoudreFardeauFatigue(porteuse, cible)
    expect(r.porteuse.fatigue.coches).toBe(2)
    expect(r.couverte.fatigue.coches).toBe(2)
  })

  it('n’offre de couvrir que les alliées qui ont une case à céder', () => {
    expect(peutCouvrirLeFardeau(nouveauPerso('trickster', { fatigue: { max: 4, coches: 2 } }))).toBe(
      true,
    )
    expect(peutCouvrirLeFardeau(nouveauPerso('trickster', { fatigue: { max: 4, coches: 0 } }))).toBe(
      false,
    )
  })

  it('ne dépasse pas la grille de la porteuse', () => {
    const pleine = nouveauPerso('trickster', { fatigue: { max: 4, coches: 4 } })
    const cible = nouveauPerso('trickster', { fatigue: { max: 4, coches: 1 } })
    expect(resoudreFardeauFatigue(pleine, cible).porteuse.fatigue.coches).toBe(4)
  })

  it('refuse un Grimoire à 4 sorts ou avec doublons', () => {
    const char = nouveauPerso('trickster')
    expect(grimoireValide(['a', 'b', 'c'], char, catalog)).toBe(true)
    expect(grimoireValide(['a', 'b', 'c', 'd'], char, catalog)).toBe(false)
    expect(grimoireValide(['a', 'a', 'b'], char, catalog)).toBe(false)
  })
})

describe('tirages', () => {
  /**
   * Régression : on ne comptait que les 1, ce qui divisait le gain par trois.
   * Seule la face 4 est vierge — un 1, un 2 et un 3 portent chacun leur point
   * rouge.
   */
  it('les osselets comptent toutes les faces sauf le 4', () => {
    const { des, brulures } = tirerOsselets(seededRng(11))
    expect(des).toHaveLength(4)
    expect(brulures).toBe(des.filter((d) => d !== 4).length)
    expect(brulures).toBeLessThanOrEqual(4)
  })

  it('ne brûle pas sur un jet de quatre 4', () => {
    // `roll` est déterministe pour une graine : on cherche celle qui donne 4444.
    let toutQuatre: number[] | null = null
    for (let graine = 0; graine < 5000 && !toutQuatre; graine += 1) {
      const { des, brulures } = tirerOsselets(seededRng(graine))
      if (des.every((d) => d === 4)) {
        expect(brulures).toBe(0)
        toutQuatre = des
      }
    }
    expect(toutQuatre).not.toBeNull()
  })

  it('la même graine produit la même suite', () => {
    expect(seededRng(9).roll(5, 20)).toEqual(seededRng(9).roll(5, 20))
  })
})

// ---------------------------------------------------------------------------
// Combat rapide — le duel « Flow »
// ---------------------------------------------------------------------------

/** Enchaîne des manches depuis le début du duel et rend l'historique complet. */
function duel(paires: [ActionDuel, ActionDuel][]): MancheJouee[] {
  const historique: MancheJouee[] = []
  for (const [j, a] of paires) historique.push(jouerManche(etatDuel(historique), j, a))
  return historique
}

describe('Combat rapide — l’anneau des actions', () => {
  it('donne à chaque action exactement deux victimes et deux prédatrices', () => {
    for (const action of ACTIONS_DUEL) {
      const battues = bat(action)
      const perdantes = perdContre(action)

      expect(battues).toHaveLength(2)
      expect(perdantes).toHaveLength(2)
      // Les quatre autres actions se répartissent sans recouvrement : c'est la
      // symétrie qui rend les cinq actions jouables à 20 % chacune.
      expect(new Set([...battues, ...perdantes])).toEqual(
        new Set(ACTIONS_DUEL.filter((a) => a !== action)),
      )
    }
  })

  it('reproduit la table de résolution du document de playtest', () => {
    const attendu: Record<ActionDuel, ActionDuel[]> = {
      pression: ['feinte', 'placement'],
      feinte: ['placement', 'contre'],
      placement: ['contre', 'garde'],
      contre: ['garde', 'pression'],
      garde: ['pression', 'feinte'],
    }
    for (const [action, battues] of Object.entries(attendu)) {
      expect([...bat(action as ActionDuel)]).toEqual(battues)
    }
  })

  it('déclare un Clash sur deux actions identiques', () => {
    for (const action of ACTIONS_DUEL) expect(issueEchange(action, action)).toBe('clash')
    expect(issueEchange('pression', 'feinte')).toBe('joueuse')
    expect(issueEchange('pression', 'garde')).toBe('adversaire')
  })

  it('n’offre aucun Flow à la première manche', () => {
    expect(flowDe(null)).toBeNull()
  })

  it('reproduit la table Flow / Anti-Flow / Appât du document', () => {
    const attendu: [ActionDuel, ActionDuel, ActionDuel, ActionDuel][] = [
      ['pression', 'feinte', 'pression', 'contre'],
      ['feinte', 'placement', 'feinte', 'garde'],
      ['placement', 'contre', 'placement', 'pression'],
      ['contre', 'garde', 'contre', 'feinte'],
      ['garde', 'pression', 'garde', 'placement'],
    ]
    for (const [precedente, flow, anti, appat] of attendu) {
      expect(flowDe(precedente)).toBe(flow)
      expect(briseFlow(precedente)).toBe(anti)
      expect(appatDe(precedente)).toBe(appat)
    }
  })

  /**
   * La propriété qui fait tout l'intérêt du jeu : « BREAK beats FLOW · BAIT
   * beats BREAK · FLOW beats BAIT ». Elle n'est écrite nulle part dans le code,
   * elle **émerge** de l'alignement des deux anneaux — ce test la vérifie.
   */
  it('fait émerger le second pierre-feuille-ciseau, pour les cinq états', () => {
    for (const precedente of ACTIONS_DUEL) {
      const flow = flowDe(precedente) as ActionDuel
      const anti = briseFlow(precedente)
      const appat = appatDe(precedente)

      expect(bat(anti)).toContain(flow)
      expect(bat(appat)).toContain(anti)
      expect(bat(flow)).toContain(appat)
    }
  })
})

describe('Combat rapide — barème', () => {
  it('rapporte 1 point à une victoire ordinaire', () => {
    const [manche] = duel([['pression', 'feinte']])
    expect(manche).toMatchObject({ issue: 'joueuse', points: 1, flow: false })
  })

  it('rapporte 2 points à une victoire qui complète un Flow', () => {
    // Manche 1 : la joueuse gagne avec Garde. Son Flow devient Pression.
    // Manche 2 : elle joue Pression et gagne — 2 points.
    const historique = duel([
      ['garde', 'pression'],
      ['pression', 'placement'],
    ])
    expect(historique[1]).toMatchObject({ issue: 'joueuse', points: 2, flow: true })
    expect(etatDuel(historique).scoreJoueuse).toBe(3)
  })

  it('ne rapporte rien à un Clash, et arme la manche suivante', () => {
    const historique = duel([['contre', 'contre']])
    expect(historique[0]).toMatchObject({ issue: 'clash', points: 0 })
    expect(etatDuel(historique)).toMatchObject({
      scoreJoueuse: 0,
      scoreAdversaire: 0,
      bonusClashActif: true,
    })
  })

  it('paie 2 points la manche décisive qui suit un Clash', () => {
    const historique = duel([
      ['contre', 'contre'],
      ['pression', 'feinte'],
    ])
    expect(historique[1]).toMatchObject({ points: 2, flow: false, bonusClash: true })
  })

  /**
   * Le plafond explicite du document : « If the next decisive winner also
   * completes a Flow, the exchange is still worth 2—not 4. »
   */
  it('plafonne à 2 une victoire Flow qui suit un Clash', () => {
    const historique = duel([
      ['garde', 'pression'], // la joueuse gagne avec Garde : son Flow devient Pression
      ['garde', 'garde'], // Clash sur Garde : le Flow tient, la suivante vaut 2…
      ['pression', 'placement'], // …et c'est justement son Flow. 2, pas 4.
    ])
    expect(historique[2]).toMatchObject({ points: 2, flow: true, bonusClash: true })
    expect(etatDuel(historique).scoreJoueuse).toBe(3)
  })

  it('ne cumule pas deux Clash d’affilée au-delà de 2', () => {
    const historique = duel([
      ['garde', 'garde'],
      ['contre', 'contre'],
      ['pression', 'feinte'],
    ])
    expect(historique[2]?.points).toBe(2)
  })

  /** Un Clash met bien les deux camps sur la même action précédente : l'état « Miroir ». */
  it('inscrit l’action jouée comme précédente, Clash compris', () => {
    const etat = etatDuel(duel([['feinte', 'feinte']]))
    expect(etat.precedenteJoueuse).toBe('feinte')
    expect(etat.precedenteAdversaire).toBe('feinte')
    expect(flowDe(etat.precedenteJoueuse)).toBe(flowDe(etat.precedenteAdversaire))
  })

  it('accorde le Flow à la gagnante, jamais à la perdante', () => {
    // L'adversaire gagne la manche 1 avec Placement, son Flow devient Contre ;
    // il le complète en manche 2. La joueuse, elle, ne marque rien.
    const historique = duel([
      ['contre', 'placement'],
      ['garde', 'contre'],
    ])
    expect(historique[1]).toMatchObject({ issue: 'adversaire', points: 2, flow: true })
    expect(etatDuel(historique)).toMatchObject({ scoreJoueuse: 0, scoreAdversaire: 3 })
  })
})

describe('Combat rapide — fin du duel', () => {
  it('laisse le duel courir tant que rien n’est joué', () => {
    expect(issueDuel([])).toBeNull()
  })

  it('donne la victoire immédiate à qui atteint l’objectif', () => {
    const historique = duel([
      ['garde', 'pression'], // victoire simple : 1
      ['pression', 'placement'], // Flow complété : +2 = 3
      ['placement', 'contre'], // victoire simple : +1 = 4
    ])
    expect(etatDuel(historique).scoreJoueuse).toBe(OBJECTIF_POINTS)
    expect(issueDuel(historique)).toEqual({
      kind: 'victoire',
      vainqueur: 'joueuse',
      motif: 'objectif',
    })
  })

  it('tranche au meilleur score après la cinquième manche', () => {
    const historique = duel([
      ['pression', 'feinte'], // joueuse +1
      ['garde', 'garde'], // clash
      ['contre', 'pression'], // joueuse +2 (bonus clash)
      ['garde', 'placement'], // adversaire +1
      ['pression', 'garde'], // adversaire +1
    ])
    expect(historique).toHaveLength(MANCHES_MAX)
    expect(etatDuel(historique)).toMatchObject({ scoreJoueuse: 3, scoreAdversaire: 2 })
    expect(issueDuel(historique)).toEqual({
      kind: 'victoire',
      vainqueur: 'joueuse',
      motif: 'points',
    })
  })

  it('départage une égalité par la dernière manche marquée', () => {
    const historique = duel([
      ['pression', 'feinte'], // joueuse +1
      ['contre', 'garde'], // joueuse +1 → 2
      ['placement', 'feinte'], // adversaire +1
      ['pression', 'garde'], // adversaire +1 → 2, et c'est la dernière marquée
      ['contre', 'contre'], // clash : le score reste à égalité
    ])
    expect(etatDuel(historique)).toMatchObject({ scoreJoueuse: 2, scoreAdversaire: 2 })
    expect(issueDuel(historique)).toEqual({
      kind: 'victoire',
      vainqueur: 'adversaire',
      motif: 'derniere-marque',
    })
  })

  it('rend le statu quo quand personne n’a marqué', () => {
    const historique = duel([
      ['pression', 'pression'],
      ['feinte', 'feinte'],
      ['placement', 'placement'],
      ['contre', 'contre'],
      ['garde', 'garde'],
    ])
    expect(etatDuel(historique)).toMatchObject({ scoreJoueuse: 0, scoreAdversaire: 0 })
    expect(issueDuel(historique)).toEqual({ kind: 'statu-quo' })
  })
})

describe('Combat rapide — le motif du PNJ', () => {
  it('répète le motif d’une manche à l’autre', () => {
    const motif: ActionDuel[] = ['garde', 'pression', 'feinte']
    expect([1, 2, 3, 4, 5].map((m) => actionScriptee(motif, m))).toEqual([
      'garde',
      'pression',
      'feinte',
      'garde',
      'pression',
    ])
  })

  it('tient sur un motif d’une seule action', () => {
    expect(actionScriptee(['contre'], 4)).toBe('contre')
  })

  it('refuse un motif vide plutôt que d’inventer une action', () => {
    expect(() => actionScriptee([], 1)).toThrow()
  })
})

// ---------------------------------------------------------------------------

function notif(
  contenu: ContenuNotification,
  patch: Partial<Notification> = {},
): Notification {
  return {
    id: 'notif-test',
    cibles: ['pj-test'],
    texte: 'Un buisson s’agite dans la pénombre.',
    contenu,
    reponses: {},
    envoyeeLe: 0,
    ...patch,
  }
}

const CHOIX_BUISSON: ContenuNotification = {
  kind: 'choix',
  options: [
    { id: 'a', libelle: 'Aller voir', cout: coutDe(fixe('lumens', 10)) },
    { id: 'b', libelle: 'Jeter une pierre', cout: COUT_GRATUIT },
  ],
}

describe('Notifications — les options', () => {
  it('propose Écouter contre un point de 6th Sens, et Laisse passer gratuitement', () => {
    const options = optionsDe(notif({ kind: 'sixth-sens' }))
    expect(options.map((o) => o.id)).toEqual(['ecouter', 'laisser'])
    expect(estGratuit(options[0]!.cout)).toBe(false)
    expect(estGratuit(options[1]!.cout)).toBe(true)
  })

  it('rend les options d’un Choix secret telles que la MJ les a écrites', () => {
    expect(optionsDe(notif(CHOIX_BUISSON)).map((o) => o.libelle)).toEqual([
      'Aller voir',
      'Jeter une pierre',
    ])
  })

  it('n’offre qu’une seule option sur un équipement remis', () => {
    const options = optionsDe(notif({ kind: 'equipement', equipementId: 'lame-simple' }))
    expect(options).toHaveLength(1)
    expect(estGratuit(options[0]!.cout)).toBe(true)
  })
})

describe('Notifications — ce qui est payable', () => {
  it('grise Écouter quand il ne reste plus de 6th Sens, mais jamais Laisse passer', () => {
    const char = nouveauPerso('trickster', { sixthSensUtilises: 1 })
    expect(computeSixthSens(char, catalog).restants).toBe(0)

    const choix = choixProposes(char, catalog, notif({ kind: 'sixth-sens' }))
    expect(choix.find((c) => c.option.id === 'ecouter')!.payable).toBe(false)
    expect(choix.find((c) => c.option.id === 'laisser')!.payable).toBe(true)
  })

  it('dit ce qui manque plutôt que de refuser sans un mot', () => {
    const char = nouveauPerso('trickster', { lumens: 6 })
    const choix = choixProposes(char, catalog, notif(CHOIX_BUISSON))
    const a = choix.find((c) => c.option.id === 'a')!

    expect(a.payable).toBe(false)
    expect(a.raison).toContain('il vous en manque 4')
  })

  it('propose un bouton par branche : « 2 Foi OU 10 Lumens » en donne deux', () => {
    const contenu: ContenuNotification = {
      kind: 'choix',
      options: [
        {
          id: 'a',
          libelle: 'Forcer le passage',
          cout: coutAuChoix([fixe('foi', 2)], [fixe('lumens', 10)]),
        },
        { id: 'b', libelle: 'Reculer', cout: COUT_GRATUIT },
      ],
    }

    // 2 Points de Foi à la création, mais 0 Lumens : une seule branche passe.
    const char = nouveauPerso('trickster', { lumens: 0 })
    const choix = choixProposes(char, catalog, notif(contenu))
    const branchesA = choix.filter((c) => c.option.id === 'a')

    expect(branchesA).toHaveLength(2)
    expect(branchesA.map((c) => c.payable)).toEqual([true, false])
    // L'option gratuite reste un seul bouton, sans coût affiché.
    expect(choix.filter((c) => c.option.id === 'b')).toEqual([
      { option: contenu.options[1], branche: 0, libelleCout: null, payable: true, raison: null },
    ])
  })
})

describe('Notifications — répondre', () => {
  it('consomme un point de 6th Sens sur Écouter, et rien sur Laisse passer', () => {
    const char = nouveauPerso('trickster')
    const n = notif({ kind: 'sixth-sens' })

    expect(repondre(char, catalog, n, 'ecouter').char.sixthSensUtilises).toBe(1)
    expect(repondre(char, catalog, n, 'laisser').char.sixthSensUtilises).toBe(0)
  })

  it('met l’objet dans le sac sans l’équiper', () => {
    const char = nouveauPerso('trickster')
    const n = notif({ kind: 'equipement', equipementId: 'lame-simple' })
    const apres = repondre(char, catalog, n, 'prendre').char

    expect(apres.possede.equipements).toContain('lame-simple')
    expect(apres.equipe).toEqual(char.equipe)
  })

  it('prélève sur la branche choisie, et sur elle seule', () => {
    const contenu: ContenuNotification = {
      kind: 'choix',
      options: [
        {
          id: 'a',
          libelle: 'Forcer le passage',
          cout: coutAuChoix([fixe('foi', 2)], [fixe('lumens', 10)]),
        },
      ],
    }
    const char = nouveauPerso('trickster', { lumens: 30 })

    const parLaFoi = repondre(char, catalog, notif(contenu), 'a', 0).char
    expect(parLaFoi.foi).toBe(char.foi - 2)
    expect(parLaFoi.lumens).toBe(30)

    const parLesLumens = repondre(char, catalog, notif(contenu), 'a', 1).char
    expect(parLesLumens.lumens).toBe(20)
    expect(parLesLumens.foi).toBe(char.foi)
  })

  it('refuse une option impayable plutôt que de laisser une jauge passer sous zéro', () => {
    const char = nouveauPerso('trickster', { lumens: 6 })
    expect(() => repondre(char, catalog, notif(CHOIX_BUISSON), 'a')).toThrow()
  })

  it('refuse une option qui n’existe pas', () => {
    const char = nouveauPerso('trickster')
    expect(() => repondre(char, catalog, notif(CHOIX_BUISSON), 'c')).toThrow()
  })
})

describe('Notifications — suivi', () => {
  it('ne compte en attente que les cibles qui n’ont pas répondu', () => {
    const n = notif(CHOIX_BUISSON, {
      cibles: ['pj-1', 'pj-2'],
      reponses: { 'pj-1': { optionId: 'b', repondueLe: 1 } },
    })

    expect(enAttente(n)).toEqual(['pj-2'])
    expect(libelleOption(n, 'b')).toBe('Jeter une pierre')
    // La MJ doit repérer d'un coup d'œil la réponse qui a coûté quelque chose.
    expect(optionCouteuse(n, 'a')).toBe(true)
    expect(optionCouteuse(n, 'b')).toBe(false)
  })
})
