import { useState } from 'react'

import { EditeurActifs } from '../../components/EditeurActifs.tsx'
import { FiltresCatalogue } from '../../components/FiltresCatalogue.tsx'
import { EditeurCout } from '../../components/EditeurCout.tsx'
import { EditeurPassifs } from '../../components/EditeurPassifs.tsx'
import { Icone } from '../../components/Icone.tsx'
import { ICONES_DISPONIBLES } from '../../content/icones.ts'
import { enregistrerEntreeCatalogue, supprimerEntreeCatalogue } from '../../data/repo.ts'
import { prixDe } from '../../domain/campfire.ts'
import type { Catalog } from '../../domain/catalog.ts'
import { COUT_GRATUIT } from '../../domain/couts.ts'
import {
  dossiersDe,
  familleRangeable,
  FILTRES_VIERGES,
  filtrerEntrees,
  type FiltresCatalogue as Filtres,
} from '../../domain/filtres.ts'
import { classesDuSort, libelleMagie } from '../../domain/magie.ts'
import {
  RARETES,
  LIBELLE_SLOT,
  SLOTS_EQUIPEMENT,
  type Amelioration,
  type Classe,
  type Dossier,
  type EntreeCatalogue,
  type Equipement,
  type Investissement,
  type Rarete,
  type Sort,
  type TypeMagique,
} from '../../domain/types.ts'

/**
 * Éditeur du contenu du jeu.
 *
 * Les guidelines l'exigent : « il faut que cela soit simple d'ajouter plus de
 * sorts, équipements, investissements et autres améliorations ». C'est aussi
 * la seule voie fiable — le contenu que je livre en dur n'atteint jamais une
 * base déjà amorcée, puisque l'amorçage n'écrase jamais l'existant.
 *
 * Les entrées livrées avec l'app (`seed`) sont modifiables et supprimables ;
 * le drapeau ne sert plus qu'à les faire revenir lors d'une réinitialisation.
 */

type Onglet = 'equipement' | 'amelioration' | 'investissement' | 'sort' | 'dossier'

const LIBELLE_ONGLET: Record<Onglet, string> = {
  equipement: 'Équipements',
  amelioration: 'Améliorations',
  investissement: 'Investissements',
  sort: 'Sorts',
  dossier: 'Dossiers',
}

const LIBELLE_CIBLE_DOSSIER: Record<Dossier['cible'], string> = {
  equipement: 'Des équipements',
  sort: 'Des sorts',
  amelioration: 'Des améliorations',
}

