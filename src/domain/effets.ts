import type { Catalog } from './catalog.ts'
import { allModifiers, paliersFlammeAtteints } from './modifiers.ts'
import { LIBELLE_COMPETENCE, type Character, type Modifier, type VieSoulshifter } from './types.ts'

/**
 * Vue unifiée de tout ce qui agit sur un personnage à un instant donné.
 *
 * Les effets d'un personnage n'ont pas tous la même provenance, et c'est ce qui
 * détermine qui peut les changer :
 *
 *  - `choisi`      la joueuse décide (config Hexcore, vie du Soulshifter)
 *  - `feu-de-camp` engagé jusqu'au prochain feu de camp (voie du Trickster)
 *  - `derive`      découle mécaniquement d'un autre état (Voie de la Flamme)
 *  - `equipement`  provient d'un objet porté
 *  - `mj`          attribué par la MJ
 *  - `temporaire`  Fardeau, Serment, Marque, Actions Alternatives
 *
 * Regrouper ces origines en un seul modèle permet à l'écran d'expliquer chaque
 * effet et de n'offrir un contrôle que là où la règle l'autorise.
 */
export type OrigineEffet = 'choisi' | 'feu-de-camp' | 'derive' | 'equipement' | 'mj' | 'temporaire'

export const LIBELLE_ORIGINE: Record<OrigineEffet, string> = {
  choisi: 'Votre choix',
  'feu-de-camp': 'Jusqu’au feu de camp',
  derive: 'Découle de votre état',
  equipement: 'Équipement',
  mj: 'Accordé par la MJ',
  temporaire: 'Temporaire',
}

export interface EffetActif {
  id: string
  nom: string
  origine: OrigineEffet
  /** Une ligne, affichée repliée. */
  resume: string
  /** L'explication complète, dépliée au toucher. */
  detail: string
  /** Les modificateurs chiffrés que porte cet effet, éventuellement aucun. */
  modificateurs: Modifier[]
}

// ---------------------------------------------------------------------------
// Description des modificateurs
// ---------------------------------------------------------------------------

export function decrireCible(target: Modifier['target']): string {
  switch (target.kind) {
    case 'competence':
      return LIBELLE_COMPETENCE[target.competence]
    case 'competence-sauf':
      return `toutes les compétences sauf ${LIBELLE_COMPETENCE[target.except]}`
    case 'competence-toutes':
      return 'toutes les compétences'
    case 'evasion':
      return 'Évasion'
    case 'sixth-sens':
      return '6th Sens'
    case 'energie-attaque':
      return "Points d'Énergie"
    case 'cout-sort':
      return target.filtre?.prefixeNom
        ? `coût des sorts « ${target.filtre.prefixeNom} »`
        : 'coût des sorts'
    case 'fatigue-max':
      return 'Points de Fatigue'
    case 'foi-max':
      return 'Points de Foi maximum'
    case 'marques-max':
      return 'Marques maximum'
    case 'brulures-max':
      return 'Brûlures maximum'
  }
}

export function decrireOperation(op: Modifier['op']): string {
  if (op.kind === 'add') return `${op.value > 0 ? '+' : ''}${op.value}`
  return op.kind === 'avantage' ? 'avantage (+d4)' : 'désavantage (−d4)'
}

export function decrireModificateur(m: Modifier): string {
  return `${decrireCible(m.target)} : ${decrireOperation(m.op)}`
}

// ---------------------------------------------------------------------------

const ORIGINE_PAR_SOURCE: Record<Modifier['source']['kind'], OrigineEffet> = {
  maitrise: 'derive',
  fardeau: 'temporaire',
  serment: 'temporaire',
  marque: 'temporaire',
  equipement: 'equipement',
  'action-alt': 'temporaire',
  passif: 'choisi',
  personnalite: 'choisi',
  'voie-flamme': 'derive',
  cicatrice: 'derive',
  mj: 'mj',
}

const EXPLICATIONS: Record<string, string> = {
  Fardeau:
    "Vous avez pris un fardeau au feu de camp en échange de 3 Points de Foi. Le désavantage court jusqu'à la fin de la journée.",
  Serment:
    "Vous avez prononcé un serment au feu de camp pour 4 Points de Foi. Une compétence a été tirée au sort et reste intacte ; toutes les autres subissent −4 jusqu'à la fin de la journée.",
  Marque:
    "La MJ a dépensé une de vos Marques pour vous imposer un désavantage sur la journée. Un contact prolongé avec l'Oblivion se paie.",
  Esquiver:
    "Action Alternative : votre jet n'a pas percé l'Évasion adverse, vous avez donc mis cette énergie dans votre garde. Le bonus tombe au tour suivant.",
}

/**
 * Effets en cours, prêts à être affichés et expliqués.
 *
 * On part des modificateurs réellement appliqués — explicites et dérivés — puis
 * on ajoute les passifs qui n'en produisent aucun mais changent tout de même la
 * règle (Overheat transforme un gain, Illusionniste débloque des sorts).
 */
