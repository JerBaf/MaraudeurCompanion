import { useEffect, useState } from 'react'

import { Icone } from '../../components/Icone.tsx'
import {
  abandonnerBrouillon,
  creerBrouillon,
  definirPhase,
  enregistrerBrouillon,
  enregistrerCampfire,
  lancerCampfire,
  surBrouillonCampfire,
  surCampfire,
  surSession,
  terminerCampfire,
  type LigneOuverture,
} from '../../data/repo.ts'
import {
  entreesAchetables,
  phasesDuCamp,
  prixDe,
  PROFILS_CAMP,
  tirerOffres,
} from '../../domain/campfire.ts'
import type { Catalog } from '../../domain/catalog.ts'
import { cryptoRng } from '../../domain/random.ts'
import {
  LIBELLE_PHASE,
  type Campfire,
  type Character,
  type EtatTable,
  type Session,
  type TypeCamp,
} from '../../domain/types.ts'
import { OngletCampfire } from '../joueuse/OngletCampfire.tsx'

/**
 * Pilotage du Feu de Camp, côté MJ.
 *
 * Deux temps : préparer le camp à l'abri des regards, puis le lancer et mener
 * la table de phase en phase. Lancer un camp **initial** ouvre la session par
 * la même occasion — les investissements y rendent leurs comptes.
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
  const [ouverture, setOuverture] = useState<LigneOuverture[] | null>(null)

  useEffect(
    () => (etat.sessionId ? surSession(etat.sessionId, setSession) : setSession(null) as void),
    [etat.sessionId],
  )
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
        ouverture={ouverture}
      />
    )
  }

  return (
    <div className="pile">
      <Preparation
        etat={etat}
        session={session}
        brouillon={brouillon}
        personnages={personnages}
        catalog={catalog}
        onOuverture={setOuverture}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------

/** Ce que les investissements ont rendu à l'ouverture de la session. */
function BilanOuverture({ ouverture }: { ouverture: LigneOuverture[] }) {
  return (
    <div className="pile pile--serree">
      <span className="etiquette">Bilan des investissements</span>
      {ouverture.length === 0 && (
        <p className="tres-discret" style={{ margin: 0 }}>
          Aucun investissement en cours.
        </p>
      )}
      {ouverture.map(({ char, bilan }) => (
        <div key={char.id} className="objet">
          <span className="objet__corps">
            <span className="objet__nom">
              {char.nom} — {bilan.total >= 0 ? '+' : ''}
              {bilan.total} ʟ
            </span>
            {bilan.lignes.map((l, i) => (
              <span key={i} className="objet__meta">
                {l.nom} : {l.recit}
              </span>
            ))}
          </span>
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------

function Preparation({
  etat,
  session,
  brouillon,
  personnages,
  catalog,
  onOuverture,
}: {
  etat: EtatTable
  session: Session | null
  brouillon: Campfire | null
  personnages: Character[]
  catalog: Catalog
  onOuverture: (o: LigneOuverture[]) => void
}) {
  const investissements = catalog.investissements()
  const [lancement, setLancement] = useState(false)

  function creer() {
    void creerBrouillon(session).then(enregistrerBrouillon)
  }

  if (!brouillon) {
    return (
      <section className="carte pile">
        <div className="carte__titre">
          <span className="etiquette">Feu de camp</span>
          <span className="tres-discret">
            {session ? `session ${session.numero} en cours` : 'aucune session ouverte'}
          </span>
        </div>
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

  // Le numéro annoncé se dérive du type choisi, et non du brouillon : celui-ci
  // a été figé à sa création, et basculer sur « initial » aurait continué
  // d'afficher la session en cours. C'est `lancerCampfire` qui tranche.
  const numeroAnnonce =
    brouillon.type === 'initial' ? (session?.numero ?? 0) + 1 : (session?.numero ?? 1)

  return (
    <section className="carte pile">
      <div className="carte__titre">
        <span className="etiquette">Feu de camp — préparation</span>
        <span className="puce puce--info">non lancé</span>
      </div>

      {/* Le type du camp commande tout le reste : les phases ouvertes, la
          Fatigue rendue, les gains de Foi, et l'ouverture d'une session. */}
      <div className="rangee">
        {(['initial', 'repos-court'] as TypeCamp[]).map((t) => (
          <button
            key={t}
            type="button"
            className={`btn ${brouillon.type === t ? 'btn--principal' : ''}`}
            onClick={() => maj({ type: t, phase: PROFILS_CAMP[t].phases[0] })}
          >
            {PROFILS_CAMP[t].libelle}
          </button>
        ))}
      </div>
      <p className="tres-discret" style={{ margin: 0 }}>
        {brouillon.type === 'initial'
          ? `Ouvrira la session ${numeroAnnonce} : investissements réglés, Fatigue rendue d'un point, 6th Sens et Actions Rapides restaurés, Fardeaux, Serments et Marques levés, Points de Foi remis à 2. Donne accès à la Banque, au Brief et aux gains de Foi.`
          : `Halte au cours de la session ${numeroAnnonce} : Boutique, Grimoire et Armurerie. Rend les cristaux épuisés, mais aucune Fatigue.`}
      </p>

      {brouillon.type === 'repos-court' && !session && (
        <p className="alerte alerte--info">
          Aucune session n'est ouverte. Un repos court n'en ouvre pas : lancez un feu de camp
          initial pour commencer la session.
        </p>
      )}

      {brouillon.type === 'initial' && (
        <label className="champ">
          <span className="etiquette">Brief de mission</span>
          <textarea
            key={brouillon.id}
            defaultValue={brouillon.brief}
            onBlur={(e) => maj({ brief: e.target.value })}
            placeholder="Un teaser de la session à venir : les joueuses orienteront leur Grimoire et leur Armurerie dessus."
          />
        </label>
      )}

      {brouillon.type === 'initial' && (
        <div className="pile pile--serree">
          <span className="etiquette">Banque — investissements proposés</span>
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

      {/* Désactivé pendant l'écriture : deux clics rejoueraient la résolution du
          camp sur toutes les fiches. */}
      <button
        type="button"
        className="btn btn--principal btn--large"
        disabled={lancement}
        onClick={() => {
          setLancement(true)
          void lancerCampfire(etat, brouillon, personnages)
            .then((r) => onOuverture(r.ouverture))
            .finally(() => setLancement(false))
        }}
      >
        {lancement
          ? 'Lancement…'
          : brouillon.type === 'initial'
            ? `Lancer et ouvrir la session ${numeroAnnonce}`
            : 'Lancer le repos court'}
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
    const suivantes = [...(brouillon.offres[charId] ?? [])]
    suivantes[index] = entreeId
    // `suivantes` peut contenir des trous (index 2 renseigné sur un tableau
    // vide) ou deux fois la même entrée : on nettoie avant de persister.
    onMaj({
      offres: { ...brouillon.offres, [charId]: [...new Set(suivantes.filter(Boolean))] },
    })
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
  ouverture,
}: {
  etat: EtatTable
  campfire: Campfire
  personnages: Character[]
  catalog: Catalog
  /** Présent juste après le lancement d'un camp initial. */
  ouverture: LigneOuverture[] | null
}) {
  const [miroir, setMiroir] = useState('')
  const phases = phasesDuCamp(campfire.type)

  // La joueuse observée : celle choisie, sinon la première de la table.
  const observee = personnages.find((p) => p.id === miroir) ?? personnages[0]

  return (
    <div className="pile">
      <section className="carte pile">
        <div className="carte__titre">
          <span className="etiquette">Feu de camp — {PROFILS_CAMP[campfire.type].libelle}</span>
          <span className="tres-discret">
            session {campfire.sessionNumero} · {LIBELLE_PHASE[campfire.phase]}
          </span>
        </div>

        {ouverture && campfire.type === 'initial' && <BilanOuverture ouverture={ouverture} />}

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

      {/* Le miroir : exactement l'écran de la joueuse choisie, actions
          neutralisées, avec les contrôles d'édition du camp à leur place. */}
      {observee && (
        <section className="carte pile">
          <div className="carte__titre">
            <span className="etiquette">Écran de la joueuse</span>
            <select
              value={observee.id}
              onChange={(e) => setMiroir(e.target.value)}
              style={{ minHeight: 40 }}
            >
              {personnages.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nom}
                </option>
              ))}
            </select>
          </div>

          <OngletCampfire
            char={observee}
            catalog={catalog}
            etat={etat}
            personnages={personnages}
            campfire={campfire}
            edition={{ onMajCamp: (patch) => void enregistrerCampfire({ ...campfire, ...patch }) }}
          />
        </section>
      )}

      <section className="carte pile pile--serree">
        <span className="etiquette">Où en sont les joueuses</span>
        {personnages.map((char) => {
          const investi = char.investissements.find(
            (i) => i.sessionNumero === campfire.sessionNumero,
          )
          const consomme = [
            char.jetonsCamp.achat === campfire.id ? 'a acheté' : null,
            char.jetonsCamp.recueillir === campfire.sessionNumero ? 'Recueillir' : null,
            char.jetonsCamp.fardeau === campfire.sessionNumero ? 'Fardeau' : null,
            char.jetonsCamp.serment === campfire.sessionNumero ? 'Serment' : null,
            investi
              ? `investi (${catalog.investissement(investi.investissementId)?.nom ?? investi.investissementId})`
              : null,
          ].filter(Boolean)

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
                {consomme.length > 0 && (
                  <span className="objet__meta">{consomme.join(' · ')}</span>
                )}
              </span>
            </div>
          )
        })}
      </section>
    </div>
  )
}
