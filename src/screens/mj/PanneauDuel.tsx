import { useEffect, useRef, useState } from 'react'

import { Icone } from '../../components/Icone.tsx'
import { Pentagone } from '../../components/Pentagone.tsx'
import { FICTION_ACTIONS } from '../../content/duel.ts'
import { ICONES_DISPONIBLES } from '../../content/icones.ts'
import {
  abandonnerDuelPrive,
  enregistrerDuelPrive,
  lancerDuel,
  nouveauDuelPrive,
  ouvrirManche,
  revelerManche,
  surDuel,
  surDuelPrive,
  terminerDuel,
} from '../../data/repo.ts'
import { actionScriptee, etatDuel, flowDe, MANCHES_MAX } from '../../domain/duel.ts'
import {
  ACTIONS_DUEL,
  LIBELLE_ACTION_DUEL,
  type ActionDuel,
  type Character,
  type Duel,
  type DuelPrive,
  type EtatTable,
} from '../../domain/types.ts'
import {
  DerniereManche,
  derniereRevelation,
  EnTete,
  Historique,
  Issue,
} from '../joueuse/OngletDuel.tsx'

/**
 * Pilotage du combat rapide, côté MJ.
 *
 * Deux temps, comme le Feu de Camp : préparer à l'abri des regards, puis mener
 * le duel manche par manche.
 *
 * 🔒 Le motif du PNJ n'apparaît que sur cet écran. Il vit dans un document
 * refusé aux joueuses — un duel dont le motif est lisible est un duel déjà
 * résolu, et Firestore ne sait pas cacher un champ.
 */
export function PanneauDuel({
  etat,
  personnages,
}: {
  etat: EtatTable
  personnages: Character[]
}) {
  const [prive, setPrive] = useState<DuelPrive | null>(null)
  const [duel, setDuel] = useState<Duel | null>(null)

  useEffect(() => surDuelPrive(setPrive), [])
  useEffect(
    () => (etat.duelId ? surDuel(etat.duelId, setDuel) : (setDuel(null) as void)),
    [etat.duelId],
  )

  if (etat.duelId && duel && prive) {
    return <Pilotage etat={etat} duel={duel} prive={prive} personnages={personnages} />
  }

  // Un duel est en cours mais ses documents ne sont pas encore là. Surtout ne
  // pas proposer d'en préparer un autre : le bouton écraserait le motif de
  // celui-ci. On laisse seulement de quoi se dégager si l'état est cassé.
  if (etat.duelId) {
    return (
      <section className="carte pile">
        <span className="etiquette">Combat rapide</span>
        <p className="discret" style={{ margin: 0 }}>
          {duel ? 'Chargement du motif…' : 'Chargement du duel en cours…'}
        </p>
        <button
          type="button"
          className="btn btn--danger btn--large"
          onClick={() => confirm('Terminer le combat rapide en cours ?') && void terminerDuel(etat, duel)}
        >
          Terminer le combat rapide
        </button>
      </section>
    )
  }

  return <Preparation etat={etat} prive={prive} personnages={personnages} />
}

// ---------------------------------------------------------------------------

