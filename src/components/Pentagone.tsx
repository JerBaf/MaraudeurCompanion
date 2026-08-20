import type { ReactNode } from 'react'

import { Icone } from './Icone.tsx'
import { FICTION_ACTIONS } from '../content/duel.ts'
import { ACTIONS_DUEL, LIBELLE_ACTION_DUEL, type ActionDuel } from '../domain/types.ts'

/**
 * Le plateau du combat rapide.
 *
 * **Le dessin est la règle.** Les cinq actions occupent les sommets d'un
 * pentagone, dans l'ordre de l'anneau ; le contour porte le sens du Flow et les
 * diagonales — la branche du pentagramme — portent l'autre moitié de la
 * relation « bat ». Une joueuse qui regarde la figure a sous les yeux les dix
 * relations du jeu, ce qui est exactement ce que le document de playtest
 * demande : apprendre l'anneau en moins de deux minutes.
 *
 * Les positions se calculent depuis l'index dans `ACTIONS_DUEL`, comme la
 * règle : réordonner la liste réordonne le dessin, sans rien à retoucher ici.
 *
 * Sans `onChoisir`, le plateau est en lecture seule — c'est ce que voient les
 * spectatrices et la MJ.
 */

interface Props {
  /** Action sélectionnée mais pas encore verrouillée : allume ses relations. */
  selection?: ActionDuel | null
  /** Le Flow de la duelliste — sa menace à 2 points. */
  flowJoueuse?: ActionDuel | null
  /** Le Flow que menace le PNJ. */
  flowAdversaire?: ActionDuel | null
  /** Les deux actions de la dernière manche révélée. */
  revele?: { joueuse: ActionDuel; adversaire: ActionDuel } | null
  /** Absent = plateau en lecture seule. */
  onChoisir?: (action: ActionDuel) => void
  /** Chrono, score ou résultat, au centre de la figure. */
  children?: ReactNode
}

/**
 * Rayon des sommets, en unités du `viewBox` (100 × 100, centre 50/50).
 *
 * Les boutons faisant 27 % de large, un sommet posé à 34 laisse leur bord à
 * 96 % du conteneur : la figure reste grande sans jamais toucher les marges,
 * et cela tient à toutes les largeurs puisque tout est en pourcentage.
 */
const RAYON = 34
/** De combien un trait s'arrête avant le sommet, pour ne pas passer sous le bouton. */
const RETRAIT = 13

interface Point {
  x: number
  y: number
}

const SOMMETS: Point[] = ACTIONS_DUEL.map((_, i) => {
  // Pression en haut, puis dans le sens des aiguilles d'une montre : le sens de
  // l'anneau est donc celui de la lecture d'une horloge.
  const angle = ((-90 + i * 72) * Math.PI) / 180
  return { x: 50 + RAYON * Math.cos(angle), y: 50 + RAYON * Math.sin(angle) }
})

/** Segment entre deux sommets, raccourci aux deux bouts. */
function segment(depuis: Point, vers: Point): { x1: number; y1: number; x2: number; y2: number } {
  const dx = vers.x - depuis.x
  const dy = vers.y - depuis.y
  const longueur = Math.hypot(dx, dy)
  const ux = dx / longueur
  const uy = dy / longueur
  return {
    x1: depuis.x + ux * RETRAIT,
    y1: depuis.y + uy * RETRAIT,
    x2: vers.x - ux * RETRAIT,
    y2: vers.y - uy * RETRAIT,
  }
}

/** Petite pointe posée sur un segment, pour dire dans quel sens tourne l'anneau. */
function pointe(depuis: Point, vers: Point): string {
  const s = segment(depuis, vers)
  const dx = s.x2 - s.x1
  const dy = s.y2 - s.y1
  const longueur = Math.hypot(dx, dy)
  const ux = dx / longueur
  const uy = dy / longueur
  // Perpendiculaire, pour écarter les deux ailes de la pointe.
  const px = -uy
  const py = ux
  const cx = s.x1 + ux * longueur * 0.58
  const cy = s.y1 + uy * longueur * 0.58
  const l = 2.6
  return [
    `${cx + ux * l},${cy + uy * l}`,
    `${cx - ux * l + px * l * 0.8},${cy - uy * l + py * l * 0.8}`,
    `${cx - ux * l - px * l * 0.8},${cy - uy * l - py * l * 0.8}`,
  ].join(' ')
}

