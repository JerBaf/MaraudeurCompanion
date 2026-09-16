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
import {
  decrireBascule,
  jetonDisponible,
  optionAccessible,
  optionRetenue,
  peutChangerOption,
  rendreJetonChoix,
  retenirOption,
  type MomentChoix,
} from '../domain/passifs.ts'
import type {
  ChoixClasse,
  Character,
  OptionChoixClasse,
  VieSoulshifter,
} from '../domain/types.ts'

/**
 * Contrôles des passifs de classe.
 *
 * Les **choix** de classe — configuration du Hexcore, voie du Trickster, Bonne
 * Étoile, état de l'Eclipsed — sont des données : cet écran les rend tous de la
 * même façon, et créer une classe qui en offre un ne demande pas d'écrire un
 * composant. Chacun porte son propre verrou (`ChoixClasse.verrou`), parce que
 * la règle diffère d'une classe à l'autre.
 *
 * Les vies du Soulshifter restent câblées : un dé dont les faces sont les vies
 * connues, un jeton d'invocation, des précisions par sort — rien de cela ne se
 * ramène à un choix parmi des options.
 *
 * ⚠️ `moment` dit où l'on se trouve, et c'est tout ce qui ouvre un verrou. La
 * phase Sorts du camp ouvre la voie du Trickster, pas l'état d'une Eclipsed ;
 * seul l'écran de la MJ passe outre tout, et rend jetons et invocations — un
 * arbitrage, jamais un droit de la joueuse.
 */
export function Passifs({
  char,
  catalog,
  vies,
  maj,
  moment = 'fiche',
}: {
  char: Character
  catalog: Catalog
  vies: readonly VieSoulshifter[]
  maj: (t: (c: Character) => Character) => void
  /** Où l'on se trouve : la fiche, la phase Sorts du camp, ou l'écran de la MJ. */
  moment?: MomentChoix
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
          catalog={catalog}
          maj={maj}
          moment={moment}
        />
      ))}

      {classe.passifMoteur === 'soulshifter-vies' && (
        <Vies
          char={char}
          vies={vies}
          catalog={catalog}
          maj={maj}
          peutAccorder={moment === 'mj'}
        />
      )}
    </section>
  )
}

// ---------------------------------------------------------------------------

const EXPLICATION_VERROU: Record<ChoixClasse['verrou'], string> = {
  libre:
    "Changer prend 5 secondes — l'équivalent d'un tour de combat, pendant lequel vous ne pouvez rien faire d'autre que vous déplacer.",
  'feu-de-camp': 'Ce choix s’engage à la phase Sorts du Feu de Camp et vaut jusqu’au suivant.',
  jeton:
    'Le premier choix est libre. Ensuite, changer consomme votre jeton, que la MJ rend quand l’heure de jeu est passée.',
  automatique: 'Ce choix bascule tout seul, selon votre état.',
}

function ChoixDeClasse({
  choix,
  char,
  catalog,
  maj,
  moment,
}: {
  choix: ChoixClasse
  char: Character
  catalog: Catalog
  maj: (t: (c: Character) => Character) => void
  moment: MomentChoix
}) {
  const retenue = optionRetenue(char, choix)
  const modifiable = peutChangerOption(char, choix, moment)
  const aJeton = choix.verrou === 'jeton'
  const jetonUtiliseA = char.passifs.jetonsChoix?.[choix.id]

  const bascules = choix.options.flatMap((o) =>
    o.bascule ? [`${o.nom} : ${decrireBascule(o.bascule)}`] : [],
  )

  function retenir(option: OptionChoixClasse) {
    const stockee = char.passifs.choix?.[choix.id]
    const consomme = aJeton && moment !== 'mj' && stockee !== undefined && stockee !== option.id
    // Un jeton consommé ne revient que par la MJ : on prévient avant.
    if (consomme && !confirm(`Passer à ${option.nom} ? Votre jeton sera utilisé jusqu’à ce que la MJ le rende.`)) {
      return
    }
    maj((c) => retenirOption(c, choix, option.id, moment, Date.now()))
  }

  return (
    <>
      <p className="tres-discret" style={{ margin: 0 }}>
        {choix.libelle && <strong>{choix.libelle} — </strong>}
        {EXPLICATION_VERROU[choix.verrou]}
        {aJeton && (jetonDisponible(char, choix) ? ' Jeton disponible.' : ' Jeton utilisé.')}
      </p>
      {bascules.length > 0 && (
        <p className="tres-discret" style={{ margin: 0 }}>
          {bascules.join(' · ')}
        </p>
      )}
      {choix.options.map((o) => {
        const actif = retenue?.id === o.id
        const accessible = optionAccessible(char, o)
        const deverrouille = modifiable && accessible
        const requise = o.requiertAmelioration
          ? (catalog.amelioration(o.requiertAmelioration)?.nom ?? o.requiertAmelioration)
          : null
        return (
          <button
            key={o.id}
            type="button"
            className={`objet ${actif ? 'objet--actif' : ''} ${deverrouille ? '' : 'objet--indisponible'}`}
            aria-pressed={actif}
            disabled={!deverrouille}
            onClick={() => retenir(o)}
          >
            <span className="objet__corps">
              <span className="objet__nom">{o.nom}</span>
              <span className="objet__meta">
                {accessible ? o.effet : `Débloquée par ${requise}`}
              </span>
            </span>
            {actif && <span className="puce puce--ambre">Actif</span>}
          </button>
        )
      })}
      {moment === 'mj' && aJeton && (
        <button
          type="button"
          className="btn"
          disabled={jetonUtiliseA == null}
          onClick={() => maj((c) => rendreJetonChoix(c, choix.id))}
        >
          {jetonUtiliseA == null
            ? 'Jeton déjà disponible'
            : `Rendre le jeton — utilisé à ${heure(jetonUtiliseA)}`}
        </button>
      )}
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
