import { useEffect, useState } from 'react'

import { Icone } from '../../components/Icone.tsx'
import {
  ajouterAdversaire,
  avancerSousGroupe,
  demarrerCombat,
  enregistrerAdversaire,
  supprimerAdversaire,
  surBestiaire,
  surSeuilsAdversaires,
  terminerCombat,
} from '../../data/repo.ts'
import {
  estTombe,
  instancierAdversaire,
  LIBELLE_SOUS_GROUPE,
  nomNumerote,
  ORDRE_SOUS_GROUPES,
  repartirParInitiative,
  sousGroupeInitiative,
} from '../../domain/combat.ts'
import type {
  Adversaire,
  Character,
  EtatTable,
  ModeleAdversaire,
  SeuilsAdversaires,
} from '../../domain/types.ts'

/**
 * Pilotage du combat, côté MJ.
 *
 * Trois blocs, dans l'ordre où on s'en sert à table : où en est le tour, qui a
 * déposé son initiative, et quelles créatures sont en jeu.
 *
 * 🔒 Les seuils de Fatigue n'apparaissent que sur cet écran : ils vivent dans un
 * document refusé aux joueuses. Ce qu'elles voient d'un adversaire se limite au
 * document public — nom, dégâts cumulés, et l'Évasion si vous la révélez.
 */
