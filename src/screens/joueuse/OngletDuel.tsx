import { useEffect, useRef, useState } from 'react'

import { Icone } from '../../components/Icone.tsx'
import { Pentagone } from '../../components/Pentagone.tsx'
import { Rappel } from './RappelsCombat.tsx'
import { FICTION_ACTIONS, RAPPELS_DUEL } from '../../content/duel.ts'
import { choisirActionDuel, surDuel } from '../../data/repo.ts'
import { etatDuel, flowDe, MANCHES_MAX, OBJECTIF_POINTS } from '../../domain/duel.ts'
import {
  LIBELLE_ACTION_DUEL,
  type ActionDuel,
  type Character,
  type Duel,
  type EtatTable,
  type MancheJouee,
} from '../../domain/types.ts'

/**
 * Le combat rapide, côté joueuse.
 *
 * L'écran se déverrouille au rythme de la MJ, comme celui du combat : tant
 * qu'une manche n'est pas ouverte, aucune action n'est cliquable ; une fois le
 * choix verrouillé, il ne peut plus être repris.
 *
 * ⚠️ **La sélection tentative ne quitte jamais l'appareil.** Elle vit en
 * `useState` ; seul le choix verrouillé est écrit dans le document, que la MJ
 * lit. L'envoyer plus tôt lui livrerait les hésitations de la joueuse — c'est le
 * même raisonnement qui garde les cycles hors de l'appareil.
 *
 * C'est aussi ce téléphone qui verrouille à l'expiration du chrono : l'écran MJ
 * n'intervient qu'en filet, si l'appareil s'est endormi.
 */
export function OngletDuel({
  char,
  etat,
  personnages,
}: {
  char: Character
  etat: EtatTable
  personnages: Character[]
}) {
  const [duel, setDuel] = useState<Duel | null>(null)

  useEffect(
    () => (etat.duelId ? surDuel(etat.duelId, setDuel) : (setDuel(null) as void)),
    [etat.duelId],
  )

  if (!duel) {
    return <p className="vide">La MJ prépare le combat rapide.</p>
  }

  if (duel.characterId !== char.id) {
    const duelliste = personnages.find((p) => p.id === duel.characterId) ?? null
    return <Spectatrice duel={duel} duelliste={duelliste} />
  }

  return <Duelliste duel={duel} />
}

// ---------------------------------------------------------------------------

function Duelliste({ duel }: { duel: Duel }) {
  const [selection, setSelection] = useState<ActionDuel | null>(null)
  const etat = etatDuel(duel.historique)

  // Une nouvelle manche repart d'une ardoise vierge.
  useEffect(() => setSelection(null), [duel.historique.length])

  const ouverte = duel.debutManche !== null && duel.choixJoueuse === null && duel.issue === null

  async function verrouiller(action: ActionDuel) {
    setSelection(action)
    await choisirActionDuel(duel, action)
  }

  // Un premier appui prépare — et montre ce que l'action bat —, un second
  // engage. Un choix irréversible ne doit pas tenir à un doigt qui glisse.
  function toucher(action: ActionDuel) {
    if (selection === action) void verrouiller(action)
    else setSelection(action)
  }

  return (
    <div className="pile">
      <EnTete duel={duel} nomJoueuse="Vous" />

      {duel.issue ? (
        <Issue duel={duel} nomJoueuse="Vous" />
      ) : (
        <section className="carte pile">
          <Pentagone
            selection={selection}
            flowJoueuse={flowDe(etat.precedenteJoueuse)}
            flowAdversaire={flowDe(etat.precedenteAdversaire)}
            revele={derniereRevelation(duel)}
            {...(ouverte ? { onChoisir: (a: ActionDuel) => void toucher(a) } : {})}
          >
            {ouverte ? (
              <Chrono
                key={duel.historique.length}
                duel={duel}
                selection={selection}
                onExpiration={verrouiller}
              />
            ) : (
              <span className="tres-discret">
                {duel.choixJoueuse ? 'verrouillé' : `manche ${etat.manche}`}
              </span>
            )}
          </Pentagone>

          {ouverte && (
            <>
              <p className="discret" style={{ margin: 0, textAlign: 'center' }}>
                {selection
                  ? `${LIBELLE_ACTION_DUEL[selection]} — ${FICTION_ACTIONS[selection].fiction} En vert ce qu’elle bat, en rouge ce qui la bat.`
                  : 'Touchez une action pour la préparer, une seconde fois pour la verrouiller.'}
              </p>
              <button
                type="button"
                className="btn btn--principal btn--large"
                disabled={!selection}
                onClick={() => selection && void verrouiller(selection)}
              >
                {selection ? `Verrouiller ${LIBELLE_ACTION_DUEL[selection]}` : 'Choisissez une action'}
              </button>
            </>
          )}

          {duel.choixJoueuse && (
            <p className="alerte alerte--info">
              <strong>{LIBELLE_ACTION_DUEL[duel.choixJoueuse]} verrouillée.</strong> On attend la
              révélation.
            </p>
          )}

          {!ouverte && !duel.choixJoueuse && (
            <p className="tour-attente">
              <strong>Patientez.</strong> La MJ va ouvrir la manche {etat.manche}.
            </p>
          )}
        </section>
      )}

      <DerniereManche duel={duel} nomJoueuse="Vous" />
      <Historique duel={duel} nomJoueuse="Vous" />
      <RappelsDuel />
    </div>
  )
}

