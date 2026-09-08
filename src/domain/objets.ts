import { ACTIF_PRINCIPAL } from './catalog.ts'
import type { Catalog } from './catalog.ts'
import {
  decrireCout,
  estGratuit,
  payerCout,
  peutPayer,
  type ChoixPaiement,
} from './couts.ts'
import type { Des, Rng } from './random.ts'
import {
  LIBELLE_SLOT,
  RARETES,
  type Actif,
  type Character,
  type Equipement,
} from './types.ts'

/**
 * Les objets à Actifs.
 *
 * Le PDF décrit ces pouvoirs pour les armes — « pour chaque arme existe une
 * table aléatoire avec différents effets » — mais la mécanique vaut aussi bien
 * pour une potion : une table à une seule face rend l'effet déterministe. D'où
 * un modèle unique plutôt qu'un cas « arme » et un cas « consommable ».
 *
 * Un objet peut porter **plusieurs** Actifs, chacun avec son propre coût et son
 * propre compteur de charges — une lanterne qui éclaire et qui brûle.
 */

// ---------------------------------------------------------------------------
// Charges
// ---------------------------------------------------------------------------

/**
 * La clé sous laquelle se comptent les charges d'un Actif.
 *
 * Composite depuis qu'un objet peut en porter plusieurs. Les fiches écrites
 * avant cela comptent sous l'identifiant de l'objet seul : `chargesRestantes`
 * s'y replie, et `poserCharges` efface la clé nue en écrivant la nouvelle, pour
 * que les deux ne divergent pas.
 */
export function cleCharges(equipementId: string, actifId: string): string {
  return `${equipementId}:${actifId}`
}

export function actifsDe(eq: Equipement): Actif[] {
  return eq.actifs ?? []
}

export function aDesEffetsActifs(eq: Equipement): boolean {
  return actifsDe(eq).length > 0
}

/** Vrai si l'Actif tient un compteur de charges. */
export function tientDesCharges(actif: Actif): boolean {
  return actif.usages !== undefined
}

/** Charges de l'Actif à neuf. `null` quand il n'en tient pas. */
export function capaciteMax(actif: Actif): number | null {
  return actif.usages?.max ?? null
}

/**
 * Charges restantes.
 *
 * Une clé absente vaut « au complet » : c'est ce qui permet d'acquérir un objet
 * sans avoir à l'initialiser nulle part — achat en boutique, don de la MJ,
 * fiche écrite avant l'existence du champ.
 */
export function chargesRestantes(char: Character, eq: Equipement, actif: Actif): number | null {
  const max = capaciteMax(actif)
  if (max === null) return null

  const suivi =
    char.chargesObjets[cleCharges(eq.id, actif.id)] ??
    // Repli : l'objet n'avait qu'une table, comptée sous son seul identifiant.
    (actif.id === ACTIF_PRINCIPAL ? char.chargesObjets[eq.id] : undefined)

  return suivi === undefined ? max : Math.max(0, Math.min(max, suivi))
}

function poserCharges(
  char: Character,
  eq: Equipement,
  actif: Actif,
  valeur: number,
): Character {
  // La clé nue disparaît en même temps : la laisser ferait diverger les deux
  // compteurs, et le repli ci-dessus finirait par lire une valeur périmée.
  const { [eq.id]: _nue, ...reste } = char.chargesObjets
  return { ...char, chargesObjets: { ...reste, [cleCharges(eq.id, actif.id)]: valeur } }
}

/**
 * L'objet est à bout : tous ses Actifs à compteur sont à zéro.
 *
 * C'est ce qui le marque en rouge. Ses passifs, eux, continuent d'agir — un
 * objet vide reste porté.
 */
export function estEpuise(char: Character, eq: Equipement): boolean {
  const aCompteur = actifsDe(eq).filter(tientDesCharges)
  return aCompteur.length > 0 && aCompteur.every((a) => chargesRestantes(char, eq, a) === 0)
}

// ---------------------------------------------------------------------------
// Description
// ---------------------------------------------------------------------------

