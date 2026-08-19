import { useState } from 'react'

import type { Catalog } from '../domain/catalog.ts'
import { facesDuDeDeVies, vieActive } from '../domain/effets.ts'
import { cryptoRng } from '../domain/random.ts'
import type { Character, VieSoulshifter } from '../domain/types.ts'

/**
 * Contrôles des passifs de classe.
 *
 * Chaque classe obéit à une contrainte différente, et l'écran la reflète :
 *  - Dusk Hunter : bascule libre, au prix d'un tour d'action en combat ;
 *  - Soulshifter : tirage aléatoire, déclenché par la joueuse, 1×/heure ;
 *  - Trickster : engagement pris au feu de camp, donc verrouillé ici.
 */
export function Passifs({
  char,
  catalog,
  vies,
  maj,
  /** La MJ peut passer outre le verrou du feu de camp. */
  autoriserToutChanger = false,
}: {
  char: Character
  catalog: Catalog
  vies: readonly VieSoulshifter[]
  maj: (t: (c: Character) => Character) => void
  autoriserToutChanger?: boolean
}) {
  const classe = catalog.classe(char.classeId)
  if (!classe?.passifMoteur) return null

  return (
    <section className="carte pile pile--serree">
      <div className="carte__titre">
        <span className="etiquette">Passif — {classe.nom}</span>
      </div>

      {classe.passifMoteur === 'dusk-hexcore' && <Hexcore char={char} maj={maj} />}
      {classe.passifMoteur === 'soulshifter-vies' && (
        <Vies char={char} vies={vies} catalog={catalog} maj={maj} />
      )}
      {classe.passifMoteur === 'trickster-voie' && (
        <VoieTrickster char={char} maj={maj} deverrouille={autoriserToutChanger} />
      )}
    </section>
  )
}

// ---------------------------------------------------------------------------

const CONFIGS_HEXCORE = [
  {
    id: 'overdrive' as const,
    nom: 'Overdrive',
    effet: "+1 Point d'Énergie à toutes les Attaques Armées",
  },
  {
    id: 'overheat' as const,
    nom: 'Overheat',
    effet: 'Toute source de X brûlures en génère X+1',
  },
]

function Hexcore({ char, maj }: { char: Character; maj: (t: (c: Character) => Character) => void }) {
  return (
    <>
      <p className="tres-discret" style={{ margin: 0 }}>
        Changer de configuration prend 5 secondes — l'équivalent d'un tour de combat, pendant
        lequel vous ne pouvez rien faire d'autre que vous déplacer.
      </p>
      {CONFIGS_HEXCORE.map((c) => (
        <button
          key={c.id}
          type="button"
          className={`objet ${char.passifs.hexcore === c.id ? 'objet--actif' : ''}`}
          aria-pressed={char.passifs.hexcore === c.id}
          onClick={() => maj((x) => ({ ...x, passifs: { ...x.passifs, hexcore: c.id } }))}
        >
          <span className="objet__corps">
            <span className="objet__nom">{c.nom}</span>
            <span className="objet__meta">{c.effet}</span>
          </span>
          {char.passifs.hexcore === c.id && <span className="puce puce--ambre">Actif</span>}
        </button>
      ))}
    </>
  )
}

// ---------------------------------------------------------------------------

function Vies({
  char,
  vies,
  catalog,
  maj,
}: {
  char: Character
  vies: readonly VieSoulshifter[]
  catalog: Catalog
  maj: (t: (c: Character) => Character) => void
}) {
  const [dernierTirage, setDernierTirage] = useState<string | null>(null)
  const faces = facesDuDeDeVies(char)
  const connues = char.passifs.viesConnues ?? []
  const active = vieActive(char, vies)

  function tirer() {
    if (faces === 0) return
    const face = cryptoRng.int(1, faces)
    const choisie = connues[face - 1] ?? face
    setDernierTirage(`d${faces} → ${face}`)
    maj((c) => ({ ...c, passifs: { ...c.passifs, vieActive: choisie } }))
  }

  return (
    <>
      <p className="tres-discret" style={{ margin: 0 }}>
        Une fois par heure, lancez un d{faces || '?'} — une face par vie connue — pour savoir
        quelle personnalité reprend le dessus pour l'heure à venir.
      </p>

      <button type="button" className="btn btn--principal btn--large" onClick={tirer} disabled={faces === 0}>
        Invoquer une vie passée
      </button>

      {dernierTirage && <p className="alerte alerte--info">{dernierTirage}</p>}

      {active ? (
        <div className="objet objet--actif">
          <span className="objet__corps">
            <span className="objet__nom">{active.nom}</span>
            {Object.entries(active.precisions).map(([sortId, texte]) => (
              <span key={sortId} className="objet__meta">
                {catalog.sort(sortId)?.nom ?? sortId} : {texte}
              </span>
            ))}
          </span>
        </div>
      ) : (
        <p className="tres-discret" style={{ margin: 0 }}>
          Aucune personnalité incarnée pour l'instant.
        </p>
      )}
    </>
  )
}

// ---------------------------------------------------------------------------

const VOIES_TRICKSTER = [
  {
    id: 'conteur' as const,
    nom: 'Conteur',
    effet: 'Le coût en Points de Foi des sorts « Word: » est réduit de 1',
  },
  {
    id: 'illusionniste' as const,
    nom: 'Illusionniste',
    effet: 'Ya gat fooled et Mage hand utilisables à volonté, hors Grimoire',
  },
]

function VoieTrickster({
  char,
  maj,
  deverrouille,
}: {
  char: Character
  maj: (t: (c: Character) => Character) => void
  deverrouille: boolean
}) {
  return (
    <>
      <p className="tres-discret" style={{ margin: 0 }}>
        {deverrouille
          ? 'La voie se choisit normalement à la phase Grimoire du Feu de Camp.'
          : 'La voie s’engage à la phase Grimoire du Feu de Camp et vaut jusqu’au suivant.'}
      </p>
      {VOIES_TRICKSTER.map((v) => {
        const actif = char.passifs.voieTrickster === v.id
        return (
          <button
            key={v.id}
            type="button"
            className={`objet ${actif ? 'objet--actif' : ''} ${deverrouille ? '' : 'objet--indisponible'}`}
            aria-pressed={actif}
            disabled={!deverrouille}
            onClick={() => maj((c) => ({ ...c, passifs: { ...c.passifs, voieTrickster: v.id } }))}
          >
            <span className="objet__corps">
              <span className="objet__nom">{v.nom}</span>
              <span className="objet__meta">{v.effet}</span>
            </span>
            {actif && <span className="puce puce--ambre">Actif</span>}
          </button>
        )
      })}
    </>
  )
}
