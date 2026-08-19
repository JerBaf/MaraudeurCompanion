import { useEffect, useState } from 'react'

import { Icone } from '../../components/Icone.tsx'
import { ObjetDetaillable } from '../../components/ObjetDetaillable.tsx'
import { Passifs } from '../../components/Passifs.tsx'
import { VIES_SOULSHIFTER } from '../../content/seed.ts'
import {
  enregistrerPersonnage,
  journaliser,
  majJetons,
  modifierPersonnage,
  surCampfire,
  surSession,
} from '../../data/repo.ts'
import {
  acheter,
  grimoireValide,
  jetonsSessionVierges,
  peutAcheter,
  peutInvestir,
  peutPrendreFardeau,
  peutPrendreFardeauDesavantage,
  peutPrendreInvestissement,
  peutPrononcerSerment,
  peutRecueillir,
  prixDe,
  resoudrePriseInvestissement,
  TAILLE_GRIMOIRE,
  type ContexteCamp,
} from '../../domain/campfire.ts'
import type { Catalog } from '../../domain/catalog.ts'
import { modificateurFardeau, modificateurSerment } from '../../domain/modifiers.ts'
import { cryptoRng } from '../../domain/random.ts'
import {
  COMPETENCES,
  LIBELLE_COMPETENCE,
  LIBELLE_MAGIE,
  LIBELLE_PHASE,
  LIBELLE_SLOT,
  SLOTS_EQUIPEMENT,
  type Campfire,
  type Character,
  type EtatTable,
  type Session,
  type Sort,
} from '../../domain/types.ts'

/**
 * Contexte partagé par les vues de phase. Purement de la plomberie d'écran :
 * il n'a pas sa place dans le domaine.
 */
interface ProprietesPhase {
  char: Character
  catalog: Catalog
  campfire: Campfire
  session: Session | null
  ctx: ContexteCamp
  personnages: Character[]
}

/**
 * Le Feu de Camp, côté joueuse.
 *
 * La MJ pilote la phase ; cet écran ne montre que celle en cours. C'est ce que
 * demandent les guidelines, et cela garde la table groupée — personne n'achète
 * pendant le brief de mission.
 */
export function OngletCampfire({
  char,
  catalog,
  etat,
  personnages,
}: {
  char: Character
  catalog: Catalog
  etat: EtatTable
  personnages: Character[]
}) {
  const [campfire, setCampfire] = useState<Campfire | null>(null)
  const [session, setSession] = useState<Session | null>(null)

  useEffect(
    () => (etat.campfireId ? surCampfire(etat.campfireId, setCampfire) : undefined),
    [etat.campfireId],
  )
  useEffect(() => (etat.sessionId ? surSession(etat.sessionId, setSession) : undefined), [etat.sessionId])

  if (!campfire) return <p className="vide">La MJ n'a pas encore lancé le feu de camp.</p>

  const jetons = session?.jetons[char.id] ?? jetonsSessionVierges()
  const ctx = {
    jetons,
    // Le PDF réserve Recueillir et Serment au premier camp de la journée ;
    // un camp « fin de journée » clôt la journée écoulée, donc celui-ci l'ouvre.
    premierCampDuJour: campfire.finDeJournee,
    debutDeSession: campfire.debutDeSession,
  }

  const props: ProprietesPhase = { char, catalog, campfire, session, ctx, personnages }

  return (
    <div className="pile">
      <p className="phase-active">
        {LIBELLE_PHASE[campfire.phase]}
        <span className="tres-discret">
          {' '}
          · {campfire.finDeJournee ? 'fin de journée' : 'repos court'}
        </span>
      </p>

      {campfire.phase === 'banque' && <Banque {...props} />}
      {campfire.phase === 'brief' && <Brief campfire={campfire} />}
      {campfire.phase === 'boutique' && <Boutique {...props} />}
      {campfire.phase === 'grimoire' && <Grimoire {...props} />}
      {campfire.phase === 'armurerie' && <Armurerie char={char} catalog={catalog} />}
    </div>
  )
}

