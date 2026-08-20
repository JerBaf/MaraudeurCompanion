import {
  COMPETENCES,
  LIBELLE_COMPETENCE,
  type Competence,
  type Modifier,
  type ModifierSourceKind,
} from '../domain/types.ts'

/** Un modificateur tel qu'il vit dans le catalogue : sans identifiant ni échéance. */
export type ModificateurCatalogue = Omit<Modifier, 'id' | 'expires'>

/**
 * Saisie des passifs accordés par une entrée de catalogue.
 *
 * Le moteur de modificateurs sait déjà les appliquer — `derivedModifiers` les
 * relit à chaque rendu et leur pose lui-même un identifiant et une échéance
 * « jamais », puisqu'ils se recalculent. Il ne manquait que ce formulaire :
 * faute de lui, tout nouveau passif devait être écrit en dur dans le code.
 *
 * Deux cibles restent volontairement absentes. `cout-sort` sert au passif
 * Conteur du Trickster et `competence-sauf` au Serment : ce sont des mécaniques
 * de règle, pas du contenu que la MJ compose.
 */

type CibleSimple = 'competence' | 'competence-toutes' | 'evasion' | 'sixth-sens' | 'energie-attaque'

const LIBELLE_CIBLE: Record<CibleSimple, string> = {
  competence: 'Une compétence',
  'competence-toutes': 'Toutes les compétences',
  evasion: 'Évasion',
  'sixth-sens': '6th Sens',
  'energie-attaque': "Points d'Énergie d'attaque",
}

type Operation = 'add' | 'avantage' | 'desavantage'

const LIBELLE_OP: Record<Operation, string> = {
  add: 'Bonus ou malus chiffré',
  avantage: 'Avantage (+d4)',
  desavantage: 'Désavantage (−d4)',
}

/** Certaines cibles ne se prêtent qu'à un chiffre : on n'ajoute pas un d4 à l'Évasion. */
const ACCEPTE_UN_DE: CibleSimple[] = ['competence', 'competence-toutes']

function vierge(label: string, source: ModifierSourceKind): ModificateurCatalogue {
  return {
    source: { kind: source, label },
    target: { kind: 'competence', competence: 'physique' },
    op: { kind: 'add', value: 1 },
  }
}

export function EditeurModificateurs({
  valeur,
  label,
  source,
  onChange,
}: {
  valeur: ModificateurCatalogue[]
  /** Nom de l'entrée : c'est lui que la joueuse verra dans ses effets. */
  label: string
  source: ModifierSourceKind
  onChange: (v: ModificateurCatalogue[]) => void
}) {
  const maj = (index: number, patch: Partial<ModificateurCatalogue>) =>
    onChange(valeur.map((m, i) => (i === index ? { ...m, ...patch } : m)))

  return (
    <div className="champ">
      <span className="tres-discret">
        Passifs accordés — appliqués automatiquement, sans que la joueuse ait à y penser
      </span>

      {valeur.length === 0 && (
        <p className="tres-discret" style={{ margin: 0 }}>
          Aucun passif.
        </p>
      )}

      {valeur.map((m, index) => {
        const cible = m.target.kind as CibleSimple
        const accepteDe = ACCEPTE_UN_DE.includes(cible)

        return (
          <div key={index} className="pile pile--serree">
            <div className="rangee">
              <select
                value={cible}
                style={{ flex: 1 }}
                aria-label="Cible du passif"
                onChange={(e) => {
                  const suivante = e.target.value as CibleSimple
                  maj(index, {
                    target:
                      suivante === 'competence'
                        ? { kind: 'competence', competence: 'physique' }
                        : ({ kind: suivante } as ModificateurCatalogue['target']),
                    // Un d4 sur l'Évasion n'a pas de sens : on retombe sur un chiffre.
                    ...(ACCEPTE_UN_DE.includes(suivante) ? {} : { op: { kind: 'add', value: 1 } }),
                  })
                }}
              >
                {(Object.keys(LIBELLE_CIBLE) as CibleSimple[]).map((c) => (
                  <option key={c} value={c}>
                    {LIBELLE_CIBLE[c]}
                  </option>
                ))}
              </select>

              {m.target.kind === 'competence' && (
                <select
                  value={m.target.competence}
                  style={{ flex: 1 }}
                  aria-label="Compétence visée"
                  onChange={(e) =>
                    maj(index, {
                      target: { kind: 'competence', competence: e.target.value as Competence },
                    })
                  }
                >
                  {COMPETENCES.map((c) => (
                    <option key={c} value={c}>
                      {LIBELLE_COMPETENCE[c]}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="rangee">
              <select
                value={m.op.kind}
                style={{ flex: 1 }}
                aria-label="Effet du passif"
                onChange={(e) => {
                  const op = e.target.value as Operation
                  maj(index, { op: op === 'add' ? { kind: 'add', value: 1 } : { kind: op } })
                }}
              >
                {(Object.keys(LIBELLE_OP) as Operation[])
                  .filter((op) => op === 'add' || accepteDe)
                  .map((op) => (
                    <option key={op} value={op}>
                      {LIBELLE_OP[op]}
                    </option>
                  ))}
              </select>

              {m.op.kind === 'add' && (
                <input
                  type="number"
                  value={m.op.value}
                  style={{ width: 90 }}
                  aria-label="Valeur du passif"
                  onChange={(e) =>
                    maj(index, { op: { kind: 'add', value: Number(e.target.value) || 0 } })
                  }
                />
              )}

              <button
                type="button"
                className="btn btn--fantome"
                onClick={() => onChange(valeur.filter((_, i) => i !== index))}
              >
                Retirer
              </button>
            </div>
          </div>
        )
      })}

      <button
        type="button"
        className="btn"
        onClick={() => onChange([...valeur, vierge(label, source)])}
      >
        Ajouter un passif
      </button>
    </div>
  )
}
