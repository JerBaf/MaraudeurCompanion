import { useState } from 'react'

import { FiltresCatalogue } from '../../components/FiltresCatalogue.tsx'
import { LanceurDes } from '../../components/LanceurDes.tsx'
import { ObjetDetaillable } from '../../components/ObjetDetaillable.tsx'
import { VIES_SOULSHIFTER } from '../../content/seed.ts'
import { journaliser } from '../../data/repo.ts'
import type { Catalog } from '../../domain/catalog.ts'
import { tailleGrimoire } from '../../domain/competences.ts'
import { branchesPayables, coutAUnX, decrireBranche } from '../../domain/couts.ts'
import { precisionPersonnalite, vieActive } from '../../domain/effets.ts'
import {
  FILTRES_VIERGES,
  filtrerEntrees,
  type FiltresCatalogue as Filtres,
} from '../../domain/filtres.ts'
import { desDuSort, lancerSort, type DemandeLancement } from '../../domain/lancement.ts'
import {
  disponibiliteSort,
  grimoireEffectif,
  libelleMagie,
  resoudreArcane,
  resumeSort,
  sortAUnCristal,
} from '../../domain/magie.ts'
import type { Rng } from '../../domain/random.ts'
import type { Character, Sort } from '../../domain/types.ts'
import { EffetAleatoire } from './EffetAleatoire.tsx'

