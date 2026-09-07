import { useRef, useState } from 'react'

import { Icone } from '../../components/Icone.tsx'
import { ImageZoomable } from '../../components/ImageZoomable.tsx'
import { ObjetDetaillable } from '../../components/ObjetDetaillable.tsx'
import { repondreNotification } from '../../data/repo.ts'
import type { Catalog } from '../../domain/catalog.ts'
import {
  choixProposes,
  libelleType,
  urlIllustration,
  type ChoixPropose,
  type Notification,
} from '../../domain/notifications.ts'
import { detailObjet, resumeEquipement } from '../../domain/objets.ts'
import { decrireRecompense } from '../../domain/quetes.ts'
import { RARETES, type Character } from '../../domain/types.ts'

/**
 * Les notifications poussées par la MJ, par-dessus tout le reste.
 *
 * Volontairement **indépendant de `etat.mode`** : Combat, Feu de camp et Combat
 * rapide détournent l'onglet actif, une notification non. Elle arrive quel que
 * soit l'écran, et repart dès qu'on y a répondu.
 *
 * Une seule à la fois : deux cartes empilées sur un téléphone ne se lisent pas,
 * et la file s'écoule toute seule — répondre retire la notification du filtre.
 */
export function OverlayNotifications({
  char,
  catalog,
  notifications,
}: {
  char: Character
  catalog: Catalog
  notifications: Notification[]
}) {
  // Ce que le paiement a entraîné — Combustion, grille de Fatigue pleine. Vit
  // ici et non dans la carte : la carte disparaît au moment où le récit arrive.
  const [recits, setRecits] = useState<string[]>([])

  const enAttente = notifications.filter(
    (n) => n.cibles.includes(char.id) && n.reponses[char.id] === undefined,
  )
  const courante = enAttente[0]

  // Le récit passe **avant** la file : sans cela une Combustion se ferait
  // recouvrir par la notification suivante, et la joueuse ne la verrait jamais.
  if (recits.length > 0) {
    return (
      <div className="overlay">
        <div className="overlay__carte pile">
          <p className="alerte alerte--info" style={{ margin: 0 }}>
            {recits.join(' · ')}
          </p>
          <button type="button" className="btn btn--principal" onClick={() => setRecits([])}>
            Continuer
          </button>
        </div>
      </div>
    )
  }

  if (!courante) return null

  return (
    <Carte
      key={courante.id}
      char={char}
      catalog={catalog}
      notif={courante}
      reste={enAttente.length - 1}
      onRecits={setRecits}
    />
  )
}

// ---------------------------------------------------------------------------