function Preparation({
  etat,
  prive,
  personnages,
}: {
  etat: EtatTable
  prive: DuelPrive | null
  personnages: Character[]
}) {
  if (!prive || prive.duelId) {
    return (
      <section className="carte pile">
        <span className="etiquette">Combat rapide</span>
        <p className="discret" style={{ margin: 0 }}>
          Un duel en cinq manches contre un PNJ, sans dés. Vous préparerez le motif de la créature
          à l'abri des regards : rien n'apparaît sur l'écran des joueuses tant que vous n'avez pas
          lancé, et le motif ne leur sera jamais lisible.
        </p>
        <button
          type="button"
          className="btn btn--principal btn--large"
          disabled={personnages.length === 0}
          onClick={() => void enregistrerDuelPrive(nouveauDuelPrive(personnages[0]?.id ?? ''))}
        >
          {personnages.length === 0 ? 'Aucun personnage à la table' : 'Préparer un combat rapide'}
        </button>
      </section>
    )
  }

  const maj = (patch: Partial<DuelPrive>) => void enregistrerDuelPrive({ ...prive, ...patch })
  const pretALancer = prive.characterId !== '' && prive.adversaireNom.trim() !== '' && prive.motif.length > 0

  return (
    <div className="pile">
      <section className="carte pile">
        <div className="carte__titre">
          <span className="etiquette">Préparer un combat rapide</span>
          <button type="button" className="btn btn--fantome" onClick={() => void abandonnerDuelPrive()}>
            Abandonner
          </button>
        </div>

        <label className="champ">
          <span className="tres-discret">Qui se bat ?</span>
          <select value={prive.characterId} onChange={(e) => maj({ characterId: e.target.value })}>
            {personnages.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nom}
              </option>
            ))}
          </select>
        </label>

        <label className="champ">
          <span className="tres-discret">Nom de l'adversaire</span>
          <input
            type="text"
            value={prive.adversaireNom}
            placeholder="Carcasse"
            onChange={(e) => maj({ adversaireNom: e.target.value })}
          />
        </label>

        <label className="champ">
          <span className="tres-discret">
            Enjeu — annoncé à la table, et c'est lui qui tient lieu de statu quo si personne ne
            marque
          </span>
          {/* Champ contrôlé, et non enregistré au `blur` : lancer le duel d'un
              clic depuis ce champ aurait couru avec l'écriture, et l'enjeu
              serait parti à la table vide. */}
          <textarea
            value={prive.enjeu}
            placeholder="La Carcasse cherche à fuir vers l'escalier."
            onChange={(e) => maj({ enjeu: e.target.value })}
          />
        </label>

        <span className="etiquette">Icône</span>
        <div className="grille-icones">
          {ICONES_DISPONIBLES.map((nom) => (
            <button
              key={nom}
              type="button"
              className={`choix-icone ${prive.adversaireIcone === nom ? 'choix-icone--actif' : ''}`}
              onClick={() => maj({ adversaireIcone: nom })}
              title={nom}
            >
              <Icone nom={nom} taille={28} />
            </button>
          ))}
        </div>
      </section>

      <section className="carte pile">
        <div className="carte__titre">
          <span className="etiquette">Motif de l'adversaire 🔒</span>
          <span className="tres-discret">{prive.motif.length} action(s)</span>
        </div>
        <p className="discret" style={{ margin: 0 }}>
          La suite d'actions que la créature répétera jusqu'à la fin du duel. Donnez-lui un motif
          court qui lui ressemble — une brute pousse, une duelliste contre. Vous pourrez en
          remplacer secrètement une action entre deux manches.
        </p>

        <div className="motif">
          {prive.motif.length === 0 && (
            <span className="tres-discret">Aucune action : touchez-en une ci-dessous.</span>
          )}
          {prive.motif.map((a, i) => (
            <span key={i} className="motif__pas">
              {i + 1}. {LIBELLE_ACTION_DUEL[a]}
            </span>
          ))}
        </div>

        <ChoixAction onChoisir={(a) => maj({ motif: [...prive.motif, a] })} />

        <button
          type="button"
          className="btn"
          disabled={prive.motif.length === 0}
          onClick={() => maj({ motif: prive.motif.slice(0, -1) })}
        >
          Retirer la dernière
        </button>
      </section>

      <section className="carte pile">
        <span className="etiquette">Réglages de la manche</span>

        <label className="champ">
          <span className="tres-discret">
            Temps de réflexion — {Math.round(prive.dureeChoixMs / 1000)} s
          </span>
          <input
            type="range"
            min={10}
            max={15}
            step={1}
            value={Math.round(prive.dureeChoixMs / 1000)}
            onChange={(e) => maj({ dureeChoixMs: Number(e.target.value) * 1000 })}
          />
        </label>

        <span className="tres-discret">
          Action jouée si le chrono expire sans que la joueuse ait rien préparé
        </span>
        <ChoixAction
          selection={prive.actionParDefaut}
          onChoisir={(a) => maj({ actionParDefaut: a })}
        />

        <button
          type="button"
          className="btn btn--principal btn--large"
          disabled={!pretALancer}
          onClick={() => void lancerDuel(etat, prive)}
        >
          {pretALancer ? 'Lancer le combat rapide' : 'Nommez l’adversaire et donnez-lui un motif'}
        </button>
      </section>
    </div>
  )
}

