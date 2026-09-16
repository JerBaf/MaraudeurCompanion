import { EditeurPassifs } from './EditeurPassifs.tsx'
import { aUnPlafond } from '../domain/competences.ts'
import { elementDepuisCle, ELEMENTS_VARIABLES, type CleElement } from '../domain/elements.ts'
import type {
  Amelioration,
  ChoixClasse,
  ConditionBascule,
  OptionChoixClasse,
  Passif,
  VerrouChoix,
} from '../domain/types.ts'

/**
 * Saisie des choix d'une classe.
 *
 * Un choix, ce sont des options **mutuellement exclusives** dont la joueuse
 * retient une : la configuration du Hexcore d'un Dusk Hunter, la voie d'un
 * Trickster, la Bonne Étoile d'un Astromancien — ou l'état d'une Eclipsed, qui
 * bascule tout seul. Chaque option porte ses propres passifs, ce qui referme le
 * dernier trou du modèle — une classe entière se compose sans toucher au code.
 *
 * Trois niveaux imbriqués, et c'est irréductible :
 *
 * ```
 * ChoixClasse[]           libellé · verrou · option de départ
 *   └ OptionChoixClasse[] nom · effet · Amélioration requise · bascule
 *       └ Passif[]        ← EditeurPassifs, réutilisé tel quel
 * ```
 */

/**
 * ⚠️ **Le verrou porte une règle, pas une commodité d'écran.** L'Hexcore se
 * bascule quand on veut, au prix d'un tour de combat ; la voie du Trickster
 * s'engage au Feu de Camp et vaut jusqu'au suivant. Composer un choix sans y
 * penser déverrouillerait silencieusement ce que la règle voulait tenir.
 *
 * Ces phrases sont celles que la joueuse lira sur sa fiche — voir
 * `EXPLICATION_VERROU` dans `Passifs.tsx`.
 */
const LIBELLE_VERROU: Record<ChoixClasse['verrou'], string> = {
  libre: 'Librement — au prix d’un tour de combat',
  'feu-de-camp': 'Au Feu de Camp seulement, jusqu’au suivant',
  jeton: 'Contre un jeton que la MJ rend — le premier choix est libre',
  automatique: 'Tout seul, selon une jauge — jamais par la joueuse',
}

function nouvelId(prefixe: string): string {
  return `${prefixe}-${globalThis.crypto?.randomUUID?.().slice(0, 8) ?? Date.now()}`
}

function choixVierge(): ChoixClasse {
  return {
    id: nouvelId('choix'),
    libelle: '',
    verrou: 'libre',
    options: [optionVierge()],
  }
}

function optionVierge(): OptionChoixClasse {
  return { id: nouvelId('option'), nom: '', effet: '' }
}

export function EditeurChoixClasse({
  valeur,
  ameliorations,
  onChange,
}: {
  valeur: ChoixClasse[]
  /** Celles qui peuvent débloquer une option — une étoile achetée en boutique. */
  ameliorations: Amelioration[]
  onChange: (v: ChoixClasse[]) => void
}) {
  const maj = (index: number, patch: Partial<ChoixClasse>) =>
    onChange(valeur.map((c, i) => (i === index ? { ...c, ...patch } : c)))

  return (
    <div className="champ">
      <span className="tres-discret">
        Choix de classe — des options exclusives dont la joueuse retient une
      </span>

      {valeur.length === 0 && (
        <p className="tres-discret" style={{ margin: 0 }}>
          Aucun choix. La classe accordera ses passifs à tout le monde pareil.
        </p>
      )}

      {valeur.map((choix, index) => (
        <div key={choix.id} className="pile pile--serree">
          <div className="rangee">
            <input
              type="text"
              value={choix.libelle}
              style={{ flex: 1 }}
              placeholder="Configuration du Hexcore"
              aria-label="Libellé du choix"
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

          <label className="champ">
            <span className="tres-discret">Quand ce choix peut changer</span>
            <select
              value={choix.verrou}
              aria-label="Verrou du choix"
              onChange={(e) => maj(index, { verrou: e.target.value as ChoixClasse['verrou'] })}
            >
              {(Object.keys(LIBELLE_VERROU) as ChoixClasse['verrou'][]).map((v) => (
                <option key={v} value={v}>
                  {LIBELLE_VERROU[v]}
                </option>
              ))}
            </select>
          </label>

          {/* Lue, jamais écrite : une fiche créée avant ce réglage en profite aussi. */}
          <label className="champ">
            <span className="tres-discret">Option de départ</span>
            <select
              value={choix.defaut ?? ''}
              aria-label="Option de départ"
              onChange={(e) => maj(index, { defaut: e.target.value || undefined })}
            >
              <option value="">Aucune — rien n’est retenu avant le premier choix</option>
              {choix.options.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.nom || 'Option sans nom'}
                </option>
              ))}
            </select>
          </label>

          <EditeurOptions
            valeur={choix.options}
            verrou={choix.verrou}
            ameliorations={ameliorations}
            onChange={(options) => maj(index, { options })}
          />
        </div>
      ))}

      <button type="button" className="btn" onClick={() => onChange([...valeur, choixVierge()])}>
        Ajouter un choix
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------

