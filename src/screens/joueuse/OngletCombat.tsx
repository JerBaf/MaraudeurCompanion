import { useState } from 'react'

import { Icone } from '../../components/Icone.tsx'
import {
  definirInitiative,
  enregistrerAdversaire,
  enregistrerPersonnage,
  journaliser,
  modifierPersonnage,
} from '../../data/repo.ts'
import type { Catalog } from '../../domain/catalog.ts'
import {
  ACTIONS_ALTERNATIVES,
  appliquerDegats,
  echeanceDiversion,
  echeanceEsquive,
  estSonTour,
  evasionAffichee,
  LIBELLE_SOUS_GROUPE,
  resoudreAttaque,
  sousGroupeDe,
} from '../../domain/combat.ts'
import { computeBonusEnergieAttaque } from '../../domain/competences.ts'
import { modificateurDiversion, modificateurEsquive } from '../../domain/modifiers.ts'
import type { Adversaire, Character, EtatCombat, EtatTable } from '../../domain/types.ts'
import { RappelsCombat } from './RappelsCombat.tsx'

/**
 * Écran de combat de la joueuse.
 *
 * L'écran se déverrouille en trois étapes, à la demande de la MJ : tant qu'une
 * joueuse n'a pas déposé son initiative elle ne voit **rien d'autre** ; tant que
 * ce n'est pas le tour de son sous-groupe elle ne voit que les adversaires.
 * L'objectif est qu'aucun champ de saisie ne soit visible à un moment où elle
 * n'a pas le droit d'agir — sans quoi la table se met à jouer hors tour.
 *
 * Les dés restent physiques : on saisit un résultat, l'app n'en lance aucun.
 */
export function OngletCombat({
  char,
  catalog,
  etat,
  adversaires,
  personnages,
}: {
  char: Character
  catalog: Catalog
  etat: EtatTable
  adversaires: Adversaire[]
  personnages: Character[]
}) {
  const combat = etat.combat

  if (!combat) {
    return <p className="vide">La MJ n'a pas encore démarré le combat.</p>
  }

  // --- Étape 1 : tant que l'initiative n'est pas déposée, rien d'autre ---
  if (combat.initiatives[char.id] === undefined) {
    return <SaisieInitiative etat={etat} char={char} />
  }

  // --- Étape 2 : ce n'est pas son tour, on ne montre que les adversaires ---
  if (!estSonTour(char, combat)) {
    return (
      <div className="pile">
        <Attente char={char} combat={combat} />
        <ListeAdversaires adversaires={adversaires} />
        <RappelsCombat />
      </div>
    )
  }

  // --- Étape 3 : c'est son tour, tout est déverrouillé ---
  return (
    <div className="pile">
      <p className="tour-actif">C'est à vous de jouer.</p>
      <Attaque
        char={char}
        catalog={catalog}
        combat={combat}
        adversaires={adversaires}
        personnages={personnages}
      />
      <ListeAdversaires adversaires={adversaires} />
      <RappelsCombat />
    </div>
  )
}

// ---------------------------------------------------------------------------

function SaisieInitiative({ etat, char }: { etat: EtatTable; char: Character }) {
  return (
    <section className="carte pile">
      <span className="etiquette">Votre initiative</span>
      <p className="discret" style={{ margin: 0 }}>
        Lancez votre d6 et saisissez le résultat. 4 à 6 vous fait jouer avant la MJ, 1 à 3 après.
        Le reste de l'écran s'ouvrira ensuite.
      </p>
      <div className="rangee">
        {[1, 2, 3, 4, 5, 6].map((d) => (
          <button
            key={d}
            type="button"
            className={`pas ${d >= 4 ? 'pas--avant' : ''}`}
            style={{ flex: 1 }}
            onClick={() => void definirInitiative(etat, char.id, d)}
          >
            {d}
          </button>
        ))}
      </div>
    </section>
  )
}

function Attente({ char, combat }: { char: Character; combat: EtatCombat }) {
  const mien = sousGroupeDe(char, combat)
  return (
    <p className="tour-attente">
      <strong>Patientez.</strong> Tour {combat.tour} — {LIBELLE_SOUS_GROUPE[combat.sousGroupeActif]}.
      {mien && ` Vous jouez ${LIBELLE_SOUS_GROUPE[mien].toLowerCase()}.`}
    </p>
  )
}

// ---------------------------------------------------------------------------