export function PanneauCombat({
  etat,
  personnages,
  adversaires,
}: {
  etat: EtatTable
  personnages: Character[]
  adversaires: Adversaire[]
}) {
  const [bestiaire, setBestiaire] = useState<ModeleAdversaire[]>([])
  const [seuils, setSeuils] = useState<SeuilsAdversaires>({})

  useEffect(() => surBestiaire(setBestiaire), [])
  useEffect(() => surSeuilsAdversaires(setSeuils), [])

  const combat = etat.combat

  if (!combat) {
    return (
      <section className="carte pile">
        <span className="etiquette">Combat</span>
        <p className="discret" style={{ margin: 0 }}>
          Aucun combat en cours. Le démarrer bascule toute la table en mode Combat et ouvre la
          saisie des initiatives.
        </p>
        <button
          type="button"
          className="btn btn--principal btn--large"
          onClick={() => void demarrerCombat(etat)}
        >
          Démarrer un combat
        </button>
      </section>
    )
  }

  const { avantMJ, apresMJ, enAttente } = repartirParInitiative(personnages, combat.initiatives)

  return (
    <div className="pile">
      <TourEnCours
        etat={etat}
        personnages={personnages}
        adversaires={adversaires}
        avantMJ={avantMJ.length}
        apresMJ={apresMJ.length}
      />

      <section className="carte pile pile--serree">
        <div className="carte__titre">
          <span className="etiquette">Initiatives</span>
          <span className="tres-discret">
            {personnages.length - enAttente.length}/{personnages.length} saisies
          </span>
        </div>

        {personnages.map((c) => {
          const d6 = combat.initiatives[c.id]
          return (
            <div key={c.id} className="objet">
              <span className="objet__corps">
                <span className="objet__nom">{c.nom}</span>
                <span className="objet__meta">
                  {d6 === undefined
                    ? 'en attente de son d6'
                    : `d6 = ${d6} · ${LIBELLE_SOUS_GROUPE[sousGroupeInitiative(d6)]}`}
                </span>
              </span>
              {d6 !== undefined && sousGroupeInitiative(d6) === combat.sousGroupeActif && (
                <span className="puce puce--ambre">À elle</span>
              )}
            </div>
          )
        })}
      </section>

      <Adversaires
        adversaires={adversaires}
        seuils={seuils}
        bestiaire={bestiaire}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------

function TourEnCours({
  etat,
  personnages,
  adversaires,
  avantMJ,
  apresMJ,
}: {
  etat: EtatTable
  personnages: Character[]
  adversaires: Adversaire[]
  avantMJ: number
  apresMJ: number
}) {
  const combat = etat.combat!
  const effectifs: Record<string, number> = { 'avant-mj': avantMJ, mj: 0, 'apres-mj': apresMJ }

  return (
    <section className="carte pile">
      <div className="carte__titre">
        <span className="etiquette">Tour {combat.tour}</span>
        <span className="tres-discret">{LIBELLE_SOUS_GROUPE[combat.sousGroupeActif]}</span>
      </div>

      <div className="onglets" role="group" aria-label="Sous-groupe actif">
        {ORDRE_SOUS_GROUPES.map((sg) => (
          <span key={sg} className={`onglet ${combat.sousGroupeActif === sg ? 'onglet--actif' : ''}`}>
            {LIBELLE_SOUS_GROUPE[sg]}
            {sg !== 'mj' && effectifs[sg] ? ` (${effectifs[sg]})` : ''}
          </span>
        ))}
      </div>

      <button
        type="button"
        className="btn btn--principal btn--large"
        onClick={() => void avancerSousGroupe(etat, personnages)}
      >
        {combat.sousGroupeActif === 'apres-mj' ? `Passer au tour ${combat.tour + 1}` : 'Sous-groupe suivant'}
      </button>

      <p className="tres-discret" style={{ margin: 0 }}>
        Passer au tour suivant fait expirer les Esquives et les Diversions en cours.
      </p>

      <button
        type="button"
        className="btn btn--danger btn--large"
        onClick={() => {
          if (
            confirm(
              `Terminer le combat ? Les ${adversaires.length} adversaire(s), les initiatives et les effets de tour seront effacés.`,
            )
          ) {
            void terminerCombat(etat, personnages, adversaires)
          }
        }}
      >
        Terminer le combat
      </button>
    </section>
  )
}

// ---------------------------------------------------------------------------

function Adversaires({
  adversaires,
  seuils,
  bestiaire,
}: {
  adversaires: Adversaire[]
  seuils: SeuilsAdversaires
  bestiaire: ModeleAdversaire[]
}) {
  const [nom, setNom] = useState('')
  const [evasion, setEvasion] = useState(1)
  const [fatigueMax, setFatigueMax] = useState(0)

  function deposer(modele: ModeleAdversaire) {
    const id = globalThis.crypto?.randomUUID?.() ?? `adv-${Date.now()}`
    const adv = instancierAdversaire(modele, adversaires, id)
    void ajouterAdversaire(adv, modele.fatigueMax, seuils)
  }

  function ajouterALaVolee() {
    if (!nom.trim()) return
    deposer({ id: 'ad-hoc', nom: nom.trim(), evasion, fatigueMax, icone: 'spectre' })
    setNom('')
    setEvasion(1)
    setFatigueMax(0)
  }

  return (
    <section className="carte pile pile--serree">
      <div className="carte__titre">
        <span className="etiquette">Adversaires en jeu</span>
        <span className="tres-discret">{adversaires.length}</span>
      </div>

      {adversaires.length === 0 && <p className="vide">Aucun adversaire.</p>}

      {adversaires.map((adv) => {
        const seuil = seuils[adv.id]
        const tombe = estTombe(adv, seuil)
        return (
          <div key={adv.id} className={`objet ${tombe ? 'objet--indisponible' : ''}`}>
            <Icone nom={adv.icone} taille={30} />
            <span className="objet__corps">
              <span className="objet__nom">
                {adv.nom}
                {tombe && <span className="puce puce--desavantage" style={{ marginLeft: 8 }}>Tombé</span>}
              </span>
              <span className="objet__meta">
                Évasion {adv.evasion} · dégâts {adv.degatsSubis}
                {seuil ? ` / ${seuil} 🔒` : ' · seuil non renseigné'}
              </span>
            </span>

            <div className="rangee" style={{ gap: 4 }}>
              <button
                type="button"
                className="pas"
                onClick={() =>
                  void enregistrerAdversaire({
                    ...adv,
                    degatsSubis: Math.max(0, adv.degatsSubis - 1),
                  })
                }
                aria-label={`Retirer un dégât à ${adv.nom}`}
              >
                −
              </button>
              <button
                type="button"
                className="pas"
                onClick={() =>
                  void enregistrerAdversaire({ ...adv, degatsSubis: adv.degatsSubis + 1 })
                }
                aria-label={`Ajouter un dégât à ${adv.nom}`}
              >
                +
              </button>
            </div>

            <button
              type="button"
              className={`btn ${adv.evasionPublique ? 'btn--principal' : ''}`}
              onClick={() =>
                void enregistrerAdversaire({ ...adv, evasionPublique: !adv.evasionPublique })
              }
              title="Rendre l'Évasion visible des joueuses"
            >
              {adv.evasionPublique ? 'Évasion visible' : 'Évasion masquée'}
            </button>

            <button
              type="button"
              className="btn btn--danger"
              onClick={() => void supprimerAdversaire(adv, seuils)}
              aria-label={`Retirer ${adv.nom}`}
            >
              ×
            </button>
          </div>
        )
      })}

      <hr className="separateur" />

      <span className="etiquette">Déposer depuis le bestiaire</span>
      {bestiaire.length === 0 && (
        <p className="tres-discret" style={{ margin: 0 }}>
          Votre bestiaire est vide. Vous pouvez le remplir dans l'onglet Réglages, ou créer un
          adversaire à la volée ci-dessous.
        </p>
      )}
      {bestiaire.map((m) => (
        <button key={m.id} type="button" className="objet" onClick={() => deposer(m)}>
          <Icone nom={m.icone} taille={28} />
          <span className="objet__corps">
            <span className="objet__nom">{nomNumerote(m.nom, adversaires)}</span>
            <span className="objet__meta">
              Évasion {m.evasion}
              {m.fatigueMax ? ` · seuil ${m.fatigueMax} 🔒` : ' · seuil non renseigné'}
            </span>
          </span>
          <span className="puce puce--ambre">Déposer</span>
        </button>
      ))}

      <hr className="separateur" />

      <span className="etiquette">Ou créer à la volée</span>
      <div className="rangee">
        <label className="champ" style={{ flex: 2, minWidth: 140 }}>
          <span className="tres-discret">Nom</span>
          <input type="text" value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Carcasse" />
        </label>
        <label className="champ" style={{ flex: 1, minWidth: 90 }}>
          <span className="tres-discret">Évasion</span>
          <input
            type="number"
            min={0}
            value={evasion}
            onChange={(e) => setEvasion(Math.max(0, Number(e.target.value) || 0))}
          />
        </label>
        <label className="champ" style={{ flex: 1, minWidth: 90 }}>
          <span className="tres-discret">Seuil 🔒</span>
          <input
            type="number"
            min={0}
            value={fatigueMax || ''}
            placeholder="—"
            onChange={(e) => setFatigueMax(Math.max(0, Number(e.target.value) || 0))}
          />
        </label>
      </div>
      <button type="button" className="btn btn--large" onClick={ajouterALaVolee} disabled={!nom.trim()}>
        Ajouter au combat
      </button>
    </section>
  )
}
