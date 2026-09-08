import { COUT_GRATUIT } from '../domain/couts.ts'
import { nouvelIdentifiant } from '../domain/random.ts'
import { FACES_TABLE, type Actif, type Recharge, type Usages } from '../domain/types.ts'
import { EditeurCout } from './EditeurCout.tsx'

/**
 * Saisie des Actifs d'une entrée de catalogue.
 *
 * Un Actif, c'est ce qu'on déclenche volontairement : l'Attaque Spéciale d'une
 * arme, une potion, le lancement d'un sort. Le PDF décrit ces pouvoirs pour les
 * armes, mais le même modèle vaut partout — une table d'une seule face rend
 * simplement l'effet déterministe.
 *
 * Deux différences avec la version précédente, et ce sont des règles :
 *
 *  - une entrée peut porter **plusieurs** Actifs, chacun avec son coût et son
 *    compteur — une lanterne qui éclaire et qui brûle ;
 *  - le coût et les utilisations sont **indépendants**. L'ancien modèle les
 *    confondait dans un seul champ « contrepartie », ce qui interdisait un
 *    objet à la fois limité en charges et payant à l'usage.
 */

type ModeRecharge = Recharge['kind']

const LIBELLE_RECHARGE: Record<ModeRecharge, string> = {
  rituel: 'Rituel validé par la MJ',
  cout: 'En payant un coût',
  aucune: 'Aucune — retrait à la main',
}

function actifVierge(nomPorteur: string): Actif {
  return {
    id: nouvelIdentifiant(),
    nom: nomPorteur || 'Effet actif',
    table: { faces: 1, entrees: [{ texte: '' }] },
    usages: { max: 3, recharge: { kind: 'rituel', description: '' } },
  }
}

function rechargeVierge(mode: ModeRecharge): Recharge {
  switch (mode) {
    case 'rituel':
      return { kind: 'rituel', description: '' }
    case 'cout':
      return { kind: 'cout', cout: COUT_GRATUIT }
    case 'aucune':
      return { kind: 'aucune' }
  }
}

export function EditeurActifs({
  valeur,
  nomPorteur,
  onChange,
}: {
  valeur: Actif[]
  /** Nom de l'entrée : sert de nom par défaut au premier Actif. */
  nomPorteur: string
  onChange: (v: Actif[]) => void
}) {
  const maj = (index: number, patch: Partial<Actif>) =>
    onChange(valeur.map((a, i) => (i === index ? { ...a, ...patch } : a)))

  return (
    <div className="champ">
      <span className="tres-discret">
        Effets actifs — ce que la joueuse déclenche elle-même
      </span>

      {valeur.length === 0 && (
        <p className="tres-discret" style={{ margin: 0 }}>
          Aucun effet actif.
        </p>
      )}

      {valeur.map((actif, index) => (
        <div key={actif.id} className="pile pile--serree">
          <div className="rangee">
            <input
              type="text"
              value={actif.nom}
              style={{ flex: 1 }}
              placeholder="Attaque spéciale"
              aria-label="Nom de l’effet actif"
              onChange={(e) => maj(index, { nom: e.target.value })}
            />
            <button
              type="button"
              className="btn btn--fantome"
              onClick={() => onChange(valeur.filter((_, i) => i !== index))}
            >
              Retirer
            </button>
          </div>

          <label className="champ">
            <span className="tres-discret">Faces</span>
            <select
              value={actif.table.faces}
              onChange={(e) => {
                const faces = Number(e.target.value)
                // On conserve les effets déjà saisis : réduire la table puis la
                // rouvrir ne doit pas effacer le travail de la MJ.
                maj(index, {
                  table: {
                    faces,
                    entrees: Array.from(
                      { length: faces },
                      (_, i) => actif.table.entrees[i] ?? { texte: '' },
                    ),
                  },
                })
              }}
            >
              {FACES_TABLE.map((f) => (
                <option key={f} value={f}>
                  {f === 1 ? 'Effet unique' : `1d${f}`}
                </option>
              ))}
            </select>
          </label>

          {actif.table.entrees.map((entree, iEffet) => (
            <label key={iEffet} className="champ">
              <span className="tres-discret">
                {actif.table.faces === 1 ? 'Effet' : `Résultat ${iEffet + 1}`}
              </span>
              <input
                type="text"
                value={entree.texte}
                onChange={(e) =>
                  maj(index, {
                    table: {
                      ...actif.table,
                      entrees: actif.table.entrees.map((v, i) =>
                        i === iEffet ? { texte: e.target.value } : v,
                      ),
                    },
                  })
                }
              />
            </label>
          ))}

          <EditeurCout
            valeur={actif.cout ?? COUT_GRATUIT}
            label="Coût de l’activation"
            onChange={(cout) => maj(index, { cout })}
          />

          <EditeurUsages
            valeur={actif.usages}
            onChange={(usages) => maj(index, { usages })}
          />
        </div>
      ))}

      <button
        type="button"
        className="btn"
        onClick={() => onChange([...valeur, actifVierge(nomPorteur)])}
      >
        Ajouter un effet actif
      </button>
    </div>
  )
}

/**
 * Les utilisations d'un Actif, et ce qui les rend.
 *
 * Absentes, l'Actif est illimité — seul son coût le borne. C'est le cas de la
 * plupart des sorts, et l'ancien modèle ne savait pas l'exprimer.
 */
function EditeurUsages({
  valeur,
  onChange,
}: {
  valeur: Usages | undefined
  onChange: (v: Usages | undefined) => void
}) {
  if (!valeur) {
    return (
      <button
        type="button"
        className="btn btn--fantome"
        onClick={() => onChange({ max: 3, recharge: { kind: 'rituel', description: '' } })}
      >
        Limiter le nombre d’utilisations
      </button>
    )
  }

  return (
    <>
      <div className="rangee">
        <label className="champ" style={{ flex: 1 }}>
          <span className="tres-discret">Charges</span>
          <input
            type="number"
            min={1}
            value={valeur.max}
            onChange={(e) => onChange({ ...valeur, max: Math.max(1, Number(e.target.value) || 1) })}
          />
        </label>

        <label className="champ" style={{ flex: 1 }}>
          <span className="tres-discret">Recharge</span>
          <select
            value={valeur.recharge.kind}
            onChange={(e) =>
              onChange({ ...valeur, recharge: rechargeVierge(e.target.value as ModeRecharge) })
            }
          >
            {(Object.keys(LIBELLE_RECHARGE) as ModeRecharge[]).map((k) => (
              <option key={k} value={k}>
                {LIBELLE_RECHARGE[k]}
              </option>
            ))}
          </select>
        </label>
      </div>

      {valeur.recharge.kind === 'rituel' && (
        <label className="champ">
          <span className="tres-discret">Rituel de recharge</span>
          <input
            type="text"
            value={valeur.recharge.description}
            placeholder="La tremper dans le sang d’une Carcasse"
            onChange={(e) =>
              onChange({ ...valeur, recharge: { kind: 'rituel', description: e.target.value } })
            }
          />
        </label>
      )}

      {valeur.recharge.kind === 'cout' && (
        <EditeurCout
          valeur={valeur.recharge.cout}
          label="Coût de la recharge"
          onChange={(cout) => onChange({ ...valeur, recharge: { kind: 'cout', cout } })}
        />
      )}

      <button type="button" className="btn btn--fantome" onClick={() => onChange(undefined)}>
        Utilisations illimitées
      </button>
    </>
  )
}
