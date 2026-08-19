import type { Catalog } from './catalog.ts'
import { allModifiers, palierVoieDeLaFlamme } from './modifiers.ts'
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

  // Soulshifter : la vie incarnée colore les quatre sorts.
  if (char.passifs.vieActive != null) {
    const vie = vies.find((v) => v.face === char.passifs.vieActive)
    effets.push({
      id: `passif:vie:${char.passifs.vieActive}`,
      nom: vie ? vie.nom : `Vie n°${char.passifs.vieActive}`,
      origine: 'choisi',
      resume: 'Personnalité incarnée pour l’heure en cours',
      detail: vie
        ? `Companion : ${vie.companion}\nElement : ${vie.element}\nTribue : ${vie.tribue}\nSens : ${vie.sens}`
        : 'Personnalité inconnue du catalogue.',
      modificateurs: [],
    })
  }

  // Voie de la Flamme : le palier « perception » et « fureur » produisent bien
  // des modificateurs (déjà regroupés plus haut), mais on explicite le palier
  // courant pour que la joueuse comprenne d'où il vient.
  const palier = palierVoieDeLaFlamme(char.brulures)
  if (palier !== 'aucun') {
    const existant = effets.find((e) => e.nom.startsWith('Voie de la Flamme'))
    if (existant) {
      existant.detail =
        palier === 'perception'
          ? `Vous portez ${char.brulures} brûlures (palier 4-6). La chaleur aiguise votre perception : vous gagnez un point de 6th Sens supplémentaire. Il disparaîtra si vous descendez sous 4 ou montez à 7.`
          : `Vous portez ${char.brulures} brûlures (palier 7-9). Le brasier vous porte : avantage sur tous les jets de Physique. Attention, à 9 brûlures la Combustion vous coûte un Point de Fatigue.`
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