/**
 * La ligne qu'on lit d'un coup d'œil sur un objet : ce qu'il est, ce qu'il vaut,
 * ce qu'il lui reste. Pendant du `resumeSort` de `magie.ts`.
 *
 * La rareté ne s'écrit que si elle sort de l'ordinaire — la teinte de l'icône dit
 * déjà « commun », et le répéter sur chaque ligne noierait le reste.
 */
export function resumeEquipement(eq: Equipement, char: Character): string {
  const charges = actifsDe(eq)
    .filter(tientDesCharges)
    .map((a) => `${chargesRestantes(char, eq, a)}/${capaciteMax(a)} charge(s)`)

  return [
    LIBELLE_SLOT[eq.slot],
    eq.rarete && eq.rarete !== 'commun' ? RARETES[eq.rarete].libelle : null,
    eq.bonusEvasion ? `Évasion +${eq.bonusEvasion}` : null,
    eq.materielDeBase ? 'matériel de base' : null,
    ...charges,
  ]
    .filter(Boolean)
    .join(' · ')
}

/** Ce qu'un Actif fait, ce qu'il coûte, ce qui le recharge. */
export function detailActif(actif: Actif): string {
  const lignes: string[] = []

  if (actif.table.faces > 1) {
    lignes.push(`${actif.nom} — table 1d${actif.table.faces}`)
    actif.table.entrees.forEach((e, i) => lignes.push(`${i + 1} · ${e.texte}`))
  } else {
    lignes.push(`${actif.nom} — ${actif.table.entrees[0]?.texte ?? 'Effet non renseigné.'}`)
  }

  if (actif.cout && !estGratuit(actif.cout)) lignes.push(`Coût — ${decrireCout(actif.cout)}`)

  const recharge = actif.usages?.recharge
  if (recharge?.kind === 'rituel') lignes.push(`Recharge — ${recharge.description}`)
  if (recharge?.kind === 'cout') lignes.push(`Recharge — ${decrireCout(recharge.cout)}`)
  if (recharge?.kind === 'aucune') {
    lignes.push('Sans recharge : une fois épuisé, il faut le retirer à la main.')
  }

  return lignes.join('\n')
}

/**
 * La description d'un objet, augmentée de ce que la joueuse doit savoir avant de
 * s'en servir.
 *
 * Vit dans le domaine parce que quatre écrans l'affichent — fiche, sac,
 * armurerie et boutique — et qu'ils doivent en dire exactement la même chose.
 */
export function detailObjet(eq: Equipement): string {
  const lignes = [eq.description ?? 'Aucune description pour cet objet.']
  for (const actif of actifsDe(eq)) lignes.push('', detailActif(actif))
  return lignes.join('\n')
}

// ---------------------------------------------------------------------------
// Utiliser
// ---------------------------------------------------------------------------

export interface RaisonsIndisponible {
  chargesEpuisees: boolean
  coutImpayable: boolean
}

export function raisonsIndisponible(
  char: Character,
  catalog: Catalog,
  eq: Equipement,
  actif: Actif,
  x = 0,
): RaisonsIndisponible {
  const restantes = chargesRestantes(char, eq, actif)
  return {
    chargesEpuisees: restantes !== null && restantes <= 0,
    coutImpayable: actif.cout ? !peutPayer(char, catalog, actif.cout, x) : false,
  }
}

export function peutUtiliser(
  char: Character,
  catalog: Catalog,
  eq: Equipement,
  actif: Actif,
  x = 0,
): boolean {
  const r = raisonsIndisponible(char, catalog, eq, actif, x)
  return !r.chargesEpuisees && !r.coutImpayable
}

export interface ResultatUsage {
  char: Character
  /** L'effet tiré sur la table. */
  effet: string
  /** Résultat du dé, de 1 à `faces`. */
  de: number
  /** Charges après l'usage, `null` pour un Actif sans compteur. */
  restantes: number | null
  /** Ce que le paiement a entraîné : Combustion, grille de Fatigue pleine. */
  recits: string[]
}

/**
 * Le dé que `utiliserActif` va consommer.
 *
 * Vit ici, collé à la fonction qui le consomme, pour que l'écran qui propose la
 * saisie manuelle ne puisse jamais en demander un de trop. Une table à une seule
 * face rend un effet déterministe : rien à lancer, donc rien à saisir.
 */
