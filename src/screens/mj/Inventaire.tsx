import { Icone } from '../../components/Icone.tsx'
import { TAILLE_GRIMOIRE } from '../../domain/campfire.ts'
import type { Catalog } from '../../domain/catalog.ts'
import { resumeSort } from '../../domain/magie.ts'
import { capaciteMax, chargesRestantes, rechargerObjet } from '../../domain/objets.ts'
import {
  LIBELLE_SLOT,
  SLOTS_EQUIPEMENT,
  type Character,
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
    .filter((s) => s.illusion !== true && !char.possede.sorts.includes(s.id))

  const equipementsAccordables = catalog
    .equipements()
    .filter((e) => !char.possede.equipements.includes(e.id))

  function basculerSort(id: string) {
    maj((c) => {
      if (c.grimoire.includes(id)) return { ...c, grimoire: c.grimoire.filter((s) => s !== id) }
      if (c.grimoire.length >= TAILLE_GRIMOIRE) return c
      return { ...c, grimoire: [...c.grimoire, id] }
    })
  }

  function donnerSort(id: string) {
    maj((c) => ({ ...c, possede: { ...c.possede, sorts: [...c.possede.sorts, id] } }))
  }

  function donnerEquipement(id: string) {
    maj((c) => ({
      ...c,
      possede: { ...c.possede, equipements: [...c.possede.equipements, id] },
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
        <span className="etiquette">Grimoire</span>
        <span className="tres-discret">
          {char.grimoire.length}/{TAILLE_GRIMOIRE}
        </span>
      </div>

      {sortsPossedes.length === 0 && <p className="vide">Aucun sort connu.</p>}
      {sortsPossedes.map((sort) => {
        const actif = char.grimoire.includes(sort.id)
        const plein = char.grimoire.length >= TAILLE_GRIMOIRE
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

      <label className="champ">
        <span className="etiquette">Accorder un sort</span>
        <select value="" onChange={(e) => e.target.value && donnerSort(e.target.value)}>
          <option value="">— choisir —</option>
          {sortsAccordables.map((s) => (
            <option key={s.id} value={s.id}>
              {s.nom}
            </option>
          ))}
        </select>
      </label>

      <hr className="separateur" />

      <span className="etiquette">Équipement possédé</span>
      {equipements.length === 0 && <p className="vide">Aucun objet.</p>}
      {equipements.map((eq) => {
        const max = capaciteMax(eq)
        const restantes = chargesRestantes(char, eq)

        return (
          <div key={eq.id} className="pile pile--serree">
            <div className="objet">
              <Icone nom={eq.icone} taille={28} />
              <span className="objet__corps">
                <span className="objet__nom">{eq.nom}</span>
                <span className="objet__meta">
                  {[
                    LIBELLE_SLOT[eq.slot],
                    eq.materielDeBase ? 'matériel de base' : null,
                    eq.bonusEvasion ? `Évasion +${eq.bonusEvasion}` : null,
                    max !== null ? `${restantes}/${max} charge(s)` : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              </span>
              {equipes.has(eq.id) && <span className="puce puce--ambre">Porté</span>}
              <button
                type="button"
                className="btn btn--fantome"
                onClick={() => retirerEquipement(eq.id, eq.nom)}
              >
                Retirer
              </button>
            </div>

            {/* Seule la MJ recharge, et seulement quand la fiction le justifie :
                le PDF attache un rituel propre à chaque objet. */}
            {eq.effetsActifs?.cout.kind === 'charges' && (
              <div className="rangee">
                <span className="tres-discret" style={{ flex: 1 }}>
                  Rituel — {eq.effetsActifs.cout.rituel}
                </span>
                <button
                  type="button"
                  className="btn"
                  disabled={restantes === max}
                  onClick={() => maj((c) => rechargerObjet(c, eq))}
                >
                  Recharger
                </button>
              </div>
            )}
          </div>
        )
      })}

      <label className="champ">
        <span className="etiquette">Accorder un équipement</span>
        <select value="" onChange={(e) => e.target.value && donnerEquipement(e.target.value)}>
          <option value="">— choisir —</option>
          {equipementsAccordables.map((eq) => (
            <option key={eq.id} value={eq.id}>
              {eq.nom} — {LIBELLE_SLOT[eq.slot]}
            </option>
          ))}
        </select>
      </label>
    </section>
  )
}
