import { useEffect, useState } from 'react'

import { FiltresCatalogue } from '../../components/FiltresCatalogue.tsx'
import { Icone } from '../../components/Icone.tsx'
import { enregistrerEntreeCatalogue, supprimerEntreeCatalogue } from '../../data/repo.ts'
import { prixDe } from '../../domain/campfire.ts'
import type { Catalog } from '../../domain/catalog.ts'
import {
  dossiersDe,
  FILTRES_VIERGES,
  filtrerEntrees,
  type FiltresCatalogue as Filtres,
} from '../../domain/filtres.ts'
import { libelleMagie } from '../../domain/magie.ts'
import {
  RARETES,
  LIBELLE_SLOT,
  type Dossier,
  type EntreeCatalogue,
} from '../../domain/types.ts'
import { FormulaireCatalogue } from './FormulaireCatalogue.tsx'

/**
 * Consultation et correction d'une famille du catalogue.
 *
 * ⚠️ **On ne crée rien ici.** La création vit dans son propre onglet
 * (`CreationCatalogue`) : le bouton « Ajouter » était sous la liste, qui
 * s'allonge à chaque session, et fabriquer une entrée demandait de dérouler
 * tout ce qu'on avait déjà écrit. Cet écran ne fait que montrer et corriger.
 *
 * Les entrées livrées avec l'app (`seed`) sont modifiables et supprimables ; le
 * drapeau ne sert plus qu'à les faire revenir lors d'une réinitialisation.
 */
export function EditeurCatalogue({
  catalog,
  kind,
}: {
  catalog: Catalog
  kind: EntreeCatalogue['kind']
}) {
  const [edition, setEdition] = useState<EntreeCatalogue | null>(null)
  const [filtres, setFiltres] = useState<Filtres>(FILTRES_VIERGES)

  // Les filtres repartent à zéro en changeant de famille : un « armure » laissé
  // actif ferait croire à un catalogue de sorts vide.
  useEffect(() => {
    setEdition(null)
    setFiltres(FILTRES_VIERGES)
  }, [kind])

  const entrees = filtrerEntrees(catalog.toutes().filter((e) => e.kind === kind), filtres)

  return (
    <section className="carte pile pile--serree">
      <FiltresCatalogue
        kind={kind}
        valeur={filtres}
        catalog={catalog}
        total={entrees.length}
        onChange={setFiltres}
      />

      {entrees.length === 0 && !edition && (
        <p className="vide">Rien pour l'instant. L'onglet Création en fabrique.</p>
      )}

      {entrees.map((e) => (
        <LigneEntree key={e.id} entree={e} catalog={catalog} onModifier={() => setEdition(e)} />
      ))}

      {edition && (
        <Formulaire catalog={catalog} entree={edition} onFerme={() => setEdition(null)} />
      )}
    </section>
  )
}

// ---------------------------------------------------------------------------

/**
 * Les dossiers, et ce qu'ils contiennent.
 *
 * Un dossier est **polyvalent** : il range indifféremment des sorts, des
 * équipements et des améliorations. C'est tout son intérêt — « Poisons » réunit
 * trois sorts et deux bibelots — et c'est pourquoi son contenu se consulte ici
 * plutôt qu'en filtrant chaque famille l'une après l'autre.
 */