export function desDeActif(actif: Actif): Des[] {
  return actif.table.faces > 1 ? [{ nombre: 1, faces: actif.table.faces }] : []
}

/**
 * Utilise un Actif : paie son coût, tire sa table, décompte sa charge.
 *
 * Le PDF ne prévoit pas d'activer un pouvoir sans en subir le coût — les deux
 * vont ensemble, d'où une seule fonction.
 *
 * ⚠️ **Un objet épuisé n'est plus détruit.** À zéro charge et sans recharge, il
 * reste en inventaire, marqué et inutilisable, jusqu'à ce que la MJ ou la
 * joueuse l'en retire — c'est la règle arrêtée avec la MJ, et elle vaut mieux
 * qu'une disparition automatique : un flacon vide se garde, se remplit, se
 * revend.
 */
export function utiliserActif(
  char: Character,
  catalog: Catalog,
  eq: Equipement,
  actif: Actif,
  rng: Rng,
  choix?: ChoixPaiement,
): ResultatUsage {
  if (!peutUtiliser(char, catalog, eq, actif, choix?.x ?? 0)) {
    throw new Error(`« ${actif.nom} » n'est pas utilisable en l'état.`)
  }

  const { char: paye, recits } = actif.cout
    ? payerCout(char, catalog, actif.cout, choix ?? { branche: 0 })
    : { char, recits: [] as string[] }

  const de = rng.int(1, Math.max(1, actif.table.faces))
  const effet = actif.table.entrees[de - 1]?.texte ?? 'Effet non renseigné — à la MJ de trancher.'

  const avant = chargesRestantes(paye, eq, actif)
  if (avant === null) return { char: paye, effet, de, restantes: null, recits }

  const restantes = Math.max(0, avant - 1)
  return { char: poserCharges(paye, eq, actif, restantes), effet, de, restantes, recits }
}

/**
 * Retire un objet de la fiche.
 *
 * Le déséquipe au passage : un emplacement qui référence un objet absent ferait
 * disparaître son bonus sans que rien ne l'explique. On oublie aussi ses
 * charges — **toutes**, un Actif à la fois — sinon elles ressusciteraient avec
 * un objet racheté plus tard.
 */
export function retirerObjet(char: Character, equipementId: string): Character {
  const prefixe = `${equipementId}:`
  const chargesObjets = Object.fromEntries(
    Object.entries(char.chargesObjets).filter(
      ([cle]) => cle !== equipementId && !cle.startsWith(prefixe),
    ),
  )

  return {
    ...char,
    possede: {
      ...char.possede,
      equipements: char.possede.equipements.filter((e) => e !== equipementId),
    },
    equipe: Object.fromEntries(
      Object.entries(char.equipe).map(([slot, porte]) => [slot, porte === equipementId ? null : porte]),
    ) as Character['equipe'],
    chargesObjets,
  }
}

/**
 * Recharge un Actif à neuf.
 *
 * Le PDF attache à chaque arme un rituel propre — bain de pleine lune, sang de
 * Carcasse — et c'est la fiction qui décide s'il est accompli : la MJ seule
 * valide un rituel. Une recharge **payante**, elle, se déclenche par la
 * joueuse, qui en règle le prix. Rien ne se recharge tout seul, pas même au feu
 * de camp.
 */
export interface ResultatPaiementRecharge {
  char: Character
  recits: string[]
}

export function rechargerActif(
  char: Character,
  catalog: Catalog,
  eq: Equipement,
  actif: Actif,
): ResultatPaiementRecharge {
  const recharge = actif.usages?.recharge
  const max = capaciteMax(actif)
  if (!recharge || max === null || recharge.kind === 'aucune') {
    throw new Error(`« ${actif.nom} » ne se recharge pas.`)
  }

  if (recharge.kind === 'cout') {
    const { char: paye, recits } = payerCout(char, catalog, recharge.cout)
    return { char: poserCharges(paye, eq, actif, max), recits }
  }

  return { char: poserCharges(char, eq, actif, max), recits: [] }
}

