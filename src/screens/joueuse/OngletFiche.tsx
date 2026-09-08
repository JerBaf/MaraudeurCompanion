import { useState } from 'react'

import { Avatar } from '../../components/Avatar.tsx'
import { Compteur } from '../../components/Compteur.tsx'
import { Effets } from '../../components/Effets.tsx'
import { LanceurDes } from '../../components/LanceurDes.tsx'
import { ObjetDetaillable } from '../../components/ObjetDetaillable.tsx'
import { Passifs } from '../../components/Passifs.tsx'
import { Vignette } from '../../components/Vignette.tsx'
import { VIES_SOULSHIFTER } from '../../content/seed.ts'
import { journaliser } from '../../data/repo.ts'
import type { Catalog } from '../../domain/catalog.ts'
import {
  actionsRapidesMax,
  computeBruluresMax,
  computeEvasion,
  computeFatigueMax,
  computeFoiMax,
  computeMarquesMax,
  computeSixthSens,
  computeToutesCompetences,
} from '../../domain/competences.ts'
import { fatigueRestante } from '../../domain/fatigue.ts'
import {
  appliquerConsommation,
  appliquerGainBrulures,
  basculerCaseBrulure,
  bruluresDisponibles,
  combustionVolontaire,
} from '../../domain/magie.ts'
import { EVASION_DE_BASE, paliersFlammeAtteints } from '../../domain/modifiers.ts'
import {
  aDesEffetsActifs,
  actifsDe,
  desDeActif,
  detailObjet,
  raisonsIndisponible,
  resumeEquipement,
  utiliserActif,
} from '../../domain/objets.ts'
import { cryptoRng, tirerOsselets, type Rng } from '../../domain/random.ts'
import {
  COMPETENCES,
  LIBELLE_COMPETENCE,
  RARETES,
  type Actif,
  type Character,
  type Competence,
  type Equipement,
  type SlotEquipement,
} from '../../domain/types.ts'
import { definirModeDes, useModeDes } from '../../hooks/useDes.ts'
import { JetCompetence } from './JetCompetence.tsx'

/**
 * L'onglet Fiche — la phase Standard.
 *
 * Ordre de lecture voulu par la MJ : d'abord ce qu'on consulte en permanence
 * (Lumens, Évasion, Fatigue), puis l'équipement porté, puis les compétences et
 * ce qui les influence, et enfin les ressources qu'on dépense.
 *
 * Aucune valeur affichée ici n'est lue telle quelle en base : compétences,
 * Évasion, 6th Sens et Actions Rapides repassent tous par le moteur de
 * modificateurs.
 */

