import { ELEMENTS_PAYABLES } from '../domain/couts.ts'
import {
  elementDepuisCle,
  ELEMENTS_VARIABLES,
  type Aspect,
  type CleElement,
} from '../domain/elements.ts'
import { decrirePassif } from '../domain/passifs.ts'
import { nouvelIdentifiant } from '../domain/random.ts'
import {
  COMPETENCES,
  LIBELLE_COMPETENCE,
  type Competence,
  type Declenchement,
  type Operation,
  type OperationValeur,
  type Passif,
} from '../domain/types.ts'

/**
 * Saisie des Passifs d'une entrée de catalogue.
 *
 * Un seul formulaire là où il en fallait deux — l'un pour les ajustements
 * permanents, l'autre pour les réactions. Ils ne différaient que par leur
 * déclenchement, jamais par leur effet : les réunir permet d'écrire « gagne
 * 10 Lumens quand tu prends une Marque » aussi bien que « +1 Évasion quand tu
 * es à 3 Fatigue », ce qu'aucun des deux ne savait faire.
 */

// ---------------------------------------------------------------------------

/** Les cibles qu'un passif sait viser, et l'aspect que chacune vise. */
const CIBLES: { cle: CleElement; aspect: Aspect; libelle: string }[] = [
  { cle: 'competence', aspect: 'valeur', libelle: 'Une compétence' },
  { cle: 'competence-toutes', aspect: 'valeur', libelle: 'Toutes les compétences' },
  { cle: 'evasion', aspect: 'valeur', libelle: 'Évasion' },
  { cle: 'energie-attaque', aspect: 'valeur', libelle: "Points d'Énergie d'attaque" },
  // Les plafonds : la règle veut qu'un objet hausse le maximum, pas la jauge.
  { cle: 'sixth-sens', aspect: 'plafond', libelle: '6th Sens (maximum)' },
  { cle: 'fatigue', aspect: 'plafond', libelle: 'Points de Fatigue (maximum)' },
  { cle: 'foi', aspect: 'plafond', libelle: 'Points de Foi (maximum)' },
  { cle: 'marques', aspect: 'plafond', libelle: 'Marques (maximum)' },
  { cle: 'brulures', aspect: 'plafond', libelle: 'Brûlures (maximum)' },
  // Les jauges, pour les réactions : « gagne 1 Point de Foi ».
  { cle: 'foi', aspect: 'valeur', libelle: 'Points de Foi (gagnés)' },
  { cle: 'lumens', aspect: 'valeur', libelle: 'Lumens (gagnés)' },
  { cle: 'marques', aspect: 'valeur', libelle: 'Marques (gagnées)' },
  { cle: 'brulures', aspect: 'valeur', libelle: 'Brûlures (gagnées)' },
  { cle: 'fatigue', aspect: 'valeur', libelle: 'Points de Fatigue (cochés)' },
]

const cleCible = (cle: CleElement, aspect: Aspect) => `${cle}|${aspect}`

/** Un d4 ne s'ajoute qu'à un jet de compétence : ailleurs, seul un chiffre a du sens. */
const ACCEPTE_UN_DE = ['competence', 'competence-toutes']

type ModeOp = OperationValeur['kind']

const LIBELLE_OP: Record<ModeOp, string> = {
  add: 'Bonus ou malus chiffré',
  'add-x': 'Le X payé',
  set: 'Fixe la valeur',
  avantage: 'Avantage (+d4)',
  desavantage: 'Désavantage (−d4)',
}

function operationVierge(): Operation {
  return {
    kind: 'ajuster',
    cible: { element: { kind: 'competence', competence: 'physique' }, aspect: 'valeur' },
    op: { kind: 'add', value: 1 },
  }
}

function passifVierge(): Passif {
  return {
    id: nouvelIdentifiant(),
    libelle: '',
    declenchement: { kind: 'permanent' },
    effet: { texte: '', operations: [operationVierge()] },
  }
}

// ---------------------------------------------------------------------------

