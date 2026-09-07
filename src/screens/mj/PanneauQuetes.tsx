import { useState } from 'react'

import { Icone } from '../../components/Icone.tsx'
import {
  enregistrerEntreeCatalogue,
  supprimerEntreeCatalogue,
  validerQuete,
} from '../../data/repo.ts'
import type { Catalog } from '../../domain/catalog.ts'
import { decrireRecompense, porteusesDe, recompenseVide } from '../../domain/quetes.ts'
import { RARETES, type Character, type Quete } from '../../domain/types.ts'
import { FormulaireCatalogue, queteVierge } from './FormulaireCatalogue.tsx'

/**
 * Les Quêtes, côté MJ.
 *
 * **Leur seul domicile.** Une quête n'est pas du contenu qu'on range dans
 * Réglages et qu'on oublie : on la compose, on la propose, on la suit et on la
 * valide pendant la session. Tout tient donc ici, à côté du Feu de camp et des
 * Notifications — sauf la proposition elle-même, qui est une notification comme
 * une autre et se fait depuis l'onglet voisin.
 *
 * ⚠️ **Valider est définitif.** Le geste verse la récompense à toutes les
 * porteuses ; il n'y a pas de retour en arrière, parce qu'il n'y en aurait pas
 * de propre — reprendre des Lumens déjà dépensés n'a pas de sens. D'où la
 * confirmation, qui nomme la récompense et les bénéficiaires.
 */
export function PanneauQuetes({
  catalog,
  personnages,
}: {
  catalog: Catalog
  personnages: Character[]
}) {
  /** `null` = aucun formulaire ouvert ; sinon la quête en cours d'édition. */
  const [edition, setEdition] = useState<Quete | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const quetes = catalog.quetes()
  const enCours = quetes.filter((q) => q.etat === 'en-cours')
  const passees = quetes.filter((q) => q.etat === 'validee')

  async function valider(quete: Quete) {
    const porteuses = porteusesDe(quete, personnages)
    const qui = porteuses.length > 0 ? porteuses.map((c) => c.nom).join(', ') : 'personne'
    const quoi = decrireRecompense(quete.recompense, catalog)

    if (!globalThis.confirm(`Valider « ${quete.nom} » ?\n\n${quoi}\n→ ${qui}`)) return

    await validerQuete(quete, personnages, catalog)
    setMessage(`« ${quete.nom} » validée — ${quoi} → ${qui}.`)
  }

  if (edition) {
    return (
      <section className="carte pile pile--serree">
        {/*
          `key` remonte le formulaire à chaque quête : son brouillon vit en
          `useState` initialisé sur la prop, et sans cela il garderait la saisie
          précédente. Même raison que dans l'onglet Création.
        */}
        <FormulaireCatalogue
          key={edition.id}
          entree={edition}
          classes={catalog.classes()}
          typesMagiques={catalog.typesMagiques()}
          dossiers={catalog.dossiers()}
          sorts={catalog.sorts()}
          equipements={catalog.equipements()}
          ameliorations={catalog.ameliorations()}
          onAnnuler={() => setEdition(null)}
          // On ne referme qu'une fois l'écriture acceptée : un refus de
          // Firestore — que le bandeau d'erreur signale — perdrait la saisie.
          onEnregistrer={async (e) => {
            await enregistrerEntreeCatalogue(e)
            setEdition(null)
            setMessage(`« ${e.nom} » enregistrée.`)
          }}
        />
      </section>
    )
  }

  return (
    <div className="pile">
      {message && <p className="alerte alerte--info">{message}</p>}

      <section className="carte pile pile--serree">
        <div className="carte__titre">
          <span className="etiquette">Quêtes</span>
          <span className="tres-discret">se proposent depuis l’onglet Notifications</span>
        </div>
        <button
          type="button"
          className="btn btn--principal"
          onClick={() => {
            setMessage(null)
            setEdition(queteVierge())
          }}
        >
          Nouvelle quête
        </button>
      </section>

      <section className="carte pile pile--serree">
        <span className="etiquette">En cours</span>
        {enCours.length === 0 && <p className="vide">Aucune quête en cours.</p>}
        {enCours.map((quete) => (
          <LigneQuete
            key={quete.id}
            quete={quete}
            catalog={catalog}
            personnages={personnages}
            onModifier={() => {
              setMessage(null)
              setEdition(quete)
            }}
            onValider={() => void valider(quete)}
          />
        ))}
      </section>

      <section className="carte pile pile--serree">
        <span className="etiquette">Passées</span>
        {passees.length === 0 && <p className="vide">Aucune quête validée.</p>}
        {passees.map((quete) => (
          <LigneQuete
            key={quete.id}
            quete={quete}
            catalog={catalog}
            personnages={personnages}
            onSupprimer={() => void supprimerEntreeCatalogue(quete)}
          />
        ))}
      </section>
    </div>
  )
}

// ---------------------------------------------------------------------------

function LigneQuete({
  quete,
  catalog,
  personnages,
  onModifier,
  onValider,
  onSupprimer,
}: {
  quete: Quete
  catalog: Catalog
  personnages: Character[]
  onModifier?: () => void
  onValider?: () => void
  onSupprimer?: () => void
}) {
  const porteuses = porteusesDe(quete, personnages)

  return (
    <div className="pile pile--serree" style={{ borderTop: '1px solid var(--encre-clair)', paddingTop: 8 }}>
      <div className="rangee rangee--entre">
        <div className="rangee">
          <Icone
            nom={quete.icone}
            taille={32}
            teinte={RARETES[quete.rarete ?? 'commun'].teinte}
          />
          <div className="pile pile--serree" style={{ gap: 2 }}>
            <strong>{quete.nom}</strong>
            <span className="tres-discret">{decrireRecompense(quete.recompense, catalog)}</span>
          </div>
        </div>
        <div className="rangee" style={{ gap: 6 }}>
          {onModifier && (
            <button type="button" className="btn btn--fantome" onClick={onModifier}>
              Modifier
            </button>
          )}
          {onValider && (
            <button type="button" className="btn btn--principal" onClick={onValider}>
              Valider
            </button>
          )}
          {onSupprimer && (
            <button type="button" className="btn btn--danger" onClick={onSupprimer}>
              Supprimer
            </button>
          )}
        </div>
      </div>

      {quete.description && (
        <p className="discret" style={{ margin: 0, whiteSpace: 'pre-line' }}>
          {quete.description}
        </p>
      )}

      {/*
        Une quête que personne ne porte se signale plutôt que de se taire : la
        MJ doit voir qu'elle en a préparé une et oublié de la proposer.
      */}
      <span className="tres-discret">
        {porteuses.length > 0
          ? `Portée par ${porteuses.map((c) => c.nom).join(', ')}`
          : 'Proposée à personne pour l’instant'}
      </span>

      {onValider && recompenseVide(quete.recompense) && (
        <span className="tres-discret">⚠️ Aucune récompense : valider ne versera rien.</span>
      )}
    </div>
  )
}
