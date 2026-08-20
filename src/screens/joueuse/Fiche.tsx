import { useEffect, useState } from 'react'

import { Avatar } from '../../components/Avatar.tsx'
import { Compteur } from '../../components/Compteur.tsx'
import { Effets } from '../../components/Effets.tsx'
import { ObjetDetaillable } from '../../components/ObjetDetaillable.tsx'
import { OngletCampfire } from './OngletCampfire.tsx'
import { OngletCombat } from './OngletCombat.tsx'
import { Passifs } from '../../components/Passifs.tsx'
import { Vignette } from '../../components/Vignette.tsx'
import { VIES_SOULSHIFTER } from '../../content/seed.ts'
import { journaliser, modifierPersonnage } from '../../data/repo.ts'
import { TAILLE_GRIMOIRE } from '../../domain/campfire.ts'
import type { Catalog } from '../../domain/catalog.ts'
import { estSonTour } from '../../domain/combat.ts'
import { precisionPersonnalite, vieActive } from '../../domain/effets.ts'
import {
  actionsRapidesMax,
  computeEvasion,
  computeSixthSens,
  computeToutesCompetences,
} from '../../domain/competences.ts'
import { fatigueRestante } from '../../domain/fatigue.ts'
import {
  appliquerGainBrulures,
  basculerCaseBrulure,
  bruluresDisponibles,
  combustionVolontaire,
  disponibiliteSort,
  grimoireEffectif,
  resumeSort,
} from '../../domain/magie.ts'
import {
  EVASION_DE_BASE,
  MAX_FOI,
  MAX_MARQUES,
  paliersFlammeAtteints,
  SEUIL_COMBUSTION,
} from '../../domain/modifiers.ts'
import { cryptoRng, tirerOsselets } from '../../domain/random.ts'
import {
  COMPETENCES,
  LIBELLE_COMPETENCE,
  LIBELLE_MAGIE,
  LIBELLE_SLOT,
  MAGIES,
  type Adversaire,
  type Character,
  type EtatTable,
  type SlotEquipement,
  type Sort,
} from '../../domain/types.ts'

/**
 * Fiche de personnage — la phase Standard.
 *
 * Ordre de lecture voulu par la MJ : d'abord ce qu'on consulte en permanence
 * (Lumens, Évasion, Fatigue), puis l'équipement porté, puis les compétences et
 * ce qui les influence, et enfin les ressources qu'on dépense.
 *
 * Aucune valeur affichée ici n'est lue telle quelle en base : compétences,
 * Évasion, 6th Sens et Actions Rapides repassent tous par le moteur de
 * modificateurs.
 */

interface Props {
  char: Character
  catalog: Catalog
  etat: EtatTable | null
  adversaires: Adversaire[]
  personnages: Character[]
  onQuitter: () => void
}

type Onglet = 'fiche' | 'combat' | 'camp' | 'sorts' | 'sac'

const LIBELLE_ONGLET: Record<Onglet, string> = {
  fiche: 'Fiche',
  combat: 'Combat',
  camp: 'Feu de camp',
  sorts: 'Sorts',
  // L'onglet montre désormais tout l'équipement, porté compris : « Sac à dos »
  // ne décrivait plus que la moitié de son contenu.
  sac: 'Équipement',
}

