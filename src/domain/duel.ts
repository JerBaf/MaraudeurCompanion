/**
 * Combat rapide — le duel « Flow ».
 *
 * Un affrontement 1 contre 1 en cinq manches au plus. Chaque manche, la
 * duelliste et le PNJ choisissent en secret une des cinq actions ; on révèle
 * simultanément et la relation entre les deux actions décide de tout.
 *
 * ⚠️ **L'ordre de `ACTIONS_DUEL` est l'anneau, et l'anneau est toute la règle.**
 * Résolution, Flow, Anti-Flow et Appât se déduisent tous d'un décalage d'index.
 * Écrire une table de résolution à la main la ferait diverger du dessin affiché
 * à l'écran au premier ajout ; ici, insérer une action suffirait à tout mettre à
 * jour, écran compris.
 */

import {
  ACTIONS_DUEL,
  type ActionDuel,
  type IssueDuel,
  type IssueEchange,
  type MancheJouee,
} from './types.ts'

// ---------------------------------------------------------------------------
// L'anneau
// ---------------------------------------------------------------------------

const TAILLE = ACTIONS_DUEL.length

function rang(action: ActionDuel): number {
  return ACTIONS_DUEL.indexOf(action)
}

/** Décalage sur l'anneau, dans les deux sens. */
function decale(action: ActionDuel, pas: number): ActionDuel {
  return ACTIONS_DUEL[(((rang(action) + pas) % TAILLE) + TAILLE) % TAILLE] as ActionDuel
}

/** Les deux actions que celle-ci bat : les deux suivantes sur l'anneau. */
export function bat(action: ActionDuel): [ActionDuel, ActionDuel] {
  return [decale(action, 1), decale(action, 2)]
}

/** Les deux actions qui battent celle-ci : les deux précédentes sur l'anneau. */
export function perdContre(action: ActionDuel): [ActionDuel, ActionDuel] {
  return [decale(action, -1), decale(action, -2)]
}

/** Actions identiques : Clash, personne ne marque. */
export function issueEchange(joueuse: ActionDuel, adversaire: ActionDuel): IssueEchange {
  if (joueuse === adversaire) return 'clash'
  return bat(joueuse).includes(adversaire) ? 'joueuse' : 'adversaire'
}

// ---------------------------------------------------------------------------
// Le méta-jeu : Flow, Anti-Flow, Appât
// ---------------------------------------------------------------------------

/**
 * Le Flow : l'action qui suit immédiatement la précédente sur l'anneau.
 *
 * La compléter en gagnant rapporte 2 points au lieu de 1. C'est une **menace**,
 * pas une obligation — et c'est justement parce qu'elle est visible de
 * l'adversaire qu'elle crée un problème de prédiction.
 *
 * `null` à la première manche : sans action précédente, aucun Flow.
 */
export function flowDe(precedente: ActionDuel | null): ActionDuel | null {
  return precedente === null ? null : decale(precedente, 1)
}

/**
 * L'Anti-Flow : ce que l'adversaire joue pour couper le Flow menacé.
 *
 * C'est la précédente elle-même — la seule des deux actions qui battent le Flow
 * qui soit désignée sans ambiguïté par l'état visible.
 */
export function briseFlow(precedente: ActionDuel): ActionDuel {
  return precedente
}

/**
 * L'Appât : abandonner son Flow pour punir celle qui l'anticipait.
 *
 * Ferme le second pierre-feuille-ciseau : Anti-Flow bat Flow, Appât bat
 * Anti-Flow, Flow bat Appât — sans ajouter le moindre bouton.
 */
export function appatDe(precedente: ActionDuel): ActionDuel {
  return decale(precedente, 3)
}

// ---------------------------------------------------------------------------
// Déroulement d'une manche
// ---------------------------------------------------------------------------

export const OBJECTIF_POINTS = 4
export const MANCHES_MAX = 5

export interface EtatDuel {
  /** Numéro de la manche à jouer, à partir de 1. */
  manche: number
  scoreJoueuse: number
  scoreAdversaire: number
  precedenteJoueuse: ActionDuel | null
  precedenteAdversaire: ActionDuel | null
  /** Un Clash attend d'être payé : la prochaine manche décisive vaut 2. */
  bonusClashActif: boolean
}

