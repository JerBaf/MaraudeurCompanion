import { useEffect, useState } from 'react'

import { Icone } from '../../components/Icone.tsx'
import { ObjetDetaillable } from '../../components/ObjetDetaillable.tsx'
import { Passifs } from '../../components/Passifs.tsx'
import { THEMATIQUES_RECUEIL } from '../../content/recueil.ts'
import { VIES_SOULSHIFTER } from '../../content/seed.ts'
import { enregistrerPersonnage, journaliser, modifierPersonnage, surCampfire } from '../../data/repo.ts'
import {
  acheter,
  entreesAchetables,
  grimoireValide,
  peutAcheter,
  peutCouvrirLeFardeau,
  peutInvestir,
  peutPrendreFardeau,
  peutPrendreInvestissement,
  peutPrononcerSerment,
  peutRecueillir,
  prixDe,
  PROFILS_CAMP,
  resoudreFardeauFatigue,
  resoudrePriseInvestissement,
  TAILLE_GRIMOIRE,
  type ContexteCamp,
} from '../../domain/campfire.ts'
import type { Catalog } from '../../domain/catalog.ts'
import { resumeSort } from '../../domain/magie.ts'
import { MAX_FOI, modificateurFardeau, modificateurSerment } from '../../domain/modifiers.ts'
import { cryptoRng } from '../../domain/random.ts'
import {
  COMPETENCES,
  LIBELLE_COMPETENCE,
  LIBELLE_PHASE,
  LIBELLE_SLOT,
  SLOTS_EQUIPEMENT,
  type Campfire,
  type Character,
  type EtatTable,
  type Sort,
} from '../../domain/types.ts'

/**
 * Ce que la MJ peut retoucher sur un camp déjà lancé.
 *
 * Sa présence bascule l'écran en **miroir** : la MJ voit exactement ce que voit
 * la joueuse choisie, actions neutralisées, et dispose à la place des contrôles
 * d'édition du camp. C'est une seule prop parce que c'est une seule différence —
 * dupliquer les cinq écrans pour la MJ les aurait fait diverger.
 */
export interface EditionCamp {
  onMajCamp: (patch: Partial<Campfire>) => void
}

/**
 * Contexte partagé par les vues de phase. Purement de la plomberie d'écran :
 * il n'a pas sa place dans le domaine.
 */
interface ProprietesPhase {
  char: Character
  catalog: Catalog
  campfire: Campfire
  ctx: ContexteCamp
  personnages: Character[]
  edition?: EditionCamp
}

/** Construit le contexte de camp d'une joueuse. Tout se dérive de sa fiche et du camp. */
export function contexteCamp(char: Character, campfire: Campfire): ContexteCamp {
  return {
    jetons: char.jetonsCamp,
    type: campfire.type,
    campfireId: campfire.id,
    sessionNumero: campfire.sessionNumero,
  }
}

/**
 * Le Feu de Camp, côté joueuse — et, avec `edition`, le miroir de la MJ.
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
  campfire: campfireFourni,
  edition,
}: {
  char: Character
  catalog: Catalog
  etat: EtatTable
  personnages: Character[]
  /** Fourni par l'écran MJ, qui a déjà le camp sous la main. */
  campfire?: Campfire
  edition?: EditionCamp
}) {
  const [campfireSuivi, setCampfire] = useState<Campfire | null>(null)

  useEffect(
    () =>
      etat.campfireId && !campfireFourni
        ? surCampfire(etat.campfireId, setCampfire)
        : undefined,
    [etat.campfireId, campfireFourni],
  )

  const campfire = campfireFourni ?? campfireSuivi
  if (!campfire) return <p className="vide">La MJ n'a pas encore lancé le feu de camp.</p>

  const ctx = contexteCamp(char, campfire)
  const props: ProprietesPhase = { char, catalog, campfire, ctx, personnages, edition }

  return (
    <div className="pile">
      <p className="phase-active">
        {LIBELLE_PHASE[campfire.phase]}
        <span className="tres-discret"> · {PROFILS_CAMP[campfire.type].libelle}</span>
      </p>

      {campfire.phase === 'banque' && <Banque {...props} />}
      {campfire.phase === 'brief' && <Brief campfire={campfire} edition={edition} />}
      {campfire.phase === 'boutique' && <Boutique {...props} />}
      {campfire.phase === 'grimoire' && <Grimoire {...props} />}
      {campfire.phase === 'armurerie' && <Armurerie char={char} catalog={catalog} edition={edition} />}
    </div>
  )
}

// ---------------------------------------------------------------------------