function EditeurOptions({
  valeur,
  verrou,
  ameliorations,
  onChange,
}: {
  valeur: OptionChoixClasse[]
  verrou: VerrouChoix
  ameliorations: Amelioration[]
  onChange: (v: OptionChoixClasse[]) => void
}) {
  const maj = (index: number, patch: Partial<OptionChoixClasse>) =>
    onChange(valeur.map((o, i) => (i === index ? { ...o, ...patch } : o)))

  return (
    <>
      {valeur.map((option, index) => (
        <div key={option.id} className="pile pile--serree" style={{ paddingLeft: 12 }}>
          <div className="rangee">
            <input
              type="text"
              value={option.nom}
              style={{ flex: 1 }}
              placeholder="Overdrive"
              aria-label="Nom de l’option"
              onChange={(e) => maj(index, { nom: e.target.value })}
            />
            <button
              type="button"
              className="btn btn--fantome"
              // Un choix sans option n'aurait rien à choisir : la dernière ne
              // se retire pas, on retire le choix entier.
              disabled={valeur.length <= 1}
              onClick={() => onChange(valeur.filter((_, i) => i !== index))}
            >
              ×
            </button>
          </div>

          <label className="champ">
            <span className="tres-discret">Ce que l’option fait, en toutes lettres</span>
            <input
              type="text"
              value={option.effet}
              placeholder="+1 Point d’Énergie à toutes les Attaques Armées"
              aria-label="Effet de l’option"
              onChange={(e) => maj(index, { effet: e.target.value })}
            />
          </label>

          {/* Une option verrouillée se voit, mais n'agit pas tant qu'il manque l'Amélioration. */}
          <label className="champ">
            <span className="tres-discret">Débloquée par une Amélioration</span>
            <select
              value={option.requiertAmelioration ?? ''}
              aria-label="Amélioration requise"
              onChange={(e) => maj(index, { requiertAmelioration: e.target.value || undefined })}
            >
              <option value="">Aucune — ouverte d’emblée</option>
              {ameliorations.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nom}
                </option>
              ))}
            </select>
          </label>

          {verrou === 'automatique' && (
            <EditeurBascule
              valeur={option.bascule}
              onChange={(bascule) => maj(index, { bascule })}
            />
          )}

          {/*
            Les passifs de l'option sont facultatifs : une option peut n'être
            que narrative — c'est le cas d'Overheat, qui transforme un gain de
            brûlures et ne se ramène donc à aucun ajustement.
          */}
          <EditeurPassifs
            valeur={option.passifs ?? []}
            onChange={(passifs: Passif[]) => maj(index, { passifs })}
          />
        </div>
      ))}

      <button
        type="button"
        className="btn btn--fantome"
        onClick={() => onChange([...valeur, optionVierge()])}
      >
        Ajouter une option
      </button>
    </>
  )
}

// ---------------------------------------------------------------------------

/** Une bascule ne lit qu'une jauge : un compteur stocké sur la fiche. */
const JAUGES = (Object.keys(ELEMENTS_VARIABLES) as CleElement[]).filter(
  (cle) => ELEMENTS_VARIABLES[cle].lire !== undefined,
)

/**
 * Quand une option d'un choix automatique s'impose : « Ombre quand les Marques
 * atteignent leur maximum », « Lumière quand elles retombent à 0 ».
 */
function EditeurBascule({
  valeur,
  onChange,
}: {
  valeur: ConditionBascule | undefined
  onChange: (v: ConditionBascule | undefined) => void
}) {
  if (!valeur) {
    return (
      <button
        type="button"
        className="btn btn--fantome"
        onClick={() =>
          onChange({ element: { kind: 'marques' }, comparaison: 'au-moins', seuil: 'plafond' })
        }
      >
        Faire basculer sur cette option
      </button>
    )
  }

  return (
    <div className="rangee">
      <span className="tres-discret">S’impose quand</span>
      <select
        value={valeur.element.kind}
        aria-label="Jauge de la bascule"
        onChange={(e) => {
          const element = elementDepuisCle(e.target.value as CleElement)
          // Une jauge sans plafond ne peut pas basculer « au maximum ».
          const seuil = valeur.seuil === 'plafond' && !aUnPlafond(element) ? 0 : valeur.seuil
          onChange({ ...valeur, element, seuil })
        }}
      >
        {JAUGES.map((cle) => (
          <option key={cle} value={cle}>
            {ELEMENTS_VARIABLES[cle].libelleValeur ?? ELEMENTS_VARIABLES[cle].libelle}
          </option>
        ))}
      </select>
      <select
        value={valeur.comparaison}
        aria-label="Sens de la bascule"
        onChange={(e) =>
          onChange({ ...valeur, comparaison: e.target.value as ConditionBascule['comparaison'] })
        }
      >
        <option value="au-moins">atteint au moins</option>
        <option value="au-plus">retombe au plus à</option>
      </select>
      <select
        value={valeur.seuil === 'plafond' ? 'plafond' : 'nombre'}
        aria-label="Seuil de la bascule"
        onChange={(e) =>
          onChange({ ...valeur, seuil: e.target.value === 'plafond' ? 'plafond' : 0 })
        }
      >
        <option value="nombre">une valeur</option>
        {aUnPlafond(valeur.element) && <option value="plafond">son maximum</option>}
      </select>
      {valeur.seuil !== 'plafond' && (
        <input
          type="number"
          min={0}
          value={valeur.seuil}
          style={{ width: 80 }}
          aria-label="Valeur de la bascule"
          onChange={(e) =>
            onChange({ ...valeur, seuil: Math.max(0, Number(e.target.value) || 0) })
          }
        />
      )}
      <button type="button" className="btn btn--fantome" onClick={() => onChange(undefined)}>
        ×
      </button>
    </div>
  )
}
