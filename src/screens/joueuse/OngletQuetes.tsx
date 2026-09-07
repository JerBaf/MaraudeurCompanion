import { ObjetDetaillable } from '../../components/ObjetDetaillable.tsx'
import type { Catalog } from '../../domain/catalog.ts'
import { decrireRecompense, quetesDe } from '../../domain/quetes.ts'
import { RARETES, type Character, type Quete } from '../../domain/types.ts'

/**
 * Les quêtes de la joueuse.
 *
 * Deux sections empilées plutôt qu'une bascule « En Cours / Passées » : les deux
 * listes sont courtes et se lisent d'un coup sur un téléphone, et une bascule
 * cacherait la moitié de ce qu'on vient chercher.
 *
 * La ligne ne montre que le titre et l'aperçu de la récompense ; la description
 * se déplie au toucher, comme un objet du sac.
 */
export function OngletQuetes({ char, catalog }: { char: Character; catalog: Catalog }) {
  const mesQuetes = quetesDe(char, catalog)
  const enCours = mesQuetes.filter((q) => q.etat === 'en-cours')
  const passees = mesQuetes.filter((q) => q.etat === 'validee')

  return (
    <div className="pile">
      <section className="carte pile pile--serree">
        <div className="carte__titre">
          <span className="etiquette">En Cours</span>
          <span className="tres-discret">{enCours.length}</span>
        </div>
        {enCours.length === 0 && <p className="vide">Aucune quête en cours.</p>}
        {enCours.map((q) => (
          <LigneQuete key={q.id} quete={q} catalog={catalog} />
        ))}
      </section>

      <section className="carte pile pile--serree">
        <div className="carte__titre">
          <span className="etiquette">Passées</span>
          <span className="tres-discret">{passees.length}</span>
        </div>
        {passees.length === 0 && <p className="vide">Aucune quête accomplie.</p>}
        {passees.map((q) => (
          <LigneQuete key={q.id} quete={q} catalog={catalog} />
        ))}
      </section>
    </div>
  )
}

function LigneQuete({ quete, catalog }: { quete: Quete; catalog: Catalog }) {
  return (
    <ObjetDetaillable
      icone={quete.icone}
      nom={quete.nom}
      meta={decrireRecompense(quete.recompense, catalog)}
      teinte={RARETES[quete.rarete ?? 'commun'].teinte}
      {...(quete.description ? { detail: quete.description } : {})}
    />
  )
}
