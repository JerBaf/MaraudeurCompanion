import { useEffect, useState } from 'react'

import { Icone } from '../../components/Icone.tsx'
import {
  abandonnerBrouillon,
  creerBrouillonPourSession,
  definirPhase,
  enregistrerBrouillon,
  lancerCampfire,
  ouvrirSession,
  surBrouillonCampfire,
  surCampfire,
  surSession,
  terminerCampfire,
  type BilanOuverture,
} from '../../data/repo.ts'
import { entreesAchetables, prixDe, tirerOffres } from '../../domain/campfire.ts'
import type { Catalog } from '../../domain/catalog.ts'
import { cryptoRng } from '../../domain/random.ts'
import {
  LIBELLE_PHASE,
  PHASES_CAMPFIRE,
  type Campfire,
  type Character,
  type EtatTable,
  type Session,
} from '../../domain/types.ts'

/**
 * Pilotage du Feu de Camp, côté MJ.
 *
 * Trois temps successifs : ouvrir la session (les investissements rendent leurs
 * comptes), préparer le camp à l'abri des regards, puis le lancer et mener la
 * table de phase en phase.
 *
 * 🔒 La préparation vit dans la collection réservée à la MJ : tant que le camp
 * n'est pas lancé, ni le brief ni les offres n'existent côté joueuse.
 */
