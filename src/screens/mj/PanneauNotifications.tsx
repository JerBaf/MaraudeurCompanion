import { useState } from 'react'

import { EditeurCout } from '../../components/EditeurCout.tsx'
import { FiltresCatalogue } from '../../components/FiltresCatalogue.tsx'
import { Icone } from '../../components/Icone.tsx'
import { envoyerNotification, nouvelleNotification, rangerNotification } from '../../data/repo.ts'
import type { Catalog } from '../../domain/catalog.ts'
import { COUT_GRATUIT } from '../../domain/couts.ts'
import {
  FILTRES_VIERGES,
  filtrerEntrees,
  type FiltresCatalogue as Filtres,
} from '../../domain/filtres.ts'
import {
  contenuComplet,
  contenuVierge,
  KINDS_NOTIFICATION,
  LIBELLE_KIND_NOTIFICATION,
  libelleOption,
  libelleType,
  optionCouteuse,
  type ContenuNotification,
  type Notification,
  type OptionNotification,
} from '../../domain/notifications.ts'
import type { Character, Equipement } from '../../domain/types.ts'

/**
 * Composer et suivre les notifications.
 *
 * Toujours accessible, comme le Feu de camp et le Combat rapide : c'est ici
 * qu'on prépare, et l'envoi ne change pas le mode de la table — la joueuse
 * visée reçoit sa carte sans que les autres soient interrompues.
 *
 * L'écran ne connaît que trois choses communes à toute notification — le type,
 * les cibles, le texte. Le reste est un fragment par type, et ajouter un type
 * revient à ajouter une entrée au registre de `domain/notifications.ts` puis un
 * cas à `<Contenu>`.
 */
