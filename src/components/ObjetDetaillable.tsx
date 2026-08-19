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
  puce,
  actif,
  indisponible,
}: {
  icone: string
  nom: string
  meta?: ReactNode
  detail?: string
  puce?: ReactNode
  actif?: boolean
  indisponible?: boolean
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
        <Icone nom={icone} taille={32} />
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
        <div className="effet__detail">
          <p style={{ margin: 0, whiteSpace: 'pre-line' }}>{detail}</p>
        </div>
      )}
    </div>
  )
}
