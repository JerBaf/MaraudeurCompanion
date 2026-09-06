import { useState } from 'react'

import { enregistrerEntreeCatalogue } from '../../data/repo.ts'
import type { Catalog } from '../../domain/catalog.ts'
import {
  entreeVierge,
  FormulaireCatalogue,
  KINDS_CREABLES,
  LIBELLE_KIND,
  type KindCreable,
} from './FormulaireCatalogue.tsx'

/**
 * L'atelier : un seul endroit où fabriquer n'importe quelle entrée.
 *
 * Auparavant, créer quelque chose demandait d'ouvrir l'onglet de sa famille et
 * de dérouler toute la liste jusqu'au bouton « Ajouter » du bas — une liste qui
 * s'allonge à chaque session. Les autres onglets ne servent plus qu'à consulter
 * et corriger ; c'est ici que naît le contenu.
 *
 * ⚠️ **Tous les types créables sont proposés, pas seulement les quatre courants.**
 * C'est la contrepartie du retrait des boutons « Ajouter » ailleurs : sans cela,
 * un dossier ou un type magique n'aurait plus aucun endroit où naître.
 */
export function CreationCatalogue({ catalog }: { catalog: Catalog }) {
  const [kind, setKind] = useState<KindCreable>('equipement')
  const [brouillon, setBrouillon] = useState(() =>
    entreeVierge('equipement', catalog.typesMagiques()),
  )
  const [message, setMessage] = useState<string | null>(null)

  function changerKind(suivant: KindCreable) {
    setKind(suivant)
    setBrouillon(entreeVierge(suivant, catalog.typesMagiques()))
    setMessage(null)
  }

  /** Repart sur une entrée vierge du même type : on en crée rarement une seule. */
  function recommencer() {
    setBrouillon(entreeVierge(kind, catalog.typesMagiques()))
  }

  return (
    <section className="carte pile pile--serree">
      <div className="carte__titre">
        <span className="etiquette">Créer</span>
        <span className="tres-discret">le contenu apparaît aussitôt dans son onglet</span>
      </div>

      <div className="champ">
        <span className="tres-discret">Quoi créer</span>
        <div className="rangee">
          {KINDS_CREABLES.map((k) => (
            <button
              key={k}
              type="button"
              className={`btn ${kind === k ? 'btn--principal' : ''}`}
              aria-pressed={kind === k}
              onClick={() => changerKind(k)}
            >
              {LIBELLE_KIND[k]}
            </button>
          ))}
        </div>
      </div>

      {message && <p className="alerte alerte--info">{message}</p>}

      {/*
        `key` remonte le formulaire à chaque nouvelle entrée : son `brouillon`
        vit en `useState` initialisé sur la prop, et sans cela il garderait la
        saisie précédente après un enregistrement.
      */}
      <FormulaireCatalogue
        key={brouillon.id}
        entree={brouillon}
        classes={catalog.classes()}
        typesMagiques={catalog.typesMagiques()}
        dossiers={catalog.dossiers()}
        sorts={catalog.sorts()}
        onAnnuler={recommencer}
        // Le formulaire ne se vide qu'une fois l'écriture acceptée : sinon un
        // refus de Firestore — que le bandeau d'erreur signale — laisserait
        // croire à un enregistrement réussi, et la saisie serait perdue.
        onEnregistrer={async (e) => {
          await enregistrerEntreeCatalogue(e)
          setMessage(`« ${e.nom} » créé. Vous pouvez en composer un autre.`)
          recommencer()
        }}
      />
    </section>
  )
}
