import { useState } from 'react'

import { Avatar } from '../../components/Avatar.tsx'
import { Compteur } from '../../components/Compteur.tsx'
import { Icone } from '../../components/Icone.tsx'
import { journaliser, modifierPersonnage } from '../../data/repo.ts'
import type { Catalog } from '../../domain/catalog.ts'
import {
  computeEvasion,
  computeSixthSens,
  computeToutesCompetences,
  actionsRapidesRestantes,
} from '../../domain/competences.ts'
import { fatigueRestante } from '../../domain/fatigue.ts'
import {
  appliquerGainBrulures,
  combustionVolontaire,
  coutFoiEffectif,
  disponibiliteSort,
} from '../../domain/magie.ts'
import { allModifiers, MAX_FOI, palierVoieDeLaFlamme, SEUIL_COMBUSTION } from '../../domain/modifiers.ts'
import { cryptoRng, tirerOsselets } from '../../domain/random.ts'
import {
  COMPETENCES,
  LIBELLE_COMPETENCE,
  LIBELLE_MAGIE,
  type Character,
  type Sort,
} from '../../domain/types.ts'

/**
 * Fiche de personnage — la phase Standard.
 *
 * Tout ce que le PDF impose de garder visible en permanence est sur le premier
 * onglet : compétences, Fatigue, Foi, Brûlures, Marques, 6th Sens, Lumens.
 * Les sorts et le sac à dos passent en onglets pour rester lisibles à une main.
 *
 * Aucune valeur affichée ici n'est lue telle quelle dans la base : compétences,
 * Évasion et 6th Sens repassent tous par le moteur de modificateurs.
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
  const palier = palierVoieDeLaFlamme(char.brulures)
  const restante = fatigueRestante(char)
  const modificateurs = allModifiers(char, catalog)

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

      {/* --- Avatar et équipement --- */}
      <section className="carte">
        <div className="carte__titre">
          <span className="etiquette">Équipement</span>
          <span className="tres-discret">modifiable au feu de camp</span>
        </div>
        <Avatar char={char} catalog={catalog} />
      </section>

      {/* --- Compétences --- */}
      <section className="carte pile pile--serree">
        <div className="carte__titre">
          <span className="etiquette">Compétences</span>
          <span className="tres-discret">
            Évasion {evasion.total} · {actionsRapidesRestantes(char, catalog)} action(s) rapide(s)
          </span>
        </div>

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

        {modificateurs.length > 0 && (
          <>
            <hr className="separateur" />
            <span className="etiquette">Effets en cours</span>
            <div className="rangee">
              {modificateurs.map((m) => (
                <span key={m.id} className="puce puce--ambre" title={decrireModificateur(m.target, m.op)}>
                  {m.source.label}
                </span>
              ))}
            </div>
          </>
        )}
      </section>

      {/* --- Ressources --- */}
      <section className="carte pile">
        <Compteur
          libelle="Points de Fatigue"
          variante="fatigue"
          valeur={char.fatigue.coches}
          max={char.fatigue.max}
          onChange={(v) => maj((c) => ({ ...c, fatigue: { ...c.fatigue, coches: v } }))}
          note={`${restante} restant(s)`}
        />

        <hr className="separateur" />

        <Compteur
          libelle="Brûlures"
          variante="brulures"
          valeur={char.brulures}
          max={SEUIL_COMBUSTION}
          onChange={(v) => maj((c) => ({ ...c, brulures: v }))}
          note={
            palier === 'fureur'
              ? 'Voie de la Flamme — avantage sur tous les jets de Physique'
              : palier === 'perception'
                ? 'Voie de la Flamme — un point de 6th Sens supplémentaire'
                : undefined
          }
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
          valeur={char.marques}
          max={MAX_FOI}
          onChange={(v) => maj((c) => ({ ...c, marques: v }))}
          note={char.marques >= 3 ? 'La MJ peut prendre le contrôle de votre personnage.' : undefined}
        />

        <hr className="separateur" />

        <Compteur
          libelle="6th Sens"
          variante="sens"
          valeur={sens.restants}
          max={sens.max}
          onChange={(v) => maj((c) => ({ ...c, sixthSensUtilises: Math.max(0, sens.max - v) }))}
          note={sens.bonus > 0 ? `dont ${sens.bonus} temporaire(s)` : undefined}
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