export function effetsActifs(
  char: Character,
  catalog: Catalog,
  vies: readonly VieSoulshifter[] = [],
): EffetActif[] {
  const effets: EffetActif[] = []

  // --- Regroupement des modificateurs par source ---
  const groupes = new Map<string, Modifier[]>()
  for (const m of allModifiers(char, catalog)) {
    const cle = `${m.source.kind}|${m.source.label}`
    const liste = groupes.get(cle)
    if (liste) liste.push(m)
    else groupes.set(cle, [m])
  }

  for (const [cle, modificateurs] of groupes) {
    const premier = modificateurs[0] as Modifier
    const nom = premier.source.label
    effets.push({
      id: `mod:${cle}`,
      nom,
      origine: ORIGINE_PAR_SOURCE[premier.source.kind],
      resume: modificateurs.map(decrireModificateur).join(' · '),
      detail: EXPLICATIONS[nom] ?? modificateurs.map(decrireModificateur).join('\n'),
      modificateurs,
    })
  }

  // --- Passifs sans modificateur chiffré ---

  // Dusk Hunter : Overheat agit sur le *gain* de brûlures, pas sur une
  // statistique — il n'existe donc aucun modificateur à afficher.
  if (char.passifs.hexcore === 'overheat') {
    effets.push({
      id: 'passif:overheat',
      nom: 'Overheat',
      origine: 'choisi',
      resume: 'Chaque source de brûlures en produit une de plus',
      detail:
        "Le sang pulse ardemment dans le Hexcore. À chaque fois qu'une source devrait générer X brûlures, elle en génère X+1. Changer de configuration prend l'équivalent d'un tour de combat.",
      modificateurs: [],
    })
  }

  // Trickster : Illusionniste ne modifie aucune valeur, il débloque des sorts.
  if (char.passifs.voieTrickster === 'illusionniste') {
    effets.push({
      id: 'passif:illusionniste',
      nom: 'Illusionniste',
      origine: 'feu-de-camp',
      resume: 'Illusions utilisables à volonté, hors Grimoire',
      detail:
        'Ya gat fooled et Mage hand sont lançables sans contrepartie et ne consomment aucun des 3 emplacements du Grimoire. La voie se choisit à la phase Grimoire du Feu de Camp.',
      modificateurs: [],
    })
  }

  // Soulshifter : la vie incarnée précise l'effet de chaque sort.
  const vie = vieActive(char, vies)
  if (char.passifs.vieActive != null) {
    effets.push({
      id: `passif:vie:${char.passifs.vieActive}`,
      nom: vie ? vie.nom : `Vie n°${char.passifs.vieActive}`,
      origine: 'choisi',
      resume: 'Personnalité incarnée pour l’heure en cours',
      detail: vie
        ? Object.entries(vie.precisions)
            .map(([sortId, texte]) => `${catalog.sort(sortId)?.nom ?? sortId} : ${texte}`)
            .join('\n')
        : 'Personnalité inconnue du catalogue.',
      modificateurs: [],
    })
  }

  // Voie de la Flamme : les paliers atteints produisent chacun leur modificateur
  // (déjà regroupés plus haut). On explicite ici d'où ils viennent, en rappelant
  // qu'ils se cumulent — un palier franchi ne remplace pas le précédent.
  for (const palier of paliersFlammeAtteints(char.brulures)) {
    const existant = effets.find((e) => e.nom === palier.nom)
    if (existant) {
      existant.detail = `Vous portez ${char.brulures} brûlures, ce qui atteint le seuil de ${palier.seuil}. ${palier.effet} Les paliers de la Voie de la Flamme se cumulent : vous conservez les bonus des seuils inférieurs.`
    }
  }

  return effets
}

// ---------------------------------------------------------------------------
// Passif du Soulshifter
// ---------------------------------------------------------------------------

/**
 * Le Soulshifter lance un dé dont le nombre de faces est égal au nombre de vies
 * connues. Le tirage est aléatoire, mais c'est la joueuse qui décide de le
 * déclencher — une fois par heure.
 */
export function facesDuDeDeVies(char: Character): number {
  return char.passifs.viesConnues?.length ?? 0
}

/** La vie actuellement incarnée, si le personnage en a une. */
export function vieActive(
  char: Character,
  vies: readonly VieSoulshifter[],
): VieSoulshifter | null {
  if (char.passifs.vieActive == null) return null
  return vies.find((v) => v.face === char.passifs.vieActive) ?? null
}

/**
 * Précision que la personnalité en cours apporte à un sort donné.
 *
 * Renvoie `null` quand aucune vie n'est incarnée ou que celle-ci ne dit rien de
 * ce sort — l'écran n'affiche alors que l'effet par défaut.
 */
export function precisionPersonnalite(
  sortId: string,
  char: Character,
  vies: readonly VieSoulshifter[],
): string | null {
  return vieActive(char, vies)?.precisions[sortId] ?? null
}