function Carte({
  char,
  catalog,
  notif,
  reste,
  onRecits,
}: {
  char: Character
  catalog: Catalog
  notif: Notification
  /** Combien d'autres attendent derrière celle-ci. */
  reste: number
  onRecits: (recits: string[]) => void
}) {
  // Le verrou tient jusqu'à ce que la réponse revienne par l'abonnement, sans
  // quoi un double appui paierait deux fois. Même garde que le chrono du duel.
  const envoye = useRef(false)
  const [enCours, setEnCours] = useState(false)

  const choix = choixProposes(char, catalog, notif)

  function repondre(c: ChoixPropose) {
    if (envoye.current) return
    envoye.current = true
    setEnCours(true)
    void repondreNotification(char, catalog, notif, c.option.id, c.branche)
      .then((recits) => {
        if (recits.length > 0) onRecits(recits)
      })
      .catch(() => {
        // Le bandeau d'erreur du store dit déjà ce qui s'est passé ; on rouvre
        // la carte pour que la joueuse puisse réessayer.
        envoye.current = false
        setEnCours(false)
      })
  }

  // L'illustration prend tout l'écran : une carte de 480 px la rendrait
  // illisible, et c'est bien la voir en grand qui est le but. Même verrou, même
  // réponse — seule la mise en page change.
  if (notif.contenu.kind === 'image') {
    return (
      <div className="overlay overlay--image" role="dialog" aria-modal="true" aria-label={libelleType(notif)}>
        <ImageZoomable
          url={urlIllustration(notif.contenu.url)}
          alt={notif.texte || 'Illustration'}
        />

        <div className="illustration__pied pile pile--serree">
          {notif.texte && <p style={{ margin: 0, whiteSpace: 'pre-line' }}>{notif.texte}</p>}
          <span className="tres-discret">Pincez ou double-touchez pour zoomer.</span>
          {/*
            Le type n'offre qu'une option, gratuite : la boucle rend exactement
            un bouton « Passer ». Il ne dépend surtout pas du chargement de
            l'image — une illustration qui ne vient pas ne doit pas enfermer la
            joueuse dans l'overlay.
          */}
          {choix.map((c) => (
            <button
              key={c.option.id}
              type="button"
              className="btn btn--principal"
              disabled={enCours}
              onClick={() => repondre(c)}
            >
              {c.option.libelle}
            </button>
          ))}
          {reste > 0 && <span className="tres-discret">+{reste} en attente</span>}
        </div>
      </div>
    )
  }

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label={libelleType(notif)}>
      <div className="overlay__carte pile">
        <div className="carte__titre" style={{ marginBottom: 0 }}>
          <span className="etiquette">{libelleType(notif)}</span>
          {reste > 0 && <span className="tres-discret">+{reste} en attente</span>}
        </div>

        <p style={{ margin: 0, whiteSpace: 'pre-line' }}>{notif.texte}</p>

        {notif.contenu.kind === 'equipement' && (
          <FicheObjet char={char} catalog={catalog} equipementId={notif.contenu.equipementId} />
        )}

        {notif.contenu.kind === 'quete' && (
          <FicheQuete catalog={catalog} queteId={notif.contenu.queteId} />
        )}

        <div className="pile pile--serree">
          {choix.map((c) => (
            <button
              key={`${c.option.id}-${c.branche}`}
              type="button"
              className={`btn ${c.payable ? 'btn--principal' : ''}`}
              disabled={!c.payable || enCours}
              onClick={() => repondre(c)}
            >
              {c.option.libelle}
              {c.libelleCout && (
                <span className="tres-discret"> — {c.libelleCout}</span>
              )}
            </button>
          ))}
        </div>

        {choix
          .filter((c) => !c.payable)
          .map((c) => (
            <span key={`${c.option.id}-${c.branche}`} className="tres-discret">
              {c.option.libelle} : {c.raison}
            </span>
          ))}
      </div>
    </div>
  )
}

/** L'objet remis, présenté comme dans le sac — mêmes mots, même détail. */
function FicheObjet({
  char,
  catalog,
  equipementId,
}: {
  char: Character
  catalog: Catalog
  equipementId: string
}) {
  const eq = catalog.equipement(equipementId)
  if (!eq) return <p className="alerte alerte--erreur">Objet introuvable au catalogue.</p>

  return (
    <ObjetDetaillable
      icone={eq.icone}
      nom={eq.nom}
      meta={resumeEquipement(eq, char)}
      detail={detailObjet(eq)}
      teinte={RARETES[eq.rarete ?? 'commun'].teinte}
    />
  )
}

/**
 * La quête proposée.
 *
 * ⚠️ Contrairement à l'onglet Quêtes, **rien n'est replié** : la description est
 * l'essentiel de ce sur quoi la joueuse s'engage, et c'est ici le moment de la
 * décision. La cacher derrière un toucher ferait accepter à l'aveugle.
 */
function FicheQuete({ catalog, queteId }: { catalog: Catalog; queteId: string }) {
  const quete = catalog.quete(queteId)
  if (!quete) return <p className="alerte alerte--erreur">Quête introuvable au catalogue.</p>

  return (
    <div className="carte pile pile--serree">
      <div className="rangee">
        <Icone nom={quete.icone} taille={32} teinte={RARETES[quete.rarete ?? 'commun'].teinte} />
        <strong>{quete.nom}</strong>
      </div>
      {quete.description && (
        <p style={{ margin: 0, whiteSpace: 'pre-line' }}>{quete.description}</p>
      )}
      <div className="rangee rangee--entre">
        <span className="etiquette">Récompense</span>
        <span>{decrireRecompense(quete.recompense, catalog)}</span>
      </div>
    </div>
  )
}