// ---------------------------------------------------------------------------

function Pilotage({
  etat,
  duel,
  prive,
  personnages,
}: {
  etat: EtatTable
  duel: Duel
  prive: DuelPrive
  personnages: Character[]
}) {
  const duelliste = personnages.find((p) => p.id === duel.characterId)
  const nomJoueuse = duelliste?.nom ?? 'La duelliste'
  const etatD = etatDuel(duel.historique)
  const termine = duel.issue !== null
  const ouverte = duel.debutManche !== null && !termine

  useArbitrage(duel, prive)

  return (
    <div className="pile">
      <EnTete duel={duel} nomJoueuse={nomJoueuse} />

      {termine ? (
        <Issue duel={duel} nomJoueuse={nomJoueuse} />
      ) : (
        <section className="carte pile">
          {/* Le même plateau que les joueuses, en lecture seule : un seul rendu
              à maintenir, et la MJ voit exactement ce qu'elles voient. */}
          <Pentagone
            flowJoueuse={flowDe(etatD.precedenteJoueuse)}
            flowAdversaire={flowDe(etatD.precedenteAdversaire)}
            revele={derniereRevelation(duel)}
          >
            <span className="tres-discret">
              manche {Math.min(etatD.manche, MANCHES_MAX)}/{MANCHES_MAX}
            </span>
          </Pentagone>

          {ouverte ? (
            <p className="tour-actif">
              {duel.choixJoueuse
                ? `${nomJoueuse} a verrouillé. Révélation…`
                : `${nomJoueuse} choisit — ${Math.round(duel.dureeChoixMs / 1000)} s au chrono.`}
            </p>
          ) : (
            <button
              type="button"
              className="btn btn--principal btn--large"
              onClick={() => void ouvrirManche(duel)}
            >
              Ouvrir la manche {etatD.manche} — le chrono démarre
            </button>
          )}
        </section>
      )}

      {/* Le récit de la manche qu'on vient de révéler : c'est la réplique que la
          MJ enchaîne à voix haute. */}
      <DerniereManche duel={duel} nomJoueuse={nomJoueuse} />

      <MotifSecret duel={duel} prive={prive} ouverte={ouverte} termine={termine} />

      <Historique duel={duel} nomJoueuse={nomJoueuse} />

      <button
        type="button"
        className="btn btn--danger btn--large"
        onClick={() => {
          if (termine || confirm('Terminer le combat rapide en cours ?')) {
            void terminerDuel(etat, duel)
          }
        }}
      >
        Terminer le combat rapide
      </button>
    </div>
  )
}

/**
 * 🔒 Ce que la MJ seule voit : le motif, et le droit de le contredire.
 *
 * Le remplacement ne s'offre **qu'entre deux manches**. Le document de playtest
 * autorise à remplacer *la prochaine* action scriptée, jamais à réagir au choix
 * de la joueuse : verrouiller le bouton pendant la manche rend la simultanéité
 * honnête plutôt que déclarative.
 */