export function Fiche({ char, catalog, etat, adversaires, personnages, onQuitter }: Props) {
  const [onglet, setOnglet] = useState<Onglet>('fiche')
  const classe = catalog.classe(char.classeId)

  const enCombat = etat?.mode === 'combat'
  const auCamp = etat?.mode === 'campfire'
  const monTour = enCombat && estSonTour(char, etat.combat)

  // Combat et Feu de camp *ajoutent* un onglet, ils n'en remplacent aucun :
  // la fiche reste consultable à tout moment.
  const onglets: Onglet[] = [
    'fiche',
    ...(enCombat ? (['combat'] as const) : []),
    ...(auCamp ? (['camp'] as const) : []),
    'sorts',
    'sac',
  ]
  const ongletActif = onglets.includes(onglet) ? onglet : 'fiche'

  // Quand la MJ lance un feu de camp ou un combat, on y amène la joueuse :
  // sans cela, elle resterait sur sa fiche sans voir que la table a basculé.
  useEffect(() => {
    if (auCamp) setOnglet('camp')
    else if (enCombat) setOnglet('combat')
    else setOnglet('fiche')
  }, [auCamp, enCombat])

  const maj = (transformer: (c: Character) => Character) => {
    void modifierPersonnage(char, transformer)
  }

  return (
    <>
      <header className="bandeau">
        <button type="button" className="btn btn--fantome pas" onClick={onQuitter} aria-label="Changer de personnage">
          ←
        </button>
        <span className="bandeau__titre">
          {char.nom}
          <span className="tres-discret"> · {classe?.nom ?? char.classeId}</span>
        </span>
        {monTour && <span className="puce puce--ambre">À vous</span>}
      </header>

      <div className="contenu pile">
        <div className="onglets" role="tablist">
          {onglets.map((cle) => (
            <button
              key={cle}
              type="button"
              role="tab"
              aria-selected={ongletActif === cle}
              className={`onglet ${ongletActif === cle ? 'onglet--actif' : ''}`}
              onClick={() => setOnglet(cle)}
            >
              {LIBELLE_ONGLET[cle]}
              {cle === 'combat' && monTour ? ' •' : ''}
            </button>
          ))}
        </div>

        {ongletActif === 'fiche' && <OngletFiche char={char} catalog={catalog} maj={maj} />}
        {ongletActif === 'combat' && etat && (
          <OngletCombat
            char={char}
            catalog={catalog}
            etat={etat}
            adversaires={adversaires}
            personnages={personnages}
          />
        )}
        {ongletActif === 'camp' && etat && (
          <OngletCampfire char={char} catalog={catalog} etat={etat} personnages={personnages} />
        )}
        {ongletActif === 'sorts' && <OngletSorts char={char} catalog={catalog} maj={maj} />}
        {ongletActif === 'sac' && <OngletSac char={char} catalog={catalog} />}
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------

function OngletFiche({
  char,
  catalog,
  maj,
}: {
  char: Character
  catalog: Catalog
  maj: (t: (c: Character) => Character) => void
}) {
  const competences = computeToutesCompetences(char, catalog)
  const evasion = computeEvasion(char, catalog)
  const sens = computeSixthSens(char, catalog)
  const rapidesMax = actionsRapidesMax(char, catalog)
  // Les paliers se lisent sur les brûlures **acquises** : la marque reste sur
  // la peau une fois dépensée, et c'est elle qui ouvre la Voie de la Flamme.
  const paliers = paliersFlammeAtteints(char.brulures)
  const disponibles = bruluresDisponibles(char)
  const restante = fatigueRestante(char)

  const [dernierJet, setDernierJet] = useState<string | null>(null)
  const [slotOuvert, setSlotOuvert] = useState<SlotEquipement | null>(null)

  const idOuvert = slotOuvert ? char.equipe[slotOuvert] : null
  const objetOuvert = idOuvert ? catalog.equipement(idOuvert) : undefined

  function lancerOsselets() {
    const { des, brulures } = tirerOsselets(cryptoRng)
    const resultat = appliquerGainBrulures(char, brulures)
    const perdu = char.brulures + resultat.gainEffectif - resultat.brulures
    setDernierJet(
      `Osselets ${des.join(' · ')} → ${brulures} brûlure(s)` +
        (resultat.gainEffectif !== brulures ? ` (Overheat : ${resultat.gainEffectif})` : '') +
        (perdu > 0 ? ` — ${perdu} perdue(s), vous êtes déjà marquée à ${SEUIL_COMBUSTION}` : ''),
    )
    maj((c) => ({ ...c, brulures: resultat.brulures }))
  }

  /** Un clic fait tourner la case ; la neuvième dépensée déclenche la Combustion. */
  function basculerCase(index: number) {
    const r = basculerCaseBrulure(char, index)
    if (r.combustion) {
      setDernierJet('Combustion ! 1 Point de Fatigue, les marques s’effacent.')
      void journaliser(char.nom, 'combustion', `${char.nom} atteint la Combustion.`)
    }
    maj((c) => ({
      ...c,
      brulures: r.brulures,
      bruluresConsommees: r.bruluresConsommees,
      fatigue: { ...c.fatigue, coches: Math.min(c.fatigue.max, c.fatigue.coches + r.fatigueAjoutee) },
    }))
  }

  function declencherCombustion() {
    const r = combustionVolontaire()
    setDernierJet('Combustion volontaire : 9 brûlures disponibles, 1 Point de Fatigue.')
    void journaliser(char.nom, 'combustion', `${char.nom} entre volontairement en Combustion.`)
    maj((c) => ({
      ...c,
      brulures: r.brulures,
      bruluresConsommees: r.bruluresConsommees,
      fatigue: { ...c.fatigue, coches: Math.min(c.fatigue.max, c.fatigue.coches + r.fatigueAjoutee) },
    }))
  }

  const detailEvasion =
    evasion.bonus > 0
      ? `base ${EVASION_DE_BASE} + ${evasion.bonus}`
      : evasion.bonus < 0
        ? `base ${EVASION_DE_BASE} − ${Math.abs(evasion.bonus)}`
        : 'aucun bonus'

  return (
    <div className="pile">
      {restante === 0 && (
        <div className="alerte alerte--erreur">
          <strong>Grille de Fatigue pleine.</strong> Prévenez la MJ : elle vous fera effectuer un
          Détachement.
        </div>
      )}

      {/* --- Lumens --- */}
      <section className="carte">
        <div className="rangee rangee--entre">
          <div>
            <span className="etiquette">Lumens</span>
            <div className="lumens">{char.lumens}</div>
          </div>
          <div className="rangee">
            {[-10, -1, +1, +10].map((delta) => (
              <button
                key={delta}
                type="button"
                className="pas"
                style={{ width: 52, minWidth: 52 }}
                onClick={() => maj((c) => ({ ...c, lumens: Math.max(0, c.lumens + delta) }))}
                disabled={delta < 0 && char.lumens < Math.abs(delta)}
              >
                {delta > 0 ? `+${delta}` : delta}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* --- Évasion et Fatigue, les deux chiffres qu'on consulte le plus --- */}
      <section className="carte">
        <div className="duo">
          <Vignette
            libelle="Évasion"
            valeur={evasion.total}
            note={detailEvasion}
            teinte="var(--foi)"
          />
          <Compteur
            libelle="Points de Fatigue"
            variante="fatigue"
            valeur={char.fatigue.coches}
            max={char.fatigue.max}
            onChange={(v) => maj((c) => ({ ...c, fatigue: { ...c.fatigue, coches: v } }))}
            note={`${restante} restant(s)`}
          />
        </div>
      </section>

      {/* --- Avatar et équipement --- */}
      <section className="carte pile pile--serree">
        <span className="etiquette">Équipement</span>
        <div style={{ marginTop: 10 }}>
          <Avatar
            char={char}
            catalog={catalog}
            onSlot={(s) => setSlotOuvert((actuel) => (actuel === s ? null : s))}
          />
        </div>

        {/* Toucher un emplacement en révèle la description, comme pour un sort :
            la joueuse doit pouvoir relire ce qu'elle porte sans demander. */}
        {objetOuvert ? (
          <ObjetDetaillable
            key={objetOuvert.id}
            icone={objetOuvert.icone}
            nom={objetOuvert.nom}
            meta={
              `${LIBELLE_SLOT[objetOuvert.slot]}` +
              (objetOuvert.bonusEvasion ? ` · Évasion +${objetOuvert.bonusEvasion}` : '')
            }
            detail={objetOuvert.description ?? 'Aucune description pour cet objet.'}
          />
        ) : (
          <p className="tres-discret" style={{ margin: 0 }}>
            Touchez un emplacement pour en relire la description.
          </p>
        )}
      </section>

      {/* --- Compétences --- */}
      <section className="carte pile pile--serree">
        <span className="etiquette">Compétences</span>

        {COMPETENCES.map((c) => {
          const v = competences[c]
          const classeNet =
            v.net === 'avantage' ? 'competence--avantage' : v.net === 'desavantage' ? 'competence--desavantage' : ''
          const classeTotal =
            v.bonus > 0 ? 'competence__total--bonifie' : v.bonus < 0 ? 'competence__total--penalise' : ''

          return (
            <div key={c} className={`competence ${classeNet}`}>
              <span className="competence__nom">{LIBELLE_COMPETENCE[c]}</span>
              {v.net !== 'neutre' && (
                <span className={`puce puce--${v.net}`}>{v.net === 'avantage' ? '+d4' : '−d4'}</span>
              )}
              <span className={`competence__total ${classeTotal}`}>
                {v.total > 0 ? '+' : ''}
                {v.total}
              </span>
            </div>
          )
        })}
      </section>

      {/* --- 6th Sens et Actions Rapides, deux réserves qu'on dépense --- */}
      <section className="carte">
        <div className="paire">
          <Compteur
            libelle="6th Sens"
            variante="sens"
            valeur={sens.restants}
            max={sens.max}
            onChange={(v) => maj((c) => ({ ...c, sixthSensUtilises: Math.max(0, sens.max - v) }))}
            note={sens.bonus > 0 ? `dont ${sens.bonus} temporaire(s)` : 'récupéré en fin de journée'}
          />
          <Compteur
            libelle="Actions Rapides"
            variante="rapides"
            valeur={Math.max(0, rapidesMax - char.actionsRapidesUtilisees)}
            max={rapidesMax}
            onChange={(v) =>
              maj((c) => ({ ...c, actionsRapidesUtilisees: Math.max(0, rapidesMax - v) }))
            }
            note={`d'après votre Physique · par jour`}
          />
        </div>
      </section>

      {/* --- Effets en cours, passifs compris --- */}
      <Effets char={char} catalog={catalog} vies={VIES_SOULSHIFTER} />

      {/* --- Passif de classe --- */}
      <Passifs char={char} catalog={catalog} vies={VIES_SOULSHIFTER} maj={maj} />

      {/* --- Ressources --- */}
      <section className="carte pile">
        {/* Une pastille tourne sur elle-même : vierge, acquise (orange), puis
            dépensée (rouge). Deux compteurs sur une seule barre, sans avoir à
            lire une ligne de chiffres. */}
        <Compteur
          libelle="Brûlures"
          variante="brulures"
          valeur={char.brulures}
          consommee={char.bruluresConsommees}
          max={SEUIL_COMBUSTION}
          onPastille={basculerCase}
          note={[
            `${disponibles} disponible(s)`,
            ...paliers.map((p) => p.effet),
          ].join(' · ')}
        />

        <div className="rangee">
          <button type="button" className="btn" onClick={lancerOsselets}>
            Tirer les osselets
          </button>
          <button type="button" className="btn btn--danger" onClick={declencherCombustion}>
            Combustion
          </button>
        </div>

        {dernierJet && <p className="alerte alerte--info">{dernierJet}</p>}

        <hr className="separateur" />

        <Compteur
          libelle="Points de Foi"
          variante="foi"
          valeur={char.foi}
          max={MAX_FOI}
          onChange={(v) => maj((c) => ({ ...c, foi: v }))}
        />

        <hr className="separateur" />

        <Compteur
          libelle="Marques"
          variante="marques"
          valeur={Math.min(char.marques, MAX_MARQUES)}
          max={MAX_MARQUES}
          onChange={(v) => maj((c) => ({ ...c, marques: v }))}
          note={
            char.marques >= MAX_MARQUES
              ? 'Seuil atteint — la MJ peut prendre le contrôle de votre personnage.'
              : undefined
          }
        />
      </section>

      {char.cicatrices.length > 0 && (
        <section className="carte pile pile--serree">
          <span className="etiquette">Cicatrices</span>
          {char.cicatrices.map((c, i) => (
            <p key={i} className="discret" style={{ margin: 0 }}>
              {c}
            </p>
          ))}
        </section>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------

function LigneSort({
  sort,
  char,
  catalog,
  maj,
}: {
  sort: Sort
  char: Character
  catalog: Catalog
  /** Absent en lecture seule ; présent, il autorise la bascule de l'Hexite. */
  maj?: (t: (c: Character) => Character) => void
}) {
  const dispo = disponibiliteSort(sort, char, catalog)
  const epuise = char.sortsEpuises.includes(sort.id)

  // La personnalité incarnée par un Soulshifter ne remplace pas l'effet du
  // sort : elle le précise. Les deux s'affichent donc l'un sous l'autre.
  const precision = precisionPersonnalite(sort.id, char, VIES_SOULSHIFTER)
  const vie = vieActive(char, VIES_SOULSHIFTER)

  // Seule l'Arcane consomme un Hexite. La joueuse lance son d6 à table ; l'app
  // ne fait qu'enregistrer que le cristal ne répond plus.
  function basculerEpuise() {
    maj?.((c) => ({
      ...c,
      sortsEpuises: epuise
        ? c.sortsEpuises.filter((id) => id !== sort.id)
        : [...c.sortsEpuises, sort.id],
    }))
  }

  return (
    <ObjetDetaillable
      icone={sort.icone}
      nom={sort.nom}
      meta={resumeSort(sort, char, catalog)}
      detail={sort.effet}
      indisponible={!dispo.disponible}
      {...(precision && vie ? { precision: { titre: `Sous ${vie.nom}`, texte: precision } } : {})}
      {...(maj && sort.magie === 'arcane'
        ? {
            // Une case à cocher plutôt qu'un bouton : l'Hexite épuisé est un
            // état, pas une action, et la ligne grisée dit le reste.
            action: (
              <label className="rangee" style={{ gap: 8 }}>
                <input
                  type="checkbox"
                  checked={epuise}
                  style={{ minHeight: 0, width: 'auto' }}
                  onChange={basculerEpuise}
                />
                <span className="tres-discret">Hexite épuisé</span>
              </label>
            ),
          }
        : {})}
    />
  )
}

/**
 * Le répertoire de sorts, en trois temps.
 *
 * Les préparés d'abord — ce sont les seuls lançables —, puis ce que le passif
 * accorde en permanence, puis le reste du répertoire rangé par magie. Chaque
 * sort n'apparaît qu'une fois, ce qui rend toute puce « Préparé » inutile : la
 * section où il figure le dit déjà.
 */
function OngletSorts({
  char,
  catalog,
  maj,
}: {
  char: Character
  catalog: Catalog
  maj: (t: (c: Character) => Character) => void
}) {
  const grimoire = grimoireEffectif(char, catalog)
  const prepares = grimoire.filter((e) => !e.horsEmplacement).map((e) => e.sort)
  const permanents = grimoire.filter((e) => e.horsEmplacement).map((e) => e.sort)

  const enJeu = new Set(grimoire.map((e) => e.sort.id))
  const connus = char.possede.sorts
    .filter((id) => !enJeu.has(id))
    .map((id) => catalog.sort(id))
    .filter((s): s is Sort => Boolean(s))

  return (
    <div className="pile">
      <section className="carte pile pile--serree">
        <div className="carte__titre">
          <span className="etiquette">Sorts préparés</span>
          <span className="tres-discret">
            {prepares.length}/{TAILLE_GRIMOIRE}
          </span>
        </div>
        {prepares.length === 0 && <p className="vide">Aucun sort préparé.</p>}
        {prepares.map((sort) => (
          <LigneSort key={sort.id} sort={sort} char={char} catalog={catalog} maj={maj} />
        ))}
      </section>

      {permanents.length > 0 && (
        <section className="carte pile pile--serree">
          <div className="carte__titre">
            <span className="etiquette">Hors emplacement</span>
            <span className="tres-discret">accordés par votre passif</span>
          </div>
          <p className="tres-discret" style={{ margin: 0 }}>
            Disponibles en permanence ; ils ne comptent pas dans la limite de {TAILLE_GRIMOIRE}.
          </p>
          {permanents.map((sort) => (
            <LigneSort key={sort.id} sort={sort} char={char} catalog={catalog} maj={maj} />
          ))}
        </section>
      )}

      <section className="carte pile pile--serree">
        <div className="carte__titre">
          <span className="etiquette">Sorts connus</span>
          <span className="tres-discret">préparables au prochain feu de camp</span>
        </div>
        {connus.length === 0 && <p className="vide">Rien d'autre à votre répertoire.</p>}
        {MAGIES.map((magie) => {
          const duType = connus.filter((s) => s.magie === magie)
          if (duType.length === 0) return null
          return (
            <div key={magie} className="pile pile--serree">
              <span className="tres-discret">{LIBELLE_MAGIE[magie]}</span>
              {duType.map((sort) => (
                <LigneSort key={sort.id} sort={sort} char={char} catalog={catalog} />
              ))}
            </div>
          )
        })}
      </section>
    </div>
  )
}

// ---------------------------------------------------------------------------

/**
 * Tout l'équipement possédé, porté ou non — le porté marqué de son emplacement.
 *
 * N'afficher que la réserve obligeait à regarder à deux endroits pour comparer
 * ce qu'on porte à ce qu'on pourrait porter.
 */
function OngletSac({ char, catalog }: { char: Character; catalog: Catalog }) {
  const equipes = Object.entries(char.equipe).filter(([, id]) => id) as [SlotEquipement, string][]
  const parObjetPorte = new Map(equipes.map(([slot, id]) => [id, slot]))

  const equipements = char.possede.equipements
    .map((id) => catalog.equipement(id))
    .filter((e): e is NonNullable<typeof e> => Boolean(e))

  const ameliorations = char.possede.ameliorations
    .map((id) => catalog.amelioration(id))
    .filter((a): a is NonNullable<typeof a> => Boolean(a))

  return (
    <div className="pile">
      <p className="alerte alerte--info">
        Tout ce que vous transportez. Les échanges se font au prochain feu de camp.
      </p>

      <section className="carte pile pile--serree">
        <span className="etiquette">Équipement</span>
        {equipements.length === 0 && <p className="vide">Vous ne possédez aucun objet.</p>}
        {equipements.map((eq) => {
          const porteEn = parObjetPorte.get(eq.id)
          return (
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
              {...(porteEn
                ? { puce: <span className="puce puce--ambre">{LIBELLE_SLOT[porteEn]}</span> }
                : {})}
            />
          )
        })}
      </section>

      {ameliorations.length > 0 && (
        <section className="carte pile pile--serree">
          <span className="etiquette">Améliorations</span>
          {ameliorations.map((am) => (
            <ObjetDetaillable
              key={am.id}
              icone={am.icone}
              nom={am.nom}
              meta={am.effetTexte}
              detail={am.description ?? am.effetTexte}
            />
          ))}
        </section>
      )}
    </div>
  )
}
