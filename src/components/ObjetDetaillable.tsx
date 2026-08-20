import { useState, type ReactNode } from 'react'

import { Icone } from './Icone.tsx'

/**
 * Élément de liste dont la description se déplie au toucher.
 *
 * Sert partout où l'on présente un objet de jeu — sorts du Grimoire, équipement
 * porté, contenu du sac à dos. Une joueuse doit pouvoir relire l'effet de ce
 * qu'elle transporte sans avoir à demander à la MJ.
 */
export function ObjetDetaillable({
  icone,
  nom,
  meta,
  detail,
  precision,
  puce,
  actif,
  indisponible,
  action,
  actionDetail,
  teinte,
}: {
  icone: string
  nom: string
  meta?: ReactNode
  detail?: string
  /** Encadré supplémentaire sous l'effet par défaut, quand le contexte le précise. */
  precision?: { titre: string; texte: string }
  puce?: ReactNode
  actif?: boolean
  indisponible?: boolean
  /**
   * Commande toujours visible, rendue sous la ligne : marquer un Hexite épuisé.
   * Vit hors du bouton de dépliage — un bouton dans un bouton n'est pas du HTML
   * valide et ne se cliquerait pas.
   */
  action?: ReactNode
  /**
   * Commande révélée avec la description, et centrée sous elle : utiliser un
   * objet. On la déplie parce qu'on veut s'en servir, et l'effet mérite d'être
   * lu avant d'agir.
   */
  actionDetail?: ReactNode
  /** Teinte de rareté, transmise à l'icône. */
  teinte?: string
}) {
  const [ouvert, setOuvert] = useState(false)
  const depliable = Boolean(detail)

  return (
    <div>
      <button
        type="button"
        className={`objet ${actif ? 'objet--actif' : ''} ${indisponible ? 'objet--indisponible' : ''}`}
        onClick={() => depliable && setOuvert((o) => !o)}
        aria-expanded={depliable ? ouvert : undefined}
        // Sans description à révéler, l'élément n'est pas interactif.
        {...(depliable ? {} : { tabIndex: -1, style: { cursor: 'default' } })}
      >
        <Icone nom={icone} taille={32} {...(teinte ? { teinte } : {})} />
        <span className="objet__corps">
          <span className="objet__nom">{nom}</span>
          {meta && <span className="objet__meta">{meta}</span>}
        </span>
        {puce}
        {depliable && (
          <span className="tres-discret" aria-hidden="true" style={{ fontSize: '0.7rem' }}>
            {ouvert ? '▾' : '▸'}
          </span>
        )}
      </button>

      {ouvert && detail && (
        <>
          <div className="effet__detail">
            <p style={{ margin: 0, whiteSpace: 'pre-line' }}>{detail}</p>
          </div>
          {precision && (
            <div className="effet__detail effet__detail--precision">
              <span className="etiquette">{precision.titre}</span>
              <p style={{ margin: '4px 0 0', whiteSpace: 'pre-line' }}>{precision.texte}</p>
            </div>
          )}
          {actionDetail && (
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: 8 }}>
              {actionDetail}
            </div>
          )}
        </>
      )}

      {action && <div style={{ marginTop: 6 }}>{action}</div>}
    </div>
  )
}
