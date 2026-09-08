import { useState } from 'react'

import { FiltresCatalogue } from '../../components/FiltresCatalogue.tsx'
import { Icone } from '../../components/Icone.tsx'
import { ajouterAuPossede } from '../../domain/campfire.ts'
import type { Catalog } from '../../domain/catalog.ts'
import { tailleGrimoire } from '../../domain/competences.ts'
import {
  FILTRES_VIERGES,
  filtrerEntrees,
  type FiltresCatalogue as Filtres,
} from '../../domain/filtres.ts'
import { resumeSort } from '../../domain/magie.ts'
import {
  actifsDe,
  capaciteMax,
  chargesRestantes,
  estEpuise,
  rechargerActif,
  resumeEquipement,
} from '../../domain/objets.ts'
import {
  LIBELLE_SLOT,
  SLOTS_EQUIPEMENT,
  type Character,
  type EntreeCatalogue,
  type Sort,
} from '../../domain/types.ts'

/**
 * Inventaire d'un personnage, vu et modifiable par la MJ.
 *
 * Les guidelines demandent de pouvoir « accéder aux profils des joueuses
 * (équipement, sorts, …) et pouvoir les éditer si besoin ». En temps normal
 * ces échanges passent par le Feu de Camp ; ici la MJ peut trancher directement,
 * ce qui est indispensable pour rattraper une erreur en pleine session.
 */