export function EditeurCatalogue({ catalog }: { catalog: Catalog }) {
  const [onglet, setOnglet] = useState<Onglet>('equipement')
  const [edition, setEdition] = useState<EntreeCatalogue | null>(null)
  // Les filtres repartent à zéro en changeant d'onglet : un « armure » laissé
  // actif ferait croire à un catalogue de sorts vide.
  const [filtres, setFiltres] = useState<Filtres>(FILTRES_VIERGES)

  function changerOnglet(cle: Onglet) {
    setOnglet(cle)
    setEdition(null)
    setFiltres(FILTRES_VIERGES)
  }

  const entrees = filtrerEntrees(catalog.toutes().filter((e) => e.kind === onglet), filtres)

  return (
    <section className="carte pile pile--serree">
      <div className="carte__titre">
        <span className="etiquette">Catalogue</span>
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

      <FiltresCatalogue
        kind={onglet}
        valeur={filtres}
        catalog={catalog}
        total={entrees.length}
        onChange={setFiltres}
      />

      {entrees.length === 0 && !edition && <p className="vide">Rien pour l'instant.</p>}

      {entrees.map((e) => (
        <div key={e.id} className="objet">
          <Icone nom={e.icone} taille={28} teinte={RARETES[e.rarete ?? 'commun'].teinte} />
          <span className="objet__corps">
            <span className="objet__nom">{e.nom}</span>
            <span className="objet__meta">{resume(e, catalog)}</span>
          </span>
          <button type="button" className="btn" onClick={() => setEdition(e)}>
            Modifier
          </button>
          <button
            type="button"
            className="btn btn--danger"
            onClick={() => {
              // Les entrées livrées se suppriment aussi : c'est le seul moyen de
              // nettoyer le catalogue de mes exemples.
              const avertissement = e.seed
                ? ` Elle reviendra si vous réinitialisez le catalogue.`
                : ''
              if (confirm(`Supprimer « ${e.nom} » du catalogue ?${avertissement}`)) {
                void supprimerEntreeCatalogue(e)
              }
            }}
            aria-label={`Supprimer ${e.nom}`}
          >
            ×
          </button>
        </div>
      ))}

      {edition ? (
        <Formulaire
          entree={edition}
          classes={catalog.classes()}
          typesMagiques={catalog.typesMagiques()}
          dossiers={catalog.dossiers()}
          onAnnuler={() => setEdition(null)}
          // Le formulaire ne se ferme qu'une fois l'écriture acceptée : sinon un
          // refus de Firestore — que le bandeau d'erreur signale — laissait
          // croire à un enregistrement réussi, et la saisie était perdue.
          onEnregistrer={async (e) => {
            await enregistrerEntreeCatalogue(e)
            setEdition(null)
          }}
        />
      ) : (
        <button
          type="button"
          className="btn btn--principal btn--large"
          onClick={() => setEdition(vierge(onglet, catalog.typesMagiques()))}
        >
          Ajouter — {LIBELLE_ONGLET[onglet].toLowerCase()}
        </button>
      )}
    </section>
  )
}

// ---------------------------------------------------------------------------

function resume(e: EntreeCatalogue, catalog: Catalog): string {
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
      return `${libelleMagie(e.magieId, catalog)}${prix ? ` · ${prix} ʟ` : ' · hors boutique'}`
    case 'dossier':
      return `Dossier · ${LIBELLE_CIBLE_DOSSIER[e.cible]}`
    default:
      return ''
  }
}

/**
 * Nettoie l'entrée avant écriture.
 *
 * ⚠️ Il fallait aussi, jusqu'ici, réaligner à la main le libellé de chaque
 * passif sur le nom de l'entrée : ce libellé était figé au moment de la
 * saisie, si bien que renommer l'objet ensuite — ou le nommer *après* avoir
 * composé ses passifs, ce qui est l'ordre naturel — laissait un « Objet »
 * générique sur la fiche de la joueuse. Le repli est désormais dans le moteur
 * (`compilerPassif`, `modifiers.ts`), qui relit le nom du porteur à chaque
 * rendu : il n'y a plus rien à recopier, ni à ne pas oublier de recopier.
 */
function nettoyer(entree: EntreeCatalogue): EntreeCatalogue {
  return { ...entree, nom: entree.nom.trim() }
}

function nouvelId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `cat-${Date.now()}`
}

