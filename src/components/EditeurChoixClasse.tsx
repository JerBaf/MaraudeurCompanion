import { EditeurPassifs } from './EditeurPassifs.tsx'
import type { ChoixClasse, OptionChoixClasse, Passif } from '../domain/types.ts'

/**
 * Saisie des choix d'une classe.
 *
 * Un choix, ce sont des options **mutuellement exclusives** dont la joueuse
 * retient une : la configuration du Hexcore d'un Dusk Hunter, la voie d'un
 * Trickster. Chaque option porte ses propres passifs, ce qui referme le dernier
 * trou du modèle — une classe entière se compose désormais sans toucher au code.
 *
 * Trois niveaux imbriqués, et c'est irréductible :
 *
 * ```
 * ChoixClasse[]           libellé · verrou
 *   └ OptionChoixClasse[] nom · effet
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
  onChange,
}: {
  valeur: ChoixClasse[]
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

          <EditeurOptions
            valeur={choix.options}
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
  onChange,
}: {
  valeur: OptionChoixClasse[]
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
