import { useState } from 'react'

import { Icone } from '../../components/Icone.tsx'
import { ICONES_DISPONIBLES } from '../../content/icones.ts'
import { enregistrerEntreeCatalogue, supprimerEntreeCatalogue } from '../../data/repo.ts'
import { prixDe } from '../../domain/campfire.ts'
import type { Catalog } from '../../domain/catalog.ts'
import { classesDuSort, sortOuvertA } from '../../domain/magie.ts'
import {
  LIBELLE_MAGIE,
  LIBELLE_SLOT,
  MAGIES,
  SLOTS_EQUIPEMENT,
  type Amelioration,
  type Classe,
  type EntreeCatalogue,
  type Equipement,
  type Investissement,
  type Sort,
} from '../../domain/types.ts'

/**
 * Éditeur du contenu du jeu.
 *
 * Les guidelines l'exigent : « il faut que cela soit simple d'ajouter plus de
 * sorts, équipements, investissements et autres améliorations ». C'est aussi
 * la seule voie fiable — le contenu que je livre en dur n'atteint jamais une
 * base déjà amorcée, puisque l'amorçage n'écrase jamais l'existant.
 *
 * Les entrées livrées avec l'app (`seed`) restent modifiables mais ne peuvent
 * pas être supprimées.
 */

type Onglet = 'equipement' | 'amelioration' | 'investissement' | 'sort'

const LIBELLE_ONGLET: Record<Onglet, string> = {
  equipement: 'Équipements',
  amelioration: 'Améliorations',
  investissement: 'Investissements',
  sort: 'Sorts',
}

export function EditeurCatalogue({ catalog }: { catalog: Catalog }) {
  const [onglet, setOnglet] = useState<Onglet>('equipement')
  const [edition, setEdition] = useState<EntreeCatalogue | null>(null)
  // Un filtre par axe, remis à zéro en changeant d'onglet : un filtre « armure »
  // laissé actif ferait croire à un catalogue de sorts vide.
  const [filtreSlot, setFiltreSlot] = useState('')
  const [filtreMagie, setFiltreMagie] = useState('')
  const [filtreClasse, setFiltreClasse] = useState('')
  const [triPrix, setTriPrix] = useState(false)

  function changerOnglet(cle: Onglet) {
    setOnglet(cle)
    setEdition(null)
    setFiltreSlot('')
    setFiltreMagie('')
    setFiltreClasse('')
    setTriPrix(false)
  }

  const entrees = catalog
    .toutes()
    .filter((e) => e.kind === onglet)
    .filter((e) => !(filtreSlot && e.kind === 'equipement' && e.slot !== filtreSlot))
    .filter((e) => !(filtreMagie && e.kind === 'sort' && e.magie !== filtreMagie))
    .filter((e) => !(filtreClasse && e.kind === 'sort' && !sortOuvertA(e, filtreClasse)))
    .sort((a, b) => (triPrix ? (prixDe(a) ?? Infinity) - (prixDe(b) ?? Infinity) : 0))

  return (
    <section className="carte pile pile--serree">
      <div className="carte__titre">
        <span className="etiquette">Catalogue</span>
        <span className="tres-discret">{entrees.length} entrée(s)</span>
      </div>

      <div className="onglets" role="tablist">
        {(Object.keys(LIBELLE_ONGLET) as Onglet[]).map((cle) => (
          <button
            key={cle}
            type="button"
            role="tab"
            aria-selected={onglet === cle}
            className={`onglet ${onglet === cle ? 'onglet--actif' : ''}`}
            onClick={() => changerOnglet(cle)}
          >
            {LIBELLE_ONGLET[cle]}
          </button>
        ))}
      </div>

      {/* Un catalogue de table devient vite long : sans filtres, retrouver une
          armure parmi trente entrées se fait à l'œil. */}
      {onglet === 'equipement' && (
        <div className="rangee">
          <select value={filtreSlot} onChange={(e) => setFiltreSlot(e.target.value)} style={{ flex: 1 }}>
            <option value="">Tous les emplacements</option>
            {SLOTS_EQUIPEMENT.map((s) => (
              <option key={s} value={s}>
                {LIBELLE_SLOT[s]}
              </option>
            ))}
          </select>
          <button
            type="button"
            className={`btn ${triPrix ? 'btn--principal' : ''}`}
            onClick={() => setTriPrix((t) => !t)}
          >
            Trier par prix
          </button>
        </div>
      )}

      {onglet === 'sort' && (
        <div className="rangee">
          <select value={filtreMagie} onChange={(e) => setFiltreMagie(e.target.value)} style={{ flex: 1 }}>
            <option value="">Toutes les magies</option>
            {MAGIES.map((m) => (
              <option key={m} value={m}>
                {LIBELLE_MAGIE[m]}
              </option>
            ))}
          </select>
          <select value={filtreClasse} onChange={(e) => setFiltreClasse(e.target.value)} style={{ flex: 1 }}>
            <option value="">Toutes les classes</option>
            {catalog.classes().map((c) => (
              <option key={c.id} value={c.id}>
                {c.nom}
              </option>
            ))}
          </select>
        </div>
      )}

      {entrees.length === 0 && !edition && <p className="vide">Rien pour l'instant.</p>}

      {entrees.map((e) => (
        <div key={e.id} className="objet">
          <Icone nom={e.icone} taille={28} />
          <span className="objet__corps">
            <span className="objet__nom">{e.nom}</span>
            <span className="objet__meta">{resume(e)}</span>
          </span>
          <button type="button" className="btn" onClick={() => setEdition(e)}>
            Modifier
          </button>
          {!e.seed && (
            <button
              type="button"
              className="btn btn--danger"
              onClick={() => {
                if (confirm(`Supprimer « ${e.nom} » du catalogue ?`)) {
                  void supprimerEntreeCatalogue(e)
                }
              }}
              aria-label={`Supprimer ${e.nom}`}
            >
              ×
            </button>
          )}
        </div>
      ))}

      {edition ? (
        <Formulaire
          entree={edition}
          classes={catalog.classes()}
          onAnnuler={() => setEdition(null)}
          onEnregistrer={(e) => {
            void enregistrerEntreeCatalogue(e)
            setEdition(null)
          }}
        />
      ) : (
        <button
          type="button"
          className="btn btn--principal btn--large"
          onClick={() => setEdition(vierge(onglet))}
        >
          Ajouter — {LIBELLE_ONGLET[onglet].toLowerCase()}
        </button>
      )}
    </section>
  )
}

// ---------------------------------------------------------------------------

function resume(e: EntreeCatalogue): string {
  const prix = prixDe(e)
  switch (e.kind) {
    case 'equipement':
      return [
        LIBELLE_SLOT[e.slot],
        e.bonusEvasion ? `Évasion +${e.bonusEvasion}` : null,
        prix ? `${prix} ʟ` : 'hors boutique',
        e.materielDeBase ? 'matériel de base' : null,
      ]
        .filter(Boolean)
        .join(' · ')
    case 'amelioration':
      return `${e.prix} ʟ · ${e.effetTexte}`
    case 'investissement':
      return `${e.cout} ʟ · ${e.beneficeTexte}`
    case 'sort':
      return `${LIBELLE_MAGIE[e.magie]}${prix ? ` · ${prix} ʟ` : ' · hors boutique'}`
    default:
      return ''
  }
}

function nouvelId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `cat-${Date.now()}`
}