function Banque({ char, catalog, campfire, ctx, edition }: ProprietesPhase) {
  const [message, setMessage] = useState<string | null>(null)
  const ouvert = peutInvestir(ctx, char)
  const dejaInvesti = char.investissements.some((i) => i.sessionNumero === campfire.sessionNumero)

  async function investir(investissementId: string) {
    const inv = catalog.investissement(investissementId)
    // Les gardes sont re-vérifiées ici : `disabled` protège l'écran, pas la règle.
    if (!inv || !ouvert || !peutPrendreInvestissement(char, inv, campfire.sessionNumero).possible) {
      return
    }

    const { lumens, recit } = resoudrePriseInvestissement(inv, cryptoRng)
    // Le registre des investissements sert lui-même de jeton : une seule
    // écriture, donc aucune fenêtre où le gain serait acquis sans la limite.
    await enregistrerPersonnage({
      ...char,
      lumens: Math.max(0, char.lumens + lumens),
      investissements: [
        ...char.investissements,
        { investissementId: inv.id, sessionNumero: campfire.sessionNumero },
      ],
    })
    await journaliser(char.nom, 'investissement', `${char.nom} investit — ${recit}`)
    setMessage(recit)
  }

  const proposables = catalog
    .investissements()
    .filter((i) => !campfire.investissementsProposes.includes(i.id))

  return (
    <section className="carte pile pile--serree">
      <div className="carte__titre">
        <span className="etiquette">Banque</span>
        <span className="tres-discret">{char.lumens} ʟ</span>
      </div>

      {!ouvert && (
        <p className="alerte alerte--info">
          {dejaInvesti
            ? 'Vous avez déjà investi cette session.'
            : "La Banque n'est ouverte qu'au feu de camp initial de la session."}
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
            {edition ? (
              <button
                type="button"
                className="btn"
                style={{ marginTop: 6 }}
                onClick={() =>
                  edition.onMajCamp({
                    investissementsProposes: campfire.investissementsProposes.filter((x) => x !== id),
                  })
                }
              >
                Retirer de la Banque
              </button>
            ) : (
              <button
                type="button"
                className="btn btn--large"
                style={{ marginTop: 6 }}
                disabled={!possible}
                onClick={() => void investir(inv.id)}
              >
                {possible ? `Investir ${inv.cout} ʟ` : (verdict.raison ?? 'Indisponible')}
              </button>
            )}
          </div>
        )
      })}

      {edition && proposables.length > 0 && (
        <label className="champ">
          <span className="etiquette">Proposer un investissement</span>
          <select
            value=""
            onChange={(e) =>
              e.target.value &&
              edition.onMajCamp({
                investissementsProposes: [...campfire.investissementsProposes, e.target.value],
              })
            }
          >
            <option value="">— ajouter —</option>
            {proposables.map((i) => (
              <option key={i.id} value={i.id}>
                {i.nom} — {i.cout} ʟ
              </option>
            ))}
          </select>
        </label>
      )}
    </section>
  )
}

// ---------------------------------------------------------------------------

