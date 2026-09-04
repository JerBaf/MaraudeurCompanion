import { useState } from 'react'

import type { Catalog } from '../domain/catalog.ts'
import { decrireModificateur, effetsActifs, LIBELLE_ORIGINE, type EffetActif } from '../domain/effets.ts'
import { dissiperEffet, estPoseParUnSort } from '../domain/lancement.ts'
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
  maj,
}: {
  char: Character
  catalog: Catalog
  vies?: readonly VieSoulshifter[]
  /**
   * Absent en lecture seule ; présent, il autorise la dissipation des effets
   * posés par un sort.
   */
  maj?: (t: (c: Character) => Character) => void
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
        <LigneEffet
          key={e.id}
          effet={e}
          {...(maj ? { onDissiper: (id: string) => maj((c) => dissiperEffet(c, id)) } : {})}
        />
      ))}
    </section>
  )
}

function LigneEffet({
  effet,
  onDissiper,
}: {
  effet: EffetActif
  onDissiper?: (modifierId: string) => void
}) {
  const [ouvert, setOuvert] = useState(false)

  /*
   * Seuls les effets posés par un sort se dissipent à la main.
   *
   * ⚠️ C'est la contrepartie assumée de l'absence d'horloge de fiction : un
   * sort « pendant 1 heure » ne peut pas expirer tout seul, et il vaut mieux
   * laisser la joueuse déclarer que l'heure est passée que faire semblant de la
   * compter. Un Fardeau ou un Serment, eux, ne se retirent pas d'un clic — ce
   * sont des engagements, levés au feu de camp.
   */
  const dissipables = effet.modificateurs.filter(estPoseParUnSort)

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
          {onDissiper && dissipables.length > 0 && (
            <button
              type="button"
              className="btn btn--fantome"
              onClick={() => dissipables.forEach((m) => onDissiper(m.id))}
            >
              Dissiper
            </button>
          )}
        </div>
      )}
    </div>
  )
}