/**
 * Tout l'état d'un duel se **recalcule** depuis la suite des manches jouées.
 *
 * Rien n'est stocké en double, donc rien ne peut se désynchroniser — et l'écran
 * des spectatrices se rend exactement depuis la même source que celui de la
 * duelliste.
 */
export function etatDuel(historique: readonly MancheJouee[]): EtatDuel {
  const derniere = historique[historique.length - 1]
  return {
    manche: historique.length + 1,
    scoreJoueuse: historique.reduce((t, m) => t + (m.issue === 'joueuse' ? m.points : 0), 0),
    scoreAdversaire: historique.reduce((t, m) => t + (m.issue === 'adversaire' ? m.points : 0), 0),
    precedenteJoueuse: derniere?.actionJoueuse ?? null,
    precedenteAdversaire: derniere?.actionAdversaire ?? null,
    // Un Clash arme le bonus ; il reste armé tant qu'aucune manche décisive ne
    // l'a consommé, y compris à travers plusieurs Clash d'affilée.
    bonusClashActif: derniere?.issue === 'clash',
  }
}

/**
 * Résout une manche.
 *
 * Le barème tient en une ligne, et c'est voulu : une victoire vaut 2 points si
 * elle complète un Flow **ou** si elle solde un Clash, et **jamais davantage**.
 * Une victoire Flow juste après un Clash vaut donc 2, pas 4 — le doc de
 * playtest plafonne explicitement une manche à 2 points.
 */
export function jouerManche(
  etat: EtatDuel,
  actionJoueuse: ActionDuel,
  actionAdversaire: ActionDuel,
): MancheJouee {
  const issue = issueEchange(actionJoueuse, actionAdversaire)

  if (issue === 'clash') {
    return { actionJoueuse, actionAdversaire, issue, points: 0, flow: false, bonusClash: false }
  }

  const gagnante = issue === 'joueuse' ? actionJoueuse : actionAdversaire
  const precedente = issue === 'joueuse' ? etat.precedenteJoueuse : etat.precedenteAdversaire
  const flow = gagnante === flowDe(precedente)

  return {
    actionJoueuse,
    actionAdversaire,
    issue,
    points: flow || etat.bonusClashActif ? 2 : 1,
    flow,
    bonusClash: etat.bonusClashActif,
  }
}

// ---------------------------------------------------------------------------
// Fin du duel
// ---------------------------------------------------------------------------

/** `null` tant que le duel continue. */
export function issueDuel(historique: readonly MancheJouee[]): IssueDuel | null {
  const { scoreJoueuse, scoreAdversaire } = etatDuel(historique)

  if (scoreJoueuse >= OBJECTIF_POINTS) {
    return { kind: 'victoire', vainqueur: 'joueuse', motif: 'objectif' }
  }
  if (scoreAdversaire >= OBJECTIF_POINTS) {
    return { kind: 'victoire', vainqueur: 'adversaire', motif: 'objectif' }
  }
  if (historique.length < MANCHES_MAX) return null

  if (scoreJoueuse !== scoreAdversaire) {
    return {
      kind: 'victoire',
      vainqueur: scoreJoueuse > scoreAdversaire ? 'joueuse' : 'adversaire',
      motif: 'points',
    }
  }

  // À égalité, c'est la manche décisive la plus récente qui départage.
  const derniereMarque = [...historique].reverse().find((m) => m.issue !== 'clash')
  if (!derniereMarque) return { kind: 'statu-quo' }

  return {
    kind: 'victoire',
    vainqueur: derniereMarque.issue as 'joueuse' | 'adversaire',
    motif: 'derniere-marque',
  }
}

// ---------------------------------------------------------------------------
// Le PNJ
// ---------------------------------------------------------------------------

/**
 * Action scriptée du PNJ : le motif se répète jusqu'à la fin du duel.
 *
 * 🔒 Le motif vit dans la collection réservée à la MJ. Un duel dont le motif est
 * lisible est un duel déjà résolu — et Firestore ne sait pas cacher un champ.
 */
export function actionScriptee(motif: readonly ActionDuel[], manche: number): ActionDuel {
  if (motif.length === 0) throw new Error('Le motif du PNJ est vide.')
  return motif[(manche - 1) % motif.length] as ActionDuel
}