// ---------------------------------------------------------------------------

function Banque({ char, catalog, campfire, session, ctx }: ProprietesPhase) {
  const [message, setMessage] = useState<string | null>(null)
  const ouvert = peutInvestir(ctx)

  async function investir(investissementId: string) {
    const inv = catalog.investissement(investissementId)
    if (!inv || !session) return

    const { lumens, recit } = resoudrePriseInvestissement(inv, cryptoRng)
    await enregistrerPersonnage({
      ...char,
      lumens: Math.max(0, char.lumens + lumens),
      investissements: [
        ...char.investissements,
        { investissementId: inv.id, sessionNumero: campfire.sessionNumero },
      ],
    })
    await majJetons(session, char.id, { investissementPris: inv.id })
    await journaliser(char.nom, 'investissement', `${char.nom} investit — ${recit}`)
    setMessage(recit)
  }

  return (
    <section className="carte pile pile--serree">
      <div className="carte__titre">
        <span className="etiquette">Banque</span>
        <span className="tres-discret">{char.lumens} ʟ</span>
      </div>

      {!ouvert && (
        <p className="alerte alerte--info">
          {ctx.jetons.investissementPris
            ? 'Vous avez déjà investi cette session.'
            : "La Banque n'est ouverte qu'au premier feu de camp de la session."}
        </p>
      )}

      {message && <p className="alerte alerte--info">{message}</p>}

      {campfire.investissementsProposes.length === 0 && (
        <p className="vide">Aucun investissement proposé.</p>
      )}

      {campfire.investissementsProposes.map((id) => {
        const inv = catalog.investissement(id)
        if (!inv) return null
        const verdict = peutPrendreInvestissement(char, inv, campfire.sessionNumero)
        const possible = ouvert && verdict.possible

        return (
          <div key={inv.id}>
            <ObjetDetaillable
              icone={inv.icone}
              nom={inv.nom}
              meta={`${inv.cout} ʟ · ${inv.beneficeTexte}`}
              detail={`Risque — ${inv.risqueTexte}\nLimite — ${inv.limiteTexte}`}
              indisponible={!possible}
            />
            <button
              type="button"
              className="btn btn--large"
              style={{ marginTop: 6 }}
              disabled={!possible}
              onClick={() => void investir(inv.id)}
            >
              {possible ? `Investir ${inv.cout} ʟ` : (verdict.raison ?? 'Indisponible')}
            </button>
          </div>
        )
      })}
    </section>
  )
}

// ---------------------------------------------------------------------------

function Brief({ campfire }: { campfire: Campfire }) {
  return (
    <section className="carte pile">
      <span className="etiquette">Brief de mission</span>
      {campfire.brief.trim() ? (
        <p style={{ margin: 0, whiteSpace: 'pre-line' }}>{campfire.brief}</p>
      ) : (
        <p className="vide">La MJ n'a rien écrit — elle vous le dira de vive voix.</p>
      )}
      <p className="tres-discret" style={{ margin: 0 }}>
        Orientez vos choix de Grimoire et d'Armurerie là-dessus.
      </p>
    </section>
  )
}

// ---------------------------------------------------------------------------

