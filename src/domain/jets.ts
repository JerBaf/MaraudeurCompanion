import type { Catalog } from './catalog.ts'
import { computeCompetence } from './competences.ts'
import type { Des, Rng } from './random.ts'
import { LIBELLE_COMPETENCE, type Character, type Competence } from './types.ts'

/**
 * Le vocabulaire d'un jet de dés.
 *
 * Jusqu'ici l'application ne lançait que ce dont un *effet* dépendait — le dé
 * d'un sort, la table d'un Actif, les osselets — et le Test de Compétence, qui
 * est pourtant la mécanique de résolution centrale du jeu, n'existait nulle
 * part : le ±d4 d'avantage n'était qu'une puce d'affichage.
 *
 * Un `Jet` est volontairement **une addition nommée**, pas une machine à
 * résoudre : une liste de termes, un seuil facultatif, et l'état du Destin. Ce
 * qui rend le total lisible à table — « d20 11 · maîtrise +3 · Brûlure +1 = 15 »
 * — est exactement ce qui le rend journalisable, sans deuxième format à tenir.
 *
 * ⚠️ Aucune valeur n'est stockée : la maîtrise et ses modificateurs repassent
 * par `computeCompetence` au moment du jet, comme partout ailleurs.
 */

/** Une composante chiffrée du total, nommée pour rester lisible. */
export interface Terme {
  libelle: string
  valeur: number
}

export interface Jet {
  /** D'où il vient, pour l'écran et pour le journal : « Physique », « Éclair ». */
  libelle: string
  termes: Terme[]
  /** Le seuil annoncé par la MJ, quand elle l'a annoncé. */
  seuil: number | null
  /**
   * Seul un Test de Compétence peut être poussé, et une seule fois. Les autres
   * jets valent `impossible` : sous le seuil ils échouent, sans devenir
   * critiques.
   */
  destin: 'impossible' | 'disponible' | 'force'
}

export type IssueJet = 'reussite' | 'echec' | 'echec-critique' | 'indetermine'

export const LIBELLE_ISSUE: Record<IssueJet, string> = {
  reussite: 'réussite',
  echec: 'échec',
  'echec-critique': 'échec critique',
  // Sans seuil, l'application ne prétend pas savoir : la MJ compare elle-même.
  indetermine: 'à la MJ de trancher',
}

/** Rules_For_Agents.pdf, « Test de Compétences » : le jet de base est un d20. */
export const DE_COMPETENCE = 20

/** « Avantage et désavantage se traduisent par un lancé de d4. » */
export const DE_AVANTAGE = 4

export function totalJet(jet: Jet): number {
  return jet.termes.reduce((total, t) => total + t.valeur, 0)
}

/**
 * L'issue du jet.
 *
 * « Mais si le score total est inférieur au seuil, alors le test est un échec
 * critique et la MJ tentera d'ajouter une Marque au personnage. » — d'où le fait
 * qu'un échec ne devienne critique **qu'après** avoir forcé le Destin. Rien
 * n'est appliqué ici : c'est la joueuse qui prend la Marque, d'un geste.
 */
export function issueJet(jet: Jet): IssueJet {
  if (jet.seuil === null) return 'indetermine'
  if (totalJet(jet) >= jet.seuil) return 'reussite'
  return jet.destin === 'force' ? 'echec-critique' : 'echec'
}

export function ajouterTerme(jet: Jet, terme: Terme): Jet {
  return { ...jet, termes: [...jet.termes, terme] }
}

/** Le jet en toutes lettres — le même texte à l'écran et au journal. */
export function decrireJet(jet: Jet): string {
  const detail = jet.termes
    .map((t, i) => (i === 0 ? `${t.libelle} ${t.valeur}` : `${t.libelle} ${signe(t.valeur)}`))
    .join(' · ')

  const contre =
    jet.seuil === null
      ? ''
      : ` contre ${jet.seuil} → ${LIBELLE_ISSUE[issueJet(jet)]}`

  return `${jet.libelle} : ${detail} = ${totalJet(jet)}${contre}`
}

function signe(valeur: number): string {
  return valeur < 0 ? `−${Math.abs(valeur)}` : `+${valeur}`
}

// ---------------------------------------------------------------------------
// Test de Compétence
// ---------------------------------------------------------------------------

/**
 * Les dés qu'un Test de Compétence demande, **dans l'ordre où `jetCompetence`
 * les consomme**. Le d4 n'est demandé que si le net n'est pas neutre —
 * avantage et désavantage s'annulant un pour un (`netAvantage`).
 */
export function desJetCompetence(net: 'avantage' | 'desavantage' | 'neutre'): Des[] {
  const des: Des[] = [{ nombre: 1, faces: DE_COMPETENCE }]
  if (net !== 'neutre') des.push({ nombre: 1, faces: DE_AVANTAGE })
  return des
}

/**
 * Compose le jet à partir des dés obtenus — que l'application les ait tirés ou
 * que la joueuse les ait saisis. Les deux chemins passent par ici, donc par les
 * mêmes règles.
 */
export function jetCompetence(
  char: Character,
  catalog: Catalog,
  competence: Competence,
  seuil: number | null,
  rng: Rng,
): Jet {
  const v = computeCompetence(char, catalog, competence)

  const termes: Terme[] = [{ libelle: `d${DE_COMPETENCE}`, valeur: rng.int(1, DE_COMPETENCE) }]

  if (v.net !== 'neutre') {
    const d4 = rng.int(1, DE_AVANTAGE)
    termes.push({
      libelle: v.net === 'avantage' ? `avantage d${DE_AVANTAGE}` : `désavantage d${DE_AVANTAGE}`,
      valeur: v.net === 'avantage' ? d4 : -d4,
    })
  }

  // Maîtrise et modificateurs restent deux termes : à table, « pourquoi j'ai
  // +3 alors que ma fiche dit −1 » se répond en lisant la ligne.
  if (v.base !== 0) termes.push({ libelle: 'maîtrise', valeur: v.base })
  if (v.bonus !== 0) termes.push({ libelle: 'modificateurs', valeur: v.bonus })

  return { libelle: LIBELLE_COMPETENCE[competence], termes, seuil, destin: 'disponible' }
}

/**
 * Forcer le Destin : « la possibilité de jeter un dé d'une valeur équivalente au
 * jet de base (d20), et d'additionner le résultat au jet précédent ».
 *
 * Une seule fois par jet, et seulement sur un Test de Compétence.
 */
export function forcerDestin(jet: Jet, rng: Rng): Jet {
  if (jet.destin !== 'disponible') {
    throw new Error('Le Destin a déjà été forcé, ou ce jet ne le permet pas.')
  }

  const pousse = ajouterTerme(jet, {
    libelle: `Destin d${DE_COMPETENCE}`,
    valeur: rng.int(1, DE_COMPETENCE),
  })
  return { ...pousse, destin: 'force' }
}

/** Le d20 du Destin, à saisir quand c'est la joueuse qui lance. */
export const DES_DESTIN: Des[] = [{ nombre: 1, faces: DE_COMPETENCE }]

/**
 * La brûlure dépensée sur un jet : « ajouter un +1 à n'importe quel jet par
 * brûlure utilisée ». La dépense elle-même passe par `consommerBrulures`.
 */
export function termeBrulure(): Terme {
  return { libelle: 'Brûlure', valeur: 1 }
}
