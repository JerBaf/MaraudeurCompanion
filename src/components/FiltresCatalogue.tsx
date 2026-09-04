import type { Catalog } from '../domain/catalog.ts'
import {
  axesPertinents,
  dossiersDe,
  DOSSIER_TOUS,
  familleRangeable,
  LIBELLE_TRI,
  SANS_DOSSIER,
  type CleTri,
  type FiltresCatalogue as Filtres,
} from '../domain/filtres.ts'
import { libelleMagie } from '../domain/magie.ts'
import {
  LIBELLE_SLOT,
  RARETES,
  SLOTS_EQUIPEMENT,
  type EntreeCatalogue,
  type Rarete,
  type SlotEquipement,
} from '../domain/types.ts'

/**
 * La barre de filtres, partagée par tous les écrans qui listent du catalogue.
 *
 * Le même contrôle pour la MJ qui compose et pour la joueuse qui cherche un
 * sort : ce sont les mêmes entrées, et il n'y avait aucune raison de les
 * chercher différemment. Les axes proposés dépendent de la famille affichée —
 * `axesPertinents` le décide, pas cet écran.
 *
 * Les libellés annoncent « Filtrer par… » plutôt que le seul nom de l'axe :
 * la barre cohabite avec le formulaire d'édition, qui porte les mêmes mots, et
 * « Emplacement » y désignerait deux choses différentes.
 */

/** Les tris qui ont un sens pour une famille donnée. */
function trisPertinents(kind: EntreeCatalogue['kind']): CleTri[] {
  const communs: CleTri[] = ['nom', 'rarete', 'creation']
  if (kind === 'sort') return [...communs, 'prix', 'cout']
  return [...communs, 'prix']
}

export function FiltresCatalogue({
  kind,
  valeur,
  catalog,
  onChange,
  /** Nombre d'entrées après filtrage, pour que le vide s'explique. */
  total,
}: {
  kind: EntreeCatalogue['kind']
  valeur: Filtres
  catalog: Catalog
  onChange: (v: Filtres) => void
  total: number
}) {
  const axes = axesPertinents(kind)
  const maj = (patch: Partial<Filtres>) => onChange({ ...valeur, ...patch })

  const famille = familleRangeable(kind)
  const dossiers = famille ? dossiersDe(catalog, famille) : []

  return (
    <div className="pile pile--serree">
      <div className="rangee">
        <input
          type="search"
          value={valeur.texte}
          style={{ flex: 2, minWidth: 140 }}
          placeholder="Rechercher…"
          aria-label="Rechercher"
          onChange={(e) => maj({ texte: e.target.value })}
        />

        <select
          value={valeur.tri}
          style={{ flex: 1, minWidth: 120 }}
          aria-label="Trier par"
          onChange={(e) => maj({ tri: e.target.value as CleTri })}
        >
          {trisPertinents(kind).map((t) => (
            <option key={t} value={t}>
              {LIBELLE_TRI[t]}
            </option>
          ))}
        </select>

        <button
          type="button"
          className="btn btn--fantome"
          aria-label={valeur.ordre === 'asc' ? 'Ordre croissant' : 'Ordre décroissant'}
          onClick={() => maj({ ordre: valeur.ordre === 'asc' ? 'desc' : 'asc' })}
        >
          {valeur.ordre === 'asc' ? '↑' : '↓'}
        </button>
      </div>

      <div className="rangee">
        {/* Le dossier « Tous » n'est pas une entrée du catalogue : c'est
            l'absence de filtre. Rien à créer, rien à tenir à jour. */}
        {axes.includes('dossierId') && famille && (
          <select
            value={valeur.dossierId}
            style={{ flex: 1, minWidth: 120 }}
            aria-label="Filtrer par dossier"
            onChange={(e) => maj({ dossierId: e.target.value })}
          >
            <option value={DOSSIER_TOUS}>Tous les dossiers</option>
            {dossiers.map((d) => (
              <option key={d.id} value={d.id}>
                {d.nom}
              </option>
            ))}
            <option value={SANS_DOSSIER}>Non classé</option>
          </select>
        )}

        {axes.includes('rarete') && (
          <select
            value={valeur.rarete}
            style={{ flex: 1, minWidth: 110 }}
            aria-label="Filtrer par rareté"
            onChange={(e) => maj({ rarete: e.target.value as Rarete | '' })}
          >
            <option value="">Toutes raretés</option>
            {(Object.keys(RARETES) as Rarete[]).map((r) => (
              <option key={r} value={r}>
                {RARETES[r].libelle}
              </option>
            ))}
          </select>
        )}

        {axes.includes('slot') && (
          <select
            value={valeur.slot}
            style={{ flex: 1, minWidth: 120 }}
            aria-label="Filtrer par emplacement"
            onChange={(e) => maj({ slot: e.target.value as SlotEquipement | '' })}
          >
            <option value="">Tous les emplacements</option>
            {SLOTS_EQUIPEMENT.map((s) => (
              <option key={s} value={s}>
                {LIBELLE_SLOT[s]}
              </option>
            ))}
          </select>
        )}

        {axes.includes('magieId') && (
          <select
            value={valeur.magieId}
            style={{ flex: 1, minWidth: 120 }}
            aria-label="Filtrer par type magique"
            onChange={(e) => maj({ magieId: e.target.value })}
          >
            <option value="">Toutes les magies</option>
            {catalog.typesMagiques().map((t) => (
              <option key={t.id} value={t.id}>
                {libelleMagie(t.id, catalog)}
              </option>
            ))}
          </select>
        )}

        {axes.includes('classeId') && (
          <select
            value={valeur.classeId}
            style={{ flex: 1, minWidth: 120 }}
            aria-label="Filtrer par classe"
            onChange={(e) => maj({ classeId: e.target.value })}
          >
            <option value="">Toutes les classes</option>
            {catalog.classes().map((c) => (
              <option key={c.id} value={c.id}>
                {c.nom}
              </option>
            ))}
          </select>
        )}
      </div>

      <span className="tres-discret">{total} entrée(s)</span>
    </div>
  )
}
