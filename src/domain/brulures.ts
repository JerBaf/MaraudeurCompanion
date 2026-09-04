import { SEUIL_COMBUSTION } from './elements.ts'
import type { Character } from './types.ts'

/**
 * Brûlures et Combustion — la mécanique de la Magie du Sang.
 *
 * Extraite de `magie.ts` pour une raison de couche : un Coût peut se payer en
 * brûlures, si bien que `couts.ts` a besoin de dépenser une brûlure. Laisser ces
 * fonctions dans `magie.ts`, qui décrit lui-même le coût des sorts, aurait fermé
 * un cycle d'imports. `magie.ts` les ré-exporte : aucun site d'appel ne change.
 *
 * Deux compteurs, et c'est tout le sujet : les brûlures **acquises** ne
 * disparaissent pas quand on les dépense — la marque reste sur la peau, et
 * c'est elle qui porte les paliers de la Voie de la Flamme. Seule la part
 * **consommée** cesse d'être utilisable.
 */

/**
 * Hook Overheat du Dusk Hunter : « à chaque fois qu'une source devrait générer
 * X brûlures, elle en génère X+1 à la place ».
 *
 * Ce n'est pas un modificateur de statistique mais une transformation du gain,
 * d'où son traitement à part du moteur de modificateurs. C'est aussi pourquoi
 * ce n'est **pas** un passif réactif : une réaction s'armerait sur tout
 * mouvement du compteur, or la barre de brûlures sert aussi de bloc-notes —
 * cocher une case pour noter son total ne doit rien produire.
 */
export function gainBrulureEffectif(char: Character, gainBrut: number): number {
  if (gainBrut <= 0) return gainBrut
  return char.passifs.hexcore === 'overheat' ? gainBrut + 1 : gainBrut
}

/** Ce qui reste dépensable. */
export function bruluresDisponibles(char: Character): number {
  return Math.max(0, char.brulures - char.bruluresConsommees)
}

export interface ResultatBrulures {
  gainBrut: number
  gainEffectif: number
  /** Brûlures acquises après le gain, plafonnées à 9. */
  brulures: number
}

/**
 * Applique un gain de brûlures.
 *
 * Le gain n'a **jamais** déclenché la Combustion : c'est la neuvième brûlure
 * *consommée* qui la provoque (voir `consommerBrulures`). Gagner au-delà de 9
 * ne fait rien de plus — le surplus est perdu.
 */
export function appliquerGainBrulures(char: Character, gainBrut: number): ResultatBrulures {
  const gainEffectif = gainBrulureEffectif(char, gainBrut)
  return {
    gainBrut,
    gainEffectif,
    brulures: Math.min(SEUIL_COMBUSTION, char.brulures + gainEffectif),
  }
}

export interface ResultatConsommation {
  brulures: number
  bruluresConsommees: number
  /** La neuvième brûlure a été consommée : 1 Point de Fatigue, tout repart à zéro. */
  combustion: boolean
  fatigueAjoutee: number
}

/**
 * Dépenser des brûlures : soit un sort de Sang de rang N, soit +1 par brûlure
 * à un jet.
 *
 * « Une fois arrivée au seuil maximal de brûlure, établi à 9, le joueur doit
 * prendre un Point de Fatigue. Son nombre de brûlures est ensuite remis à
 * zéro. » Ce seuil se compte sur les brûlures **consommées** : accumuler neuf
 * marques sans en dépenser aucune ne brûle personne.
 */
export function consommerBrulures(char: Character, nombre: number): ResultatConsommation {
  const dispo = bruluresDisponibles(char)
  if (nombre < 0 || nombre > dispo) {
    throw new Error(`Impossible de dépenser ${nombre} brûlure(s) (disponibles : ${dispo})`)
  }

  const consommees = char.bruluresConsommees + nombre
  const combustion = consommees >= SEUIL_COMBUSTION

  return {
    brulures: combustion ? 0 : char.brulures,
    bruluresConsommees: combustion ? 0 : consommees,
    combustion,
    fatigueAjoutee: combustion ? 1 : 0,
  }
}

export type EtatCaseBrulure = 'vierge' | 'disponible' | 'consommee'

/** L'état d'une case de la barre de brûlures. Les deux compteurs sont des préfixes. */
export function etatCaseBrulure(char: Character, index: number): EtatCaseBrulure {
  if (index < char.bruluresConsommees) return 'consommee'
  if (index < char.brulures) return 'disponible'
  return 'vierge'
}

/**
 * Fait tourner une case de la barre : vierge → disponible → consommée → vierge.
 *
 * C'est le geste le plus direct à table — on marque ce qu'on vient de tirer,
 * puis ce qu'on vient de dépenser, sur la même case. Les deux compteurs restant
 * des préfixes, retirer une case retire aussi tout ce qui la suit : une barre
 * trouée n'aurait pas de sens.
 */
export function basculerCaseBrulure(char: Character, index: number): ResultatConsommation {
  const inchange = {
    brulures: char.brulures,
    bruluresConsommees: char.bruluresConsommees,
    combustion: false,
    fatigueAjoutee: 0,
  }

  switch (etatCaseBrulure(char, index)) {
    case 'vierge':
      return { ...inchange, brulures: Math.min(SEUIL_COMBUSTION, index + 1) }
    case 'disponible':
      // Passe par la consommation : c'est elle qui sait reconnaître la neuvième.
      return consommerBrulures(char, index + 1 - char.bruluresConsommees)
    case 'consommee':
      return { ...inchange, brulures: index, bruluresConsommees: index }
  }
}

/**
 * Combustion volontaire : la joueuse paie 1 Point de Fatigue pour disposer
 * instantanément des neuf brûlures — et elles sont **toutes dépensables**,
 * sinon la manœuvre n'aurait aucun intérêt.
 */
export function combustionVolontaire(): {
  brulures: number
  bruluresConsommees: number
  fatigueAjoutee: number
} {
  return { brulures: SEUIL_COMBUSTION, bruluresConsommees: 0, fatigueAjoutee: 1 }
}

/** Le rang du sort de Magie du Sang lancé correspond au nombre de brûlures dépensées. */
export function rangSortSang(bruluresDepensees: number): number {
  return bruluresDepensees
}
