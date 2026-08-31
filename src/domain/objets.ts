import type { Rng } from './random.ts'
import { LIBELLE_SLOT, RARETES, type Character, type Equipement } from './types.ts'

/**
 * Les objets à effets actifs.
 *
 * Le PDF décrit ces pouvoirs pour les armes — « pour chaque arme existe une
 * table aléatoire avec différents effets » — mais la mécanique vaut aussi bien
 * pour une potion : une table à une seule face rend l'effet déterministe. D'où
 * un modèle unique plutôt qu'un cas « arme » et un cas « consommable ».
 *
 * Deux contreparties, comme le PDF : des **charges** qu'un rituel restaure, ou
 * un **paiement** décrit en toutes lettres que la MJ applique à sa table. Un
 * **consommable** est le cas dégénéré des charges — celles-ci ne se rechargent
 * pas, et l'objet est détruit une fois la dernière dépensée.
 */

export function aDesEffetsActifs(eq: Equipement): boolean {
  return eq.effetsActifs !== undefined
}

/** Vrai si l'objet tient un compteur de charges. Un `paiement` n'en a pas. */
export function tientDesCharges(eq: Equipement): boolean {
  const kind = eq.effetsActifs?.cout.kind
  return kind === 'charges' || kind === 'consommable'
}

/** Charges de l'objet à neuf. `null` quand il n'en tient pas. */
export function capaciteMax(eq: Equipement): number | null {
  const cout = eq.effetsActifs?.cout
  if (cout?.kind === 'charges' || cout?.kind === 'consommable') return cout.max
  return null
}

/**
 * Charges restantes.
 *
 * Une clé absente de `chargesObjets` vaut « au complet » : c'est ce qui permet
 * d'acquérir un objet sans avoir à l'initialiser nulle part.
 */
export function chargesRestantes(char: Character, eq: Equipement): number | null {
  const max = capaciteMax(eq)
  if (max === null) return null
  const suivi = char.chargesObjets[eq.id]
  return suivi === undefined ? max : Math.max(0, Math.min(max, suivi))
}

/**
 * La ligne qu'on lit d'un coup d'œil sur un objet : ce qu'il est, ce qu'il vaut,
 * ce qu'il lui reste. Pendant du `resumeSort` de `magie.ts`.
 *
 * La rareté ne s'écrit que si elle sort de l'ordinaire — la teinte de l'icône dit
 * déjà « commun », et le répéter sur chaque ligne noierait le reste.
 */
export function resumeEquipement(eq: Equipement, char: Character): string {
  const max = capaciteMax(eq)
  return [
    LIBELLE_SLOT[eq.slot],
    eq.rarete && eq.rarete !== 'commun' ? RARETES[eq.rarete].libelle : null,
    eq.bonusEvasion ? `Évasion +${eq.bonusEvasion}` : null,
    eq.materielDeBase ? 'matériel de base' : null,
    max !== null ? `${chargesRestantes(char, eq)}/${max} charge(s)` : null,
  ]
    .filter(Boolean)
    .join(' · ')
}

/**
 * La description d'un objet, augmentée de ce que la joueuse doit savoir avant de
 * s'en servir : sa table d'effets et sa contrepartie.
 *
 * Vit dans le domaine parce que quatre écrans l'affichent — fiche, sac,
 * armurerie et boutique — et qu'ils doivent en dire exactement la même chose.
 */
export function detailObjet(eq: Equipement): string {
  const lignes = [eq.description ?? 'Aucune description pour cet objet.']
  const actifs = eq.effetsActifs
  if (!actifs) return lignes.join('\n')

  if (actifs.faces > 1) {
    lignes.push('', `Table — 1d${actifs.faces}`)
    actifs.effets.forEach((e, i) => lignes.push(`${i + 1} · ${e}`))
  }

  if (actifs.cout.kind === 'charges') lignes.push('', `Recharge — ${actifs.cout.rituel}`)
  if (actifs.cout.kind === 'consommable') lignes.push('', 'Consommable : détruit une fois épuisé.')
  if (actifs.cout.kind === 'paiement') lignes.push('', `Contrepartie — ${actifs.cout.description}`)

  return lignes.join('\n')
}

export function peutUtiliser(char: Character, eq: Equipement): boolean {
  if (!aDesEffetsActifs(eq)) return false
  const restantes = chargesRestantes(char, eq)
  // Un `paiement` n'a pas de compteur : rien ne l'épuise.
  return restantes === null || restantes > 0
}

export interface ResultatUsage {
  char: Character
  /** L'effet tiré sur la table. */
  effet: string
  /** Résultat du dé, de 1 à `faces`. */
  de: number
  /** Charges après l'usage, `null` pour un objet sans compteur. */
  restantes: number | null
  /** Le consommable a rendu sa dernière charge : il n'existe plus. */
  detruit: boolean
}

/**
 * Utilise l'objet : tire sa table, décompte sa charge.
 *
 * Le PDF ne prévoit pas d'activer un pouvoir sans en subir le coût — les deux
 * vont ensemble, d'où une seule fonction.
 */
export function utiliserObjet(char: Character, eq: Equipement, rng: Rng): ResultatUsage {
  const actifs = eq.effetsActifs
  if (!actifs) throw new Error(`« ${eq.nom} » n'a pas d'effet actif.`)
  if (!peutUtiliser(char, eq)) throw new Error(`« ${eq.nom} » n'a plus de charge.`)

  const de = rng.int(1, Math.max(1, actifs.faces))
  const effet = actifs.effets[de - 1] ?? 'Effet non renseigné — à la MJ de trancher.'

  const avant = chargesRestantes(char, eq)
  if (avant === null) {
    return { char, effet, de, restantes: null, detruit: false }
  }

  const restantes = avant - 1
  const detruit = restantes <= 0 && actifs.cout.kind === 'consommable'

  return {
    char: detruit ? retirerObjet(char, eq.id) : { ...char, chargesObjets: { ...char.chargesObjets, [eq.id]: restantes } },
    effet,
    de,
    restantes,
    detruit,
  }
}

/**
 * Retire un objet de la fiche.
 *
 * Le déséquipe au passage : un emplacement qui référence un objet absent ferait
 * disparaître son bonus sans que rien ne l'explique. On oublie aussi ses
 * charges, sinon elles ressusciteraient avec un objet racheté plus tard.
 */
export function retirerObjet(char: Character, equipementId: string): Character {
  const { [equipementId]: _oublie, ...charges } = char.chargesObjets

  return {
    ...char,
    possede: {
      ...char.possede,
      equipements: char.possede.equipements.filter((e) => e !== equipementId),
    },
    equipe: Object.fromEntries(
      Object.entries(char.equipe).map(([slot, porte]) => [slot, porte === equipementId ? null : porte]),
    ) as Character['equipe'],
    chargesObjets: charges,
  }
}

/**
 * Recharge un objet à neuf.
 *
 * Réservée à la MJ : le PDF attache à chaque arme un rituel propre — bain de
 * pleine lune, sang de Carcasse — et c'est la fiction qui décide s'il est
 * accompli. Rien ne se recharge tout seul, pas même au feu de camp.
 */
export function rechargerObjet(char: Character, eq: Equipement): Character {
  const max = capaciteMax(eq)
  if (max === null) return char
  return { ...char, chargesObjets: { ...char.chargesObjets, [eq.id]: max } }
}