export function EditeurDossiers({ catalog }: { catalog: Catalog }) {
  const [ouvert, setOuvert] = useState<string | null>(null)
  const [edition, setEdition] = useState<EntreeCatalogue | null>(null)

  const dossiers = dossiersDe(catalog)
  const contenu = ouvert ? catalog.toutes().filter((e) => e.dossierId === ouvert) : []

  return (
    <section className="carte pile pile--serree">
      {dossiers.length === 0 && (
        <p className="vide">Aucun dossier. L'onglet Création en fabrique.</p>
      )}

      {dossiers.map((d) => (
        <div key={d.id} className="pile pile--serree">
          <div className={`objet ${ouvert === d.id ? 'objet--actif' : ''}`}>
            <Icone nom={d.icone} taille={28} teinte={RARETES[d.rarete ?? 'commun'].teinte} />
            <button
              type="button"
              className="objet__corps"
              style={{ textAlign: 'left', background: 'none', border: 0, padding: 0 }}
              aria-expanded={ouvert === d.id}
              onClick={() => setOuvert(ouvert === d.id ? null : d.id)}
            >
              <span className="objet__nom">{d.nom}</span>
              <span className="objet__meta">{resumeDossier(d, catalog)}</span>
            </button>
            <button type="button" className="btn" onClick={() => setEdition(d)}>
              Modifier
            </button>
            <BoutonSupprimer entree={d} />
          </div>

          {ouvert === d.id && (
            <div className="pile pile--serree" style={{ paddingLeft: 12 }}>
              {contenu.length === 0 && (
                <p className="tres-discret" style={{ margin: 0 }}>
                  Ce dossier est vide. On y range une entrée depuis son propre onglet.
                </p>
              )}
              {contenu.map((e) => (
                <LigneEntree
                  key={e.id}
                  entree={e}
                  catalog={catalog}
                  onModifier={() => setEdition(e)}
                />
              ))}
            </div>
          )}
        </div>
      ))}

      {edition && (
        <Formulaire catalog={catalog} entree={edition} onFerme={() => setEdition(null)} />
      )}
    </section>
  )
}

/** Ce qu'on veut savoir d'un dossier : ce qu'il contient, pas ce qu'il vise. */
function resumeDossier(dossier: Dossier, catalog: Catalog): string {
  const n = catalog.toutes().filter((e) => e.dossierId === dossier.id).length
  return n === 0 ? 'vide' : `${n} entrée(s)`
}

// ---------------------------------------------------------------------------

function LigneEntree({
  entree,
  catalog,
  onModifier,
}: {
  entree: EntreeCatalogue
  catalog: Catalog
  onModifier: () => void
}) {
  return (
    <div className="objet">
      <Icone nom={entree.icone} taille={28} teinte={RARETES[entree.rarete ?? 'commun'].teinte} />
      <span className="objet__corps">
        <span className="objet__nom">{entree.nom}</span>
        <span className="objet__meta">{resume(entree, catalog)}</span>
      </span>
      <button type="button" className="btn" onClick={onModifier}>
        Modifier
      </button>
      <BoutonSupprimer entree={entree} />
    </div>
  )
}

function BoutonSupprimer({ entree }: { entree: EntreeCatalogue }) {
  return (
    <button
      type="button"
      className="btn btn--danger"
      onClick={() => {
        // Les entrées livrées se suppriment aussi : c'est le seul moyen de
        // nettoyer le catalogue de mes exemples.
        const avertissement = entree.seed
          ? ` Elle reviendra si vous réinitialisez le catalogue.`
          : ''
        if (confirm(`Supprimer « ${entree.nom} » du catalogue ?${avertissement}`)) {
          void supprimerEntreeCatalogue(entree)
        }
      }}
      aria-label={`Supprimer ${entree.nom}`}
    >
      ×
    </button>
  )
}

/**
 * Le formulaire d'édition, monté sur une entrée existante.
 *
 * Il ne se ferme qu'une fois l'écriture acceptée : sinon un refus de Firestore
 * — que le bandeau d'erreur signale — laissait croire à un enregistrement
 * réussi, et la saisie était perdue.
 */
function Formulaire({
  catalog,
  entree,
  onFerme,
}: {
  catalog: Catalog
  entree: EntreeCatalogue
  onFerme: () => void
}) {
  return (
    <FormulaireCatalogue
      entree={entree}
      classes={catalog.classes()}
      typesMagiques={catalog.typesMagiques()}
      dossiers={catalog.dossiers()}
      sorts={catalog.sorts()}
      onAnnuler={onFerme}
      onEnregistrer={async (e) => {
        await enregistrerEntreeCatalogue(e)
        onFerme()
      }}
    />
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
      return resumeDossier(e, catalog)
    // Les deux familles qui n'étaient créables nulle part avant l'onglet
    // Création. Sans ces cas, leur ligne de méta serait restée vide.
    case 'classe':
      return [
        `${e.fatigueMax} Fatigue · ${e.sixthSensBase} 6th Sens`,
        `${e.sortsIds.length} sort(s)`,
        e.choix?.length ? `${e.choix.length} choix` : null,
      ]
        .filter(Boolean)
        .join(' · ')
    case 'type-magique':
      return [e.deParDefaut, e.cristal ? 'à cristal' : null].filter(Boolean).join(' · ') || 'Type magique'
  }
}
