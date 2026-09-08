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
import type { Rng } from '../domain/random.ts'
import { LanceurDes } from './LanceurDes.tsx'
import { optionRetenue } from '../domain/passifs.ts'
import type { ChoixClasse, Character, VieSoulshifter } from '../domain/types.ts'

/**
 * Contrôles des passifs de classe.
 *
 * Les **choix** de classe — configuration du Hexcore, voie du Trickster — sont
 * désormais des données : cet écran les rend tous de la même façon, et créer
 * une classe qui en offre un ne demande plus d'écrire un composant. Chacun
 * porte son propre verrou (`ChoixClasse.verrou`), parce que la règle diffère :
 * le Hexcore se bascule quand on veut, au prix d'un tour de combat, tandis que
 * la voie du Trickster s'engage au Feu de Camp.
 *
 * Les vies du Soulshifter restent câblées : un dé dont les faces sont les vies
 * connues, un jeton d'invocation, des précisions par sort — rien de cela ne se
 * ramène à un choix parmi des options.
 *
 * ⚠️ Les deux déverrouillages ne se confondent pas. `autoriserToutChanger` dit
 * « on est à un moment où un choix verrouillé peut changer » — vrai aussi pour
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
  const choix = classe?.choix ?? []
  if (!classe || (choix.length === 0 && classe.passifMoteur !== 'soulshifter-vies')) return null

  return (
    <section className="carte pile pile--serree">
      <div className="carte__titre">
        <span className="etiquette">Passif — {classe.nom}</span>
      </div>

      {choix.map((c) => (
        <ChoixDeClasse
          key={c.id}
          choix={c}
          char={char}
          maj={maj}
          deverrouille={c.verrou === 'libre' || autoriserToutChanger}
        />
      ))}

      {classe.passifMoteur === 'soulshifter-vies' && (
        <Vies char={char} vies={vies} catalog={catalog} maj={maj} peutAccorder={peutAccorder} />
      )}
    </section>
  )
}

// ---------------------------------------------------------------------------

const EXPLICATION_VERROU: Record<ChoixClasse['verrou'], string> = {
  libre:
    "Changer prend 5 secondes — l'équivalent d'un tour de combat, pendant lequel vous ne pouvez rien faire d'autre que vous déplacer.",
  'feu-de-camp': 'Ce choix s’engage à la phase Sorts du Feu de Camp et vaut jusqu’au suivant.',
}

function ChoixDeClasse({
  choix,
  char,
  maj,
  deverrouille,
}: {
  choix: ChoixClasse
  char: Character
  maj: (t: (c: Character) => Character) => void
  deverrouille: boolean
}) {
  const retenue = optionRetenue(char, choix)

  return (
    <>
      <p className="tres-discret" style={{ margin: 0 }}>
        {EXPLICATION_VERROU[choix.verrou]}
      </p>
      {choix.options.map((o) => {
        const actif = retenue?.id === o.id
        return (
          <button
            key={o.id}
            type="button"
            className={`objet ${actif ? 'objet--actif' : ''} ${deverrouille ? '' : 'objet--indisponible'}`}
            aria-pressed={actif}
            disabled={!deverrouille}
            onClick={() =>
              maj((c) => ({
                ...c,
                passifs: { ...c.passifs, choix: { ...(c.passifs.choix ?? {}), [choix.id]: o.id } },
              }))
            }
          >
            <span className="objet__corps">
              <span className="objet__nom">{o.nom}</span>
              <span className="objet__meta">{o.effet}</span>
            </span>
            {actif && <span className="puce puce--ambre">Actif</span>}
          </button>
        )
      })}
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

  async function tirer(rng: Rng) {
    // Les gardes de l'écran protègent l'écran, pas la règle : on revérifie.
    if (faces === 0 || !disponible || enCours) return

    const remplacee = active ? `${active.nom} laissera la place.` : 'Aucune personnalité incarnée.'
    if (!confirm(`Invoquer une vie passée ? ${remplacee} Le tirage est irréversible.`)) return

    // `enCours` complète le jeton persisté : `maj` transforme la fiche telle
    // qu'elle est arrivée en prop, donc tant que Firestore n'a pas fait l'écho,
    // un second appui repartirait d'un `vieTireeA` périmé.
    setEnCours(true)
    try {
      const face = rng.int(1, faces)
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

      {/* Ce tirage passait par `cryptoRng` sans consulter le réglage, puis
          affichait « d8 → 5 » comme si la joueuse l'avait lancé : le seul jet de
          l'application qui contredisait « Je lance mes propres dés ». */}
      <LanceurDes
        des={[{ nombre: 1, faces }]}
        libelle={disponible ? 'Invoquer une vie passée' : 'Invocation déjà utilisée'}
        disabled={faces === 0 || !disponible || enCours}
        onJet={(rng) => void tirer(rng)}
      />

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