export function PanneauNotifications({
  personnages,
  notifications,
  catalog,
}: {
  personnages: Character[]
  notifications: Notification[]
  catalog: Catalog
}) {
  const [brouillon, setBrouillon] = useState<Notification>(() =>
    nouvelleNotification('sixth-sens'),
  )

  const maj = (patch: Partial<Notification>) => setBrouillon({ ...brouillon, ...patch })

  const pret =
    brouillon.cibles.length > 0 &&
    brouillon.texte.trim() !== '' &&
    contenuComplet(brouillon.contenu)

  async function envoyer() {
    await envoyerNotification(brouillon, personnages)
    // Un brouillon neuf, mais du même type : on envoie rarement un 6th Sens seul.
    setBrouillon(nouvelleNotification(brouillon.contenu.kind))
  }

  return (
    <div className="mj-grille">
      <section className="carte pile">
        <span className="etiquette">Composer</span>

        <div className="rangee" style={{ gap: 6 }}>
          {KINDS_NOTIFICATION.map((kind) => (
            <button
              key={kind}
              type="button"
              className={`btn ${brouillon.contenu.kind === kind ? 'btn--principal' : ''}`}
              onClick={() => maj({ contenu: contenuVierge(kind) })}
            >
              {LIBELLE_KIND_NOTIFICATION[kind]}
            </button>
          ))}
        </div>

        <div className="champ">
          <span className="etiquette">Destinataires</span>
          {personnages.length === 0 && (
            <p className="vide">Aucun personnage. Les joueuses en créent depuis leur écran.</p>
          )}
          {personnages.map((p) => (
            <label key={p.id} className="rangee">
              <input
                type="checkbox"
                checked={brouillon.cibles.includes(p.id)}
                onChange={(e) =>
                  maj({
                    cibles: e.target.checked
                      ? [...brouillon.cibles, p.id]
                      : brouillon.cibles.filter((id) => id !== p.id),
                  })
                }
              />
              <span>{p.nom}</span>
            </label>
          ))}
          {personnages.length > 1 && (
            <button
              type="button"
              className="btn btn--fantome"
              onClick={() =>
                maj({
                  cibles:
                    brouillon.cibles.length === personnages.length
                      ? []
                      : personnages.map((p) => p.id),
                })
              }
            >
              {brouillon.cibles.length === personnages.length ? 'Aucune' : 'Toutes'}
            </button>
          )}
        </div>

        <label className="champ">
          <span className="tres-discret">
            {brouillon.contenu.kind === 'sixth-sens'
              ? "Ce qui titille son 6th Sens — l'amorce, pas l'information"
              : 'Le contexte, affiché au-dessus des options'}
          </span>
          <textarea
            value={brouillon.texte}
            placeholder={
              brouillon.contenu.kind === 'sixth-sens'
                ? "Un courant d'air froid vient du couloir de gauche."
                : "Un buisson s'agite dans la pénombre."
            }
            onChange={(e) => maj({ texte: e.target.value })}
          />
        </label>

        <Contenu
          contenu={brouillon.contenu}
          catalog={catalog}
          onChange={(contenu) => maj({ contenu })}
        />

        <button
          type="button"
          className="btn btn--principal btn--large"
          disabled={!pret}
          onClick={() => void envoyer()}
        >
          Envoyer
        </button>
      </section>

      <div className="mj-grille__cote pile">
        <span className="etiquette">En cours ({notifications.length})</span>
        {notifications.length === 0 && <p className="vide">Aucune notification en cours.</p>}
        {notifications.map((n) => (
          <Suivi key={n.id} notif={n} personnages={personnages} catalog={catalog} />
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Le fragment propre à chaque type
// ---------------------------------------------------------------------------

function Contenu({
  contenu,
  catalog,
  onChange,
}: {
  contenu: ContenuNotification
  catalog: Catalog
  onChange: (c: ContenuNotification) => void
}) {
  switch (contenu.kind) {
    case 'sixth-sens':
      return (
        <p className="alerte alerte--info" style={{ margin: 0 }}>
          Deux réponses, toujours les mêmes : <strong>Écouter</strong> consomme un point de 6th
          Sens et vous le signale ici — vous donnez alors l'information à l'oreille —, ou{' '}
          <strong>Laisse passer</strong>, et il ne se passe rien.
        </p>
      )

    case 'choix':
      return <ChoixOptions options={contenu.options} onChange={(options) => onChange({ ...contenu, options })} />

    case 'equipement':
      return (
        <ChoisirEquipement
          catalog={catalog}
          valeur={contenu.equipementId}
          onChange={(equipementId) => onChange({ ...contenu, equipementId })}
        />
      )
  }
}

/** Les options d'un Choix secret : un libellé, et ce qu'il en coûte de le prendre. */
function ChoixOptions({
  options,
  onChange,
}: {
  options: OptionNotification[]
  onChange: (o: OptionNotification[]) => void
}) {
  const majOption = (index: number, patch: Partial<OptionNotification>) =>
    onChange(options.map((o, i) => (i === index ? { ...o, ...patch } : o)))

  return (
    <div className="pile pile--serree">
      {options.map((option, index) => (
        <section key={option.id} className="carte pile pile--serree">
          <div className="carte__titre" style={{ marginBottom: 0 }}>
            <span className="etiquette">Option {String.fromCharCode(65 + index)}</span>
            {options.length > 2 && (
              <button
                type="button"
                className="btn btn--fantome"
                onClick={() => onChange(options.filter((_, i) => i !== index))}
              >
                Retirer
              </button>
            )}
          </div>

          <input
            type="text"
            value={option.libelle}
            placeholder={index === 0 ? 'Aller voir' : 'Jeter une pierre dans le buisson'}
            aria-label={`Libellé de l'option ${String.fromCharCode(65 + index)}`}
            onChange={(e) => majOption(index, { libelle: e.target.value })}
          />

          <EditeurCout
            valeur={option.cout}
            label="Coût de l'option"
            onChange={(cout) => majOption(index, { cout })}
          />
        </section>
      ))}

      <button
        type="button"
        className="btn btn--fantome"
        onClick={() =>
          onChange([
            ...options,
            // L'identifiant sert de clé de réponse : il doit rester unique et
            // stable, même si une option antérieure est retirée.
            { id: `opt-${options.length}-${Date.now()}`, libelle: '', cout: COUT_GRATUIT },
          ])
        }
      >
        Ajouter une option
      </button>
    </div>
  )
}

/** On filtre d'abord, on choisit ensuite — même geste que « Accorder » dans l'inventaire. */
function ChoisirEquipement({
  catalog,
  valeur,
  onChange,
}: {
  catalog: Catalog
  valeur: string
  onChange: (id: string) => void
}) {
  const [filtres, setFiltres] = useState<Filtres>(FILTRES_VIERGES)
  const visibles = filtrerEntrees(catalog.equipements(), filtres) as Equipement[]
  const choisi = valeur ? catalog.equipement(valeur) : undefined

  return (
    <div className="champ">
      <span className="etiquette">L'objet remis</span>

      <FiltresCatalogue
        kind="equipement"
        valeur={filtres}
        catalog={catalog}
        total={visibles.length}
        onChange={setFiltres}
      />

      <select
        value={valeur}
        aria-label="L'objet remis"
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">— choisir —</option>
        {visibles.map((e) => (
          <option key={e.id} value={e.id}>
            {e.nom}
            {e.prix !== undefined ? ` — ${e.prix} ʟ` : ''}
          </option>
        ))}
      </select>

      <p className="discret" style={{ margin: 0 }}>
        {choisi
          ? `L'objet entre dans le sac quand la joueuse le prend — il ne sera pas équipé.`
          : `Choisissez l'objet : la joueuse verra sa description et ses statistiques avant de le prendre.`}
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Suivi
// ---------------------------------------------------------------------------

function Suivi({
  notif,
  personnages,
  catalog,
}: {
  notif: Notification
  personnages: Character[]
  catalog: Catalog
}) {
  const objet =
    notif.contenu.kind === 'equipement' ? catalog.equipement(notif.contenu.equipementId) : undefined

  return (
    <section className="carte pile pile--serree">
      <div className="carte__titre" style={{ marginBottom: 0 }}>
        <span className="etiquette">{libelleType(notif)}</span>
        <button type="button" className="btn btn--fantome" onClick={() => void rangerNotification(notif.id)}>
          Ranger
        </button>
      </div>

      <p style={{ margin: 0, whiteSpace: 'pre-line' }}>{notif.texte}</p>

      {objet && (
        <div className="rangee">
          <Icone nom={objet.icone} taille={24} />
          <span className="tres-discret">{objet.nom}</span>
        </div>
      )}

      {notif.cibles.map((id) => {
        const nom = personnages.find((p) => p.id === id)?.nom ?? id
        const reponse = notif.reponses[id]

        return (
          <div key={id} className="rangee">
            <span style={{ flex: 1 }}>{nom}</span>
            {reponse ? (
              <span
                className={`puce ${optionCouteuse(notif, reponse.optionId) ? 'puce--ambre' : ''}`}
              >
                {libelleOption(notif, reponse.optionId)}
              </span>
            ) : (
              <span className="tres-discret">En attente…</span>
            )}
          </div>
        )
      })}
    </section>
  )
}