function Boutique({ char, catalog, campfire, session, ctx }: ProprietesPhase) {
  const [message, setMessage] = useState<string | null>(null)
  const offres = (campfire.offres[char.id] ?? []).map((id) => catalog.entree(id)).filter(Boolean)

  async function acquerir(entreeId: string) {
    const entree = catalog.entree(entreeId)
    if (!entree || !session) return
    try {
      await enregistrerPersonnage(acheter(char, entree))
      await majJetons(session, char.id, { achatFaitCeCamp: true })
      await journaliser(char.nom, 'achat', `${char.nom} acquiert ${entree.nom} (${prixDe(entree)} ʟ).`)
      setMessage(`${entree.nom} est à vous.`)
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Achat impossible.')
    }
  }

  return (
    <section className="carte pile pile--serree">
      <div className="carte__titre">
        <span className="etiquette">Boutique</span>
        <span className="tres-discret">{char.lumens} ʟ · une acquisition par feu de camp</span>
      </div>

      {ctx.jetons.achatFaitCeCamp && (
        <p className="alerte alerte--info">Vous avez déjà fait votre acquisition à ce feu de camp.</p>
      )}
      {message && <p className="alerte alerte--info">{message}</p>}

      {offres.length === 0 && <p className="vide">Rien ne vous est proposé.</p>}

      {offres.map((entree) => {
        const prix = prixDe(entree!) ?? 0
        const possible = peutAcheter(ctx, char, prix)
        return (
          <div key={entree!.id}>
            <ObjetDetaillable
              icone={entree!.icone}
              nom={entree!.nom}
              meta={`${prix} ʟ`}
              detail={entree!.description ?? (entree!.kind === 'sort' ? entree!.effet : undefined)}
              indisponible={!possible}
            />
            <button
              type="button"
              className="btn btn--large"
              style={{ marginTop: 6 }}
              disabled={!possible}
              onClick={() => void acquerir(entree!.id)}
            >
              {char.lumens < prix ? 'Lumens insuffisants' : `Acquérir — ${prix} ʟ`}
            </button>
          </div>
        )
      })}
    </section>
  )
}

// ---------------------------------------------------------------------------

function Grimoire({ char, catalog, session, ctx, personnages }: ProprietesPhase) {
  const sorts = char.possede.sorts
    .map((id) => catalog.sort(id))
    .filter((s): s is Sort => Boolean(s) && s!.illusion !== true)

  function basculer(id: string) {
    void modifierPersonnage(char, (c) => {
      if (c.grimoire.includes(id)) return { ...c, grimoire: c.grimoire.filter((s) => s !== id) }
      // La règle des 3 emplacements est portée par le domaine, pas réécrite ici.
      const suivant = [...c.grimoire, id]
      return grimoireValide(suivant) ? { ...c, grimoire: suivant } : c
    })
  }

  return (
    <div className="pile">
      <section className="carte pile pile--serree">
        <div className="carte__titre">
          <span className="etiquette">Grimoire</span>
          <span className="tres-discret">
            {char.grimoire.length}/{TAILLE_GRIMOIRE} · figé jusqu'au prochain feu de camp
          </span>
        </div>

        {sorts.length === 0 && <p className="vide">Aucun sort connu.</p>}
        {sorts.map((sort) => {
          const actif = char.grimoire.includes(sort.id)
          const plein = char.grimoire.length >= TAILLE_GRIMOIRE
          return (
            <button
              key={sort.id}
              type="button"
              className={`objet ${actif ? 'objet--actif' : ''} ${!actif && plein ? 'objet--indisponible' : ''}`}
              aria-pressed={actif}
              disabled={!actif && plein}
              onClick={() => basculer(sort.id)}
              title={sort.effet}
            >
              <Icone nom={sort.icone} taille={28} />
              <span className="objet__corps">
                <span className="objet__nom">{sort.nom}</span>
                <span className="objet__meta">
                  {LIBELLE_MAGIE[sort.magie]} · {sort.duree}
                </span>
              </span>
              {actif && <span className="puce puce--ambre">Préparé</span>}
            </button>
          )
        })}
      </section>

      <Passifs char={char} catalog={catalog} vies={VIES_SOULSHIFTER} maj={(t) => void modifierPersonnage(char, t)} autoriserToutChanger />

      <GainsDeFoi char={char} session={session} ctx={ctx} personnages={personnages} />
    </div>
  )
}

// ---------------------------------------------------------------------------

