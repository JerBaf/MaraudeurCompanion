import { useState } from 'react'

import type { Catalog } from '../domain/catalog.ts'
import { decrireModificateur, effetsActifs, LIBELLE_ORIGINE, type EffetActif } from '../domain/effets.ts'
import type { Character, VieSoulshifter } from '../domain/types.ts'

/**
 * Effets en cours.
 *
 * Chaque effet se déplie au toucher pour expliquer d'où il vient et ce qu'il
 * fait exactement. Les passifs y figurent au même titre que les Fardeaux ou les
 * bonus d'armure : de la joueuse, tout cela agit sur sa fiche, et la seule chose
 * qui les distingue vraiment est de savoir qui peut les changer.
 */
export function Effets({
  char,
  catalog,
  vies,
}: {
  char: Character
  catalog: Catalog
  vies?: readonly VieSoulshifter[]
}) {
  const effets = effetsActifs(char, catalog, vies)

  if (effets.length === 0) {
    return (
      <section className="carte">
        <span className="etiquette">Effets en cours</span>
        <p className="vide" style={{ padding: '12px 0 0' }}>
          Aucun effet actif.
        </p>
      </section>
    )
  }

  return (
    <section className="carte pile pile--serree">
      <div className="carte__titre">
        <span className="etiquette">Effets en cours</span>
        <span className="tres-discret">{effets.length} · touchez pour le détail</span>
      </div>
      {effets.map((e) => (
        <LigneEffet key={e.id} effet={e} />
      ))}
    </section>
  )
}

function LigneEffet({ effet }: { effet: EffetActif }) {
  const [ouvert, setOuvert] = useState(false)

  return (
    <div>
      <button
        type="button"
        className={`objet objet--effet effet--${effet.origine}`}
        onClick={() => setOuvert((o) => !o)}
        aria-expanded={ouvert}
      >
        <span className="objet__corps">
          <span className="objet__nom">{effet.nom}</span>
          <span className="objet__meta">{effet.resume}</span>
        </span>
        <span className="puce puce--info">{LIBELLE_ORIGINE[effet.origine]}</span>
      </button>

      {ouvert && (
        <div className="effet__detail">
          <p style={{ margin: 0, whiteSpace: 'pre-line' }}>{effet.detail}</p>
          {effet.modificateurs.length > 0 && (
            <ul className="effet__liste">
              {effet.modificateurs.map((m) => (
                <li key={m.id}>{decrireModificateur(m)}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
