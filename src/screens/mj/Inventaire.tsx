import { Icone } from '../../components/Icone.tsx'
import { TAILLE_GRIMOIRE } from '../../domain/campfire.ts'
import type { Catalog } from '../../domain/catalog.ts'
import {
  LIBELLE_MAGIE,
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
  const enReserve = char.possede.equipements
    .filter((id) => !equipes.has(id))
    .map((id) => catalog.equipement(id))
    .filter((e): e is NonNullable<typeof e> => Boolean(e))

  function basculerSort(id: string) {
    maj((c) => {
      if (c.grimoire.includes(id)) return { ...c, grimoire: c.grimoire.filter((s) => s !== id) }
      if (c.grimoire.length >= TAILLE_GRIMOIRE) return c
      return { ...c, grimoire: [...c.grimoire, id] }
    })
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
          <button
            key={sort.id}
            type="button"
            className={`objet ${actif ? 'objet--actif' : ''} ${!actif && plein ? 'objet--indisponible' : ''}`}
            aria-pressed={actif}
            disabled={!actif && plein}
            onClick={() => basculerSort(sort.id)}
            title={sort.effet}
          >
            <Icone nom={sort.icone} taille={28} />
            <span className="objet__corps">
              <span className="objet__nom">{sort.nom}</span>
              <span className="objet__meta">
                {LIBELLE_MAGIE[sort.magie]} · {sort.duree}
                {char.sortsEpuises.includes(sort.id) ? ' · cristal épuisé' : ''}
              </span>
            </span>
            {actif && <span className="puce puce--ambre">Préparé</span>}
          </button>
        )
      })}

      <hr className="separateur" />

      <span className="etiquette">Sac à dos</span>
      {enReserve.length === 0 && <p className="vide">Rien en réserve.</p>}
      {enReserve.map((eq) => (
        <div key={eq.id} className="objet">
          <Icone nom={eq.icone} taille={28} />
          <span className="objet__corps">
            <span className="objet__nom">{eq.nom}</span>
            <span className="objet__meta">
              {LIBELLE_SLOT[eq.slot]}
              {eq.materielDeBase ? ' · matériel de base' : ''}
              {eq.bonusEvasion ? ` · Évasion +${eq.bonusEvasion}` : ''}
            </span>
          </span>
        </div>
      ))}
    </section>
  )
}