function vierge(onglet: Onglet): EntreeCatalogue {
  const base = { id: nouvelId(), nom: '', icone: 'crystal-shine' }
  switch (onglet) {
    case 'equipement':
      return { ...base, kind: 'equipement', slot: 'arme' } as Equipement
    case 'amelioration':
      return { ...base, kind: 'amelioration', prix: 50, effetTexte: '' } as Amelioration
    case 'investissement':
      return {
        ...base,
        kind: 'investissement',
        cout: 50,
        beneficeTexte: '',
        risqueTexte: '',
        limiteTexte: '',
      } as Investissement
    case 'sort':
      return {
        ...base,
        kind: 'sort',
        magie: 'arcane',
        cout: { kind: 'aucun' },
        de: null,
        duree: 'Instantané',
        effet: '',
      } as Sort
  }
}

// ---------------------------------------------------------------------------

function Formulaire({
  entree,
  classes,
  onAnnuler,
  onEnregistrer,
}: {
  entree: EntreeCatalogue
  classes: Classe[]
  onAnnuler: () => void
  onEnregistrer: (e: EntreeCatalogue) => void
}) {
  const [brouillon, setBrouillon] = useState<EntreeCatalogue>(entree)
  const maj = (patch: Record<string, unknown>) =>
    setBrouillon({ ...brouillon, ...patch } as EntreeCatalogue)

  /** Un champ numérique vide vaut « non renseigné », pas zéro. */
  const nombre = (v: string): number | undefined => (v === '' ? undefined : Math.max(0, Number(v) || 0))

  return (
    <div className="carte pile pile--serree" style={{ background: 'var(--encre)' }}>
      <span className="etiquette">{entree.nom ? `Modifier — ${entree.nom}` : 'Nouvelle entrée'}</span>

      <label className="champ">
        <span className="tres-discret">Nom</span>
        <input type="text" value={brouillon.nom} onChange={(e) => maj({ nom: e.target.value })} />
      </label>

      <label className="champ">
        <span className="tres-discret">Description</span>
        <textarea
          value={brouillon.description ?? ''}
          onChange={(e) => maj({ description: e.target.value })}
          placeholder="Ce que la joueuse lira en touchant l'objet."
        />
      </label>

      {brouillon.kind === 'equipement' && (
        <>
          <div className="rangee">
            <label className="champ" style={{ flex: 1, minWidth: 120 }}>
              <span className="tres-discret">Emplacement</span>
              <select value={brouillon.slot} onChange={(e) => maj({ slot: e.target.value })}>
                {SLOTS_EQUIPEMENT.map((s) => (
                  <option key={s} value={s}>
                    {LIBELLE_SLOT[s]}
                  </option>
                ))}
              </select>
            </label>
            <label className="champ" style={{ flex: 1, minWidth: 100 }}>
              <span className="tres-discret">Prix (ʟ)</span>
              <input
                type="number"
                min={0}
                value={brouillon.prix ?? ''}
                placeholder="hors boutique"
                onChange={(e) => maj({ prix: nombre(e.target.value) })}
              />
            </label>
            <label className="champ" style={{ flex: 1, minWidth: 100 }}>
              <span className="tres-discret">Évasion</span>
              <input
                type="number"
                min={0}
                value={brouillon.bonusEvasion ?? ''}
                placeholder="—"
                onChange={(e) => maj({ bonusEvasion: nombre(e.target.value) })}
              />
            </label>
          </div>
          <label className="rangee" style={{ gap: 8 }}>
            <input
              type="checkbox"
              checked={brouillon.materielDeBase ?? false}
              onChange={(e) => maj({ materielDeBase: e.target.checked })}
            />
            <span className="tres-discret">
              Matériel de base — hors des 3 emplacements, exclu du Détachement et de la boutique
            </span>
          </label>
        </>
      )}

      {brouillon.kind === 'amelioration' && (
        <>
          <label className="champ">
            <span className="tres-discret">Prix (ʟ)</span>
            <input
              type="number"
              min={0}
              value={brouillon.prix}
              onChange={(e) => maj({ prix: Math.max(0, Number(e.target.value) || 0) })}
            />
          </label>
          <label className="champ">
            <span className="tres-discret">Effet</span>
            <input
              type="text"
              value={brouillon.effetTexte}
              onChange={(e) => maj({ effetTexte: e.target.value })}
            />
          </label>
        </>
      )}

      {brouillon.kind === 'investissement' && (
        <>
          <div className="rangee">
            <label className="champ" style={{ flex: 1, minWidth: 100 }}>
              <span className="tres-discret">Coût (ʟ)</span>
              <input
                type="number"
                min={0}
                value={brouillon.cout}
                onChange={(e) => maj({ cout: Math.max(0, Number(e.target.value) || 0) })}
              />
            </label>
            <label className="champ" style={{ flex: 1, minWidth: 120 }}>
              <span className="tres-discret">Risque (0 à 1)</span>
              <input
                type="number"
                min={0}
                max={1}
                step={0.05}
                value={brouillon.probabiliteRisque ?? ''}
                placeholder="—"
                onChange={(e) =>
                  maj({
                    probabiliteRisque:
                      e.target.value === '' ? undefined : Math.min(1, Math.max(0, Number(e.target.value) || 0)),
                  })
                }
              />
            </label>
          </div>

          <p className="tres-discret" style={{ margin: 0 }}>
            Le risque est la probabilité que le <em>mauvais</em> dénouement survienne. S'il
            s'accompagne d'un coût de risque, il fait payer ce montant ; sinon il annule le bénéfice.
          </p>

          <div className="rangee">
            {(
              [
                ['gainImmediat', 'Gain immédiat'],
                ['gainProchainSession', 'Gain prochaine session'],
                ['gainRecurrent', 'Gain récurrent'],
                ['coutRisque', 'Coût du risque'],
              ] as const
            ).map(([cle, libelle]) => (
              <label key={cle} className="champ" style={{ flex: 1, minWidth: 110 }}>
                <span className="tres-discret">{libelle}</span>
                <input
                  type="number"
                  min={0}
                  value={brouillon[cle] ?? ''}
                  placeholder="—"
                  onChange={(e) => maj({ [cle]: nombre(e.target.value) })}
                />
              </label>
            ))}
          </div>

          <div className="rangee">
            <label className="champ" style={{ flex: 1, minWidth: 110 }}>
              <span className="tres-discret">Limite totale</span>
              <input
                type="number"
                min={0}
                value={brouillon.limiteTotale ?? ''}
                placeholder="—"
                onChange={(e) => maj({ limiteTotale: nombre(e.target.value) })}
              />
            </label>
            <label className="champ" style={{ flex: 1, minWidth: 110 }}>
              <span className="tres-discret">Limite par session</span>
              <input
                type="number"
                min={0}
                value={brouillon.limiteParSession ?? ''}
                placeholder="—"
                onChange={(e) => maj({ limiteParSession: nombre(e.target.value) })}
              />
            </label>
          </div>

          {(
            [
              ['beneficeTexte', 'Bénéfice, en toutes lettres'],
              ['risqueTexte', 'Risque, en toutes lettres'],
              ['limiteTexte', 'Limite, en toutes lettres'],
            ] as const
          ).map(([cle, libelle]) => (
            <label key={cle} className="champ">
              <span className="tres-discret">{libelle}</span>
              <input type="text" value={brouillon[cle]} onChange={(e) => maj({ [cle]: e.target.value })} />
            </label>
          ))}
        </>
      )}

      {brouillon.kind === 'sort' && (
        <>
          <div className="rangee">
            <label className="champ" style={{ flex: 1, minWidth: 120 }}>
              <span className="tres-discret">Magie</span>
              <select value={brouillon.magie} onChange={(e) => maj({ magie: e.target.value })}>
                {MAGIES.map((m) => (
                  <option key={m} value={m}>
                    {LIBELLE_MAGIE[m]}
                  </option>
                ))}
              </select>
            </label>
            <label className="champ" style={{ flex: 1, minWidth: 100 }}>
              <span className="tres-discret">Dé</span>
              <input
                type="text"
                value={brouillon.de ?? ''}
                placeholder="1d6"
                onChange={(e) => maj({ de: e.target.value || null })}
              />
            </label>
            <label className="champ" style={{ flex: 1, minWidth: 100 }}>
              <span className="tres-discret">Prix (ʟ)</span>
              <input
                type="number"
                min={0}
                value={brouillon.prix ?? ''}
                placeholder="hors boutique"
                onChange={(e) => maj({ prix: nombre(e.target.value) })}
              />
            </label>
          </div>
          <label className="champ">
            <span className="tres-discret">Durée</span>
            <input type="text" value={brouillon.duree} onChange={(e) => maj({ duree: e.target.value })} />
          </label>
          <label className="champ">
            <span className="tres-discret">Effet</span>
            <textarea value={brouillon.effet} onChange={(e) => maj({ effet: e.target.value })} />
          </label>

          {/* Rien de coché = ouvert à toutes les classes. C'est la lecture la
              plus permissive, et elle n'oblige à rien renseigner pour un sort
              commun. */}
          <div className="champ">
            <span className="tres-discret">
              Classes éligibles — aucune cochée : ouvert à toutes
            </span>
            <div className="rangee">
              {classes.map((c) => {
                const choisies = classesDuSort(brouillon as Sort)
                const actif = choisies.includes(c.id)
                return (
                  <button
                    key={c.id}
                    type="button"
                    className={`btn ${actif ? 'btn--principal' : ''}`}
                    aria-pressed={actif}
                    onClick={() =>
                      maj({
                        classesIds: actif
                          ? choisies.filter((id) => id !== c.id)
                          : [...choisies, c.id],
                        // L'ancien champ au singulier disparaît dès qu'on touche
                        // à la liste, sinon les deux divergeraient.
                        classeId: undefined,
                      })
                    }
                  >
                    {c.nom}
                  </button>
                )
              })}
            </div>
          </div>

          <label className="rangee" style={{ gap: 8 }}>
            <input
              type="checkbox"
              checked={brouillon.illusion === true}
              style={{ minHeight: 0, width: 'auto' }}
              onChange={(e) => maj({ illusion: e.target.checked || undefined })}
            />
            <span className="tres-discret">
              Illusion — accordée par le passif Illusionniste, hors des 3 emplacements et hors
              boutique
            </span>
          </label>
        </>
      )}

      <div className="champ">
        <span className="tres-discret">Icône</span>
        <div className="grille-icones" role="radiogroup" aria-label="Icône">
          {ICONES_DISPONIBLES.map((nom) => (
            <button
              key={nom}
              type="button"
              role="radio"
              aria-checked={brouillon.icone === nom}
              aria-label={nom}
              title={nom}
              className={`choix-icone ${brouillon.icone === nom ? 'choix-icone--actif' : ''}`}
              onClick={() => maj({ icone: nom })}
            >
              <Icone nom={nom} taille={30} />
            </button>
          ))}
        </div>
      </div>

      <div className="rangee">
        <button type="button" className="btn btn--fantome" onClick={onAnnuler}>
          Annuler
        </button>
        <button
          type="button"
          className="btn btn--principal"
          style={{ flex: 1 }}
          onClick={() => onEnregistrer({ ...brouillon, nom: brouillon.nom.trim() })}
          disabled={!brouillon.nom.trim()}
        >
          Enregistrer
        </button>
      </div>
    </div>
  )
}
