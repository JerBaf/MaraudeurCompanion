import { useState } from 'react'

import { ObjetDetaillable } from './ObjetDetaillable.tsx'
import type { Catalog } from '../domain/catalog.ts'
import {
  detailVie,
  facesDuDeDeVies,
  peutTirerUneVie,
  rendreInvocationDeVie,
  vieActive,
} from '../domain/effets.ts'
import { cryptoRng } from '../domain/random.ts'
import type { Character, VieSoulshifter } from '../domain/types.ts'

/**
 * Contrôles des passifs de classe.
 *
 * Chaque classe obéit à une contrainte différente, et l'écran la reflète :
 *  - Dusk Hunter : bascule libre, au prix d'un tour d'action en combat ;
 *  - Soulshifter : tirage aléatoire, déclenché par la joueuse, 1×/heure de jeu ;
 *  - Trickster : engagement pris au feu de camp, donc verrouillé ici.
 *
 * ⚠️ Les deux déverrouillages ne se confondent pas. `autoriserToutChanger` dit
 * « on est à un moment où la voie du Trickster peut changer » — vrai aussi pour
 * la joueuse pendant la phase Sorts du camp. `peutAccorder` dit « on est sur
 * l'écran de la MJ » : rendre son invocation à un Soulshifter est un arbitrage,
 * jamais un droit de la joueuse.
 */
export function Passifs({
  char,
  catalog,
  vies,
  maj,
  /** La MJ peut passer outre le verrou du feu de camp. */
  autoriserToutChanger = false,
  /** Écran MJ : elle seule rend son invocation à un Soulshifter. */
  peutAccorder = false,
}: {
  char: Character
  catalog: Catalog
  vies: readonly VieSoulshifter[]
  maj: (t: (c: Character) => Character) => void
  autoriserToutChanger?: boolean
  peutAccorder?: boolean
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
        <Vies char={char} vies={vies} catalog={catalog} maj={maj} peutAccorder={peutAccorder} />
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
  peutAccorder,
}: {
  char: Character
  vies: readonly VieSoulshifter[]
  catalog: Catalog
  maj: (t: (c: Character) => Character) => void
  /** Écran MJ : affiche le bouton qui rend l'invocation. */
  peutAccorder: boolean
}) {
  const [dernierTirage, setDernierTirage] = useState<string | null>(null)
  const [enCours, setEnCours] = useState(false)

  const faces = facesDuDeDeVies(char)
  const connues = char.passifs.viesConnues ?? []
  const active = vieActive(char, vies)
  const disponible = peutTirerUneVie(char)

  async function tirer() {
    // Les gardes de l'écran protègent l'écran, pas la règle : on revérifie.
    if (faces === 0 || !disponible || enCours) return

    const remplacee = active ? `${active.nom} laissera la place.` : 'Aucune personnalité incarnée.'
    if (!confirm(`Invoquer une vie passée ? ${remplacee} Le tirage est irréversible.`)) return

    // `enCours` complète le jeton persisté : `maj` transforme la fiche telle
    // qu'elle est arrivée en prop, donc tant que Firestore n'a pas fait l'écho,
    // un second appui repartirait d'un `vieTireeA` périmé.
    setEnCours(true)
    try {
      const face = cryptoRng.int(1, faces)
      const choisie = connues[face - 1] ?? face
      setDernierTirage(`d${faces} → ${face}`)
      // Vie et jeton dans la même transformation : la personnalité ne peut pas
      // changer sans que l'invocation ne soit consommée.
      maj((c) => ({
        ...c,
        passifs: { ...c.passifs, vieActive: choisie, vieTireeA: Date.now() },
      }))
    } finally {
      setEnCours(false)
    }
  }

  return (
    <>
      <p className="tres-discret" style={{ margin: 0 }}>
        Une fois par heure de jeu, lancez un d{faces || '?'} — une face par vie connue — pour
        savoir quelle personnalité reprend le dessus. C'est la MJ qui vous rend l'invocation :
        l'heure est celle de la fiction, pas celle de la table.
      </p>

      <button
        type="button"
        className="btn btn--principal btn--large"
        onClick={() => void tirer()}
        disabled={faces === 0 || !disponible || enCours}
      >
        {disponible ? 'Invoquer une vie passée' : 'Invocation déjà utilisée'}
      </button>

      {peutAccorder && (
        <button
          type="button"
          className="btn"
          disabled={disponible}
          onClick={() => maj(rendreInvocationDeVie)}
        >
          {disponible
            ? 'Invocation déjà disponible'
            : `Rendre l'invocation${char.passifs.vieTireeA ? ` — tirée à ${heure(char.passifs.vieTireeA)}` : ''}`}
        </button>
      )}

      {dernierTirage && <p className="alerte alerte--info">{dernierTirage}</p>}

      {/* Toutes les vies connues, et pas seulement celle incarnée : on ne décide
          pas de lancer un dé sans savoir ce qu'il peut donner. */}
      {connues.length === 0 ? (
        <p className="tres-discret" style={{ margin: 0 }}>
          Aucune vie passée connue pour l'instant.
        </p>
      ) : (
        connues.map((face) => {
          const vie = vies.find((v) => v.face === face)
          const incarnee = char.passifs.vieActive === face
          return (
            <ObjetDetaillable
              key={face}
              icone="transform"
              nom={vie?.nom ?? `Vie n°${face}`}
              meta={`Face ${face}`}
              detail={vie ? detailVie(vie, catalog) : 'Personnalité inconnue du catalogue.'}
              actif={incarnee}
              {...(incarnee ? { puce: <span className="puce puce--ambre">Incarnée</span> } : {})}
            />
          )
        })
      )}
    </>
  )
}

/** L'heure de table du dernier tirage, pour que la MJ situe la dernière invocation. */
function heure(instant: number): string {
  return new Date(instant).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
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
    effet: 'Ya gat fooled et Mage hand utilisables à volonté, hors emplacements',
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
          ? 'La voie se choisit normalement à la phase Sorts du Feu de Camp.'
          : 'La voie s’engage à la phase Sorts du Feu de Camp et vaut jusqu’au suivant.'}
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