export function Inventaire({
  char,
  catalog,
  maj,
}: {
  char: Character
  catalog: Catalog
  maj: (t: (c: Character) => Character) => void
}) {
  // Dérivé, pas constant : un passif peut accorder un emplacement de plus.
  const slotsGrimoire = tailleGrimoire(char, catalog)

  const sortsPossedes = char.possede.sorts
    .map((id) => catalog.sort(id))
    .filter((s): s is Sort => Boolean(s))

  const equipes = new Set(Object.values(char.equipe).filter(Boolean) as string[])
  const equipements = char.possede.equipements
    .map((id) => catalog.equipement(id))
    .filter((e): e is NonNullable<typeof e> => Boolean(e))

  // Les illusions sont dérivées du passif Illusionniste, jamais possédées :
  // les accorder à la main créerait un doublon avec `sortsHorsEmplacement`.
  const sortsAccordables = catalog
    .sorts()
    .filter((s) => s.requiertPassif === undefined && !char.possede.sorts.includes(s.id))

  const equipementsAccordables = catalog
    .equipements()
    .filter((e) => !char.possede.equipements.includes(e.id))

  const ameliorations = char.possede.ameliorations
    .map((id) => catalog.amelioration(id))
    .filter((a): a is NonNullable<typeof a> => Boolean(a))

  const ameliorationsAccordables = catalog
    .ameliorations()
    .filter((a) => !char.possede.ameliorations.includes(a.id))

  function basculerSort(id: string) {
    maj((c) => {
      if (c.grimoire.includes(id)) return { ...c, grimoire: c.grimoire.filter((s) => s !== id) }
      if (c.grimoire.length >= slotsGrimoire) return c
      return { ...c, grimoire: [...c.grimoire, id] }
    })
  }

  /**
   * Accorder une entrée, quel que soit son type.
   *
   * Passe par `ajouterAuPossede`, qui range au bon endroit **et ne double
   * jamais** : les trois versions manuscrites poussaient l'identifiant sans rien
   * vérifier, si bien que donner deux fois le même sort le faisait apparaître
   * deux fois sur la fiche. C'est aussi le chemin qu'emprunte la boutique.
   */
  function donner(id: string) {
    const entree = catalog.entree(id)
    if (entree) maj((c) => ajouterAuPossede(c, entree))
  }

  function retirerAmelioration(id: string, nom: string) {
    if (!confirm(`Retirer « ${nom} » à ${char.nom} ? La perte est définitive.`)) return
    maj((c) => ({
      ...c,
      possede: { ...c.possede, ameliorations: c.possede.ameliorations.filter((a) => a !== id) },
    }))
  }

  function retirerSort(id: string, nom: string) {
    if (!confirm(`Retirer « ${nom} » à ${char.nom} ? La perte est définitive.`)) return
    // Retirer un sort doit aussi le sortir du Grimoire et de la liste des
    // cristaux épuisés, sinon ces deux-là pointent dans le vide.
    maj((c) => ({
      ...c,
      possede: { ...c.possede, sorts: c.possede.sorts.filter((s) => s !== id) },
      grimoire: c.grimoire.filter((s) => s !== id),
      sortsEpuises: c.sortsEpuises.filter((s) => s !== id),
    }))
  }

  function retirerEquipement(id: string, nom: string) {
    if (!confirm(`Retirer « ${nom} » à ${char.nom} ? La perte est définitive.`)) return
    // Déséquiper au passage : un emplacement qui référence un objet absent
    // ferait disparaître son bonus sans que rien ne l'explique.
    maj((c) => ({
      ...c,
      possede: { ...c.possede, equipements: c.possede.equipements.filter((e) => e !== id) },
      equipe: Object.fromEntries(
        Object.entries(c.equipe).map(([slot, porte]) => [slot, porte === id ? null : porte]),
      ) as Character['equipe'],
    }))
  }

  return (
    <section className="pile pile--serree">
      <span className="etiquette">Équipement porté</span>
      {SLOTS_EQUIPEMENT.map((slot) => {
        const candidats = char.possede.equipements
          .map((id) => catalog.equipement(id))
          .filter((e): e is NonNullable<typeof e> => Boolean(e) && e!.slot === slot && !e!.materielDeBase)

        return (
          <label key={slot} className="champ">
            <span className="etiquette">{LIBELLE_SLOT[slot]}</span>
            <select
              value={char.equipe[slot] ?? ''}
              onChange={(e) =>
                maj((c) => ({ ...c, equipe: { ...c.equipe, [slot]: e.target.value || null } }))
              }
            >
              <option value="">— vide —</option>
              {candidats.map((eq) => (
                <option key={eq.id} value={eq.id}>
                  {eq.nom}
                  {eq.bonusEvasion ? ` (Évasion +${eq.bonusEvasion})` : ''}
                </option>
              ))}
            </select>
          </label>
        )
      })}

      <hr className="separateur" />

      <div className="carte__titre" style={{ marginBottom: 0 }}>
        <span className="etiquette">Sorts</span>
        <span className="tres-discret">
          {char.grimoire.length}/{slotsGrimoire}
        </span>
      </div>

      {sortsPossedes.length === 0 && <p className="vide">Aucun sort connu.</p>}
      {sortsPossedes.map((sort) => {
        const actif = char.grimoire.includes(sort.id)
        const plein = char.grimoire.length >= slotsGrimoire
        return (
          <div key={sort.id} className="rangee">
            <button
              type="button"
              className={`objet ${actif ? 'objet--actif' : ''} ${!actif && plein ? 'objet--indisponible' : ''}`}
              style={{ flex: 1 }}
              aria-pressed={actif}
              disabled={!actif && plein}
              onClick={() => basculerSort(sort.id)}
              title={sort.effet}
            >
              <Icone nom={sort.icone} taille={28} />
              <span className="objet__corps">
                <span className="objet__nom">{sort.nom}</span>
                <span className="objet__meta">
                  {resumeSort(sort, char, catalog)}
                  {char.sortsEpuises.includes(sort.id) ? ' · cristal épuisé' : ''}
                </span>
              </span>
              {actif && <span className="puce puce--ambre">Préparé</span>}
            </button>
            <button
              type="button"
              className="btn btn--fantome"
              onClick={() => retirerSort(sort.id, sort.nom)}
            >
              Retirer
            </button>
          </div>
        )
      })}

      <Accorder
        titre="Accorder un sort"
        kind="sort"
        candidats={sortsAccordables}
        catalog={catalog}
        onChoisir={donner}
      />

      <hr className="separateur" />

      <span className="etiquette">Équipement possédé</span>
      {equipements.length === 0 && <p className="vide">Aucun objet.</p>}
      {equipements.map((eq) => {
        const epuise = estEpuise(char, eq)

        return (
          <div key={eq.id} className="pile pile--serree">
            {/* Un objet à bout se signale : ses actifs ne partent plus, mais il
                reste en inventaire — c'est la MJ ou la joueuse qui l'en retire. */}
            <div className={epuise ? 'objet objet--indisponible' : 'objet'}>
              <Icone nom={eq.icone} taille={28} />
              <span className="objet__corps">
                <span className="objet__nom">{eq.nom}</span>
                <span className="objet__meta">{resumeEquipement(eq, char)}</span>
              </span>
              {equipes.has(eq.id) && <span className="puce puce--ambre">Porté</span>}
              {epuise && <span className="puce">Épuisé</span>}
              <button
                type="button"
                className="btn btn--fantome"
                onClick={() => retirerEquipement(eq.id, eq.nom)}
              >
                Retirer
              </button>
            </div>

            {/* Seule la MJ valide un rituel, et seulement quand la fiction le
                justifie : le PDF en attache un propre à chaque objet. Une
                recharge payante, elle, se déclenche côté joueuse. */}
            {actifsDe(eq)
              .filter((a) => a.usages?.recharge.kind === 'rituel')
              .map((actif) => (
                <div key={actif.id} className="rangee">
                  <span className="tres-discret" style={{ flex: 1 }}>
                    {actif.nom} — rituel :{' '}
                    {actif.usages?.recharge.kind === 'rituel' && actif.usages.recharge.description}
                  </span>
                  <button
                    type="button"
                    className="btn"
                    disabled={chargesRestantes(char, eq, actif) === capaciteMax(actif)}
                    onClick={() => maj((c) => rechargerActif(c, catalog, eq, actif).char)}
                  >
                    Recharger
                  </button>
                </div>
              ))}
          </div>
        )
      })}

      <Accorder
        titre="Accorder un équipement"
        kind="equipement"
        candidats={equipementsAccordables}
        catalog={catalog}
        onChoisir={donner}
        suffixe={(e) => (e.kind === 'equipement' ? ` — ${LIBELLE_SLOT[e.slot]}` : '')}
      />

      <hr className="separateur" />

      {/* Une amélioration ne s'obtenait qu'en boutique : la MJ ne pouvait pas
          en accorder une, ni corriger une acquisition. */}
      <span className="etiquette">Améliorations</span>
      {ameliorations.length === 0 && <p className="vide">Aucune.</p>}
      {ameliorations.map((am) => (
        <div key={am.id} className="objet">
          <Icone nom={am.icone} taille={28} />
          <span className="objet__corps">
            <span className="objet__nom">{am.nom}</span>
            <span className="objet__meta">{am.effetTexte}</span>
          </span>
          <button
            type="button"
            className="btn btn--fantome"
            onClick={() => retirerAmelioration(am.id, am.nom)}
          >
            Retirer
          </button>
        </div>
      ))}

      <Accorder
        titre="Accorder une amélioration"
        kind="amelioration"
        candidats={ameliorationsAccordables}
        catalog={catalog}
        onChoisir={donner}
        suffixe={(e) => (e.kind === 'amelioration' ? ` — ${e.prix} ʟ` : '')}
      />
    </section>
  )
}

