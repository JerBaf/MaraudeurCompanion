import { appatDe, bat, briseFlow, flowDe, perdContre } from '../domain/duel.ts'
import { ACTIONS_DUEL, LIBELLE_ACTION_DUEL, type ActionDuel } from '../domain/types.ts'
import type { RappelRegle } from './regles-combat.ts'

/**
 * Ce qu'une action veut dire à la fiction, et l'icône qui la porte.
 *
 * Le contenu vit ici et la règle dans `domain/duel.ts` : la relation « bat »
 * n'a pas à savoir à quoi ressemble une Feinte, et la MJ peut remplacer
 * n'importe laquelle de ces icônes en déposant son propre dessin sous le même
 * nom dans `public/icons` — aucun code à toucher.
 */
export interface FictionAction {
  icone: string
  /** La phrase que la joueuse lit sous l'action. */
  fiction: string
}

export const FICTION_ACTIONS: Record<ActionDuel, FictionAction> = {
  pression: { icone: 'battle-axe', fiction: 'Attaque directe, on avance, on submerge.' },
  feinte: { icone: 'mirror-mirror', fiction: 'Leurre, appât, faux engagement.' },
  placement: { icone: 'leather-boot', fiction: 'Jeu de jambes, changement de couvert, angle.' },
  contre: { icone: 'crossbow', fiction: 'Parade, interruption, punition, tir précis.' },
  garde: { icone: 'shield-echoes', fiction: 'Blocage, couvert, esquive prudente, refus de l’appât.' },
}

const nom = (a: ActionDuel) => LIBELLE_ACTION_DUEL[a]
const liste = (actions: readonly ActionDuel[]) => actions.map(nom).join(' et ')

/**
 * Rappels de règles du combat rapide.
 *
 * ⚠️ Les deux tables sont **construites depuis `domain/duel.ts`**, jamais
 * recopiées : c'est le procédé déjà retenu pour les coûts d'Arcane dans
 * `regles-combat.ts`. Le rappel affiché ne peut donc pas contredire ce que le
 * moteur applique, ni le pentagone dessiné à l'écran.
 */
export const RAPPELS_DUEL: RappelRegle[] = [
  {
    id: 'duel-anneau',
    titre: 'L’anneau',
    texte:
      'Chaque manche, vous et votre adversaire choisissez une action en secret ; on révèle en même temps. Chaque action bat les deux suivantes sur l’anneau et perd contre les deux précédentes. Deux fois la même action : c’est un Clash, personne ne marque.',
    table: {
      entetes: ['Action', 'Bat', 'Perd contre'],
      lignes: ACTIONS_DUEL.map((a) => [nom(a), liste(bat(a)), liste(perdContre(a))]),
    },
  },
  {
    id: 'duel-flow',
    titre: 'Le Flow',
    texte:
      'Votre Flow est toujours l’action qui suit immédiatement la vôtre sur l’anneau. La jouer et gagner rapporte 2 points au lieu de 1. C’est une menace, pas une obligation : vous gardez le droit de jouer n’importe laquelle des cinq actions, et votre adversaire voit la menace aussi bien que vous.',
    table: {
      entetes: ['Votre dernière action', 'Votre Flow', 'Ce qui le brise', 'Votre appât'],
      lignes: ACTIONS_DUEL.map((a) => [
        nom(a),
        nom(flowDe(a) as ActionDuel),
        nom(briseFlow(a)),
        nom(appatDe(a)),
      ]),
    },
  },
  {
    id: 'duel-score',
    titre: 'Marquer',
    texte:
      'Victoire simple : 1 point. Victoire qui complète votre Flow : 2 points. Clash : personne ne marque, mais la prochaine manche décisive vaut 2 points. Une manche ne vaut jamais plus de 2 : un Flow gagné juste après un Clash rapporte 2, pas 4.',
  },
  {
    id: 'duel-fin',
    titre: 'Gagner le duel',
    texte:
      'La première à 4 points l’emporte immédiatement. Sinon le duel s’arrête après la cinquième manche et le meilleur score gagne. À égalité, c’est celle qui a marqué la dernière manche décisive. Si personne n’a marqué, rien ne bouge : le statu quo l’emporte.',
  },
  {
    id: 'duel-lecture',
    titre: 'Lire l’adversaire',
    texte:
      'Trois coups s’enchaînent naturellement : compléter son Flow, le briser en rejouant sa propre action précédente, ou abandonner son Flow pour punir celle qui l’attendait. Les trois se battent en rond — et les deux actions restantes sont toujours disponibles pour sortir du script. Refuser plusieurs fois de compléter un Flow apprend à l’adversaire à ne plus le respecter ; c’est là qu’on l’encaisse.',
  },
]
