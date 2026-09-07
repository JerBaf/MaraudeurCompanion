import { useState } from 'react'

import { EditeurActifs } from '../../components/EditeurActifs.tsx'
import { EditeurChoixClasse } from '../../components/EditeurChoixClasse.tsx'
import { EditeurCout } from '../../components/EditeurCout.tsx'
import { EditeurPassifs } from '../../components/EditeurPassifs.tsx'
import { Icone } from '../../components/Icone.tsx'
import { ICONES_DISPONIBLES } from '../../content/icones.ts'
import { ELEMENTS_PAYABLES } from '../../domain/couts.ts'
import { COUT_GRATUIT } from '../../domain/couts.ts'
import { dossiersDe, estRangeable } from '../../domain/filtres.ts'
import { ELEMENTS_VARIABLES } from '../../domain/elements.ts'
import { classesDuSort } from '../../domain/magie.ts'
import {
  RARETES,
  LIBELLE_SLOT,
  SLOTS_EQUIPEMENT,
  type Amelioration,
  type Classe,
  type Dossier,
  type EntreeCatalogue,
  type EntreeCatalogueBase,
  type Equipement,
  type Investissement,
  type Quete,
  type Rarete,
  type Sort,
  type TypeMagique,
} from '../../domain/types.ts'

/**
 * Le formulaire d'une entrée de catalogue — un seul, pour tous les types.
 *
 * Extrait de `EditeurCatalogue` parce que deux écrans en ont besoin : celui qui
 * **corrige** ce qui existe, et l'onglet **Création** qui fabrique du neuf. Le
 * dupliquer aurait garanti qu'ils divergent au premier champ ajouté.
 *
 * Les guidelines l'exigent : « il faut que cela soit simple d'ajouter plus de
 * sorts, équipements, investissements et autres améliorations ». C'est aussi la
 * seule voie fiable — le contenu livré en dur n'atteint jamais une base déjà
 * amorcée, puisque l'amorçage n'écrase jamais l'existant.
 */

/** Les types que la MJ peut fabriquer, dans l'ordre où l'écran les propose. */
export const KINDS_CREABLES = [
  'equipement',
  'amelioration',
  'sort',
  'classe',
  'investissement',
  'type-magique',
  'dossier',
] as const

export type KindCreable = (typeof KINDS_CREABLES)[number]

export const LIBELLE_KIND: Record<KindCreable, string> = {
  equipement: 'Équipement',
  amelioration: 'Amélioration',
  sort: 'Sort',
  classe: 'Classe',
  investissement: 'Investissement',
  'type-magique': 'Type magique',
  dossier: 'Dossier',
}

/**
 * Nettoie l'entrée avant écriture.
 *
 * ⚠️ Il fallait aussi, jusqu'ici, réaligner à la main le libellé de chaque
 * passif sur le nom de l'entrée : ce libellé était figé au moment de la saisie,
 * si bien que renommer l'objet ensuite — ou le nommer *après* avoir composé ses
 * passifs, ce qui est l'ordre naturel — laissait un « Objet » générique sur la
 * fiche de la joueuse. Le repli est désormais dans le moteur (`compilerPassif`,
 * `modifiers.ts`), qui relit le nom du porteur à chaque rendu.
 */
export function nettoyer(entree: EntreeCatalogue): EntreeCatalogue {
  return { ...entree, nom: entree.nom.trim() }
}

function nouvelId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `cat-${Date.now()}`
}

/**
 * Une entrée vierge du type demandé.
 *
 * ⚠️ `switch` exhaustif **sans `default`** : ajouter un type créable ne
 * compilera pas tant qu'il n'a pas son arme ici. C'est le garde-fou qui a
 * rattrapé l'ajout de la Classe et du Type magique.
 */
