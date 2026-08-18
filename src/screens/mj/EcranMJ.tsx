import { useEffect, useState } from 'react'

import { Compteur } from '../../components/Compteur.tsx'
import { Icone } from '../../components/Icone.tsx'
import {
  amorcerSiNecessaire,
  definirMode,
  detacher,
  enregistrerPersonnage,
  enregistrerSecret,
  exporterCatalogue,
  journaliser,
  reinitialiserCatalogue,
  supprimerPersonnage,
  surJournal,
  surSecret,
} from '../../data/repo.ts'
import type { Catalog } from '../../domain/catalog.ts'
import { computeEvasion, computeSixthSens, computeToutesCompetences } from '../../domain/competences.ts'
import { cyclesRestants, fatigueRestante, resoudreGrillePleine } from '../../domain/fatigue.ts'
import { MAX_FOI, SEUIL_COMBUSTION, modificateurMJ } from '../../domain/modifiers.ts'
import { cryptoRng } from '../../domain/random.ts'
import {
  COMPETENCES,
  LIBELLE_COMPETENCE,
  type Character,
  type CharacterSecret,
  type Competence,
  type EtatTable,
  type EvenementJournal,
} from '../../domain/types.ts'

/**
 * Écran de la MJ.
 *
 * Pensé pour un ordinateur : la liste des personnages à gauche, le détail de
 * celle qu'on manipule à droite. C'est le seul écran qui a le droit de lire les
 * cycles restants — et cette permission est appliquée par les règles Firestore,
 * pas par cette interface.
 */

interface Props {
  etat: EtatTable | null
  personnages: Character[]
  catalog: Catalog
  onDeconnexion: () => void
}

type Onglet = 'table' | 'journal' | 'reglages'