function LigneSort({
  sort,
  char,
  catalog,
  maj,
  onLance,
}: {
  sort: Sort
  char: Character
  catalog: Catalog
  /** Absent en lecture seule ; présent, il autorise la bascule de l'Hexite. */
  maj?: (t: (c: Character) => Character) => void
  /** Absent hors du Grimoire : on ne lance que ce qu'on a préparé. */
  onLance?: (demande: DemandeLancement, rng: Rng) => void
}) {
  // Le « X » d'un coût variable : la joueuse décide combien elle dépense, et
  // l'effet en dépend. Zéro tant qu'elle n'a rien saisi.
  const [x, setX] = useState(0)
  const [branche, setBranche] = useState(0)

  const dispo = disponibiliteSort(sort, char, catalog, x)
  const epuise = char.sortsEpuises.includes(sort.id)
  const payables = branchesPayables(char, catalog, sort.cout, x, sort)
  const aUnX = coutAUnX(sort.cout)

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
      {...(maj && sortAUnCristal(sort, catalog)
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
      {...(onLance
        ? {
            actionDetail: (
              <div className="rangee">
                {/* Le « OU » du coût : une branche par façon de payer, et seules
                    celles qu'elle peut régler sont proposées. */}
                {sort.cout.branches.length > 1 && (
                  <select
                    value={branche}
                    aria-label="Payer avec"
                    style={{ flex: 1 }}
                    onChange={(e) => setBranche(Number(e.target.value))}
                  >
                    {sort.cout.branches.map((b, i) => (
                      <option key={i} value={i} disabled={!payables.includes(i)}>
                        {decrireBranche(b)}
                      </option>
                    ))}
                  </select>
                )}

                {aUnX && (
                  <input
                    type="number"
                    min={0}
                    value={x || ''}
                    placeholder="X"
                    aria-label="Valeur de X"
                    style={{ width: 80 }}
                    onChange={(e) => setX(Math.max(0, Number(e.target.value) || 0))}
                  />
                )}

                {/* Les dés demandés viennent de `desDuSort`, qui vit collé à
                    `lancerSort` : la joueuse qui saisit ses propres dés en
                    saisit toujours exactement le compte. */}
                <LanceurDes
                  des={desDuSort(sort)}
                  libelle={dispo.disponible ? 'Lancer' : 'Indisponible'}
                  disabled={!dispo.disponible}
                  onJet={(rng) => onLance({ sortId: sort.id, brancheCout: branche, x }, rng)}
                />
              </div>
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
export function OngletSorts({
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

  const [filtres, setFiltres] = useState<Filtres>(FILTRES_VIERGES)
  const visibles = filtrerEntrees(connus, filtres) as Sort[]
  // Dérivé, pas constant : un passif peut accorder un emplacement de plus.
  const slotsGrimoire = tailleGrimoire(char, catalog)

  // Le récit du lancement vit hors de la ligne du sort : un effet tiré doit
  // rester lisible même quand le sort redevient indisponible dans la foulée.
  const [dernierLancement, setDernierLancement] = useState<string | null>(null)
  // Le 6 de l'Arcane demande un second jet — 2d4 — que le dé du sort ne pouvait
  // pas annoncer d'avance.
  const [effetAleatoire, setEffetAleatoire] = useState<string | null>(null)

  function lancer(demande: DemandeLancement, rng: Rng) {
    const r = lancerSort(char, catalog, demande, rng)

    /*
     * Le dé d'un sort à cristal se lit : c'est le Jet d'Arcane. `resoudreArcane`
     * existait et était testé, mais aucun écran ne l'appelait — la joueuse
     * déclarait son Hexite épuisé à la main, ce qui laissait la règle « 1 et 2 »
     * à sa mémoire. Un type magique créé par la MJ hérite de la mécanique dès
     * qu'il porte `cristal`.
     */
    const arcane = r.de !== null && sortAUnCristal(r.sort, catalog) ? resoudreArcane(r.de) : null

    setDernierLancement(
      `${r.sort.nom}` +
        (r.de !== null ? ` — ${r.sort.de} → ${r.de}` : '') +
        (arcane ? ` · ${arcane.pointsEnergie} Point(s) d'Énergie` : '') +
        (arcane?.cristalEpuise ? ' · le cristal s’épuise' : '') +
        (arcane?.effetAleatoire ? ' · la magie vous échappe' : '') +
        (r.effets.length ? ` · ${r.effets.join(' · ')}` : '') +
        (r.recits.length ? ` — ${r.recits.join(' · ')}` : ''),
    )
    void journaliser(
      char.nom,
      'sort',
      `${char.nom} lance ${r.sort.nom}${r.de !== null ? ` (${r.sort.de} → ${r.de})` : ''}.`,
    )

    if (arcane?.effetAleatoire) setEffetAleatoire(r.sort.nom)

    maj((c) => ({
      ...r.char,
      id: c.id,
      // Sur 1 et 2 l'Hexite ne répond plus jusqu'à l'avoir réétudié au camp.
      // La case à cocher de la ligne reste, en correction.
      sortsEpuises:
        arcane?.cristalEpuise && !r.char.sortsEpuises.includes(r.sort.id)
          ? [...r.char.sortsEpuises, r.sort.id]
          : r.char.sortsEpuises,
    }))
  }

  return (
    <div className="pile">
      {effetAleatoire && (
        <EffetAleatoire
          char={char}
          sortNom={effetAleatoire}
          onFini={() => setEffetAleatoire(null)}
        />
      )}

      <section className="carte pile pile--serree">
        <div className="carte__titre">
          <span className="etiquette">Sorts préparés</span>
          <span className="tres-discret">
            {prepares.length}/{slotsGrimoire}
          </span>
        </div>
        {prepares.length === 0 && <p className="vide">Aucun sort préparé.</p>}
        {prepares.map((sort) => (
          <LigneSort
            key={sort.id}
            sort={sort}
            char={char}
            catalog={catalog}
            maj={maj}
            onLance={lancer}
          />
        ))}
        {dernierLancement && <p className="alerte alerte--info">{dernierLancement}</p>}
      </section>

      {permanents.length > 0 && (
        <section className="carte pile pile--serree">
          <div className="carte__titre">
            <span className="etiquette">Hors emplacement</span>
            <span className="tres-discret">accordés par votre passif</span>
          </div>
          <p className="tres-discret" style={{ margin: 0 }}>
            Disponibles en permanence ; ils ne comptent pas dans la limite de {slotsGrimoire}.
          </p>
          {permanents.map((sort) => (
            <LigneSort
              key={sort.id}
              sort={sort}
              char={char}
              catalog={catalog}
              maj={maj}
              onLance={lancer}
            />
          ))}
        </section>
      )}

      <section className="carte pile pile--serree">
        <div className="carte__titre">
          <span className="etiquette">Sorts connus</span>
          <span className="tres-discret">préparables au prochain feu de camp</span>
        </div>

        {/* Un répertoire s'allonge de session en session : le chercher à l'œil
            devient vite pénible sur un téléphone. */}
        <FiltresCatalogue
          kind="sort"
          valeur={filtres}
          catalog={catalog}
          total={visibles.length}
          onChange={setFiltres}
        />

        {connus.length === 0 && <p className="vide">Rien d'autre à votre répertoire.</p>}
        {connus.length > 0 && visibles.length === 0 && (
          <p className="vide">Aucun sort ne correspond à cette recherche.</p>
        )}

        {/* Regroupés par type magique. On part des types **présents parmi les
            sorts affichés** et non de la liste du catalogue : un sort dont le
            type n'a pas encore été semé — le temps qu'une MJ se connecte —
            resterait sinon invisible, et c'est exactement le genre de
            disparition silencieuse qu'on ne veut pas. */}
        {[...new Set(visibles.map((s) => s.magieId))].map((magieId) => (
          <div key={magieId} className="pile pile--serree">
            <span className="tres-discret">{libelleMagie(magieId, catalog)}</span>
            {visibles
              .filter((s) => s.magieId === magieId)
              .map((sort) => (
                <LigneSort key={sort.id} sort={sort} char={char} catalog={catalog} />
              ))}
          </div>
        ))}
      </section>
    </div>
  )
}
