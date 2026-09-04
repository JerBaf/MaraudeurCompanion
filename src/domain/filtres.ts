import { prixDe } from './campfire.ts'
import type { Cout } from './couts.ts'
import { sortOuvertA } from './magie.ts'
import {
  RARETES,
  type Dossier,
  type EntreeCatalogue,
  type Rarete,
  type SlotEquipement,
} from './types.ts'

/**
 * Filtrage et tri du catalogue.
 *
 * Un catalogue de table devient vite long, et il était jusqu'ici parcouru à
 * l'œil : les seuls filtres existants vivaient dans l'éditeur de la MJ, écrits
 * à même l'écran, tandis que les listes de la joueuse et les « Accorder… » de
 * l'inventaire énuméraient tout sans rien proposer.
 *
 * Ces règles vivent donc dans le domaine, où elles se testent, et un composant
 * unique les présente partout de la même façon.
 */

export type CleTri = 'nom' | 'rarete' | 'prix' | 'cout' | 'creation'

export const LIBELLE_TRI: Record<CleTri, string> = {
  nom: 'Nom',
  rarete: 'Rareté',
  prix: 'Prix',
  cout: 'Coût',
  creation: 'Date de création',
}

/**
 * Le dossier « ALL » n'est pas stocké : c'est l'absence de filtre.
 * `SANS_DOSSIER` désigne au contraire ce qui n'a été rangé nulle part.
 */
export const DOSSIER_TOUS = ''
export const SANS_DOSSIER = 'sans-dossier'

export interface FiltresCatalogue {
  /** Recherche sur le nom et la description, insensible à la casse et aux accents. */
  texte: string
  dossierId: string
  rarete: Rarete | ''
  classeId: string
  magieId: string
  slot: SlotEquipement | ''
  tri: CleTri
  ordre: 'asc' | 'desc'
}

export const FILTRES_VIERGES: FiltresCatalogue = {
  texte: '',
  dossierId: DOSSIER_TOUS,
  rarete: '',
  classeId: '',
  magieId: '',
  slot: '',
  tri: 'nom',
  ordre: 'asc',
}

/**
 * Les axes qui ont un sens pour une famille d'entrées.
 *
 * La classe et le type magique ne concernent que les sorts, l'emplacement que
 * les équipements : les proposer ailleurs donnerait des filtres qui ne filtrent
 * rien, et un catalogue vide sans qu'on comprenne pourquoi.
 */
export function axesPertinents(kind: EntreeCatalogue['kind']): (keyof FiltresCatalogue)[] {
  const communs: (keyof FiltresCatalogue)[] = ['texte', 'dossierId', 'rarete']
  switch (kind) {
    case 'sort':
      return [...communs, 'classeId', 'magieId']
    case 'equipement':
      return [...communs, 'slot']
    default:
      return communs
  }
}

/** Le dossier n'existe que pour les trois familles qu'on range. */
export function familleRangeable(
  kind: EntreeCatalogue['kind'],
): 'sort' | 'equipement' | 'amelioration' | null {
  return kind === 'sort' || kind === 'equipement' || kind === 'amelioration' ? kind : null
}

// ---------------------------------------------------------------------------
// Comparaisons
// ---------------------------------------------------------------------------

/**
 * Normalise pour la recherche : sans accents, sans casse.
 *
 * Une MJ qui cherche « epee » doit trouver « Épée ». Sans cela le filtre serait
 * inutilisable en français à une main, sur téléphone.
 */
function sansAccents(texte: string): string {
  return texte
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
}

const RANG_RARETE = Object.keys(RARETES) as Rarete[]

/**
 * Le poids d'un coût, pour le tri.
 *
 * La branche la moins chère fait foi — c'est ce que la joueuse paiera si elle
 * le peut. Les parts variables comptent pour zéro : le X est choisi au
 * lancement, et le prétendre connu tromperait le tri.
 */
export function poidsCout(cout: Cout): number {
  if (cout.branches.length === 0) return 0
  const poids = cout.branches.map((b) =>
    b.parts.reduce((total, p) => total + (p.kind === 'fixe' ? p.valeur : 0), 0),
  )
  return Math.min(...poids)
}

function coutDe(entree: EntreeCatalogue): number {
  return entree.kind === 'sort' ? poidsCout(entree.cout) : 0
}

function comparer(a: EntreeCatalogue, b: EntreeCatalogue, tri: CleTri): number {
  switch (tri) {
    case 'nom':
      return a.nom.localeCompare(b.nom, 'fr')
    case 'rarete':
      return RANG_RARETE.indexOf(a.rarete ?? 'commun') - RANG_RARETE.indexOf(b.rarete ?? 'commun')
    case 'prix':
      // Sans prix = hors boutique : rangé en fin de liste, jamais mêlé aux gratuits.
      return (prixDe(a) ?? Number.POSITIVE_INFINITY) - (prixDe(b) ?? Number.POSITIVE_INFINITY)
    case 'cout':
      return coutDe(a) - coutDe(b)
    case 'creation':
      // Les entrées d'avant l'existence du champ passent pour les plus anciennes.
      return (a.creeLe ?? 0) - (b.creeLe ?? 0)
  }
}

// ---------------------------------------------------------------------------

/**
 * Filtre puis trie.
 *
 * Chaque axe ne s'applique qu'aux entrées qu'il concerne : filtrer par
 * emplacement ne fait pas disparaître les sorts d'une liste mixte, il n'a
 * simplement rien à y dire.
 */
export function filtrerEntrees(
  entrees: readonly EntreeCatalogue[],
  filtres: FiltresCatalogue,
): EntreeCatalogue[] {
  const recherche = sansAccents(filtres.texte.trim())

  const gardees = entrees.filter((e) => {
    if (recherche) {
      const cible = sansAccents(`${e.nom} ${e.description ?? ''}`)
      if (!cible.includes(recherche)) return false
    }

    if (filtres.dossierId === SANS_DOSSIER) {
      if (e.dossierId) return false
    } else if (filtres.dossierId !== DOSSIER_TOUS) {
      if (e.dossierId !== filtres.dossierId) return false
    }

    if (filtres.rarete && (e.rarete ?? 'commun') !== filtres.rarete) return false
    if (filtres.slot && e.kind === 'equipement' && e.slot !== filtres.slot) return false
    if (filtres.magieId && e.kind === 'sort' && e.magieId !== filtres.magieId) return false
    if (filtres.classeId && e.kind === 'sort' && !sortOuvertA(e, filtres.classeId)) return false

    return true
  })

  // Tri stable : à égalité sur l'axe demandé, le nom départage. Sans cela
  // l'ordre serait celui — imprévisible — des documents Firestore.
  const sens = filtres.ordre === 'desc' ? -1 : 1
  return gardees.sort((a, b) => {
    const delta = comparer(a, b, filtres.tri)
    return delta !== 0 ? delta * sens : a.nom.localeCompare(b.nom, 'fr')
  })
}

/** Les dossiers d'une famille, dans l'ordre voulu par la MJ. */
export function dossiersDe(
  catalog: { dossiers(): Dossier[] },
  cible: 'sort' | 'equipement' | 'amelioration',
) {
  return catalog
    .dossiers()
    .filter((d) => d.cible === cible)
    .sort((a, b) => a.ordre - b.ordre || a.nom.localeCompare(b.nom, 'fr'))
}