export function EcranMJ({ etat, personnages, catalog, onDeconnexion }: Props) {
  const [onglet, setOnglet] = useState<Onglet>('table')
  const [selectionId, setSelectionId] = useState<string | null>(null)

  const selection = personnages.find((c) => c.id === selectionId) ?? null

  return (
    <>
      <header className="bandeau">
        <span className="bandeau__titre">Écran MJ</span>
        {etat && (
          <div className="rangee" style={{ gap: 6 }}>
            <button
              type="button"
              className={`btn ${etat.mode === 'standard' ? 'btn--principal' : ''}`}
              onClick={() => void definirMode(etat, 'standard')}
            >
              Standard
            </button>
            <button
              type="button"
              className={`btn ${etat.mode === 'combat' ? 'btn--principal' : ''}`}
              onClick={() => void definirMode(etat, 'combat')}
            >
              Combat
            </button>
          </div>
        )}
        <button type="button" className="btn btn--fantome" onClick={onDeconnexion}>
          Quitter
        </button>
      </header>

      <div className="contenu contenu--large pile">
        <div className="onglets" role="tablist">
          {(['table', 'journal', 'reglages'] as const).map((cle) => (
            <button
              key={cle}
              type="button"
              role="tab"
              aria-selected={onglet === cle}
              className={`onglet ${onglet === cle ? 'onglet--actif' : ''}`}
              onClick={() => setOnglet(cle)}
            >
              {cle === 'table' ? 'Table' : cle === 'journal' ? 'Journal' : 'Réglages'}
            </button>
          ))}
        </div>

        {onglet === 'table' && (
          <div className="mj-grille">
            <section className="pile pile--serree">
              <span className="etiquette">Personnages ({personnages.length})</span>
              {personnages.length === 0 && (
                <p className="vide">Aucun personnage. Les joueuses en créent depuis leur écran.</p>
              )}
              {personnages.map((c) => (
                <LignePersonnage
                  key={c.id}
                  char={c}
                  catalog={catalog}
                  actif={c.id === selectionId}
                  onClick={() => setSelectionId(c.id === selectionId ? null : c.id)}
                />
              ))}
            </section>

            <div className="mj-grille__cote">
              {selection ? (
                <DetailPersonnage char={selection} catalog={catalog} onSupprime={() => setSelectionId(null)} />
              ) : (
                <p className="vide">Sélectionnez un personnage pour l'éditer.</p>
              )}
            </div>
          </div>
        )}

        {onglet === 'journal' && <Journal />}
        {onglet === 'reglages' && <Reglages />}
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------

function LignePersonnage({
  char,
  catalog,
  actif,
  onClick,
}: {
  char: Character
  catalog: Catalog
  actif: boolean
  onClick: () => void
}) {
  const classe = catalog.classe(char.classeId)
  const evasion = computeEvasion(char, catalog)
  const restante = fatigueRestante(char)

  return (
    <button type="button" className={`objet ${actif ? 'objet--actif' : ''}`} onClick={onClick}>
      <Icone nom={classe?.icone ?? 'inconnu'} taille={34} />
      <span className="objet__corps">
        <span className="objet__nom">{char.nom}</span>
        <span className="objet__meta">
          Fatigue {restante}/{char.fatigue.max} · Foi {char.foi} · Brûlures {char.brulures} ·
          Marques {char.marques} · Évasion {evasion.total} · {char.lumens} ʟ
        </span>
      </span>
      {restante === 0 && <span className="puce puce--desavantage">Grille pleine</span>}
    </button>
  )
}

// ---------------------------------------------------------------------------

function DetailPersonnage({
  char,
  catalog,
  onSupprime,
}: {
  char: Character
  catalog: Catalog
  onSupprime: () => void
}) {
  const [secret, setSecret] = useState<CharacterSecret | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [cyclesVisibles, setCyclesVisibles] = useState(false)

  useEffect(() => {
    setCyclesVisibles(false)
    return surSecret(char.id, setSecret)
  }, [char.id])

  const competences = computeToutesCompetences(char, catalog)
  const sens = computeSixthSens(char, catalog)
  const restante = fatigueRestante(char)

  const maj = (transformer: (c: Character) => Character) => {
    void enregistrerPersonnage(transformer(char))
  }

  /**
   * Ajuste la compétence via un modificateur MJ unique par compétence, plutôt
   * que d'empiler un modificateur par clic : le total reste lisible côté joueuse.
   */
  function ajusterCompetence(competence: Competence, delta: number) {
    maj((c) => {
      const existant = c.modifiers.find(
        (m) => m.source.kind === 'mj' && m.target.kind === 'competence' && m.target.competence === competence,
      )
      const valeur = (existant?.op.kind === 'add' ? existant.op.value : 0) + delta
      const autres = c.modifiers.filter((m) => m.id !== existant?.id)
      if (valeur === 0) return { ...c, modifiers: autres }

      const nouveau = modificateurMJ(
        { kind: 'competence', competence },
        { kind: 'add', value: valeur },
        `MJ — ${LIBELLE_COMPETENCE[competence]}`,
      )
      return { ...c, modifiers: [...autres, { ...nouveau, id: existant?.id ?? nouveau.id }] }
    })
  }

  async function lancerDetachement() {
    if (!confirm(`Effectuer un Détachement sur ${char.nom} ? La perte est définitive.`)) return
    const { perdu, pool } = await detacher(char, catalog)
    setMessage(
      perdu
        ? `Détachement : « ${perdu.nom} » est perdu à jamais (tiré parmi ${pool.length} éléments).`
        : "Rien à détacher : ce personnage ne possède ni sort ni équipement éligible.",
    )
  }

  async function resoudreFatiguePleine() {
    if (!secret) return
    const r = resoudreGrillePleine(char, secret, catalog, cryptoRng)
    await enregistrerPersonnage(r.char)
    await enregistrerSecret(r.secret)

    if (r.finDuPersonnage) {
      setMessage(`${char.nom} a achevé son dernier cycle. Le personnage disparaît.`)
      await journaliser('MJ', 'fin-personnage', `${char.nom} a achevé son dernier cycle.`)
    } else {
      setMessage(
        `Cycle consommé. Détachement : « ${r.detachement?.perdu?.nom ?? 'rien à perdre'} ». Cicatrice obtenue, Fatigue restaurée.`,
      )
      await journaliser(
        'MJ',
        'cycle',
        `${char.nom} achève un cycle : Détachement et Cicatrice, Fatigue restaurée.`,
      )
    }
  }

  return (
    <div className="carte pile">
      <div className="carte__titre">
        <h2>{char.nom}</h2>
        <span className="tres-discret">{catalog.classe(char.classeId)?.nom}</span>
      </div>

      {message && <p className="alerte alerte--info">{message}</p>}

      {/* --- Secret MJ --- */}
      <div className="alerte alerte--secret">
        <div className="rangee rangee--entre">
          <span className="etiquette" style={{ color: 'inherit' }}>
            Cycles — secret
          </span>
          <button type="button" className="btn btn--fantome" onClick={() => setCyclesVisibles((v) => !v)}>
            {cyclesVisibles ? 'Masquer' : 'Révéler'}
          </button>
        </div>
        {cyclesVisibles &&
          (secret ? (
            <p style={{ margin: '6px 0 0' }}>
              {cyclesRestants(secret)} cycle(s) restant(s) sur {secret.cyclesTotal}.
            </p>
          ) : (
            <p style={{ margin: '6px 0 0' }} className="tres-discret">
              Aucun secret enregistré pour ce personnage.
            </p>
          ))}
      </div>

      {/* --- Compétences --- */}
      <section className="pile pile--serree">
        <span className="etiquette">Compétences</span>
        {COMPETENCES.map((c) => {
          const v = competences[c]
          return (
            <div key={c} className="competence">
              <span className="competence__nom">{LIBELLE_COMPETENCE[c]}</span>
              <span className="tres-discret">
                base {v.base > 0 ? '+' : ''}
                {v.base}
              </span>
              <button type="button" className="pas" onClick={() => ajusterCompetence(c, -1)}>
                −
              </button>
              <span className="competence__total">
                {v.total > 0 ? '+' : ''}
                {v.total}
              </span>
              <button type="button" className="pas" onClick={() => ajusterCompetence(c, +1)}>
                +
              </button>
            </div>
          )
        })}
      </section>

      <hr className="separateur" />

      {/* --- Ressources --- */}
      <Compteur
        libelle="Fatigue"
        variante="fatigue"
        valeur={char.fatigue.coches}
        max={char.fatigue.max}
        onChange={(v) => maj((c) => ({ ...c, fatigue: { ...c.fatigue, coches: v } }))}
      />
      <Compteur
        libelle="Brûlures"
        variante="brulures"
        valeur={char.brulures}
        max={SEUIL_COMBUSTION}
        onChange={(v) => maj((c) => ({ ...c, brulures: v }))}
      />
      <Compteur
        libelle="Points de Foi"
        variante="foi"
        valeur={char.foi}
        max={MAX_FOI}
        onChange={(v) => maj((c) => ({ ...c, foi: v }))}
      />
      <Compteur
        libelle="Marques"
        variante="marques"
        valeur={char.marques}
        max={MAX_FOI}
        onChange={(v) => maj((c) => ({ ...c, marques: v }))}
      />
      <Compteur
        libelle="6th Sens"
        variante="sens"
        valeur={sens.restants}
        max={sens.max}
        onChange={(v) => maj((c) => ({ ...c, sixthSensUtilises: Math.max(0, sens.max - v) }))}
      />

      <label className="champ">
        <span className="etiquette">Lumens</span>
        <input
          type="number"
          min={0}
          value={char.lumens}
          onChange={(e) => maj((c) => ({ ...c, lumens: Math.max(0, Number(e.target.value) || 0) }))}
        />
      </label>

      <hr className="separateur" />

      <div className="pile pile--serree">
        <button type="button" className="btn btn--danger btn--large" onClick={() => void lancerDetachement()}>
          Effectuer un Détachement
        </button>

        {restante === 0 && (
          <button type="button" className="btn btn--danger btn--large" onClick={() => void resoudreFatiguePleine()}>
            Résoudre la grille pleine (cycle, Détachement, Cicatrice)
          </button>
        )}

        <button
          type="button"
          className="btn btn--fantome btn--large"
          onClick={() => {
            if (confirm(`Supprimer définitivement ${char.nom} ?`)) {
              void supprimerPersonnage(char).then(onSupprime)
            }
          }}
        >
          Supprimer ce personnage
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------

function Journal() {
  const [evenements, setEvenements] = useState<EvenementJournal[]>([])
  useEffect(() => surJournal(setEvenements), [])

  return (
    <section className="carte pile pile--serree">
      <div className="carte__titre">
        <span className="etiquette">Journal</span>
        <span className="tres-discret">{evenements.length} événement(s) · visible de vous seule</span>
      </div>
      {evenements.length === 0 && <p className="vide">Rien à signaler pour l'instant.</p>}
      {evenements.map((e) => (
        <div key={e.id} className="objet">
          <span className="objet__corps">
            <span className="objet__nom" style={{ fontSize: '0.94rem' }}>
              {e.resume}
            </span>
            <span className="objet__meta">
              {new Date(e.ts).toLocaleString('fr-FR')} · {e.acteur}
            </span>
          </span>
        </div>
      ))}
    </section>
  )
}

// ---------------------------------------------------------------------------

function Reglages() {
  const [message, setMessage] = useState<string | null>(null)

  async function amorcer() {
    const r = await amorcerSiNecessaire()
    setMessage(
      `${r.entreesAjoutees} entrée(s) ajoutée(s) au catalogue${r.etatCree ? ", état de table créé" : ''}.`,
    )
  }

  async function exporter() {
    const json = await exporterCatalogue()
    await navigator.clipboard?.writeText(json).catch(() => undefined)
    setMessage(`Catalogue exporté (${json.length} caractères) et copié dans le presse-papier.`)
  }

  async function reinitialiser() {
    if (!confirm('Réécrire tout le catalogue par-dessus vos modifications ?')) return
    await reinitialiserCatalogue()
    setMessage('Catalogue réinitialisé depuis le contenu livré avec l’app.')
  }

  return (
    <section className="carte pile">
      <span className="etiquette">Catalogue</span>
      <p className="discret" style={{ margin: 0 }}>
        Le contenu vit dans la base et sera éditable depuis cet écran au lot 3. En attendant,
        l'amorçage installe les 3 classes et leurs sorts, et l'export vous donne une sauvegarde.
      </p>

      {message && <p className="alerte alerte--info">{message}</p>}

      <button type="button" className="btn btn--large" onClick={() => void amorcer()}>
        Amorcer le contenu manquant
      </button>
      <button type="button" className="btn btn--large" onClick={() => void exporter()}>
        Exporter le catalogue (JSON)
      </button>
      <button type="button" className="btn btn--danger btn--large" onClick={() => void reinitialiser()}>
        Réinitialiser le catalogue
      </button>
    </section>
  )
}
