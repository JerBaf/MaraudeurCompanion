import { LIBELLE_RESSOURCE, RESSOURCES } from '../domain/declencheurs.ts'
import type { Declencheur, Ressource } from '../domain/types.ts'

/**
 * Saisie des passifs réactifs d'une entrée de catalogue.
 *
 * Un déclencheur relie deux jauges : « quand les Marques augmentent, gagne un
 * Point de Foi ». Il s'arme au même régime que les modificateurs — objet porté,
 * amélioration possédée — et s'applique en une seule passe, sans cascade.
 */
export function EditeurDeclencheurs({
  valeur,
  onChange,
}: {
  valeur: Declencheur[]
  onChange: (v: Declencheur[]) => void
}) {
  const maj = (index: number, patch: Partial<Declencheur>) =>
    onChange(valeur.map((d, i) => (i === index ? { ...d, ...patch } : d)))

  return (
    <div className="champ">
      <span className="tres-discret">
        Passifs réactifs — appliqués dès que la jauge surveillée bouge
      </span>

      {valeur.length === 0 && (
        <p className="tres-discret" style={{ margin: 0 }}>
          Aucun.
        </p>
      )}

      {valeur.map((d, index) => (
        <div key={index} className="pile pile--serree">
          <div className="rangee">
            <span className="tres-discret">Quand</span>
            <select
              value={d.quand}
              style={{ flex: 1 }}
              aria-label="Jauge surveillée"
              onChange={(e) => maj(index, { quand: e.target.value as Ressource })}
            >
              {RESSOURCES.map((r) => (
                <option key={r} value={r}>
                  {LIBELLE_RESSOURCE[r]}
                </option>
              ))}
            </select>
            <select
              value={d.sens}
              style={{ flex: 1 }}
              aria-label="Sens du déclencheur"
              onChange={(e) => maj(index, { sens: e.target.value as Declencheur['sens'] })}
            >
              <option value="augmente">augmente</option>
              <option value="diminue">diminue</option>
            </select>
          </div>

          <div className="rangee">
            <span className="tres-discret">Alors</span>
            <select
              value={d.alors}
              style={{ flex: 1 }}
              aria-label="Jauge affectée"
              onChange={(e) => maj(index, { alors: e.target.value as Ressource })}
            >
              {RESSOURCES.map((r) => (
                <option key={r} value={r}>
                  {LIBELLE_RESSOURCE[r]}
                </option>
              ))}
            </select>
            <input
              type="number"
              value={d.delta}
              style={{ width: 90 }}
              aria-label="Variation"
              onChange={(e) => maj(index, { delta: Number(e.target.value) || 0 })}
            />
            <button
              type="button"
              className="btn btn--fantome"
              onClick={() => onChange(valeur.filter((_, i) => i !== index))}
            >
              Retirer
            </button>
          </div>
        </div>
      ))}

      <button
        type="button"
        className="btn"
        onClick={() =>
          onChange([...valeur, { quand: 'marques', sens: 'augmente', alors: 'foi', delta: 1 }])
        }
      >
        Ajouter un passif réactif
      </button>
    </div>
  )
}