export function EditeurPassifs({
  valeur,
  onChange,
}: {
  valeur: Passif[]
  onChange: (v: Passif[]) => void
}) {
  const maj = (index: number, patch: Partial<Passif>) =>
    onChange(valeur.map((p, i) => (i === index ? { ...p, ...patch } : p)))

  return (
    <div className="champ">
      <span className="tres-discret">
        Passifs — appliqués sans que la joueuse ait à y penser
      </span>

      {valeur.length === 0 && (
        <p className="tres-discret" style={{ margin: 0 }}>
          Aucun passif.
        </p>
      )}

      {valeur.map((passif, index) => (
        <div key={passif.id} className="pile pile--serree">
          <div className="rangee">
            <input
              type="text"
              value={passif.libelle}
              style={{ flex: 1 }}
              placeholder="Nom du passif (par défaut, celui de l’entrée)"
              aria-label="Nom du passif"
              onChange={(e) => maj(index, { libelle: e.target.value })}
            />
            <button
              type="button"
              className="btn btn--fantome"
              onClick={() => onChange(valeur.filter((_, i) => i !== index))}
            >
              Retirer
            </button>
          </div>

          <EditeurDeclenchement
            valeur={passif.declenchement}
            onChange={(declenchement) => maj(index, { declenchement })}
          />

          <EditeurOperations
            valeur={passif.effet.operations ?? []}
            onChange={(operations) => maj(index, { effet: { ...passif.effet, operations } })}
          />

          <label className="champ">
            <span className="tres-discret">
              Texte lu à table — laissez vide si le chiffre se suffit
            </span>
            <input
              type="text"
              value={passif.effet.texte}
              aria-label="Texte du passif"
              onChange={(e) => maj(index, { effet: { ...passif.effet, texte: e.target.value } })}
            />
          </label>

          <span className="tres-discret">{decrirePassif(passif)}</span>
        </div>
      ))}

      <button type="button" className="btn" onClick={() => onChange([...valeur, passifVierge()])}>
        Ajouter un passif
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------

type ModeDeclenchement = 'permanent' | 'seuil' | 'reaction'

const LIBELLE_DECLENCHEMENT: Record<ModeDeclenchement, string> = {
  permanent: 'En permanence',
  seuil: 'À partir d’un seuil',
  reaction: 'En réaction à un changement',
}

function modeDe(d: Declenchement): ModeDeclenchement {
  if (d.kind === 'reaction') return 'reaction'
  return d.condition ? 'seuil' : 'permanent'
}

function declenchementVierge(mode: ModeDeclenchement): Declenchement {
  switch (mode) {
    case 'permanent':
      return { kind: 'permanent' }
    case 'seuil':
      return { kind: 'permanent', condition: { element: { kind: 'brulures' }, seuil: 4 } }
    case 'reaction':
      return {
        kind: 'reaction',
        quand: { element: { kind: 'marques' }, sens: 'augmente', chez: 'soi' },
      }
  }
}

function EditeurDeclenchement({
  valeur,
  onChange,
}: {
  valeur: Declenchement
  onChange: (v: Declenchement) => void
}) {
  const mode = modeDe(valeur)

  return (
    <>
      <label className="champ">
        <span className="tres-discret">Déclenchement</span>
        <select
          value={mode}
          onChange={(e) => onChange(declenchementVierge(e.target.value as ModeDeclenchement))}
        >
          {(Object.keys(LIBELLE_DECLENCHEMENT) as ModeDeclenchement[]).map((m) => (
            <option key={m} value={m}>
              {LIBELLE_DECLENCHEMENT[m]}
            </option>
          ))}
        </select>
      </label>

      {mode === 'seuil' && valeur.kind === 'permanent' && valeur.condition && (
        <div className="rangee">
          <select
            value={valeur.condition.element.kind}
            style={{ flex: 1 }}
            aria-label="Jauge du seuil"
            onChange={(e) =>
              onChange({
                kind: 'permanent',
                condition: {
                  element: elementDepuisCle(e.target.value as CleElement),
                  seuil: valeur.condition?.seuil ?? 1,
                },
              })
            }
          >
            {ELEMENTS_PAYABLES.map((cle) => (
              <option key={cle} value={cle}>
                {ELEMENTS_VARIABLES[cle].libelle}
              </option>
            ))}
          </select>
          <input
            type="number"
            min={0}
            value={valeur.condition.seuil}
            style={{ width: 90 }}
            aria-label="Seuil"
            onChange={(e) =>
              onChange({
                kind: 'permanent',
                condition: {
                  element: valeur.condition?.element ?? { kind: 'brulures' },
                  seuil: Math.max(0, Number(e.target.value) || 0),
                },
              })
            }
          />
        </div>
      )}

      {mode === 'reaction' && valeur.kind === 'reaction' && (
        <div className="rangee">
          <select
            value={valeur.quand.element.kind}
            style={{ flex: 1 }}
            aria-label="Jauge surveillée"
            onChange={(e) =>
              onChange({
                kind: 'reaction',
                quand: { ...valeur.quand, element: elementDepuisCle(e.target.value as CleElement) },
              })
            }
          >
            {ELEMENTS_PAYABLES.map((cle) => (
              <option key={cle} value={cle}>
                {ELEMENTS_VARIABLES[cle].libelle}
              </option>
            ))}
          </select>
          <select
            value={valeur.quand.sens}
            style={{ flex: 1 }}
            aria-label="Sens du changement"
            onChange={(e) =>
              onChange({
                kind: 'reaction',
                quand: { ...valeur.quand, sens: e.target.value as 'augmente' | 'diminue' },
              })
            }
          >
            <option value="augmente">augmente</option>
            <option value="diminue">diminue</option>
          </select>
          <select
            value={valeur.quand.chez}
            style={{ flex: 1 }}
            aria-label="Chez qui"
            onChange={(e) =>
              onChange({
                kind: 'reaction',
                quand: { ...valeur.quand, chez: e.target.value as 'soi' | 'un-allie' | 'quiconque' },
              })
            }
          >
            <option value="soi">chez vous</option>
            <option value="un-allie">chez une alliée</option>
            <option value="quiconque">chez quiconque</option>
          </select>
        </div>
      )}
    </>
  )
}

// ---------------------------------------------------------------------------

function EditeurOperations({
  valeur,
  onChange,
}: {
  valeur: Operation[]
  onChange: (v: Operation[]) => void
}) {
  const maj = (index: number, operation: Operation) =>
    onChange(valeur.map((o, i) => (i === index ? operation : o)))

  return (
    <>
      {valeur.map((operation, index) => {
        const { cible, op } = operation
        const accepteDe = ACCEPTE_UN_DE.includes(cible.element.kind)

        return (
          <div key={index} className="rangee">
            <select
              value={cleCible(cible.element.kind, cible.aspect)}
              style={{ flex: 1 }}
              aria-label="Cible du passif"
              onChange={(e) => {
                const [cle, aspect] = e.target.value.split('|') as [CleElement, Aspect]
                maj(index, {
                  kind: 'ajuster',
                  cible: {
                    element: elementDepuisCle(cle),
                    aspect,
                  },
                  // Un d4 sur l'Évasion n'a pas de sens : on retombe sur un chiffre.
                  op: ACCEPTE_UN_DE.includes(cle) ? op : { kind: 'add', value: 1 },
                })
              }}
            >
              {CIBLES.map((c) => (
                <option key={cleCible(c.cle, c.aspect)} value={cleCible(c.cle, c.aspect)}>
                  {c.libelle}
                </option>
              ))}
            </select>

            {cible.element.kind === 'competence' && (
              <select
                value={cible.element.competence}
                style={{ flex: 1 }}
                aria-label="Compétence visée"
                onChange={(e) =>
                  maj(index, {
                    kind: 'ajuster',
                    cible: {
                      element: { kind: 'competence', competence: e.target.value as Competence },
                      aspect: 'valeur',
                    },
                    op,
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

            <select
              value={op.kind}
              style={{ flex: 1 }}
              aria-label="Effet du passif"
              onChange={(e) => {
                const mode = e.target.value as ModeOp
                maj(index, {
                  kind: 'ajuster',
                  cible,
                  op:
                    mode === 'add'
                      ? { kind: 'add', value: 1 }
                      : mode === 'set'
                        ? { kind: 'set', value: 0 }
                        : { kind: mode },
                })
              }}
            >
              {(Object.keys(LIBELLE_OP) as ModeOp[])
                .filter((m) => m === 'add' || m === 'set' || accepteDe)
                .map((m) => (
                  <option key={m} value={m}>
                    {LIBELLE_OP[m]}
                  </option>
                ))}
            </select>

            {(op.kind === 'add' || op.kind === 'set') && (
              <input
                type="number"
                value={op.value}
                style={{ width: 90 }}
                aria-label="Valeur du passif"
                onChange={(e) =>
                  maj(index, {
                    kind: 'ajuster',
                    cible,
                    op: { kind: op.kind, value: Number(e.target.value) || 0 },
                  })
                }
              />
            )}

            <button
              type="button"
              className="btn btn--fantome"
              onClick={() => onChange(valeur.filter((_, i) => i !== index))}
            >
              ×
            </button>
          </div>
        )
      })}

      <button
        type="button"
        className="btn btn--fantome"
        onClick={() => onChange([...valeur, operationVierge()])}
      >
        Ajouter un ajustement
      </button>
    </>
  )
}