function GainsDeFoi({
  char,
  session,
  ctx,
  personnages,
}: Pick<ProprietesPhase, 'char' | 'session' | 'ctx' | 'personnages'>) {
  const [texte, setTexte] = useState('')
  const [cibleFardeau, setCibleFardeau] = useState('')
  const [message, setMessage] = useState<string | null>(null)

  const ajouterFoi = (n: number) => Math.min(9, char.foi + n)

  async function recueillir() {
    if (!session || texte.trim().length === 0) return
    await enregistrerPersonnage({ ...char, foi: ajouterFoi(2) })
    await majJetons(session, char.id, { recueillirUtilise: true })
    await journaliser(char.nom, 'recueillir', `${char.nom} se recueille : « ${texte.trim()} »`)
    setMessage('+2 Points de Foi. Votre texte est parvenu à la MJ.')
    setTexte('')
  }

  async function fardeauDesavantage(competence: (typeof COMPETENCES)[number]) {
    if (!session) return
    await enregistrerPersonnage({
      ...char,
      foi: ajouterFoi(3),
      modifiers: [...char.modifiers, modificateurFardeau(competence)],
    })
    await majJetons(session, char.id, { fardeauUtilise: true })
    await journaliser(char.nom, 'fardeau', `${char.nom} prend un fardeau : désavantage en ${LIBELLE_COMPETENCE[competence]}.`)
    setMessage(`+3 Points de Foi. Désavantage en ${LIBELLE_COMPETENCE[competence]} pour la journée.`)
  }

  async function fardeauFatigue() {
    if (!session || !cibleFardeau) return
    const couverte = personnages.find((p) => p.id === cibleFardeau)
    await enregistrerPersonnage({
      ...char,
      foi: ajouterFoi(3),
      fatigue: { ...char.fatigue, coches: Math.min(char.fatigue.max, char.fatigue.coches + 1) },
    })
    await majJetons(session, char.id, { fardeauUtilise: true })
    await journaliser(
      char.nom,
      'fardeau',
      `${char.nom} prend un Point de Fatigue à la place de ${couverte?.nom ?? 'une alliée'}.`,
    )
    setMessage(`+3 Points de Foi, et un Point de Fatigue pris pour ${couverte?.nom ?? 'une alliée'}.`)
  }

  async function serment() {
    if (!session) return
    // La compétence épargnée est tirée par l'app : c'est un des cas où
    // l'impartialité prime sur le plaisir de lancer un dé.
    const epargnee = cryptoRng.pick(COMPETENCES)
    await enregistrerPersonnage({
      ...char,
      foi: ajouterFoi(4),
      modifiers: [...char.modifiers, modificateurSerment(epargnee)],
    })
    await majJetons(session, char.id, { sermentUtilise: true })
    await journaliser(char.nom, 'serment', `${char.nom} prononce un serment : ${LIBELLE_COMPETENCE[epargnee]} épargnée.`)
    setMessage(`+4 Points de Foi. ${LIBELLE_COMPETENCE[epargnee]} est épargnée, les autres subissent −4.`)
  }

  const allies = personnages.filter((p) => p.id !== char.id)

  return (
    <section className="carte pile pile--serree">
      <div className="carte__titre">
        <span className="etiquette">Points de Foi</span>
        <span className="tres-discret">{char.foi} / 9</span>
      </div>

      {message && <p className="alerte alerte--info">{message}</p>}

      {/* --- Recueillir --- */}
      <div className="pile pile--serree">
        <span className="objet__nom">Recueillir · +2</span>
        {peutRecueillir(ctx) ? (
          <>
            <p className="tres-discret" style={{ margin: 0 }}>
              Écrivez 2 à 3 phrases sur la thématique annoncée par la MJ.
            </p>
            <textarea value={texte} onChange={(e) => setTexte(e.target.value)} />
            <button
              type="button"
              className="btn"
              disabled={texte.trim().length === 0}
              onClick={() => void recueillir()}
            >
              Se recueillir
            </button>
          </>
        ) : (
          <p className="tres-discret" style={{ margin: 0 }}>
            Réservé au premier feu de camp de la journée, une fois par session.
          </p>
        )}
      </div>

      <hr className="separateur" />

      {/* --- Fardeau --- */}
      <div className="pile pile--serree">
        <span className="objet__nom">Fardeau · +3</span>
        {peutPrendreFardeau(ctx) ? (
          <>
            {peutPrendreFardeauDesavantage(ctx) && (
              <>
                <p className="tres-discret" style={{ margin: 0 }}>
                  Un désavantage sur une compétence, pour la journée :
                </p>
                <div className="rangee">
                  {COMPETENCES.map((c) => (
                    <button
                      key={c}
                      type="button"
                      className="btn"
                      onClick={() => void fardeauDesavantage(c)}
                    >
                      {LIBELLE_COMPETENCE[c]}
                    </button>
                  ))}
                </div>
              </>
            )}
            <p className="tres-discret" style={{ margin: 0 }}>
              Ou prendre un Point de Fatigue à la place d'une alliée :
            </p>
            <div className="rangee">
              <select
                value={cibleFardeau}
                onChange={(e) => setCibleFardeau(e.target.value)}
                style={{ flex: 1, minHeight: 44 }}
              >
                <option value="">— pour qui ? —</option>
                {allies.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nom}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="btn"
                disabled={!cibleFardeau}
                onClick={() => void fardeauFatigue()}
              >
                Se sacrifier
              </button>
            </div>
          </>
        ) : (
          <p className="tres-discret" style={{ margin: 0 }}>
            Déjà pris cette session.
          </p>
        )}
      </div>

      <hr className="separateur" />

      {/* --- Serment --- */}
      <div className="pile pile--serree">
        <span className="objet__nom">Serment · +4</span>
        {peutPrononcerSerment(ctx) ? (
          <>
            <p className="tres-discret" style={{ margin: 0 }}>
              Une compétence sera tirée au sort et épargnée ; les trois autres subiront −4 jusqu'à
              la fin de la journée.
            </p>
            <button type="button" className="btn btn--danger" onClick={() => void serment()}>
              Prononcer le serment
            </button>
          </>
        ) : (
          <p className="tres-discret" style={{ margin: 0 }}>
            Réservé au premier feu de camp de la journée, une fois par session.
          </p>
        )}
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------

function Armurerie({ char, catalog }: { char: Character; catalog: Catalog }) {
  return (
    <section className="carte pile pile--serree">
      <div className="carte__titre">
        <span className="etiquette">Armurerie</span>
        <span className="tres-discret">3 emplacements</span>
      </div>
      <p className="discret" style={{ margin: 0 }}>
        Ce que vous portez pendant la session à venir. Le reste attend dans votre sac à dos.
      </p>

      {SLOTS_EQUIPEMENT.map((slot) => {
        const candidats = char.possede.equipements
          .map((id) => catalog.equipement(id))
          .filter((e): e is NonNullable<typeof e> => Boolean(e) && e!.slot === slot && !e!.materielDeBase)

        return (
          <label key={slot} className="champ">
            <span className="etiquette">{LIBELLE_SLOT[slot]}</span>
            <select
              value={char.equipe[slot] ?? ''}
              onChange={(e) =>
                void modifierPersonnage(char, (c) => ({
                  ...c,
                  equipe: { ...c.equipe, [slot]: e.target.value || null },
                }))
              }
            >
              <option value="">— vide —</option>
              {candidats.map((eq) => (
                <option key={eq.id} value={eq.id}>
                  {eq.nom}
                  {eq.bonusEvasion ? ` (Évasion +${eq.bonusEvasion})` : ''}
                </option>
              ))}
            </select>
          </label>
        )
      })}
    </section>
  )
}