function Brief({ campfire, edition }: { campfire: Campfire; edition?: EditionCamp }) {
  return (
    <section className="carte pile">
      <span className="etiquette">Brief de mission</span>

      {edition ? (
        // `defaultValue` + `onBlur` : un champ contrôlé sur un document souscrit
        // écrivait en base à chaque frappe, et le caret sautait au retour du
        // snapshot. Même parade que les notes de la MJ.
        <textarea
          key={campfire.id}
          rows={4}
          defaultValue={campfire.brief}
          onBlur={(e) => edition.onMajCamp({ brief: e.target.value })}
        />
      ) : campfire.brief.trim() ? (
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

function Boutique({ char, catalog, campfire, ctx, edition }: ProprietesPhase) {
  const [message, setMessage] = useState<string | null>(null)
  const ids = campfire.offres[char.id] ?? []
  const dejaAchete = char.jetonsCamp.achat === campfire.id

  async function acquerir(entreeId: string) {
    const entree = catalog.entree(entreeId)
    if (!entree) return
    const prix = prixDe(entree)
    if (prix === null || !peutAcheter(ctx, char, prix)) return

    try {
      // Achat et jeton dans la même écriture : l'ordre précédent créditait
      // l'objet puis échouait à poser la limite, ce qui rendait les achats
      // illimités tout en affichant « Achat impossible ».
      await enregistrerPersonnage({
        ...acheter(char, entree),
        jetonsCamp: { ...char.jetonsCamp, achat: campfire.id },
      })
      await journaliser(char.nom, 'achat', `${char.nom} acquiert ${entree.nom} (${prix} ʟ).`)
      setMessage(`${entree.nom} est à vous.`)
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Achat impossible.')
    }
  }

  function remplacer(index: number, entreeId: string) {
    const suivantes = [...ids]
    if (entreeId) suivantes[index] = entreeId
    else suivantes.splice(index, 1)
    // Un même objet deux fois dans la liste n'aurait aucun sens : on dédoublonne.
    edition?.onMajCamp({
      offres: { ...campfire.offres, [char.id]: [...new Set(suivantes.filter(Boolean))] },
    })
  }

  const candidats = entreesAchetables(char, catalog)

  return (
    <section className="carte pile pile--serree">
      <div className="carte__titre">
        <span className="etiquette">Boutique</span>
        <span className="tres-discret">{char.lumens} ʟ · une acquisition par feu de camp</span>
      </div>

      {dejaAchete && (
        <p className="alerte alerte--info">Vous avez déjà fait votre acquisition à ce feu de camp.</p>
      )}
      {message && <p className="alerte alerte--info">{message}</p>}

      {ids.length === 0 && <p className="vide">Rien ne vous est proposé.</p>}

      {ids.map((id, index) => {
        const entree = catalog.entree(id)
        if (!entree) return null
        const prix = prixDe(entree) ?? 0
        const possible = peutAcheter(ctx, char, prix)

        return (
          <div key={id}>
            <ObjetDetaillable
              icone={entree.icone}
              nom={entree.nom}
              meta={`${prix} ʟ`}
              detail={entree.description ?? (entree.kind === 'sort' ? entree.effet : undefined)}
              indisponible={!possible}
            />
            {edition ? (
              <select
                value={id}
                style={{ marginTop: 6 }}
                onChange={(e) => remplacer(index, e.target.value)}
              >
                <option value="">— retirer cette offre —</option>
                {[entree, ...candidats.filter((c) => c.id !== id)].map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nom} — {prixDe(c)} ʟ
                  </option>
                ))}
              </select>
            ) : (
              <button
                type="button"
                className="btn btn--large"
                style={{ marginTop: 6 }}
                disabled={!possible}
                onClick={() => void acquerir(id)}
              >
                {dejaAchete
                  ? 'Acquisition déjà faite'
                  : char.lumens < prix
                    ? 'Lumens insuffisants'
                    : `Acquérir — ${prix} ʟ`}
              </button>
            )}
          </div>
        )
      })}

      {edition && (
        <label className="champ">
          <span className="etiquette">Ajouter une offre</span>
          <select value="" onChange={(e) => e.target.value && remplacer(ids.length, e.target.value)}>
            <option value="">— ajouter —</option>
            {candidats
              .filter((c) => !ids.includes(c.id))
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nom} — {prixDe(c)} ʟ
                </option>
              ))}
          </select>
        </label>
      )}
    </section>
  )
}

// ---------------------------------------------------------------------------

function Grimoire({ char, catalog, ctx, personnages, edition }: ProprietesPhase) {
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
              disabled={Boolean(edition) || (!actif && plein)}
              onClick={() => basculer(sort.id)}
              title={sort.effet}
            >
              <Icone nom={sort.icone} taille={28} />
              <span className="objet__corps">
                <span className="objet__nom">{sort.nom}</span>
                <span className="objet__meta">{resumeSort(sort, char, catalog)}</span>
              </span>
              {actif && <span className="puce puce--ambre">Préparé</span>}
            </button>
          )
        })}

        {/* Les boutons ci-dessus basculent la préparation ; ils ne peuvent pas
            en plus déplier une description. La consultation vit donc à part. */}
        {sorts.length > 0 && (
          <>
            <hr className="separateur" />
            <span className="tres-discret">Ce que font vos sorts</span>
            {sorts.map((sort) => (
              <ObjetDetaillable
                key={sort.id}
                icone={sort.icone}
                nom={sort.nom}
                meta={resumeSort(sort, char, catalog)}
                detail={sort.effet}
                {...(char.grimoire.includes(sort.id)
                  ? { puce: <span className="puce puce--ambre">Préparé</span> }
                  : {})}
              />
            ))}
          </>
        )}
      </section>

      <Passifs
        char={char}
        catalog={catalog}
        vies={VIES_SOULSHIFTER}
        maj={(t) => void modifierPersonnage(char, t)}
        autoriserToutChanger={!edition}
      />

      {/* Les gains de Foi n'ont lieu qu'au camp initial ; en miroir, la MJ en lit
          seulement l'état — ce sont des engagements que la joueuse prend elle-même. */}
      {ctx.type === 'initial' &&
        (edition ? (
          <RecapitulatifFoi char={char} ctx={ctx} />
        ) : (
          <GainsDeFoi char={char} ctx={ctx} personnages={personnages} />
        ))}
    </div>
  )
}