function ListeAdversaires({ adversaires }: { adversaires: Adversaire[] }) {
  return (
    <section className="carte pile pile--serree">
      <div className="carte__titre">
        <span className="etiquette">Adversaires</span>
        <span className="tres-discret">{adversaires.length}</span>
      </div>
      {adversaires.length === 0 && <p className="vide">Aucun adversaire en jeu.</p>}
      {adversaires.map((adv) => (
        <div key={adv.id} className="objet">
          <Icone nom={adv.icone} taille={30} />
          <span className="objet__corps">
            <span className="objet__nom">{adv.nom}</span>
            <span className="objet__meta">
              Évasion {evasionAffichee(adv, false)} · {adv.degatsSubis} dégât(s) subi(s)
            </span>
          </span>
        </div>
      ))}
    </section>
  )
}

// ---------------------------------------------------------------------------

function Attaque({
  char,
  catalog,
  combat,
  adversaires,
  personnages,
}: {
  char: Character
  catalog: Catalog
  combat: EtatCombat
  adversaires: Adversaire[]
  personnages: Character[]
}) {
  const [cibleId, setCibleId] = useState<string>('')
  const [jet, setJet] = useState('')
  const [resultat, setResultat] = useState<string | null>(null)
  const [alternative, setAlternative] = useState(false)

  const bonus = computeBonusEnergieAttaque(char, catalog).bonus
  const cible = adversaires.find((a) => a.id === cibleId)
  const jetNombre = Number(jet)
  const saisieValide = cible !== undefined && jet !== '' && Number.isFinite(jetNombre)

  async function resoudre() {
    if (!cible || !saisieValide) return

    const pointsEnergie = jetNombre + bonus
    const r = resoudreAttaque(pointsEnergie, cible.evasion)

    if (r.touche) {
      await enregistrerAdversaire(appliquerDegats(cible, r.degats))
      await journaliser(
        char.nom,
        'attaque',
        `${char.nom} inflige ${r.degats} dégât(s) à ${cible.nom} (${pointsEnergie} PE contre Évasion ${cible.evasion}).`,
      )
      setResultat(
        `${pointsEnergie} Point(s) d'Énergie contre Évasion ${cible.evasion} → ${r.degats} dégât(s) infligé(s).`,
      )
      setAlternative(false)
    } else {
      setResultat(
        `${pointsEnergie} Point(s) d'Énergie contre Évasion ${cible.evasion} : l'attaque ne passe pas.`,
      )
      setAlternative(true)
    }
    setJet('')
  }

  return (
    <>
      <section className="carte pile">
        <div className="carte__titre">
          <span className="etiquette">Attaquer</span>
          {bonus !== 0 && (
            <span className="puce puce--ambre">
              {bonus > 0 ? '+' : ''}
              {bonus} PE
            </span>
          )}
        </div>

        <label className="champ">
          <span className="tres-discret">Cible</span>
          <select value={cibleId} onChange={(e) => setCibleId(e.target.value)}>
            <option value="">— choisir —</option>
            {adversaires.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nom} (Évasion {evasionAffichee(a, false)})
              </option>
            ))}
          </select>
        </label>

        <label className="champ">
          <span className="tres-discret">
            Résultat de votre dé{bonus !== 0 ? ` — ${bonus > 0 ? '+' : ''}${bonus} sera ajouté` : ''}
          </span>
          <input
            type="number"
            inputMode="numeric"
            value={jet}
            onChange={(e) => setJet(e.target.value)}
            placeholder="3"
          />
        </label>

        <button
          type="button"
          className="btn btn--principal btn--large"
          onClick={() => void resoudre()}
          disabled={!saisieValide}
        >
          Résoudre
        </button>

        {resultat && <p className="alerte alerte--info">{resultat}</p>}
      </section>

      <ActionsAlternatives
        char={char}
        personnages={personnages}
        combat={combat}
        ouvertParEchec={alternative}
      />
    </>
  )
}

// ---------------------------------------------------------------------------

/**
 * Le bouton « G pas touchão ».
 *
 * S'ouvre de lui-même quand un jet n'a pas percé l'Évasion, et reste
 * accessible le reste du temps. Les deux actions se choisissent en touchant
 * leur encadré ; la désignation de l'alliée n'apparaît qu'après avoir choisi
 * la Diversion, pour que l'écran ne montre jamais un champ sans objet.
 */
