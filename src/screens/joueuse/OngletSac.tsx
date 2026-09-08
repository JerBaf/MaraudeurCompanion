import { useState } from 'react'

import { FiltresCatalogue } from '../../components/FiltresCatalogue.tsx'
import { ObjetDetaillable } from '../../components/ObjetDetaillable.tsx'
import type { Catalog } from '../../domain/catalog.ts'
import {
  FILTRES_VIERGES,
  filtrerEntrees,
  type FiltresCatalogue as Filtres,
} from '../../domain/filtres.ts'
import { detailObjet, resumeEquipement } from '../../domain/objets.ts'
import {
  LIBELLE_SLOT,
  RARETES,
  type Character,
  type Equipement,
  type SlotEquipement,
} from '../../domain/types.ts'

/**
 * Tout l'équipement possédé, porté ou non — le porté marqué de son emplacement.
 *
 * N'afficher que la réserve obligeait à regarder à deux endroits pour comparer
 * ce qu'on porte à ce qu'on pourrait porter.
 */
export function OngletSac({ char, catalog }: { char: Character; catalog: Catalog }) {
  const equipes = Object.entries(char.equipe).filter(([, id]) => id) as [SlotEquipement, string][]
  const parObjetPorte = new Map(equipes.map(([slot, id]) => [id, slot]))

  const [filtres, setFiltres] = useState<Filtres>(FILTRES_VIERGES)

  const equipements = filtrerEntrees(
    char.possede.equipements
      .map((id) => catalog.equipement(id))
      .filter((e): e is Equipement => Boolean(e)),
    filtres,
  ) as Equipement[]

  const ameliorations = char.possede.ameliorations
    .map((id) => catalog.amelioration(id))
    .filter((a): a is NonNullable<typeof a> => Boolean(a))

  return (
    <div className="pile">
      <p className="alerte alerte--info">
        Tout ce que vous transportez. Les échanges se font au prochain feu de camp.
      </p>

      <section className="carte pile pile--serree">
        <span className="etiquette">Équipement</span>

        <FiltresCatalogue
          kind="equipement"
          valeur={filtres}
          catalog={catalog}
          total={equipements.length}
          onChange={setFiltres}
        />

        {equipements.length === 0 && <p className="vide">Aucun objet à afficher.</p>}
        {equipements.map((eq) => {
          const porteEn = parObjetPorte.get(eq.id)

          return (
            <ObjetDetaillable
              key={eq.id}
              icone={eq.icone}
              nom={eq.nom}
              meta={resumeEquipement(eq, char)}
              detail={detailObjet(eq)}
              {...(porteEn
                ? { puce: <span className="puce puce--ambre">{LIBELLE_SLOT[porteEn]}</span> }
                : {})}
              teinte={RARETES[eq.rarete ?? 'commun'].teinte}
            />
          )
        })}
      </section>

      {ameliorations.length > 0 && (
        <section className="carte pile pile--serree">
          <span className="etiquette">Améliorations</span>
          {ameliorations.map((am) => (
            <ObjetDetaillable
              key={am.id}
              icone={am.icone}
              nom={am.nom}
              meta={am.effetTexte}
              detail={am.description ?? am.effetTexte}
            />
          ))}
        </section>
      )}
    </div>
  )
}