/** Les dix relations « bat » : cinq arêtes (l'anneau) et cinq diagonales. */
const RELATIONS = ACTIONS_DUEL.flatMap((action, i) =>
  [1, 2].map((pas) => ({
    depuis: action,
    vers: ACTIONS_DUEL[(i + pas) % ACTIONS_DUEL.length] as ActionDuel,
    /** Une arête porte le Flow ; une diagonale ne porte que la relation « bat ». */
    anneau: pas === 1,
    i,
    j: (i + pas) % ACTIONS_DUEL.length,
  })),
)

export function Pentagone({
  selection = null,
  flowJoueuse = null,
  flowAdversaire = null,
  revele = null,
  onChoisir,
  children,
}: Props) {
  return (
    <div className="pentagone">
      <svg className="pentagone__figure" viewBox="0 0 100 100" aria-hidden="true">
        {RELATIONS.map((r) => {
          // Une relation s'allume quand elle part de l'action sélectionnée (ce
          // qu'elle bat) ou qu'elle y arrive (ce qui la bat).
          const etat =
            selection === null
              ? 'base'
              : r.depuis === selection
                ? 'gagne'
                : r.vers === selection
                  ? 'perd'
                  : 'base'
          const s = segment(SOMMETS[r.i] as Point, SOMMETS[r.j] as Point)
          return (
            <g
              key={`${r.depuis}-${r.vers}`}
              className={
                `pentagone__lien pentagone__lien--${etat} ` +
                // L'anneau se lit en premier, les diagonales en second : c'est
                // le contour qui porte le Flow, et donc tout le méta-jeu.
                (r.anneau ? 'pentagone__lien--anneau' : 'pentagone__lien--diagonale')
              }
            >
              <line {...s} />
              {r.anneau && (
                <polygon points={pointe(SOMMETS[r.i] as Point, SOMMETS[r.j] as Point)} />
              )}
            </g>
          )
        })}
      </svg>

      {ACTIONS_DUEL.map((action, i) => {
        const sommet = SOMMETS[i] as Point
        const fiction = FICTION_ACTIONS[action]
        const marques = [
          flowJoueuse === action ? 'pentagone__sommet--flow' : '',
          flowAdversaire === action ? 'pentagone__sommet--menace' : '',
          selection === action ? 'pentagone__sommet--choisi' : '',
        ]
          .filter(Boolean)
          .join(' ')

        const roleRevele =
          revele && revele.joueuse === action && revele.adversaire === action
            ? 'les deux'
            : revele?.joueuse === action
              ? 'vous'
              : revele?.adversaire === action
                ? 'lui'
                : null

        const commun = {
          className: `pentagone__sommet ${marques}`,
          style: { left: `${sommet.x}%`, top: `${sommet.y}%` },
          title: fiction.fiction,
        }

        const contenu = (
          <>
            <Icone nom={fiction.icone} taille={26} />
            <span className="pentagone__nom">{LIBELLE_ACTION_DUEL[action]}</span>
            {roleRevele && <span className="pentagone__revele">{roleRevele}</span>}
          </>
        )

        // Un plateau en lecture seule ne doit pas offrir de cible cliquable : les
        // spectatrices et la MJ regardent, elles ne choisissent pas.
        return onChoisir ? (
          <button
            key={action}
            type="button"
            {...commun}
            aria-pressed={selection === action}
            onClick={() => onChoisir(action)}
          >
            {contenu}
          </button>
        ) : (
          <span key={action} {...commun}>
            {contenu}
          </span>
        )
      })}

      {children && <div className="pentagone__centre">{children}</div>}
    </div>
  )
}
