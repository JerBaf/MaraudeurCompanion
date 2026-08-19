import { COUT_CIBLES, COUT_DISCRETION, COUT_DUREE, COUT_PORTEE } from '../domain/magie.ts'

/**
 * Rappels de règles affichés en combat, tirés de `Rules_For_Agents.pdf`.
 *
 * Les guidelines demandent « un rappel des règles liées au combat […] les
 * attaques armées, l'Évasion, les modifications de sorts en Arcane et leurs
 * coûts associés, les notions de distances et d'initiative », plus la séquence
 * de combat.
 *
 * Les coûts de l'Arcane sont lus depuis `magie.ts` et non recopiés : le rappel
 * ne peut donc pas diverger de ce que le moteur applique réellement.
 */

export interface RappelRegle {
  id: string
  titre: string
  texte: string
  /** Petit tableau optionnel, rendu tel quel. */
  table?: { entetes: string[]; lignes: string[][] }
}

export const RAPPELS_COMBAT: RappelRegle[] = [
  {
    id: 'attaque-armee',
    titre: 'Attaque Armée',
    texte:
      "On ne distingue pas de différence de dégâts entre les types d'armes. Sauf enchantement spécial, toutes infligent un nombre de Points d'Énergie correspondant à un jet de d4.",
  },
  {
    id: 'evasion',
    titre: 'Évasion',
    texte:
      "L'Évasion agit comme un bouclier. Une attaque de E Points d'Énergie contre une Évasion de N inflige E − N Points de Fatigue. Si E est inférieur ou égal à N, l'attaque ne passe pas : vous devez effectuer une Action Alternative. Toutes les joueuses ont une Évasion de base de 1.",
  },
  {
    id: 'initiative',
    titre: 'Initiative',
    texte:
      "Chaque joueuse lance un d6 en début de combat. Un résultat de 4 à 6 la fait jouer avant la MJ, un résultat de 1 à 3 après. Cela forme deux sous-groupes plutôt qu'un ordre individuel, ce qui pousse à se coordonner.",
  },
  {
    id: 'portee',
    titre: 'Portée',
    texte:
      "Au-delà de 20 mètres, tous les jets d'attaque à distance sont exécutés avec désavantage.",
    table: {
      entetes: ['Portée', 'Distance', 'Usage'],
      lignes: [
        ['Proche', '1-2 m', 'armes de contact'],
        ['Moyenne', '2-20 m', 'armes de jet, la plupart des sorts'],
        ['Distante', '> 20 m', 'désavantage sur les jets à distance'],
      ],
    },
  },
  {
    id: 'arcane',
    titre: "Arcane — coûts additionnels",
    texte:
      "Un sort d'Arcane se lance au d6, qui donne directement les Points d'Énergie. Un 1 ou un 2 épuise le cristal jusqu'au prochain feu de camp ; un 6 déchaîne un Effet Aléatoire. Modifier la portée, la durée, le nombre de cibles ou la discrétion coûte des Points d'Énergie supplémentaires :",
    table: {
      entetes: ['Coût', 'Cibles', 'Portée', 'Durée', 'Discrétion'],
      lignes: [
        [
          String(COUT_CIBLES.une),
          'Une',
          `Proche, Moyenne (${COUT_PORTEE.proche})`,
          `Instantanée (${COUT_DUREE.instantanee})`,
          `Visible (${COUT_DISCRETION.visible})`,
        ],
        [
          String(COUT_CIBLES['par-cible-supplementaire']),
          'par cible supplémentaire',
          `Distante (${COUT_PORTEE.distante})`,
          `1 minute (${COUT_DUREE.minute})`,
          `Détectable (${COUT_DISCRETION.detectable})`,
        ],
        [
          String(COUT_CIBLES['petite-zone']),
          'Petite zone',
          '—',
          `1 heure (${COUT_DUREE.heure})`,
          `Invisible (${COUT_DISCRETION.invisible})`,
        ],
        [String(COUT_CIBLES['grande-zone']), 'Grande zone', '—', '—', '—'],
      ],
    },
  },
  {
    id: 'action-rapide',
    titre: 'Action Rapide',
    texte:
      "Quand une situation exige une réaction immédiate, vous pouvez dépenser une Action Rapide. Vous en avez 2 par jour si votre Physique est à +2, 1 sinon.",
  },
]

/** La séquence de combat, telle que le PDF la décrit. */
export const SEQUENCE_COMBAT = [
  {
    etape: 'Étape 0',
    titre: 'Initiative',
    details: ['Chaque joueuse lance un d6.', '4-6 : avant la MJ. 1-3 : après la MJ.'],
  },
  {
    etape: 'Étape 1',
    titre: 'Tour de combat',
    details: [
      'Choisissez entre un Sort et une Attaque Armée.',
      "Lancez le dé associé à votre action.",
      "Si le résultat dépasse l'Évasion de la cible, les dégâts passent.",
      "Sinon, effectuez une Action Alternative.",
    ],
  },
  {
    etape: 'Fin',
    titre: 'Répétition',
    details: [
      'On répète le tour jusqu’à ce que tout ennemi ait disparu…',
      '…ou que toutes les joueuses soient à bout de Points de Fatigue.',
    ],
  },
]