// ---------------------------------------------------------------------------

function RecapitulatifFoi({ char, ctx }: Pick<ProprietesPhase, 'char' | 'ctx'>) {
  const restants = [
    peutRecueillir(ctx) ? 'Recueillir' : null,
    peutPrendreFardeau(ctx) ? 'Fardeau' : null,
    peutPrononcerSerment(ctx) ? 'Serment' : null,
  ].filter(Boolean)

  return (
    <section className="carte pile pile--serree">
      <div className="carte__titre">
        <span className="etiquette">Points de Foi</span>
        <span className="tres-discret">
          {char.foi} / {MAX_FOI}
        </span>
      </div>
      <p className="tres-discret" style={{ margin: 0 }}>
        {restants.length > 0 ? `Encore disponible : ${restants.join(' · ')}.` : 'Tout est consommé.'}
      </p>
    </section>
  )
}

// ---------------------------------------------------------------------------

function GainsDeFoi({
  char,
  ctx,
  personnages,
}: Pick<ProprietesPhase, 'char' | 'ctx' | 'personnages'>) {
  const [thematique, setThematique] = useState<string | null>(null)
  const [cibleFardeau, setCibleFardeau] = useState('')
  const [message, setMessage] = useState<string | null>(null)

  const ajouterFoi = (n: number) => Math.min(MAX_FOI, char.foi + n)

  // Chaque action pose son jeton dans la même écriture que sa récompense : le
  // jeton retient le numéro de session, ce qui le rend caduc de lui-même à la
  // suivante — plus rien à réinitialiser.
  async function recueillir() {
    if (!peutRecueillir(ctx)) return
    // La thématique est tirée par l'app et ne se relance pas : le hasard est
    // subi, comme les dés à table. La joueuse écrit ensuite dans son carnet —
    // rien de ce qu'elle rédige ne transite par l'application.
    const tiree = cryptoRng.pick(THEMATIQUES_RECUEIL)
    await enregistrerPersonnage({
      ...char,
      foi: ajouterFoi(2),
      jetonsCamp: { ...char.jetonsCamp, recueillir: ctx.sessionNumero },
    })
    await journaliser(char.nom, 'recueillir', `${char.nom} se recueille — « ${tiree} »`)
    setThematique(tiree)
    setMessage('+2 Points de Foi. Écrivez vos 2 à 3 phrases dans votre carnet.')
  }

  async function fardeauDesavantage(competence: (typeof COMPETENCES)[number]) {
    if (!peutPrendreFardeau(ctx)) return
    await enregistrerPersonnage({
      ...char,
      foi: ajouterFoi(3),
      modifiers: [...char.modifiers, modificateurFardeau(competence)],
      jetonsCamp: { ...char.jetonsCamp, fardeau: ctx.sessionNumero },
    })
    await journaliser(char.nom, 'fardeau', `${char.nom} prend un fardeau : désavantage en ${LIBELLE_COMPETENCE[competence]}.`)
    setMessage(`+3 Points de Foi. Désavantage en ${LIBELLE_COMPETENCE[competence]} pour la session.`)
  }

  async function fardeauFatigue() {
    const cible = personnages.find((p) => p.id === cibleFardeau)
    if (!peutPrendreFardeau(ctx) || !cible || !peutCouvrirLeFardeau(cible)) return

    const { porteuse, couverte } = resoudreFardeauFatigue(char, cible)
    await enregistrerPersonnage({
      ...porteuse,
      foi: ajouterFoi(3),
      jetonsCamp: { ...char.jetonsCamp, fardeau: ctx.sessionNumero },
    })
    // La case change de fiche : sans cette seconde écriture, le Fardeau coûtait
    // un Point de Fatigue sans soulager personne.
    await enregistrerPersonnage(couverte)
    await journaliser(
      char.nom,
      'fardeau',
      `${char.nom} prend un Point de Fatigue à la place de ${cible.nom}.`,
    )
    setMessage(`+3 Points de Foi, et un Point de Fatigue pris pour ${cible.nom}.`)
    setCibleFardeau('')
  }

  async function serment() {
    if (!peutPrononcerSerment(ctx)) return
    if (!confirm('Trois de vos compétences subiront −4 jusqu’à la fin de la session. Confirmer ?')) {
      return
    }
    // La compétence épargnée est tirée par l'app : c'est un des cas où
    // l'impartialité prime sur le plaisir de lancer un dé.
    const epargnee = cryptoRng.pick(COMPETENCES)
    await enregistrerPersonnage({
      ...char,
      foi: ajouterFoi(4),
      modifiers: [...char.modifiers, modificateurSerment(epargnee)],
      jetonsCamp: { ...char.jetonsCamp, serment: ctx.sessionNumero },
    })
    await journaliser(char.nom, 'serment', `${char.nom} prononce un serment : ${LIBELLE_COMPETENCE[epargnee]} épargnée.`)
    setMessage(`+4 Points de Foi. ${LIBELLE_COMPETENCE[epargnee]} est épargnée, les autres subissent −4.`)
  }

  // Seules les alliées qui ont une case à céder peuvent être soulagées.
  const allies = personnages.filter((p) => p.id !== char.id && peutCouvrirLeFardeau(p))

  return (
    <section className="carte pile pile--serree">
      <div className="carte__titre">
        <span className="etiquette">Points de Foi</span>
        <span className="tres-discret">
          {char.foi} / {MAX_FOI}
        </span>
      </div>

      {message && <p className="alerte alerte--info">{message}</p>}

      {/* --- Recueillir --- */}
      <div className="pile pile--serree">
        <span className="objet__nom">Recueillir · +2</span>
        {peutRecueillir(ctx) ? (
          <>
            <p className="tres-discret" style={{ margin: 0 }}>
              Une thématique vous sera tirée au sort. Écrivez-en 2 à 3 phrases dans votre carnet.
            </p>
            <button type="button" className="btn" onClick={() => void recueillir()}>
              Se recueillir
            </button>
          </>
        ) : (
          <p className="tres-discret" style={{ margin: 0 }}>
            Réservé au feu de camp initial, une fois par session.
          </p>
        )}

        {thematique && (
          <p className="alerte alerte--info" style={{ whiteSpace: 'pre-line' }}>
            {thematique}
          </p>
        )}
      </div>

      <hr className="separateur" />

      {/* --- Fardeau --- */}
      <div className="pile pile--serree">
        <span className="objet__nom">Fardeau · +3</span>
        {peutPrendreFardeau(ctx) ? (
          <>
            <p className="tres-discret" style={{ margin: 0 }}>
              Un désavantage sur une compétence, pour la session :
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
            <p className="tres-discret" style={{ margin: 0 }}>
              Ou prendre un Point de Fatigue à la place d'une alliée :
            </p>
            {allies.length === 0 ? (
              <p className="tres-discret" style={{ margin: 0 }}>
                Personne n'a de Point de Fatigue à céder.
              </p>
            ) : (
              <div className="rangee">
                <select
                  value={cibleFardeau}
                  onChange={(e) => setCibleFardeau(e.target.value)}
                  style={{ flex: 1 }}
                >
                  <option value="">— pour qui ? —</option>
                  {allies.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nom} — {p.fatigue.coches} coché(s)
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
            )}
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
              la fin de la session.
            </p>
            <button type="button" className="btn btn--danger" onClick={() => void serment()}>
              Prononcer le serment
            </button>
          </>
        ) : (
          <p className="tres-discret" style={{ margin: 0 }}>
            Réservé au feu de camp initial, une fois par session.
          </p>
        )}
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------

function Armurerie({
  char,
  catalog,
  edition,
}: {
  char: Character
  catalog: Catalog
  edition?: EditionCamp
}) {
  const porte = new Set(Object.values(char.equipe).filter(Boolean) as string[])
  const equipements = char.possede.equipements
    .map((id) => catalog.equipement(id))
    .filter((e): e is NonNullable<typeof e> => Boolean(e))

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
              disabled={Boolean(edition)}
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

      {/* Choisir dans un menu déroulant suppose de se souvenir de ce que fait
          chaque objet. La liste dépliable met les descriptions sous la main. */}
      {equipements.length > 0 && (
        <>
          <hr className="separateur" />
          <span className="tres-discret">Ce que vous transportez</span>
          {equipements.map((eq) => (
            <ObjetDetaillable
              key={eq.id}
              icone={eq.icone}
              nom={eq.nom}
              meta={
                `${LIBELLE_SLOT[eq.slot]}` +
                (eq.bonusEvasion ? ` · Évasion +${eq.bonusEvasion}` : '') +
                (eq.materielDeBase ? ' · matériel de base' : '')
              }
              detail={eq.description ?? 'Aucune description pour cet objet.'}
              {...(porte.has(eq.id)
                ? { puce: <span className="puce puce--ambre">Porté</span> }
                : {})}
            />
          ))}
        </>
      )}
    </section>
  )
}
