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
  estSonTour,
  evasionAffichee,
  LIBELLE_SOUS_GROUPE,
  resoudreAttaque,
  sousGroupeInitiative,
} from '../../domain/combat.ts'
import { computeBonusEnergieAttaque } from '../../domain/competences.ts'
import { modificateurDiversion, modificateurEsquive } from '../../domain/modifiers.ts'
import type { Adversaire, Character, EtatTable } from '../../domain/types.ts'
import { RappelsCombat } from './RappelsCombat.tsx'

/**
 * Écran de combat de la joueuse.
 *
 * Décision arrêtée avec la MJ : la joueuse saisit sa cible et son jet, l'app
 * calcule `E − N` et applique les dégâts pour toute la table. La MJ garde la
 * main pour corriger depuis son écran.
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

  const monInitiative = combat.initiatives[char.id]
  const monTour = estSonTour(char, combat)

  return (
    <div className="pile">
      {monInitiative === undefined ? (
        <SaisieInitiative etat={etat} char={char} />
      ) : monTour ? (
        <p className="tour-actif">C'est à vous de jouer.</p>
      ) : (
        <p className="tour-attente">
          {LIBELLE_SOUS_GROUPE[combat.sousGroupeActif]} · tour {combat.tour}. Vous jouez{' '}
          {LIBELLE_SOUS_GROUPE[sousGroupeInitiative(monInitiative)].toLowerCase()} (d6 ={' '}
          {monInitiative}).
        </p>
      )}

      <Attaque
        char={char}
        catalog={catalog}
        etat={etat}
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
  const [cibleId, setCibleId] = useState<string>('')
  const [jet, setJet] = useState('')
  const [resultat, setResultat] = useState<string | null>(null)
  const [alternative, setAlternative] = useState(false)

  const combat = etat.combat!
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

      {alternative && (
        <ActionsAlternatives
          char={char}
          personnages={personnages}
          tour={combat.tour}
          onFait={() => setAlternative(false)}
        />
      )}
    </section>
  )
}

// ---------------------------------------------------------------------------

/**
 * Le bouton « G pas touchão ».
 *
 * S'ouvre automatiquement quand un jet n'a pas percé l'Évasion, et reste
 * accessible autrement. Les deux effets expirent au tour suivant — la
 * Diversion étant posée sur la fiche d'une **autre** joueuse.
 */
function ActionsAlternatives({
  char,
  personnages,
  tour,
  onFait,
}: {
  char: Character
  personnages: Character[]
  tour: number
  onFait: () => void
}) {
  const [cibleId, setCibleId] = useState('')
  const [message, setMessage] = useState<string | null>(null)

  const allies = personnages.filter((p) => p.id !== char.id)

  async function esquiver() {
    await modifierPersonnage(char, (c) => ({
      ...c,
      modifiers: [...c.modifiers, modificateurEsquive(tour)],
    }))
    setMessage('Esquive posée : +1 à votre Évasion jusqu’au tour suivant.')
    onFait()
  }

  async function faireDiversion() {
    const allie = allies.find((a) => a.id === cibleId)
    if (!allie) return
    await enregistrerPersonnage({
      ...allie,
      modifiers: [...allie.modifiers, modificateurDiversion(tour, char.nom)],
    })
    await journaliser(char.nom, 'diversion', `${char.nom} fait diversion pour ${allie.nom} (+1 PE).`)
    setMessage(`Diversion pour ${allie.nom} : +1 Point d'Énergie jusqu’au tour suivant.`)
    onFait()
  }

  return (
    <div className="carte pile pile--serree" style={{ background: 'var(--encre)' }}>
      <span className="etiquette">G pas touchão</span>
      <p className="discret" style={{ margin: 0 }}>
        Votre jet n'a pas percé les défenses adverses. Plutôt que de perdre votre tour, employez
        ces Points d'Énergie autrement.
      </p>

      {ACTIONS_ALTERNATIVES.map((a) => (
        <div key={a.id} className="pile pile--serree">
          <div className="objet">
            <span className="objet__corps">
              <span className="objet__nom">{a.nom}</span>
              <span className="objet__meta">{a.description}</span>
            </span>
          </div>

          {a.id === 'esquiver' ? (
            <button type="button" className="btn btn--large" onClick={() => void esquiver()}>
              Esquiver
            </button>
          ) : (
            <div className="rangee">
              <select
                value={cibleId}
                onChange={(e) => setCibleId(e.target.value)}
                style={{ flex: 1, minHeight: 44 }}
              >
                <option value="">— quelle alliée ? —</option>
                {allies.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nom}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="btn"
                onClick={() => void faireDiversion()}
                disabled={!cibleId}
              >
                Faire diversion
              </button>
            </div>
          )}
        </div>
      ))}

      {message && <p className="alerte alerte--info">{message}</p>}
    </div>
  )
}
