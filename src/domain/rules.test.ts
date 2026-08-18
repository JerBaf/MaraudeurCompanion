import { describe, expect, it } from 'vitest'

import { SEED } from '../content/seed.ts'
import { resoudreCampPourPersonnage } from './campfire.ts'
import { createCatalog } from './catalog.ts'
import { appliquerProfil, creerPersonnage, maitrisesSuiventLeProfil } from './character.ts'
import {
  ACTIONS_ALTERNATIVES,
  estSonTour,
  repartirParInitiative,
  resoudreAttaque,
  sousGroupeInitiative,
} from './combat.ts'
import {
  actionsRapidesMax,
  computeCompetence,
  computeEvasion,
  computeSixthSens,
} from './competences.ts'
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
  resoudreArcane,
} from './magie.ts'
import {
  derivedModifiers,
  expireModifiers,
  modificateurEsquive,
  modificateurFardeau,
  modificateurSerment,
  palierVoieDeLaFlamme,
} from './modifiers.ts'
import { seededRng, tirerEffetAleatoire, tirerOsselets } from './random.ts'
import type { Character, Sort } from './types.ts'

const catalog = createCatalog(SEED)

function nouveauPerso(classeId: string, patch: Partial<Character> = {}): Character {
  const { char } = creerPersonnage(
    {
      id: 'pj-test',
      nom: 'Maya',
      classeId,
      maitrises: appliquerProfil(['physique', 'roublardise'], 'esprit'),
    },
    catalog,
    seededRng(1),
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

  it('garde les cycles hors de la fiche publique', () => {
    const { char, secret } = creerPersonnage(
      { id: 'x', nom: 'Lila', classeId: 'trickster', maitrises: appliquerProfil(['esprit', 'social'], 'physique') },
      catalog,
      seededRng(7),
      0,
    )
    expect(secret.cyclesTotal).toBeGreaterThanOrEqual(3)
    expect(secret.cyclesTotal).toBeLessThanOrEqual(6)
    expect(JSON.stringify(char)).not.toContain('cycle')
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
  it('découpe les paliers 1-3 / 4-6 / 7-9', () => {
    expect(palierVoieDeLaFlamme(0)).toBe('aucun')
    expect(palierVoieDeLaFlamme(3)).toBe('aucun')
    expect(palierVoieDeLaFlamme(4)).toBe('perception')
    expect(palierVoieDeLaFlamme(6)).toBe('perception')
    expect(palierVoieDeLaFlamme(7)).toBe('fureur')
  })

  it('accorde +1 6th Sens entre 4 et 6 brûlures, sans rien persister', () => {
    const calme = nouveauPerso('dusk-hunter', { brulures: 3 })
    const chaud = nouveauPerso('dusk-hunter', { brulures: 5 })

    expect(computeSixthSens(calme, catalog).max).toBe(1)
    expect(computeSixthSens(chaud, catalog).max).toBe(2)
    expect(chaud.modifiers).toHaveLength(0)
    expect(derivedModifiers(chaud, catalog).some((m) => m.target.kind === 'sixth-sens')).toBe(true)
  })

  it('bascule sur l’avantage en Physique à partir de 7 brûlures', () => {
    const brasier = nouveauPerso('dusk-hunter', { brulures: 8 })
    expect(computeCompetence(brasier, catalog, 'physique').net).toBe('avantage')
    expect(computeSixthSens(brasier, catalog).max).toBe(1)
  })

  it('ne produit jamais un reste de 6th Sens négatif en changeant de palier', () => {
    const char = nouveauPerso('dusk-hunter', { brulures: 8, sixthSensUtilises: 2 })
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

describe('Esquiver', () => {
  it('ajoute +1 à l’Évasion', () => {
    const char = nouveauPerso('trickster', { modifiers: [modificateurEsquive(3)] })
    expect(computeEvasion(char, catalog).total).toBe(2)
  })

  it('survit à son tour et tombe au tour suivant', () => {
    const mods = [modificateurEsquive(3)]
    expect(expireModifiers(mods, { kind: 'tour', tour: 3 })).toHaveLength(1)
    expect(expireModifiers(mods, { kind: 'tour', tour: 4 })).toHaveLength(0)
    expect(expireModifiers(mods, { kind: 'fin-combat' })).toHaveLength(0)
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