function ActionsAlternatives({
  char,
  personnages,
  combat,
  ouvertParEchec,
}: {
  char: Character
  personnages: Character[]
  combat: EtatCombat
  ouvertParEchec: boolean
}) {
  const [ouvert, setOuvert] = useState(false)
  const [choix, setChoix] = useState<'esquiver' | 'diversion' | null>(null)
  const [cibleId, setCibleId] = useState('')
  const [message, setMessage] = useState<string | null>(null)

  const deploye = ouvert || ouvertParEchec
  const allies = personnages.filter((p) => p.id !== char.id)
  const monSousGroupe = sousGroupeDe(char, combat)

  async function esquiver() {
    if (!monSousGroupe) return
    await modifierPersonnage(char, (c) => ({
      ...c,
      modifiers: [...c.modifiers, modificateurEsquive(echeanceEsquive(combat, monSousGroupe))],
    }))
    setMessage('Esquive posée : +1 à votre Évasion jusqu’à votre prochain tour.')
    setChoix(null)
  }

  async function faireDiversion() {
    const allie = allies.find((a) => a.id === cibleId)
    if (!allie) return

    // L'échéance dépend du sous-groupe de la bénéficiaire : si elle a déjà
    // joué ce tour-ci, le bonus vaut pour son activation du tour suivant.
    const sousGroupeAllie = sousGroupeDe(allie, combat)
    if (!sousGroupeAllie) {
      setMessage(`${allie.nom} n'a pas encore déposé son initiative.`)
      return
    }

    await enregistrerPersonnage({
      ...allie,
      modifiers: [
        ...allie.modifiers,
        modificateurDiversion(echeanceDiversion(combat, sousGroupeAllie), char.nom),
      ],
    })
    await journaliser(char.nom, 'diversion', `${char.nom} fait diversion pour ${allie.nom} (+1 PE).`)
    setMessage(`Diversion pour ${allie.nom} : +1 Point d'Énergie pour sa prochaine action.`)
    setChoix(null)
    setCibleId('')
  }

  if (!deploye) {
    return (
      <button type="button" className="btn-touchao" onClick={() => setOuvert(true)}>
        G pas touchão
      </button>
    )
  }

  return (
    <section className="carte carte--touchao pile">
      <div className="carte__titre">
        <span className="titre-touchao">G pas touchão</span>
        {!ouvertParEchec && (
          <button type="button" className="btn btn--fantome" onClick={() => setOuvert(false)}>
            Fermer
          </button>
        )}
      </div>

      <p className="discret" style={{ margin: 0 }}>
        Votre jet n'a pas percé les défenses adverses. Plutôt que de perdre votre tour, employez
        ces Points d'Énergie autrement — touchez une action pour la choisir.
      </p>

      {ACTIONS_ALTERNATIVES.map((a) => (
        <button
          key={a.id}
          type="button"
          className={`choix-action ${choix === a.id ? 'choix-action--actif' : ''}`}
          aria-pressed={choix === a.id}
          onClick={() => setChoix(choix === a.id ? null : a.id)}
        >
          <span className="objet__corps">
            <span className="choix-action__nom">{a.nom}</span>
            <span className="objet__meta">{a.description}</span>
          </span>
        </button>
      ))}

      {choix === 'esquiver' && (
        <button type="button" className="btn btn--principal btn--large" onClick={() => void esquiver()}>
          Confirmer l'esquive
        </button>
      )}

      {choix === 'diversion' && (
        <div className="pile pile--serree">
          <label className="champ">
            <span className="tres-discret">Quelle alliée aidez-vous ?</span>
            <select value={cibleId} onChange={(e) => setCibleId(e.target.value)}>
              <option value="">— choisir —</option>
              {allies.map((p) => {
                const sg = sousGroupeDe(p, combat)
                return (
                  <option key={p.id} value={p.id}>
                    {p.nom}
                    {sg ? ` — ${LIBELLE_SOUS_GROUPE[sg].toLowerCase()}` : ' — sans initiative'}
                  </option>
                )
              })}
            </select>
          </label>
          <button
            type="button"
            className="btn btn--principal btn--large"
            onClick={() => void faireDiversion()}
            disabled={!cibleId}
          >
            Confirmer la diversion
          </button>
        </div>
      )}

      {message && <p className="alerte alerte--info">{message}</p>}
    </section>
  )
}