// ---------------------------------------------------------------------------

/**
 * Accorder une entrée du catalogue : on filtre d'abord, on choisit ensuite.
 *
 * ⚠️ Ce n'était pas un simple `<select>` de trop. Les trois listes énuméraient
 * **tout** le catalogue sans le moindre filtre : passé une trentaine
 * d'entrées, retrouver une armure y devient un défilement à l'aveugle, et le
 * catalogue d'une table grossit à chaque session.
 */
function Accorder({
  titre,
  kind,
  candidats,
  catalog,
  onChoisir,
  suffixe,
}: {
  titre: string
  kind: EntreeCatalogue['kind']
  candidats: EntreeCatalogue[]
  catalog: Catalog
  onChoisir: (id: string) => void
  /** Ce qu'on ajoute au nom pour reconnaître l'entrée d'un coup d'œil. */
  suffixe?: (e: EntreeCatalogue) => string
}) {
  const [filtres, setFiltres] = useState<Filtres>(FILTRES_VIERGES)
  const visibles = filtrerEntrees(candidats, filtres)

  return (
    <div className="champ">
      <span className="etiquette">{titre}</span>

      <FiltresCatalogue
        kind={kind}
        valeur={filtres}
        catalog={catalog}
        total={visibles.length}
        onChange={setFiltres}
      />

      <select value="" aria-label={titre} onChange={(e) => e.target.value && onChoisir(e.target.value)}>
        <option value="">— choisir —</option>
        {visibles.map((e) => (
          <option key={e.id} value={e.id}>
            {e.nom}
            {suffixe?.(e) ?? ''}
          </option>
        ))}
      </select>
    </div>
  )
}