// ---------------------------------------------------------------------------

/** Le plateau des joueuses qui ne se battent pas : tout est visible, rien n'est cliquable. */
function Spectatrice({ duel, duelliste }: { duel: Duel; duelliste: Character | null }) {
  const etat = etatDuel(duel.historique)
  const nom = duelliste?.nom ?? 'La duelliste'

  return (
    <div className="pile">
      <p className="alerte alerte--info">
        {nom} affronte {duel.adversaireNom}. Vous regardez.
      </p>

      <EnTete duel={duel} nomJoueuse={nom} />

      {duel.issue ? (
        <Issue duel={duel} nomJoueuse={nom} />
      ) : (
        <section className="carte pile">
          <Pentagone
            flowJoueuse={flowDe(etat.precedenteJoueuse)}
            flowAdversaire={flowDe(etat.precedenteAdversaire)}
            revele={derniereRevelation(duel)}
          >
            <span className="tres-discret">
              manche {Math.min(etat.manche, MANCHES_MAX)}/{MANCHES_MAX}
            </span>
          </Pentagone>
        </section>
      )}

      <DerniereManche duel={duel} nomJoueuse={nom} />
      <Historique duel={duel} nomJoueuse={nom} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Morceaux partagés — l'écran MJ les réutilise tels quels
// ---------------------------------------------------------------------------

/** La dernière manche révélée, pour marquer les deux sommets joués. */
export function derniereRevelation(
  duel: Duel,
): { joueuse: ActionDuel; adversaire: ActionDuel } | null {
  const derniere = duel.historique[duel.historique.length - 1]
  if (!derniere || duel.debutManche !== null) return null
  return { joueuse: derniere.actionJoueuse, adversaire: derniere.actionAdversaire }
}

export function EnTete({ duel, nomJoueuse }: { duel: Duel; nomJoueuse: string }) {
  const etat = etatDuel(duel.historique)

  return (
    <section className="carte pile pile--serree">
      <div className="carte__titre">
        <span className="etiquette">Combat rapide</span>
        <span className="tres-discret">
          manche {Math.min(etat.manche, MANCHES_MAX)}/{MANCHES_MAX} · premier à {OBJECTIF_POINTS}
        </span>
      </div>

      <LigneScore nom={nomJoueuse} points={etat.scoreJoueuse} />
      <LigneScore
        nom={duel.adversaireNom}
        points={etat.scoreAdversaire}
        icone={duel.adversaireIcone}
      />

      {etat.bonusClashActif && (
        <p className="tres-discret" style={{ margin: 0 }}>
          Clash : la prochaine manche décisive vaut 2 points.
        </p>
      )}

      {duel.enjeu && (
        <p className="discret" style={{ margin: 0 }}>
          {duel.enjeu}
        </p>
      )}
    </section>
  )
}

function LigneScore({ nom, points, icone }: { nom: string; points: number; icone?: string }) {
  return (
    <div className="score-duel">
      {icone && <Icone nom={icone} taille={26} />}
      <span className="score-duel__nom">{nom}</span>
      <span className="score-duel__points" aria-label={`${points} point(s)`}>
        {Array.from({ length: OBJECTIF_POINTS }, (_, i) => (
          <span
            key={i}
            className={`score-duel__point ${i < points ? 'score-duel__point--pleine' : ''}`}
          />
        ))}
      </span>
    </div>
  )
}

/**
 * Le chrono, au centre du pentagone.
 *
 * ⚠️ À zéro, c'est **cet appareil** qui verrouille — la sélection en cours, ou
 * l'action par défaut si la joueuse n'a rien préparé. La garde par `ref` évite
 * qu'un second battement n'écrive deux fois la même manche.
 */
function Chrono({
  duel,
  selection,
  onExpiration,
}: {
  duel: Duel
  selection: ActionDuel | null
  onExpiration: (action: ActionDuel) => Promise<void>
}) {
  const [restant, setRestant] = useState(() => restantMs(duel))

  // Le battement ne doit dépendre de rien : la sélection change à chaque appui
  // et `duel` à chaque écho du store. On les lit dans une ref plutôt que de
  // relancer l'intervalle, et `envoye` garantit une seule écriture par manche
  // (le composant est remonté à chaque manche par sa `key`).
  const dernier = useRef({ duel, selection, onExpiration })
  dernier.current = { duel, selection, onExpiration }
  const envoye = useRef(false)

  useEffect(() => {
    const battement = setInterval(() => {
      const courant = dernier.current
      const reste = restantMs(courant.duel)
      setRestant(reste)
      if (reste > 0 || envoye.current) return
      envoye.current = true
      void courant.onExpiration(courant.selection ?? courant.duel.actionParDefaut)
    }, 200)
    return () => clearInterval(battement)
  }, [])

  const secondes = Math.ceil(Math.max(0, restant) / 1000)

  return (
    <>
      <span className={`chrono ${secondes <= 3 ? 'chrono--urgent' : ''}`}>{secondes}</span>
      <span className="tres-discret">
        {selection ? LIBELLE_ACTION_DUEL[selection] : LIBELLE_ACTION_DUEL[duel.actionParDefaut]}
      </span>
    </>
  )
}

function restantMs(duel: Duel): number {
  return duel.debutManche === null ? duel.dureeChoixMs : duel.debutManche + duel.dureeChoixMs - Date.now()
}

/** Le résultat de la manche qu'on vient de révéler, en clair. */
export function DerniereManche({ duel, nomJoueuse }: { duel: Duel; nomJoueuse: string }) {
  const derniere = duel.historique[duel.historique.length - 1]
  if (!derniere || duel.debutManche !== null) return null

  return (
    <p className="alerte alerte--info">
      <strong>{recitManche(derniere, nomJoueuse, duel.adversaireNom)}</strong>
    </p>
  )
}

export function recitManche(manche: MancheJouee, nomJoueuse: string, nomAdversaire: string): string {
  const echange = `${nomJoueuse} ${LIBELLE_ACTION_DUEL[manche.actionJoueuse]} · ${nomAdversaire} ${LIBELLE_ACTION_DUEL[manche.actionAdversaire]}`
  if (manche.issue === 'clash') {
    return `${echange} — Clash. Personne ne marque, la prochaine manche décisive vaut 2.`
  }

  const gagnant = manche.issue === 'joueuse' ? nomJoueuse : nomAdversaire
  const raison = manche.flow ? ' (Flow complété)' : manche.bonusClash ? ' (manche d’après-Clash)' : ''
  return `${echange} — ${gagnant} marque ${manche.points}${raison}.`
}

export function Historique({ duel, nomJoueuse }: { duel: Duel; nomJoueuse: string }) {
  if (duel.historique.length === 0) return null

  return (
    <section className="carte pile pile--serree">
      <span className="etiquette">Manches jouées</span>
      {duel.historique.map((m, i) => (
        <div key={i} className={`manche manche--${m.issue}`}>
          <span className="manche__numero">{i + 1}</span>
          <span className="manche__corps">
            <span className="objet__nom" style={{ fontSize: '0.9rem' }}>
              {recitManche(m, nomJoueuse, duel.adversaireNom)}
            </span>
          </span>
        </div>
      ))}
    </section>
  )
}

export function Issue({ duel, nomJoueuse }: { duel: Duel; nomJoueuse: string }) {
  const issue = duel.issue
  if (!issue) return null

  if (issue.kind === 'statu-quo') {
    return (
      <section className="carte pile pile--serree">
        <span className="etiquette">Statu quo</span>
        <p style={{ margin: 0 }}>
          Personne n'a marqué : rien ne bouge. {duel.enjeu || 'La situation reste ce qu’elle était.'}
        </p>
      </section>
    )
  }

  const vainqueur = issue.vainqueur === 'joueuse' ? nomJoueuse : duel.adversaireNom
  const motif = {
    objectif: `${OBJECTIF_POINTS} points atteints`,
    points: 'meilleur score après la cinquième manche',
    'derniere-marque': 'égalité, départagée par la dernière manche marquée',
  }[issue.motif]

  return (
    <section className="carte pile pile--serree">
      <span className="etiquette">Duel terminé</span>
      <p style={{ margin: 0 }}>
        <strong>{vainqueur} l'emporte.</strong> <span className="tres-discret">({motif})</span>
      </p>
      {duel.enjeu && (
        <p className="discret" style={{ margin: 0 }}>
          {duel.enjeu}
        </p>
      )}
    </section>
  )
}

export function RappelsDuel() {
  return (
    <section className="carte pile pile--serree">
      <span className="etiquette">Rappels de règles</span>
      {RAPPELS_DUEL.map((r) => (
        <Rappel key={r.id} rappel={r} />
      ))}
    </section>
  )
}