function MotifSecret({
  duel,
  prive,
  ouverte,
  termine,
}: {
  duel: Duel
  prive: DuelPrive
  ouverte: boolean
  termine: boolean
}) {
  const etatD = etatDuel(duel.historique)
  const scriptee = prive.motif.length > 0 ? actionScriptee(prive.motif, etatD.manche) : null
  const prochaine = prive.override ?? scriptee
  const indexProchain = prive.motif.length > 0 ? (etatD.manche - 1) % prive.motif.length : -1

  return (
    <section className="alerte alerte--secret pile">
      <span className="etiquette" style={{ color: 'inherit' }}>
        Motif de {duel.adversaireNom} — secret
      </span>

      <div className="motif">
        {prive.motif.map((a, i) => (
          <span
            key={i}
            className={`motif__pas ${!termine && i === indexProchain ? 'motif__pas--prochain' : ''}`}
          >
            {LIBELLE_ACTION_DUEL[a]}
          </span>
        ))}
      </div>

      {!termine && prochaine && (
        <p style={{ margin: 0 }}>
          Manche {etatD.manche} : <strong>{LIBELLE_ACTION_DUEL[prochaine]}</strong>
          {prive.override && <span className="tres-discret"> — remplacée par vous</span>}
        </p>
      )}

      {!termine && (
        <>
          <span className="tres-discret">
            {ouverte
              ? 'Manche ouverte : le remplacement est verrouillé, il se décide avant.'
              : 'Remplacer la prochaine action, sans que la joueuse le sache :'}
          </span>
          <ChoixAction
            selection={prive.override}
            desactive={ouverte}
            onChoisir={(a) =>
              void enregistrerDuelPrive({ ...prive, override: prive.override === a ? null : a })
            }
          />
        </>
      )}
    </section>
  )
}

/**
 * L'arbitrage, sur l'écran MJ.
 *
 * C'est le seul écran qui peut lire le motif, donc le seul qui peut résoudre.
 * Il révèle dès que le choix verrouillé arrive ; le chrono, lui, tourne sur le
 * téléphone de la duelliste. Le délai de grâce ne sert qu'au cas où cet appareil
 * ne répond plus — écran éteint, réseau coupé.
 *
 * ⚠️ La `ref` est indexée sur le nombre de manches jouées : sans elle, un
 * re-rendu entre l'écriture et son écho résoudrait la manche deux fois.
 */
const GRACE_MS = 3_000

function useArbitrage(duel: Duel, prive: DuelPrive): void {
  const reveleePour = useRef<number | null>(null)

  useEffect(() => {
    if (duel.issue || duel.debutManche === null) return
    const manche = duel.historique.length
    if (reveleePour.current === manche) return

    const reveler = (choix: ActionDuel) => {
      reveleePour.current = manche
      void revelerManche(duel, prive, choix)
    }

    if (duel.choixJoueuse) {
      reveler(duel.choixJoueuse)
      return
    }

    const attente = duel.debutManche + duel.dureeChoixMs + GRACE_MS - Date.now()
    const minuterie = setTimeout(() => reveler(duel.actionParDefaut), Math.max(0, attente))
    return () => clearTimeout(minuterie)
  }, [duel, prive])
}

// ---------------------------------------------------------------------------

/** Les cinq actions en ligne, pour composer un motif ou trancher un réglage. */
function ChoixAction({
  selection = null,
  desactive = false,
  onChoisir,
}: {
  selection?: ActionDuel | null
  desactive?: boolean
  onChoisir: (action: ActionDuel) => void
}) {
  return (
    <div className="rangee">
      {ACTIONS_DUEL.map((a) => (
        <button
          key={a}
          type="button"
          className={`choix-action ${selection === a ? 'choix-action--actif' : ''}`}
          style={{ flex: 1, minWidth: 92 }}
          disabled={desactive}
          aria-pressed={selection === a}
          onClick={() => onChoisir(a)}
          title={FICTION_ACTIONS[a].fiction}
        >
          <span className="objet__corps" style={{ alignItems: 'center' }}>
            <Icone nom={FICTION_ACTIONS[a].icone} taille={24} />
            <span className="choix-action__nom">{LIBELLE_ACTION_DUEL[a]}</span>
          </span>
        </button>
      ))}
    </div>
  )
}
