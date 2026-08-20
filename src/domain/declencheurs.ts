import type { Catalog } from './catalog.ts'
import {
  computeBruluresMax,
  computeFatigueMax,
  computeFoiMax,
  computeMarquesMax,
} from './competences.ts'
import type { Character, Declencheur, Ressource } from './types.ts'

/**
 * Passifs réactifs.
 *
 * Le moteur de modificateurs sait ajuster une valeur affichée ; il ne sait pas
 * *réagir* à un changement. « Quand tu prends une Marque, gagne un Point de
 * Foi » demande un second mécanisme : on compare l'état d'avant à celui d'après,
 * et on applique ce qui s'est armé.
 *
 * Deux bornes, sans lesquelles la mécanique serait ingérable :
 *
 *  - **une seule passe**. Un déclencheur ne peut pas en réveiller un autre.
 *    Sans cela, « +1 Foi quand la Foi augmente » bouclerait à l'infini, et une
 *    cascade serait de toute façon impossible à suivre à table.
 *  - **le résultat reste borné** par les plafonds dérivés : un déclencheur ne
 *    fait pas déborder une jauge.
 *
 * Un déclencheur s'arme au même régime que les modificateurs — objet porté,
 * amélioration possédée. Un talisman au fond du sac ne réagit à rien.
 */

export const LIBELLE_RESSOURCE: Record<Ressource, string> = {
  fatigue: 'Points de Fatigue',
  marques: 'Marques',
  foi: 'Points de Foi',
  brulures: 'Brûlures',
  lumens: 'Lumens',
}

export const RESSOURCES: Ressource[] = ['fatigue', 'marques', 'foi', 'brulures', 'lumens']

/**
 * La valeur courante d'une ressource.
 *
 * Deux pièges : la Fatigue se compte en **cases cochées**, et les brûlures en
 * marques **acquises** — la part consommée n'est pas une ressource distincte.
 */
export function lireRessource(char: Character, r: Ressource): number {
  switch (r) {
    case 'fatigue':
      return char.fatigue.coches
    case 'marques':
      return char.marques
    case 'foi':
      return char.foi
    case 'brulures':
      return char.brulures
    case 'lumens':
      return char.lumens
  }
}

function plafondDe(char: Character, catalog: Catalog, r: Ressource): number {
  switch (r) {
    case 'fatigue':
      return computeFatigueMax(char, catalog).max
    case 'marques':
      return computeMarquesMax(char, catalog).max
    case 'foi':
      return computeFoiMax(char, catalog).max
    case 'brulures':
      return computeBruluresMax(char, catalog).max
    case 'lumens':
      // Les Lumens n'ont pas de plafond : c'est une bourse, pas une jauge.
      return Number.POSITIVE_INFINITY
  }
}

export function ecrireRessource(
  char: Character,
  catalog: Catalog,
  r: Ressource,
  valeur: number,
): Character {
  const borne = Math.max(0, Math.min(plafondDe(char, catalog, r), valeur))
  switch (r) {
    case 'fatigue':
      return { ...char, fatigue: { ...char.fatigue, coches: borne } }
    case 'marques':
      return { ...char, marques: borne }
    case 'foi':
      return { ...char, foi: borne }
    case 'brulures':
      return { ...char, brulures: borne }
    case 'lumens':
      return { ...char, lumens: borne }
  }
}

export interface DeclencheurActif {
  declencheur: Declencheur
  /** Nom de l'objet ou de l'amélioration qui l'accorde. */
  source: string
  /** Sa provenance, pour que l'écran sache qui a le droit de le retirer. */
  provenance: 'equipement' | 'amelioration'
  /** Identifiant de l'entrée de catalogue, pour distinguer deux sources homonymes. */
  ref: string
}

/** Les déclencheurs en vigueur : équipement porté, améliorations possédées. */
export function declencheursActifs(char: Character, catalog: Catalog): DeclencheurActif[] {
  const out: DeclencheurActif[] = []

  for (const id of Object.values(char.equipe)) {
    if (!id) continue
    const eq = catalog.equipement(id)
    eq?.declencheurs?.forEach((d) =>
      out.push({ declencheur: d, source: eq.nom, provenance: 'equipement', ref: eq.id }),
    )
  }

  for (const id of char.possede.ameliorations) {
    const am = catalog.amelioration(id)
    am?.declencheurs?.forEach((d) =>
      out.push({ declencheur: d, source: am.nom, provenance: 'amelioration', ref: am.id }),
    )
  }

  return out
}

/** Le déclencheur en une phrase, pour l'écran des effets en cours. */
export function decrireDeclencheur(d: Declencheur): string {
  const signe = d.delta > 0 ? '+' : ''
  return `Quand ${LIBELLE_RESSOURCE[d.quand]} ${d.sens} : ${LIBELLE_RESSOURCE[d.alors]} ${signe}${d.delta}`
}

export interface ResultatDeclencheurs {
  char: Character
  /** Un récit par déclencheur armé, à montrer et à journaliser. */
  recits: string[]
}

/**
 * Applique les déclencheurs armés par le passage de `avant` à `apres`.
 *
 * Les déclencheurs sont lus sur l'état **d'après** : équiper un talisman et
 * prendre une Marque dans le même geste doit armer le talisman.
 */
export function resoudreDeclencheurs(
  avant: Character,
  apres: Character,
  catalog: Catalog,
): ResultatDeclencheurs {
  const recits: string[] = []
  let char = apres

  for (const { declencheur, source } of declencheursActifs(apres, catalog)) {
    const delta = lireRessource(apres, declencheur.quand) - lireRessource(avant, declencheur.quand)
    const arme = declencheur.sens === 'augmente' ? delta > 0 : delta < 0
    if (!arme) continue

    // Lu sur `char` et non sur `apres` : deux déclencheurs visant la même
    // ressource s'additionnent au lieu de s'écraser.
    const avantEffet = lireRessource(char, declencheur.alors)
    char = ecrireRessource(char, catalog, declencheur.alors, avantEffet + declencheur.delta)

    const applique = lireRessource(char, declencheur.alors) - avantEffet
    if (applique === 0) continue

    recits.push(
      `${source} — ${LIBELLE_RESSOURCE[declencheur.alors]} ${applique > 0 ? '+' : ''}${applique}`,
    )
  }

  return { char, recits }
}
