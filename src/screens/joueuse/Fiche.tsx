import { useState } from 'react'

import { Avatar } from '../../components/Avatar.tsx'
import { Compteur } from '../../components/Compteur.tsx'
import { Effets } from '../../components/Effets.tsx'
import { ObjetDetaillable } from '../../components/ObjetDetaillable.tsx'
import { Passifs } from '../../components/Passifs.tsx'
import { Vignette } from '../../components/Vignette.tsx'
import { VIES_SOULSHIFTER } from '../../content/seed.ts'
import { journaliser, modifierPersonnage } from '../../data/repo.ts'
import { TAILLE_GRIMOIRE } from '../../domain/campfire.ts'
import type { Catalog } from '../../domain/catalog.ts'
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
  combustionVolontaire,
  coutFoiEffectif,
  disponibiliteSort,
  grimoireEffectif,
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
  type Character,
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
  onQuitter: () => void
}

type Onglet = 'fiche' | 'sorts' | 'sac'

export function Fiche({ char, catalog, onQuitter }: Props) {
  const [onglet, setOnglet] = useState<Onglet>('fiche')
  const classe = catalog.classe(char.classeId)

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
      </header>

      <div className="contenu pile">
        <div className="onglets" role="tablist">
          {(['fiche', 'sorts', 'sac'] as const).map((cle) => (
            <button
              key={cle}
              type="button"
              role="tab"
              aria-selected={onglet === cle}
              className={`onglet ${onglet === cle ? 'onglet--actif' : ''}`}
              onClick={() => setOnglet(cle)}
            >
              {cle === 'fiche' ? 'Fiche' : cle === 'sorts' ? 'Sorts' : 'Sac à dos'}
            </button>
          ))}
        </div>

        {onglet === 'fiche' && <OngletFiche char={char} catalog={catalog} maj={maj} />}
        {onglet === 'sorts' && <OngletSorts char={char} catalog={catalog} />}
        {onglet === 'sac' && <OngletSac char={char} catalog={catalog} />}
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
  const paliers = paliersFlammeAtteints(char.brulures)
  const restante = fatigueRestante(char)

  const [dernierJet, setDernierJet] = useState<string | null>(null)

  function lancerOsselets() {
    const { des, brulures } = tirerOsselets(cryptoRng)
    const resultat = appliquerGainBrulures(char, brulures)
    setDernierJet(
      `Osselets ${des.join(' · ')} → ${brulures} brûlure(s)` +
        (resultat.gainEffectif !== brulures ? ` (Overheat : ${resultat.gainEffectif})` : '') +
        (resultat.combustion ? ' — Combustion ! 1 Point de Fatigue' : ''),
    )
    maj((c) => ({
      ...c,
      brulures: resultat.brulures,
      fatigue: { ...c.fatigue, coches: Math.min(c.fatigue.max, c.fatigue.coches + resultat.fatigueAjoutee) },
    }))
  }

  function declencherCombustion() {
    const r = combustionVolontaire()
    setDernierJet('Combustion volontaire : 9 brûlures, 1 Point de Fatigue.')
    void journaliser(char.nom, 'combustion', `${char.nom} entre volontairement en Combustion.`)
    maj((c) => ({
      ...c,
      brulures: r.brulures,
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
      <section className="carte">
        <span className="etiquette">Équipement</span>
        <div style={{ marginTop: 10 }}>
          <Avatar char={char} catalog={catalog} />
        </div>
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
        <Compteur
          libelle="Brûlures"
          variante="brulures"
          valeur={char.brulures}
          max={SEUIL_COMBUSTION}
          onChange={(v) => maj((c) => ({ ...c, brulures: v }))}
          // Les paliers se cumulent : on les liste tous, pas seulement le plus haut.
          {...(paliers.length > 0 ? { note: paliers.map((p) => p.effet).join(' ') } : {})}
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

export function decrireCoutSort(sort: Sort, coutFoi: number | null): string {
  switch (sort.cout.kind) {
    case 'aucun':
      return 'sans coût'
    case 'foi':
    case 'foi-plus-variable':
      return `${coutFoi ?? '?'} Foi${sort.cout.kind === 'foi-plus-variable' ? ' + X' : ''}`
    case 'brulures':
      return `${sort.cout.valeur} brûlure(s)`
    case 'brulures-variable':
      return 'X brûlures'
    case 'marques-variable':
      return `X Marques (max ${sort.cout.max})`
  }
}

function LigneSort({
  sort,
  char,
  catalog,
  horsEmplacement,
}: {
  sort: Sort
  char: Character
  catalog: Catalog
  horsEmplacement?: boolean
}) {
  const dispo = disponibiliteSort(sort, char, catalog)
  const coutFoi = coutFoiEffectif(sort, char, catalog)
  const epuise = char.sortsEpuises.includes(sort.id)

  // La personnalité incarnée par un Soulshifter ne remplace pas l'effet du
  // sort : elle le précise. Les deux s'affichent donc l'un sous l'autre.
  const precision = precisionPersonnalite(sort.id, char, VIES_SOULSHIFTER)
  const vie = vieActive(char, VIES_SOULSHIFTER)

  return (
    <ObjetDetaillable
      icone={sort.icone}
      nom={sort.nom}
      meta={`${LIBELLE_MAGIE[sort.magie]} · ${decrireCoutSort(sort, coutFoi)}${sort.de ? ` · ${sort.de}` : ''} · ${sort.duree}`}
      detail={sort.effet}
      indisponible={!dispo.disponible}
      {...(precision && vie ? { precision: { titre: `Sous ${vie.nom}`, texte: precision } } : {})}
      {...(epuise
        ? { puce: <span className="puce puce--desavantage">Épuisé</span> }
        : horsEmplacement
          ? { puce: <span className="puce puce--ambre">Hors emplacement</span> }
          : {})}
    />
  )
}

function OngletSorts({ char, catalog }: { char: Character; catalog: Catalog }) {
  const grimoire = grimoireEffectif(char, catalog)
  const prepares = grimoire.filter((e) => !e.horsEmplacement).length
  const permanents = grimoire.length - prepares

  return (
    <div className="pile">
      <section className="carte pile pile--serree">
        <div className="carte__titre">
          <span className="etiquette">Grimoire</span>
          <span className="tres-discret">
            {prepares}/{TAILLE_GRIMOIRE} préparé(s)
            {permanents > 0 ? ` + ${permanents} en permanence` : ''}
          </span>
        </div>
        {grimoire.length === 0 && <p className="vide">Aucun sort préparé.</p>}
        {grimoire.map(({ sort, horsEmplacement }) => (
          <LigneSort
            key={sort.id}
            sort={sort}
            char={char}
            catalog={catalog}
            horsEmplacement={horsEmplacement}
          />
        ))}
        {permanents > 0 && (
          <p className="tres-discret" style={{ margin: 0 }}>
            Les sorts « hors emplacement » sont disponibles en permanence et ne comptent pas dans
            la limite de {TAILLE_GRIMOIRE}.
          </p>
        )}
      </section>
    </div>
  )
}

// ---------------------------------------------------------------------------

function OngletSac({ char, catalog }: { char: Character; catalog: Catalog }) {
  const sortsEnReserve = char.possede.sorts
    .filter((id) => !char.grimoire.includes(id))
    .map((id) => catalog.sort(id))
    .filter((s): s is Sort => Boolean(s))

  const equipes = new Set(Object.values(char.equipe).filter(Boolean) as string[])
  const equipementsEnReserve = char.possede.equipements
    .filter((id) => !equipes.has(id))
    .map((id) => catalog.equipement(id))
    .filter((e): e is NonNullable<typeof e> => Boolean(e))

  const ameliorations = char.possede.ameliorations
    .map((id) => catalog.amelioration(id))
    .filter((a): a is NonNullable<typeof a> => Boolean(a))

  return (
    <div className="pile">
      <p className="alerte alerte--info">
        Ce que vous transportez sans l'avoir préparé. Les échanges se font au prochain feu de camp.
      </p>

      <section className="carte pile pile--serree">
        <span className="etiquette">Sorts en réserve</span>
        {sortsEnReserve.length === 0 && <p className="vide">Rien en réserve.</p>}
        {sortsEnReserve.map((sort) => (
          <ObjetDetaillable
            key={sort.id}
            icone={sort.icone}
            nom={sort.nom}
            meta={`${LIBELLE_MAGIE[sort.magie]} · ${sort.duree}`}
            detail={sort.effet}
          />
        ))}
      </section>

      <section className="carte pile pile--serree">
        <span className="etiquette">Équipement en réserve</span>
        {equipementsEnReserve.length === 0 && <p className="vide">Rien en réserve.</p>}
        {equipementsEnReserve.map((eq) => (
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
          />
        ))}
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
