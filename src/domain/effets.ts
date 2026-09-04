import type { Catalog } from './catalog.ts'
import { decrireCible } from './elements.ts'
import { allModifiers } from './modifiers.ts'
import {
  conditionRemplie,
  decrirePassif,
  paliersFlammeAtteints,
  passifsActifs,
  type ProvenancePassif,
} from './passifs.ts'
import type { Character, Modifier, VieSoulshifter } from './types.ts'

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

/*
 * `decrireCible` vit avec le vocabulaire qu'elle décrit, dans `elements.ts` :
 * un élément ajouté au registre s'y nomme tout seul, au lieu de demander une
 * branche de plus dans un `switch` que rien n'obligeait à tenir à jour.
 */
export { decrireCible } from './elements.ts'

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

const ORIGINE_PAR_PROVENANCE: Record<ProvenancePassif, OrigineEffet> = {
  equipement: 'equipement',
  amelioration: 'choisi',
  classe: 'choisi',
  'type-magique': 'derive',
  derive: 'derive',
}

const EXPLICATION_PAR_PROVENANCE: Record<ProvenancePassif, string> = {
  equipement: "S'applique tant que l'objet est porté.",
  amelioration: "Acquis en permanence : une amélioration n'occupe aucun emplacement.",
  classe: 'Accordé par votre classe.',
  'type-magique': 'Découle du type de magie que vous pratiquez.',
  derive: 'Découle de votre état, sans que vous l’ayez choisi.',
}

/**
 * Effets en cours, prêts à être affichés et expliqués.
 *
 * ⚠️ **Ce point était un piège durable du projet** : la liste partait des
 * modificateurs, si bien que tout passif n'en produisant pas — une réaction,
 * Overheat, Illusionniste — devait y être ajouté *à la main*, et l'oubli ne se
 * voyait nulle part. Un passif réactif accordé par une amélioration n'apparut
 * ainsi nulle part pendant des semaines.
 *
 * Depuis l'unification, la liste part des **passifs** : tout ce que la MJ
 * compose y figure par construction, qu'il produise un modificateur ou non.
 * Ne restent en dur que les trois mécaniques qui ne sont pas des passifs —
 * Overheat transforme un gain, Illusionniste débloque des sorts, la vie du
 * Soulshifter recolore des sorts.
 */
export function effetsActifs(
  char: Character,
  catalog: Catalog,
  vies: readonly VieSoulshifter[] = [],
): EffetActif[] {
  const effets: EffetActif[] = []

  // --- Les passifs en vigueur, chiffrés ou non ---
  const modsParPassif = new Map<string, Modifier[]>()
  for (const m of allModifiers(char, catalog)) {
    const cle = m.id.startsWith('derive:passif:') ? m.id.split(':').slice(0, 5).join(':') : null
    if (!cle) continue
    const liste = modsParPassif.get(cle)
    if (liste) liste.push(m)
    else modsParPassif.set(cle, [m])
  }

  for (const { passif, source, provenance, ref } of passifsActifs(char, catalog)) {
    if (!conditionRemplie(passif, char)) continue

    const nom = passif.libelle || source
    const modificateurs = modsParPassif.get(`derive:passif:${ref}:${passif.id}`) ?? []
    const resume = decrirePassif(passif)

    effets.push({
      id: `passif:${ref}:${passif.id}`,
      nom,
      origine: ORIGINE_PAR_PROVENANCE[provenance],
      resume,
      detail: `${passif.effet.texte || resume}\n\n${EXPLICATION_PAR_PROVENANCE[provenance]}`,
      modificateurs,
    })
  }

  // --- Les modificateurs qui ne viennent d'aucun passif ---
  // Fardeau, Serment, Marque, Esquive, Diversion, ajustements de la MJ, bonus
  // d'Évasion d'une armure : de la monnaie d'exécution, pas du contenu.
  const groupes = new Map<string, Modifier[]>()
  for (const m of allModifiers(char, catalog)) {
    if (m.id.startsWith('derive:passif:')) continue
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
      resume: 'Illusions utilisables à volonté, hors emplacements',
      detail:
        'Ya gat fooled et Mage hand sont lançables sans contrepartie et ne consomment aucun des 3 emplacements de Sorts. La voie se choisit à la phase Sorts du Feu de Camp.',
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
      detail: vie ? detailVie(vie, catalog) : 'Personnalité inconnue du catalogue.',
      modificateurs: [],
    })
  }

  // Voie de la Flamme : les paliers figurent déjà dans la liste — ce sont des
  // passifs à seuil comme les autres. On précise seulement d'où ils viennent,
  // en rappelant qu'ils se cumulent : un palier franchi ne remplace pas le
  // précédent.
  for (const palier of paliersFlammeAtteints(char.brulures)) {
    const existant = effets.find((e) => e.id === `passif:voie-flamme:${palier.id}`)
    const seuil =
      palier.declenchement.kind === 'permanent' ? palier.declenchement.condition?.seuil : undefined
    if (existant) {
      existant.detail = `Vous portez ${char.brulures} brûlures, ce qui atteint le seuil de ${seuil}. ${palier.effet.texte} Les paliers de la Voie de la Flamme se cumulent : vous conservez les bonus des seuils inférieurs.`
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

/** Ce qu'une personnalité change aux sorts, une ligne par sort qu'elle recolore. */
export function detailVie(vie: VieSoulshifter, catalog: Catalog): string {
  return Object.entries(vie.precisions)
    .map(([sortId, texte]) => `${catalog.sort(sortId)?.nom ?? sortId} : ${texte}`)
    .join('\n')
}

/**
 * Peut-on invoquer une vie passée ?
 *
 * ⚠️ « Une fois par **heure de jeu** » — et l'heure de jeu, l'application ne la
 * connaît pas : une halte au feu de camp peut couvrir une nuit de fiction en
 * trois minutes de table. Un compte à rebours réel se serait donc trompé dans
 * les deux sens.
 *
 * L'invocation est un **jeton** : le tirage le consomme, et c'est la MJ qui le
 * rend quand la fiction a passé l'heure. `vieTireeA` retient l'instant du
 * dernier tirage — sa présence *est* le jeton consommé, et sa valeur sert à
 * l'afficher à la MJ.
 */
export function peutTirerUneVie(char: Character): boolean {
  return facesDuDeDeVies(char) > 0 && char.passifs.vieTireeA == null
}

/** Rend l'invocation. Réservé à la MJ, seule à savoir où en est l'heure de jeu. */
export function rendreInvocationDeVie(char: Character): Character {
  const { vieTireeA: _consomme, ...passifs } = char.passifs
  return { ...char, passifs }
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