export function OngletFiche({
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
  const restante = fatigueRestante(char, catalog)
  // Les quatre plafonds sont dérivés : un objet peut les faire bouger.
  const fatigueMax = computeFatigueMax(char, catalog).max
  const foiMax = computeFoiMax(char, catalog).max
  const marquesMax = computeMarquesMax(char, catalog).max
  const bruluresMax = computeBruluresMax(char, catalog).max

  const [dernierJet, setDernierJet] = useState<string | null>(null)
  const [slotOuvert, setSlotOuvert] = useState<SlotEquipement | null>(null)
  const [jetOuvert, setJetOuvert] = useState<Competence | null>(null)

  const modeDes = useModeDes()
  // Le compte de points rouges quand la joueuse a jeté ses propres osselets.
  const [osselets, setOsselets] = useState('')
  const osseletsValides = osselets !== '' && Number(osselets) >= 0 && Number(osselets) <= 4
  // Le récit d'usage vit hors de la ligne de l'objet : un objet qui s'épuise
  // change d'état en même temps qu'il agit, et l'effet tiré doit rester lisible.
  const [dernierUsage, setDernierUsage] = useState<string | null>(null)

  const idOuvert = slotOuvert ? char.equipe[slotOuvert] : null
  const objetOuvert = idOuvert ? catalog.equipement(idOuvert) : undefined

  /** Le dé de la table est lancé ici ; l'écran en donne le résultat et l'effet. */
  function utiliser(eq: Equipement, actif: Actif, rng: Rng) {
    const r = utiliserActif(char, catalog, eq, actif, rng)
    setDernierUsage(
      `${actif.nom} — ` +
        // Une table à une seule entrée est déterministe : le dé n'a rien à dire.
        (actif.table.faces > 1 ? `1d${actif.table.faces} → ${r.de} · ` : '') +
        r.effet +
        // Combustion, grille de Fatigue pleine : ce que le paiement a entraîné.
        (r.recits.length ? ` — ${r.recits.join(' · ')}` : '') +
        (r.restantes === 0 ? ' Il ne lui reste plus de charge.' : ''),
    )
    void journaliser(char.nom, 'objet', `${char.nom} utilise ${actif.nom} : ${r.effet}`)
    maj(() => r.char)
  }

  /**
   * Le gain, qu'il vienne du tirage de l'app ou du compte annoncé par la
   * joueuse. Overheat et le plafond s'appliquent des deux côtés.
   */
  function gagnerDesBrulures(brulures: number, tirage: string) {
    const resultat = appliquerGainBrulures(char, brulures)
    const perdu = char.brulures + resultat.gainEffectif - resultat.brulures
    setDernierJet(
      `${tirage} → ${brulures} brûlure(s)` +
        (resultat.gainEffectif !== brulures ? ` (Overheat : ${resultat.gainEffectif})` : '') +
        (perdu > 0 ? ` — ${perdu} perdue(s), vous êtes déjà marquée à ${bruluresMax}` : ''),
    )
    maj((c) => ({ ...c, brulures: resultat.brulures }))
  }

  function lancerOsselets() {
    const { des, brulures } = tirerOsselets(cryptoRng)
    gagnerDesBrulures(brulures, `Osselets ${des.join(' · ')}`)
  }

  /** Un clic fait tourner la case ; la neuvième dépensée déclenche la Combustion. */
  function basculerCase(index: number) {
    const { char: apres, recit } = appliquerConsommation(
      char,
      catalog,
      basculerCaseBrulure(char, index),
    )
    if (recit) {
      setDernierJet(recit)
      void journaliser(char.nom, 'combustion', `${char.nom} atteint la Combustion.`)
    }
    maj(() => apres)
  }

  function declencherCombustion() {
    const { char: apres } = appliquerConsommation(char, catalog, combustionVolontaire())
    // Récit propre à la manœuvre volontaire : elle se paie d'avance, et les
    // neuf brûlures qu'elle ouvre sont le point, pas la Fatigue.
    setDernierJet('Combustion volontaire : 9 brûlures disponibles, 1 Point de Fatigue.')
    void journaliser(char.nom, 'combustion', `${char.nom} entre volontairement en Combustion.`)
    maj(() => apres)
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
            max={fatigueMax}
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

        {/* Toucher un emplacement révèle l'objet ; le toucher à son tour déplie
            sa description, et c'est là qu'on s'en sert. */}
        {objetOuvert ? (
          <ObjetDetaillable
            key={objetOuvert.id}
            icone={objetOuvert.icone}
            nom={objetOuvert.nom}
            teinte={RARETES[objetOuvert.rarete ?? 'commun'].teinte}
            meta={resumeEquipement(objetOuvert, char)}
            detail={detailObjet(objetOuvert)}
            {...(aDesEffetsActifs(objetOuvert)
              ? {
                  // Un bouton par Actif : un objet peut en porter plusieurs,
                  // chacun avec son coût et ses charges.
                  actionDetail: (
                    <div className="rangee">
                      {actifsDe(objetOuvert).map((actif) => (
                        <BoutonActif
                          key={actif.id}
                          char={char}
                          catalog={catalog}
                          eq={objetOuvert}
                          actif={actif}
                          onUtiliser={(rng) => utiliser(objetOuvert, actif, rng)}
                        />
                      ))}
                    </div>
                  ),
                }
              : {})}
          />
        ) : (
          <p className="tres-discret" style={{ margin: 0 }}>
            Touchez un emplacement pour en relire la description.
          </p>
        )}

        {dernierUsage && <p className="alerte alerte--info">{dernierUsage}</p>}
      </section>

      {/* --- Compétences --- */}
      <section className="carte pile pile--serree">
        <div className="carte__titre">
          <span className="etiquette">Compétences</span>
          <span className="tres-discret">touchez-en une pour la lancer</span>
        </div>

        {COMPETENCES.map((c) => {
          const v = competences[c]
          const classeNet =
            v.net === 'avantage' ? 'competence--avantage' : v.net === 'desavantage' ? 'competence--desavantage' : ''
          const classeTotal =
            v.bonus > 0 ? 'competence__total--bonifie' : v.bonus < 0 ? 'competence__total--penalise' : ''
          const ouvert = jetOuvert === c

          return (
            <div key={c}>
              {/* La ligne devient le bouton du jet : le Test de Compétence vit
                  sous la compétence qu'il lance, pas dans un écran à part. */}
              <button
                type="button"
                className={`competence ${classeNet}`}
                aria-expanded={ouvert}
                onClick={() => setJetOuvert(ouvert ? null : c)}
              >
                <span className="competence__nom">{LIBELLE_COMPETENCE[c]}</span>
                {v.net !== 'neutre' && (
                  <span className={`puce puce--${v.net}`}>{v.net === 'avantage' ? '+d4' : '−d4'}</span>
                )}
                <span className={`competence__total ${classeTotal}`}>
                  {v.total > 0 ? '+' : ''}
                  {v.total}
                </span>
                <span className="tres-discret" aria-hidden="true" style={{ fontSize: '0.7rem' }}>
                  {ouvert ? '▾' : '▸'}
                </span>
              </button>

              {/* Un seul jet ouvert à la fois : deux panneaux dépliés ne
                  tiendraient pas sur un téléphone. */}
              {ouvert && (
                <JetCompetence char={char} catalog={catalog} competence={c} valeur={v} />
              )}
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
      <Effets char={char} catalog={catalog} vies={VIES_SOULSHIFTER} maj={maj} />

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
          max={bruluresMax}
          onPastille={basculerCase}
          note={[
            `${disponibles} disponible(s)`,
            ...paliers.map((p) => p.effet),
          ].join(' · ')}
        />

        {/* Les osselets restent hors de `LanceurDes`, et c'est voulu : la
            joueuse qui les a jetés a déjà compté ses points rouges en les
            regardant. Lui redemander les quatre faces serait une double saisie
            pour le même résultat. */}
        <div className="rangee">
          {modeDes === 'app' ? (
            <button type="button" className="btn" onClick={lancerOsselets}>
              Tirer les osselets
            </button>
          ) : (
            <>
              <input
                type="number"
                inputMode="numeric"
                className="de-saisi"
                min={0}
                max={4}
                value={osselets}
                placeholder="0-4"
                aria-label="Points rouges obtenus aux osselets"
                onChange={(e) => setOsselets(e.target.value)}
              />
              <button
                type="button"
                className="btn"
                disabled={!osseletsValides}
                onClick={() => {
                  gagnerDesBrulures(Number(osselets), 'Osselets annoncés')
                  setOsselets('')
                }}
              >
                Compter mes points rouges
              </button>
            </>
          )}
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
          max={foiMax}
          onChange={(v) => maj((c) => ({ ...c, foi: v }))}
        />

        <hr className="separateur" />

        <Compteur
          libelle="Marques"
          variante="marques"
          valeur={Math.min(char.marques, marquesMax)}
          max={marquesMax}
          onChange={(v) => maj((c) => ({ ...c, marques: v }))}
          note={
            char.marques >= marquesMax
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

      {/* --- Qui lance les dés ---
          Une joueuse a ses dés ou ne les a pas, et ça ne change pas trois fois
          dans la soirée : un seul réglage vaut pour tous les jets de l'app, ce
          qui laisse un bouton unique par jet sur un téléphone. */}
      <section className="carte">
        <label className="rangee" style={{ gap: 10, alignItems: 'flex-start' }}>
          <input
            type="checkbox"
            checked={modeDes === 'main'}
            style={{ minHeight: 0, width: 'auto', marginTop: 4 }}
            onChange={(e) => definirModeDes(e.target.checked ? 'main' : 'app')}
          />
          <span className="objet__corps">
            <span className="objet__nom">🎲 Je lance mes propres dés</span>
            <span className="objet__meta">
              Chaque jet vous demandera le résultat au lieu de le tirer. Réglage propre à cet
              appareil ; chaque jet garde de quoi faire l’inverse une fois.
            </span>
          </span>
        </label>
      </section>
    </div>
  )
}

// ---------------------------------------------------------------------------

/**
 * Le bouton d'un Actif, et la raison quand il ne part pas.
 *
 * Deux causes distinctes, qu'il serait trompeur de confondre sous un « Plus de
 * charge » : le compteur est vide, ou le coût n'est pas payable. La seconde se
 * résout en gagnant des Points de Foi, la première non.
 */
function BoutonActif({
  char,
  catalog,
  eq,
  actif,
  onUtiliser,
}: {
  char: Character
  catalog: Catalog
  eq: Equipement
  actif: Actif
  onUtiliser: (rng: Rng) => void
}) {
  const raisons = raisonsIndisponible(char, catalog, eq, actif)
  const bloque = raisons.chargesEpuisees || raisons.coutImpayable

  const libelle = raisons.chargesEpuisees
    ? 'Plus de charge'
    : raisons.coutImpayable
      ? 'Coût impayable'
      : actif.nom

  return (
    <LanceurDes des={desDeActif(actif)} libelle={libelle} disabled={bloque} onJet={onUtiliser} />
  )
}