function vierge(onglet: Onglet, typesMagiques: TypeMagique[]): EntreeCatalogue {
  // `creeLe` n'est posé qu'ici : les entrées écrites avant son existence n'en
  // ont pas, et se trient comme les plus anciennes. C'est le comportement
  // attendu, et il évite d'inventer une date qu'on ne connaît pas.
  const base = { id: nouvelId(), nom: '', icone: 'crystal-shine', creeLe: Date.now() }
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
    case 'dossier':
      // Le dossier « ALL » n'est jamais créé : c'est l'absence de filtre.
      return { ...base, kind: 'dossier', cible: 'equipement', ordre: 0 } as Dossier
    case 'sort':
      return {
        ...base,
        kind: 'sort',
        magieId: typesMagiques[0]?.id ?? 'arcane',
        cout: COUT_GRATUIT,
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
  typesMagiques,
  dossiers,
  onAnnuler,
  onEnregistrer,
}: {
  entree: EntreeCatalogue
  classes: Classe[]
  typesMagiques: TypeMagique[]
  dossiers: Dossier[]
  onAnnuler: () => void
  onEnregistrer: (e: EntreeCatalogue) => Promise<void>
}) {
  const [brouillon, setBrouillon] = useState<EntreeCatalogue>(entree)
  const famille = familleRangeable(brouillon.kind)

  // Toutes les options de classe, pour désigner celle qui débloque un sort.
  const optionsDeClasse = classes.flatMap((c) =>
    (c.choix ?? []).flatMap((ch) => ch.options.map((o) => ({ ...o, classe: c.nom }))),
  )
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

      {/* La rareté vaut pour toute entrée du catalogue, sort compris : c'est le
          palier qu'une joueuse lit en boutique avant de dépenser ses Lumens. */}
      <label className="champ">
        <span className="tres-discret">Rareté — donne sa couleur à l'icône</span>
        <select
          value={brouillon.rarete ?? 'commun'}
          onChange={(e) => maj({ rarete: e.target.value as Rarete })}
        >
          {(Object.keys(RARETES) as Rarete[]).map((r) => (
            <option key={r} value={r}>
              {RARETES[r].libelle}
            </option>
          ))}
        </select>
      </label>

      {/* Le rangement : une entrée appartient à zéro ou un dossier. */}
      {famille && (
        <label className="champ">
          <span className="tres-discret">Dossier</span>
          <select
            value={brouillon.dossierId ?? ''}
            onChange={(e) => maj({ dossierId: e.target.value || undefined })}
          >
            <option value="">Non classé</option>
            {dossiersDe({ dossiers: () => dossiers }, famille).map((d) => (
              <option key={d.id} value={d.id}>
                {d.nom}
              </option>
            ))}
          </select>
        </label>
      )}

      {brouillon.kind === 'dossier' && (
        <label className="champ">
          <span className="tres-discret">Ce que ce dossier range</span>
          <select
            value={brouillon.cible}
            onChange={(e) => maj({ cible: e.target.value as Dossier['cible'] })}
          >
            {(Object.keys(LIBELLE_CIBLE_DOSSIER) as Dossier['cible'][]).map((c) => (
              <option key={c} value={c}>
                {LIBELLE_CIBLE_DOSSIER[c]}
              </option>
            ))}
          </select>
        </label>
      )}

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

          <EditeurPassifs
            valeur={brouillon.passifs ?? []}
            onChange={(passifs) => maj({ passifs })}
          />

          <EditeurActifs
            valeur={brouillon.actifs ?? []}
            nomPorteur={brouillon.nom}
            onChange={(actifs) => maj({ actifs })}
          />
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

          {/* Une amélioration n'a pas d'emplacement : ses passifs valent dès
              qu'elle est possédée. */}
          <EditeurPassifs
            valeur={brouillon.passifs ?? []}
            onChange={(passifs) => maj({ passifs })}
          />
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
              {/* Les types magiques sont du contenu : en créer un le fait
                  apparaître ici, sans toucher au code. */}
              <select value={brouillon.magieId} onChange={(e) => maj({ magieId: e.target.value })}>
                {typesMagiques.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nom}
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

          {/* Le coût d'un sort n'était éditable nulle part : tout sort composé
              depuis cet écran naissait gratuit, quoi qu'en dise son texte. */}
          <EditeurCout
            valeur={brouillon.cout}
            label="Coût du sort"
            onChange={(cout) => maj({ cout })}
          />

          <EditeurActifs
            valeur={brouillon.actifs ?? []}
            nomPorteur={brouillon.nom}
            onChange={(actifs) => maj({ actifs })}
          />

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

          {/* Généralise l'ancienne case « Illusion » : n'importe quelle option
              de classe peut désormais débloquer un sort, et pas seulement la
              voie Illusionniste du Trickster. */}
          <label className="champ">
            <span className="tres-discret">
              Débloqué par un passif de classe — hors des 3 emplacements et hors boutique
            </span>
            <select
              value={brouillon.requiertPassif ?? ''}
              onChange={(e) => maj({ requiertPassif: e.target.value || undefined })}
            >
              <option value="">Aucun — sort ordinaire</option>
              {optionsDeClasse.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.nom} ({o.classe})
                </option>
              ))}
            </select>
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
          onClick={() => void onEnregistrer(nettoyer(brouillon))}
          disabled={!brouillon.nom.trim()}
        >
          Enregistrer
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