export function entreeVierge(kind: KindCreable, typesMagiques: TypeMagique[]): EntreeCatalogue {
  // `creeLe` n'est posé qu'ici : les entrées écrites avant son existence n'en
  // ont pas, et se trient comme les plus anciennes. C'est le comportement
  // attendu, et il évite d'inventer une date qu'on ne connaît pas.
  const base = { id: nouvelId(), nom: '', icone: 'crystal-shine', creeLe: Date.now() }
  switch (kind) {
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
      return { ...base, kind: 'dossier', ordre: 0 } as Dossier
    case 'type-magique':
      return { ...base, kind: 'type-magique', deParDefaut: null } as TypeMagique
    case 'classe':
      /*
       * Des valeurs de départ jouables, pas des zéros : `creerPersonnage` lit
       * `fatigueMax` et `sixthSensBase` tels quels, et une classe à 0 Point de
       * Fatigue donnerait un personnage qui tombe au premier coup.
       */
      return {
        ...base,
        kind: 'classe',
        fatigueMax: 4,
        sixthSensBase: 1,
        lore: '',
        passifTexte: '',
        sortsIds: [],
      } as Classe
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

/**
 * Une quête vierge.
 *
 * Hors du `switch` d'`entreeVierge`, dont le rôle est de garder exhaustifs les
 * types de l'onglet Création : une quête ne s'y crée pas, elle naît dans son
 * propre onglet MJ, où on la suit et où on la valide.
 */
export function queteVierge(): Quete {
  return {
    id: nouvelId(),
    nom: '',
    icone: 'scroll-unfurled',
    creeLe: Date.now(),
    kind: 'quete',
    etat: 'en-cours',
    recompense: { entrees: [] },
  }
}

// ---------------------------------------------------------------------------

export function FormulaireCatalogue({
  entree,
  classes,
  typesMagiques,
  dossiers,
  sorts,
  equipements,
  ameliorations,
  onAnnuler,
  onEnregistrer,
}: {
  entree: EntreeCatalogue
  classes: Classe[]
  typesMagiques: TypeMagique[]
  dossiers: Dossier[]
  /** Pour composer les sorts qu'une classe fournit d'office. */
  sorts: Sort[]
  /** Avec `sorts`, le butin qu'une quête peut verser. */
  equipements: Equipement[]
  ameliorations: Amelioration[]
  onAnnuler: () => void
  onEnregistrer: (e: EntreeCatalogue) => Promise<void>
}) {
  const [brouillon, setBrouillon] = useState<EntreeCatalogue>(entree)
  const rangeable = estRangeable(brouillon.kind)

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

      {/* Le rangement : une entrée appartient à zéro ou un dossier. Un dossier
          est polyvalent — sorts, améliorations et équipements s'y mêlent. */}
      {rangeable && (
        <label className="champ">
          <span className="tres-discret">Dossier</span>
          <select
            value={brouillon.dossierId ?? ''}
            onChange={(e) => maj({ dossierId: e.target.value || undefined })}
          >
            <option value="">Non classé</option>
            {dossiersDe({ dossiers: () => dossiers }).map((d) => (
              <option key={d.id} value={d.id}>
                {d.nom}
              </option>
            ))}
          </select>
        </label>
      )}

      {brouillon.kind === 'type-magique' && (
        <>
          <div className="rangee">
            <label className="champ" style={{ flex: 1, minWidth: 140 }}>
              <span className="tres-discret">Élément payé d’ordinaire</span>
              <select
                value={brouillon.elementCoutParDefaut ?? ''}
                onChange={(e) => maj({ elementCoutParDefaut: e.target.value || undefined })}
              >
                <option value="">Aucun</option>
                {ELEMENTS_PAYABLES.map((cle) => (
                  <option key={cle} value={cle}>
                    {ELEMENTS_VARIABLES[cle].libelle}
                  </option>
                ))}
              </select>
            </label>
            <label className="champ" style={{ flex: 1, minWidth: 100 }}>
              <span className="tres-discret">Dé associé</span>
              <input
                type="text"
                value={brouillon.deParDefaut ?? ''}
                placeholder="1d6"
                onChange={(e) => maj({ deParDefaut: e.target.value || null })}
              />
            </label>
          </div>

          {/* Sans ce drapeau, un type magique créé ici perdrait silencieusement
              la mécanique de l'Hexite, jusqu'ici câblée sur le seul Arcane. */}
          <label className="rangee" style={{ gap: 8 }}>
            <input
              type="checkbox"
              checked={brouillon.cristal ?? false}
              onChange={(e) => maj({ cristal: e.target.checked || undefined })}
            />
            <span className="tres-discret">
              Ses sorts consomment un cristal, épuisable jusqu’au prochain feu de camp
            </span>
          </label>
        </>
      )}

      {brouillon.kind === 'classe' && (
        <>
          <div className="rangee">
            <label className="champ" style={{ flex: 1, minWidth: 120 }}>
              <span className="tres-discret">Points de Fatigue de départ</span>
              <input
                type="number"
                min={1}
                value={brouillon.fatigueMax}
                onChange={(e) => maj({ fatigueMax: Math.max(1, Number(e.target.value) || 1) })}
              />
            </label>
            <label className="champ" style={{ flex: 1, minWidth: 120 }}>
              <span className="tres-discret">6th Sens de base</span>
              <input
                type="number"
                min={0}
                value={brouillon.sixthSensBase}
                onChange={(e) => maj({ sixthSensBase: Math.max(0, Number(e.target.value) || 0) })}
              />
            </label>
          </div>

          <label className="champ">
            <span className="tres-discret">Lore — ce que la joueuse lit en choisissant</span>
            <textarea value={brouillon.lore} onChange={(e) => maj({ lore: e.target.value })} />
          </label>

          <label className="champ">
            <span className="tres-discret">Passif de classe, en toutes lettres</span>
            <textarea
              value={brouillon.passifTexte}
              onChange={(e) => maj({ passifTexte: e.target.value })}
            />
          </label>

          {/* Ces sorts sont accordés d'office à la création, et les trois
              premiers garnissent le Grimoire de départ. */}
          <div className="champ">
            <span className="tres-discret">Sorts fournis d’office</span>
            <div className="rangee">
              {sorts.length === 0 && (
                <span className="tres-discret">Aucun sort au catalogue pour l’instant.</span>
              )}
              {sorts.map((s) => {
                const actif = brouillon.sortsIds.includes(s.id)
                return (
                  <button
                    key={s.id}
                    type="button"
                    className={`btn ${actif ? 'btn--principal' : ''}`}
                    aria-pressed={actif}
                    onClick={() =>
                      maj({
                        sortsIds: actif
                          ? brouillon.sortsIds.filter((id) => id !== s.id)
                          : [...brouillon.sortsIds, s.id],
                      })
                    }
                  >
                    {s.nom}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Ce que la classe accorde à tout le monde, sans choix à faire. */}
          <EditeurPassifs
            valeur={brouillon.passifs ?? []}
            onChange={(passifs) => maj({ passifs })}
          />

          <EditeurChoixClasse
            valeur={brouillon.choix ?? []}
            onChange={(choix) => maj({ choix })}
          />

          {/*
            ⚠️ Il ne reste qu'un comportement câblé : les vies du Soulshifter —
            un dé dont les faces sont les vies connues, un jeton d'invocation
            rendu par la MJ, des précisions par sort. Rien de cela ne se ramène
            à un choix parmi des options, d'où ce champ plutôt qu'un passif.
          */}
          <label className="champ">
            <span className="tres-discret">Comportement câblé — rare, et à éviter</span>
            <select
              value={brouillon.passifMoteur ?? ''}
              onChange={(e) => maj({ passifMoteur: e.target.value || undefined })}
            >
              <option value="">Aucun — tout passe par les passifs et les choix</option>
              <option value="soulshifter-vies">Vies passées du Soulshifter</option>
            </select>
          </label>
        </>
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

      {brouillon.kind === 'quete' && (
        <FragmentQuete
          quete={brouillon}
          sorts={sorts}
          equipements={equipements}
          ameliorations={ameliorations}
          maj={maj}
        />
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

/**
 * La récompense d'une quête : des Lumens, et du butin pris au catalogue.
 *
 * Le butin est une simple liste d'identifiants : l'entrée sait déjà si elle est
 * un sort, un équipement ou une amélioration, si bien qu'un seul sélecteur —
 * groupé par famille — suffit aux trois.
 *
 * ⚠️ L'état de la quête ne se saisit pas ici. En changer verse la récompense à
 * toutes les porteuses, ce qu'un formulaire de contenu n'a pas à faire : c'est
 * `validerQuete` qui en a la charge, depuis l'onglet Quêtes.
 */
function FragmentQuete({
  quete,
  sorts,
  equipements,
  ameliorations,
  maj,
}: {
  quete: Quete
  sorts: Sort[]
  equipements: Equipement[]
  ameliorations: Amelioration[]
  maj: (patch: Record<string, unknown>) => void
}) {
  const { recompense } = quete
  // Typé sur la base commune : seuls l'identifiant et le nom servent ici, et
  // sans cela TypeScript infère une union de trois tableaux distincts.
  const familles: { libelle: string; entrees: EntreeCatalogueBase[] }[] = [
    { libelle: 'Sorts', entrees: sorts },
    { libelle: 'Équipements', entrees: equipements },
    { libelle: 'Améliorations', entrees: ameliorations },
  ]
  const nomDe = (id: string) =>
    familles.flatMap((f) => f.entrees).find((e) => e.id === id)?.nom ?? id

  const majRecompense = (patch: Partial<typeof recompense>) =>
    maj({ recompense: { ...recompense, ...patch } })

  return (
    <>
      <label className="champ">
        <span className="tres-discret">Récompense — Lumens</span>
        <input
          type="number"
          min={0}
          value={recompense.lumens ?? ''}
          onChange={(e) =>
            majRecompense({
              // Un champ vide vaut « pas de Lumens », pas zéro.
              lumens: e.target.value === '' ? undefined : Math.max(0, Number(e.target.value) || 0),
            })
          }
        />
      </label>

      <div className="champ">
        <span className="tres-discret">Récompense — butin</span>
        {recompense.entrees.length === 0 && <p className="vide">Aucun objet, sort ni amélioration.</p>}
        {recompense.entrees.map((id, index) => (
          <div key={`${id}-${index}`} className="rangee rangee--entre">
            <span>{nomDe(id)}</span>
            <button
              type="button"
              className="btn btn--fantome pas"
              aria-label={`Retirer ${nomDe(id)} de la récompense`}
              onClick={() =>
                majRecompense({ entrees: recompense.entrees.filter((_, i) => i !== index) })
              }
            >
              ×
            </button>
          </div>
        ))}
        {/*
          Contrôlé sur la valeur vide : le sélecteur retombe seul sur son
          invite après chaque ajout, et sert donc autant de fois qu'on veut.
        */}
        <select
          aria-label="Ajouter au butin"
          value=""
          onChange={(e) =>
            e.target.value && majRecompense({ entrees: [...recompense.entrees, e.target.value] })
          }
        >
          <option value="">Ajouter au butin…</option>
          {familles.map((f) => (
            <optgroup key={f.libelle} label={f.libelle}>
              {f.entrees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nom}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>
    </>
  )
}
