import {
  COUT_GRATUIT,
  decrireCout,
  ELEMENTS_PAYABLES,
  fixe,
  type BrancheCout,
  type ClePayable,
  type Cout,
  type PartCout,
} from '../domain/couts.ts'
import { ELEMENTS_VARIABLES } from '../domain/elements.ts'

/**
 * Saisie d'un Coût.
 *
 * Trois niveaux, et l'écran suit exactement le modèle : une **part** prélève un
 * Élément Variable, une **branche** réunit les parts qu'il faut payer toutes,
 * et les branches s'enchaînent par un « OU ». C'est ce dernier niveau qui
 * manquait — « 2 Points de Foi OU 10 Lumens » ne pouvait pas s'écrire.
 *
 * Les éléments proposés sont ceux que le moteur sait prélever
 * (`ELEMENTS_PAYABLES`) : ajouter une monnaie au jeu la fait apparaître ici
 * sans toucher à ce formulaire.
 */

type KindPart = PartCout['kind']

const LIBELLE_KIND: Record<KindPart, string> = {
  fixe: 'Montant fixe',
  variable: 'Montant au choix (X)',
  narratif: 'Contrepartie à table',
}

function partVierge(kind: KindPart): PartCout {
  switch (kind) {
    case 'fixe':
      return fixe('foi', 1)
    case 'variable':
      return { kind: 'variable', element: { kind: 'foi' } }
    case 'narratif':
      return { kind: 'narratif', description: '' }
  }
}

export function EditeurCout({
  valeur,
  label,
  onChange,
}: {
  valeur: Cout
  /** Ce que le coût borne : « Coût du sort », « Coût de l'actif ». */
  label: string
  onChange: (v: Cout) => void
}) {
  const majBranche = (index: number, branche: BrancheCout) =>
    onChange({ branches: valeur.branches.map((b, i) => (i === index ? branche : b)) })

  const majPart = (iBranche: number, iPart: number, part: PartCout) => {
    const branche = valeur.branches[iBranche]
    if (!branche) return
    majBranche(iBranche, { parts: branche.parts.map((p, i) => (i === iPart ? part : p)) })
  }

  if (valeur.branches.length === 0) {
    return (
      <div className="champ">
        <span className="tres-discret">{label} — gratuit</span>
        <button
          type="button"
          className="btn"
          onClick={() => onChange({ branches: [{ parts: [partVierge('fixe')] }] })}
        >
          Ajouter un coût
        </button>
      </div>
    )
  }

  return (
    <div className="champ">
      <span className="tres-discret">
        {label} — {decrireCout(valeur)}
      </span>

      {valeur.branches.map((branche, iBranche) => (
        <div key={iBranche} className="pile pile--serree">
          {iBranche > 0 && <span className="etiquette">ou</span>}

          {branche.parts.map((part, iPart) => (
            <div key={iPart} className="rangee">
              <select
                value={part.kind}
                style={{ flex: 1 }}
                aria-label="Nature de la part de coût"
                onChange={(e) => majPart(iBranche, iPart, partVierge(e.target.value as KindPart))}
              >
                {(Object.keys(LIBELLE_KIND) as KindPart[]).map((k) => (
                  <option key={k} value={k}>
                    {LIBELLE_KIND[k]}
                  </option>
                ))}
              </select>

              {part.kind !== 'narratif' && (
                <select
                  value={part.element.kind}
                  style={{ flex: 1 }}
                  aria-label="Élément payé"
                  onChange={(e) =>
                    majPart(iBranche, iPart, {
                      ...part,
                      element: { kind: e.target.value as ClePayable },
                    })
                  }
                >
                  {ELEMENTS_PAYABLES.map((cle) => (
                    <option key={cle} value={cle}>
                      {ELEMENTS_VARIABLES[cle].libelle}
                    </option>
                  ))}
                </select>
              )}

              {part.kind === 'fixe' && (
                <input
                  type="number"
                  min={0}
                  value={part.valeur}
                  style={{ width: 80 }}
                  aria-label="Montant"
                  onChange={(e) =>
                    majPart(iBranche, iPart, { ...part, valeur: Math.max(0, Number(e.target.value) || 0) })
                  }
                />
              )}

              {part.kind === 'variable' && (
                <input
                  type="number"
                  min={0}
                  value={part.max ?? ''}
                  style={{ width: 80 }}
                  placeholder="max"
                  aria-label="Maximum du X"
                  onChange={(e) => {
                    const brut = e.target.value
                    const { max: _retire, ...reste } = part
                    majPart(
                      iBranche,
                      iPart,
                      brut === '' ? reste : { ...reste, max: Math.max(0, Number(brut) || 0) },
                    )
                  }}
                />
              )}

              {part.kind === 'narratif' && (
                <input
                  type="text"
                  value={part.description}
                  style={{ flex: 2 }}
                  placeholder="Une Marque toutes les trois utilisations"
                  aria-label="Contrepartie, en toutes lettres"
                  onChange={(e) => majPart(iBranche, iPart, { ...part, description: e.target.value })}
                />
              )}

              <button
                type="button"
                className="btn btn--fantome"
                onClick={() => {
                  const restantes = branche.parts.filter((_, i) => i !== iPart)
                  // Une branche sans part ne veut rien dire : elle disparaît avec sa dernière.
                  if (restantes.length > 0) majBranche(iBranche, { parts: restantes })
                  else onChange({ branches: valeur.branches.filter((_, i) => i !== iBranche) })
                }}
              >
                ×
              </button>
            </div>
          ))}

          <button
            type="button"
            className="btn btn--fantome"
            onClick={() => majBranche(iBranche, { parts: [...branche.parts, partVierge('fixe')] })}
          >
            Et aussi…
          </button>
        </div>
      ))}

      <div className="rangee">
        <button
          type="button"
          className="btn"
          onClick={() => onChange({ branches: [...valeur.branches, { parts: [partVierge('fixe')] }] })}
        >
          Ajouter une alternative (OU)
        </button>
        <button type="button" className="btn btn--fantome" onClick={() => onChange(COUT_GRATUIT)}>
          Rendre gratuit
        </button>
      </div>
    </div>
  )
}