function OngletSorts({ char, catalog }: { char: Character; catalog: Catalog }) {
  const grimoire = char.grimoire.map((id) => catalog.sort(id)).filter((s): s is Sort => Boolean(s))
  const illusions =
    char.passifs.voieTrickster === 'illusionniste'
      ? char.possede.sorts
          .map((id) => catalog.sort(id))
          .filter((s): s is Sort => Boolean(s?.illusion))
      : []

  return (
    <div className="pile">
      <section className="carte pile pile--serree">
        <div className="carte__titre">
          <span className="etiquette">Grimoire</span>
          <span className="tres-discret">{grimoire.length}/3 · figé jusqu'au feu de camp</span>
        </div>
        {grimoire.length === 0 && <p className="vide">Aucun sort préparé.</p>}
        {grimoire.map((sort) => (
          <LigneSort key={sort.id} sort={sort} char={char} catalog={catalog} />
        ))}
      </section>

      {illusions.length > 0 && (
        <section className="carte pile pile--serree">
          <div className="carte__titre">
            <span className="etiquette">Illusions</span>
            <span className="tres-discret">à volonté, hors Grimoire</span>
          </div>
          {illusions.map((sort) => (
            <LigneSort key={sort.id} sort={sort} char={char} catalog={catalog} />
          ))}
        </section>
      )}
    </div>
  )
}

function LigneSort({ sort, char, catalog }: { sort: Sort; char: Character; catalog: Catalog }) {
  const [ouvert, setOuvert] = useState(false)
  const dispo = disponibiliteSort(sort, char, catalog)
  const coutFoi = coutFoiEffectif(sort, char, catalog)

  return (
    <div>
      <button
        type="button"
        className={`objet ${dispo.disponible ? '' : 'objet--indisponible'}`}
        onClick={() => setOuvert((o) => !o)}
        aria-expanded={ouvert}
      >
        <Icone nom={sort.icone} taille={32} />
        <span className="objet__corps">
          <span className="objet__nom">{sort.nom}</span>
          <span className="objet__meta">
            {LIBELLE_MAGIE[sort.magie]} · {decrireCout(sort, coutFoi)}
            {sort.de ? ` · ${sort.de}` : ''} · {sort.duree}
          </span>
        </span>
        {char.sortsEpuises.includes(sort.id) && <span className="puce puce--desavantage">Épuisé</span>}
      </button>

      {ouvert && (
        <p className="discret" style={{ margin: '6px 4px 0' }}>
          {sort.effet}
        </p>
      )}
    </div>
  )
}

function decrireCout(sort: Sort, coutFoi: number | null): string {
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
    .filter(Boolean)

  const ameliorations = char.possede.ameliorations.map((id) => catalog.amelioration(id)).filter(Boolean)

  return (
    <div className="pile">
      <p className="alerte alerte--info">
        Ce que vous transportez sans l'avoir préparé. Les échanges se font au prochain feu de camp.
      </p>

      <section className="carte pile pile--serree">
        <span className="etiquette">Sorts en réserve</span>
        {sortsEnReserve.length === 0 && <p className="vide">Rien en réserve.</p>}
        {sortsEnReserve.map((sort) => (
          <div key={sort.id} className="objet">
            <Icone nom={sort.icone} taille={30} />
            <span className="objet__corps">
              <span className="objet__nom">{sort.nom}</span>
              <span className="objet__meta">{LIBELLE_MAGIE[sort.magie]}</span>
            </span>
          </div>
        ))}
      </section>

      <section className="carte pile pile--serree">
        <span className="etiquette">Équipement en réserve</span>
        {equipementsEnReserve.length === 0 && <p className="vide">Rien en réserve.</p>}
        {equipementsEnReserve.map((eq) => (
          <div key={eq!.id} className="objet">
            <Icone nom={eq!.icone} taille={30} />
            <span className="objet__corps">
              <span className="objet__nom">{eq!.nom}</span>
              <span className="objet__meta">
                {eq!.slot}
                {eq!.materielDeBase ? ' · matériel de base' : ''}
                {eq!.bonusEvasion ? ` · Évasion +${eq!.bonusEvasion}` : ''}
              </span>
            </span>
          </div>
        ))}
      </section>

      {ameliorations.length > 0 && (
        <section className="carte pile pile--serree">
          <span className="etiquette">Améliorations</span>
          {ameliorations.map((am) => (
            <div key={am!.id} className="objet">
              <Icone nom={am!.icone} taille={30} />
              <span className="objet__corps">
                <span className="objet__nom">{am!.nom}</span>
                <span className="objet__meta">{am!.effetTexte}</span>
              </span>
            </div>
          ))}
        </section>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------

function decrireModificateur(
  target: import('../../domain/types.ts').ModifierTarget,
  op: import('../../domain/types.ts').ModifierOp,
): string {
  const quoi =
    target.kind === 'competence'
      ? LIBELLE_COMPETENCE[target.competence]
      : target.kind === 'competence-sauf'
        ? `toutes sauf ${LIBELLE_COMPETENCE[target.except]}`
        : target.kind === 'competence-toutes'
          ? 'toutes les compétences'
          : target.kind === 'evasion'
            ? 'Évasion'
            : target.kind === 'sixth-sens'
              ? '6th Sens'
              : target.kind === 'energie-attaque'
                ? "Points d'Énergie"
                : 'coût des sorts'

  const effet =
    op.kind === 'add' ? `${op.value > 0 ? '+' : ''}${op.value}` : op.kind === 'avantage' ? 'avantage' : 'désavantage'

  return `${quoi} : ${effet}`
}