export function PanneauCampfire({
  etat,
  personnages,
  catalog,
}: {
  etat: EtatTable
  personnages: Character[]
  catalog: Catalog
}) {
  const [session, setSession] = useState<Session | null>(null)
  const [brouillon, setBrouillon] = useState<Campfire | null>(null)
  const [campfire, setCampfire] = useState<Campfire | null>(null)
  const [bilan, setBilan] = useState<BilanOuverture | null>(null)

  useEffect(() => (etat.sessionId ? surSession(etat.sessionId, setSession) : undefined), [etat.sessionId])
  useEffect(() => surBrouillonCampfire(setBrouillon), [])
  useEffect(() => (etat.campfireId ? surCampfire(etat.campfireId, setCampfire) : setCampfire(null) as void), [etat.campfireId])

  // --- Camp en cours : on pilote ---
  if (etat.campfireId && campfire) {
    return (
      <PilotageCamp
        etat={etat}
        campfire={campfire}
        personnages={personnages}
        catalog={catalog}
        session={session}
      />
    )
  }

  return (
    <div className="pile">
      <Ouverture etat={etat} personnages={personnages} session={session} bilan={bilan} onBilan={setBilan} />

      {session && (
        <Preparation
          etat={etat}
          session={session}
          brouillon={brouillon}
          personnages={personnages}
          catalog={catalog}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------

function Ouverture({
  etat,
  personnages,
  session,
  bilan,
  onBilan,
}: {
  etat: EtatTable
  personnages: Character[]
  session: Session | null
  bilan: BilanOuverture | null
  onBilan: (b: BilanOuverture) => void
}) {
  const [enCours, setEnCours] = useState(false)

  async function ouvrir() {
    // Ouvrir une session verse les revenus et tire les risques : le faire deux
    // fois paierait deux fois les loyers. On confirme dès qu'une session existe.
    if (
      session &&
      !confirm(
        `La session ${session.numero} est déjà ouverte. En ouvrir une nouvelle versera à nouveau les revenus d'investissement et retirera les risques. Continuer ?`,
      )
    ) {
      return
    }

    setEnCours(true)
    try {
      onBilan(await ouvrirSession(etat, personnages))
    } finally {
      setEnCours(false)
    }
  }

  return (
    <section className="carte pile">
      <div className="carte__titre">
        <span className="etiquette">Session</span>
        {session && <span className="tres-discret">n° {session.numero}</span>}
      </div>

      <p className="discret" style={{ margin: 0 }}>
        Ouvrir une session résout les investissements en attente — loyers, cargaisons,
        rénovations — et déverrouille la Banque pour le premier feu de camp.
      </p>

      <button
        type="button"
        className={`btn btn--large ${session ? '' : 'btn--principal'}`}
        onClick={() => void ouvrir()}
        disabled={enCours}
      >
        {enCours ? 'Résolution…' : session ? `Ouvrir la session ${session.numero + 1}` : 'Ouvrir une nouvelle session'}
      </button>

      {bilan && (
        <div className="pile pile--serree">
          <hr className="separateur" />
          <span className="etiquette">Bilan des investissements</span>
          {bilan.bilans.every((b) => b.bilan.lignes.length === 0) && (
            <p className="tres-discret" style={{ margin: 0 }}>
              Aucun investissement en cours.
            </p>
          )}
          {bilan.bilans
            .filter((b) => b.bilan.lignes.length > 0)
            .map(({ char, bilan: b }) => (
              <div key={char.id} className="objet">
                <span className="objet__corps">
                  <span className="objet__nom">
                    {char.nom} — {b.total >= 0 ? '+' : ''}
                    {b.total} ʟ
                  </span>
                  {b.lignes.map((l, i) => (
                    <span key={i} className="objet__meta">
                      {l.nom} : {l.recit}
                    </span>
                  ))}
                </span>
              </div>
            ))}
        </div>
      )}
    </section>
  )
}

// ---------------------------------------------------------------------------

function Preparation({
  etat,
  session,
  brouillon,
  personnages,
  catalog,
}: {
  etat: EtatTable
  session: Session
  brouillon: Campfire | null
  personnages: Character[]
  catalog: Catalog
}) {
  const investissements = catalog.investissements()

  function creer() {
    // La Banque s'ouvre au premier camp de chaque session — c'est
    // `creerBrouillonPourSession` qui le détermine, en regardant les camps déjà
    // lancés plutôt que le numéro de journée.
    void creerBrouillonPourSession(session.numero).then(enregistrerBrouillon)
  }

  if (!brouillon) {
    return (
      <section className="carte pile">
        <span className="etiquette">Feu de camp</span>
        <p className="discret" style={{ margin: 0 }}>
          Vous préparerez le brief, les investissements proposés et les offres de boutique avant de
          lancer. Rien n'apparaît sur l'écran des joueuses tant que vous n'avez pas lancé.
        </p>
        <button type="button" className="btn btn--principal btn--large" onClick={creer}>
          Préparer un feu de camp
        </button>
      </section>
    )
  }

  const maj = (patch: Partial<Campfire>) => void enregistrerBrouillon({ ...brouillon, ...patch })

  return (
    <section className="carte pile">
      <div className="carte__titre">
        <span className="etiquette">Feu de camp — préparation</span>
        <span className="puce puce--info">non lancé</span>
      </div>

      <div className="rangee">
        <button
          type="button"
          className={`btn ${brouillon.finDeJournee ? '' : 'btn--principal'}`}
          onClick={() => maj({ finDeJournee: false })}
        >
          Repos court
        </button>
        <button
          type="button"
          className={`btn ${brouillon.finDeJournee ? 'btn--principal' : ''}`}
          onClick={() => maj({ finDeJournee: true })}
        >
          Fin de journée
        </button>
      </div>
      <p className="tres-discret" style={{ margin: 0 }}>
        {brouillon.finDeJournee
          ? 'Rendra le 6th Sens et les Actions Rapides, et lèvera Fardeaux, Serments et Marques journalières.'
          : 'Rendra la Fatigue et les cristaux épuisés, rien de plus.'}
      </p>

      <label className="champ">
        <span className="etiquette">Brief de mission</span>
        <textarea
          value={brouillon.brief}
          onChange={(e) => maj({ brief: e.target.value })}
          placeholder="Un teaser de la session à venir : les joueuses orienteront leur Grimoire et leur Armurerie dessus."
        />
      </label>

      <div className="rangee rangee--entre">
        <span className="etiquette">Banque</span>
        <button
          type="button"
          className={`btn ${brouillon.debutDeSession ? 'btn--principal' : ''}`}
          onClick={() => maj({ debutDeSession: !brouillon.debutDeSession })}
        >
          {brouillon.debutDeSession ? 'Ouverte' : 'Fermée'}
        </button>
      </div>

      {brouillon.debutDeSession && (
        <div className="pile pile--serree">
          {investissements.length === 0 && (
            <p className="tres-discret" style={{ margin: 0 }}>
              Aucun investissement au catalogue. Ajoutez-en dans l'onglet Réglages.
            </p>
          )}
          {investissements.map((inv) => {
            const propose = brouillon.investissementsProposes.includes(inv.id)
            return (
              <button
                key={inv.id}
                type="button"
                className={`objet ${propose ? 'objet--actif' : ''}`}
                aria-pressed={propose}
                onClick={() =>
                  maj({
                    investissementsProposes: propose
                      ? brouillon.investissementsProposes.filter((i) => i !== inv.id)
                      : [...brouillon.investissementsProposes, inv.id],
                  })
                }
              >
                <Icone nom={inv.icone} taille={28} />
                <span className="objet__corps">
                  <span className="objet__nom">{inv.nom}</span>
                  <span className="objet__meta">
                    {inv.cout} ʟ · {inv.beneficeTexte}
                  </span>
                </span>
                {propose && <span className="puce puce--ambre">Proposé</span>}
              </button>
            )
          })}
        </div>
      )}

      <hr className="separateur" />

      <Offres brouillon={brouillon} personnages={personnages} catalog={catalog} onMaj={maj} />

      <hr className="separateur" />

      <button
        type="button"
        className="btn btn--principal btn--large"
        onClick={() => void lancerCampfire(etat, brouillon, personnages)}
      >
        Lancer le feu de camp
      </button>
      <button
        type="button"
        className="btn btn--fantome btn--large"
        onClick={() => {
          if (confirm('Abandonner cette préparation ?')) void abandonnerBrouillon()
        }}
      >
        Abandonner
      </button>
    </section>
  )
}

// ---------------------------------------------------------------------------

function Offres({
  brouillon,
  personnages,
  catalog,
  onMaj,
}: {
  brouillon: Campfire
  personnages: Character[]
  catalog: Catalog
  onMaj: (patch: Partial<Campfire>) => void
}) {
  function tirerTout() {
    const offres: Record<string, string[]> = {}
    for (const char of personnages) offres[char.id] = tirerOffres(char, catalog, cryptoRng, 3)
    onMaj({ offres })
  }

  function remplacer(charId: string, index: number, entreeId: string) {
    const actuelles = brouillon.offres[charId] ?? []
    const suivantes = [...actuelles]
    suivantes[index] = entreeId
    onMaj({ offres: { ...brouillon.offres, [charId]: suivantes } })
  }

  return (
    <div className="pile pile--serree">
      <div className="carte__titre" style={{ marginBottom: 0 }}>
        <span className="etiquette">Boutique — 3 offres par joueuse</span>
        <button type="button" className="btn" onClick={tirerTout}>
          Tirer les offres
        </button>
      </div>

      {personnages.length === 0 && <p className="vide">Aucune joueuse à la table.</p>}

      {personnages.map((char) => {
        const offres = brouillon.offres[char.id] ?? []
        const candidats = entreesAchetables(char, catalog)

        return (
          <div key={char.id} className="pile pile--serree">
            <span className="tres-discret">
              {char.nom} — {char.lumens} ʟ
            </span>
            {[0, 1, 2].map((i) => (
              <select
                key={i}
                value={offres[i] ?? ''}
                onChange={(e) => remplacer(char.id, i, e.target.value)}
                style={{ minHeight: 40 }}
              >
                <option value="">— vide —</option>
                {candidats.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.nom} — {prixDe(e)} ʟ
                  </option>
                ))}
              </select>
            ))}
          </div>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------

function PilotageCamp({
  etat,
  campfire,
  personnages,
  catalog,
  session,
}: {
  etat: EtatTable
  campfire: Campfire
  personnages: Character[]
  catalog: Catalog
  session: Session | null
}) {
  const phases = campfire.debutDeSession
    ? PHASES_CAMPFIRE
    : PHASES_CAMPFIRE.filter((p) => p !== 'banque')

  return (
    <div className="pile">
      <section className="carte pile">
        <div className="carte__titre">
          <span className="etiquette">
            Feu de camp — {campfire.finDeJournee ? 'fin de journée' : 'repos court'}
          </span>
          <span className="tres-discret">{LIBELLE_PHASE[campfire.phase]}</span>
        </div>

        <div className="onglets" role="group" aria-label="Phase du feu de camp">
          {phases.map((p) => (
            <button
              key={p}
              type="button"
              className={`onglet ${campfire.phase === p ? 'onglet--actif' : ''}`}
              onClick={() => void definirPhase(campfire, p)}
            >
              {LIBELLE_PHASE[p]}
            </button>
          ))}
        </div>

        <p className="tres-discret" style={{ margin: 0 }}>
          L'écran des joueuses suit la phase que vous choisissez.
        </p>

        <button
          type="button"
          className="btn btn--danger btn--large"
          onClick={() => {
            if (confirm('Terminer le feu de camp et revenir en mode Standard ?')) {
              void terminerCampfire(etat)
            }
          }}
        >
          Terminer le feu de camp
        </button>
      </section>

      <section className="carte pile pile--serree">
        <span className="etiquette">Choix des joueuses</span>
        {personnages.map((char) => {
          const jetons = session?.jetons[char.id]
          const offres = (campfire.offres[char.id] ?? [])
            .map((id) => catalog.entree(id))
            .filter(Boolean)

          return (
            <div key={char.id} className="objet">
              <span className="objet__corps">
                <span className="objet__nom">
                  {char.nom} — {char.lumens} ʟ · Foi {char.foi}
                </span>
                <span className="objet__meta">
                  Grimoire {char.grimoire.length}/3 · équipé{' '}
                  {Object.values(char.equipe).filter(Boolean).length}/3
                </span>
                <span className="objet__meta">
                  Offres : {offres.map((e) => e!.nom).join(', ') || 'aucune'}
                </span>
                {jetons && (
                  <span className="objet__meta">
                    {jetons.achatFaitCeCamp ? 'a acheté · ' : ''}
                    {jetons.recueillirUtilise ? 'Recueillir · ' : ''}
                    {jetons.fardeauUtilise ? 'Fardeau · ' : ''}
                    {jetons.sermentUtilise ? 'Serment · ' : ''}
                    {jetons.investissementPris ? `investi (${jetons.investissementPris})` : ''}
                  </span>
                )}
              </span>
            </div>
          )
        })}
      </section>
    </div>
  )
}
