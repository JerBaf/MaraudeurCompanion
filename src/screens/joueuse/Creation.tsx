import { useState } from 'react'

import { Icone } from '../../components/Icone.tsx'
import type { Catalog } from '../../domain/catalog.ts'
import { appliquerProfil, maitrisesSuiventLeProfil } from '../../domain/character.ts'
import { COMPETENCES, LIBELLE_COMPETENCE, type Competence, type Maitrises } from '../../domain/types.ts'

/**
 * Création de personnage : un nom, une classe, une répartition de maîtrises.
 *
 * La répartition suit le profil du PDF — deux compétences à +2, une à 0, une à
 * -2 — et l'écran la construit par sélection plutôt que par saisie de nombres :
 * on choisit ses deux points forts et son point faible, le reste se déduit.
 * Impossible de se tromper, et c'est plus rapide sur un téléphone.
 */

interface Props {
  catalog: Catalog
  onCreer: (demande: { nom: string; classeId: string; maitrises: Maitrises }) => Promise<void>
  onAnnuler: () => void
}

export function Creation({ catalog, onCreer, onAnnuler }: Props) {
  const classes = catalog.classes()
  const [nom, setNom] = useState('')
  const [classeId, setClasseId] = useState<string | null>(null)
  const [fortes, setFortes] = useState<Competence[]>([])
  const [faible, setFaible] = useState<Competence | null>(null)
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  function basculerForte(c: Competence) {
    setFaible((f) => (f === c ? null : f))
    setFortes((actuelles) => {
      if (actuelles.includes(c)) return actuelles.filter((x) => x !== c)
      if (actuelles.length >= 2) return [actuelles[1] as Competence, c]
      return [...actuelles, c]
    })
  }

  function definirFaible(c: Competence) {
    setFortes((actuelles) => actuelles.filter((x) => x !== c))
    setFaible((f) => (f === c ? null : c))
  }

  const maitrises =
    fortes.length === 2 && faible
      ? appliquerProfil([fortes[0] as Competence, fortes[1] as Competence], faible)
      : null

  const valide = nom.trim().length > 0 && classeId !== null && maitrises !== null

  async function soumettre() {
    if (!valide || !classeId || !maitrises) return
    setEnCours(true)
    setErreur(null)
    try {
      await onCreer({ nom: nom.trim(), classeId, maitrises })
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Création impossible.')
      setEnCours(false)
    }
  }

  const classeChoisie = classeId ? catalog.classe(classeId) : undefined

  return (
    <div className="contenu pile">
      <header>
        <h1>Nouveau personnage</h1>
      </header>

      <div className="carte pile">
        <label className="champ">
          <span className="etiquette">Nom du personnage</span>
          <input
            type="text"
            value={nom}
            onChange={(e) => setNom(e.target.value)}
            placeholder="Maya"
            maxLength={40}
          />
        </label>
      </div>

      <section className="carte pile">
        <span className="etiquette">Classe</span>
        {classes.length === 0 && <p className="vide">Le catalogue n'est pas encore chargé.</p>}
        {classes.map((classe) => (
          <button
            key={classe.id}
            type="button"
            className={`objet ${classeId === classe.id ? 'objet--actif' : ''}`}
            onClick={() => setClasseId(classe.id)}
            aria-pressed={classeId === classe.id}
          >
            <Icone nom={classe.icone} taille={36} />
            <span className="objet__corps">
              <span className="objet__nom">{classe.nom}</span>
              <span className="objet__meta">
                {classe.fatigueMax} points de Fatigue · {classe.sortsIds.length} sorts de départ
              </span>
            </span>
          </button>
        ))}

        {classeChoisie && (
          <>
            <hr className="separateur" />
            <p className="discret" style={{ margin: 0 }}>
              {classeChoisie.lore}
            </p>
            <p className="tres-discret" style={{ margin: 0 }}>
              <strong>Passif —</strong> {classeChoisie.passifTexte}
            </p>
          </>
        )}
      </section>

      <section className="carte pile">
        <div className="carte__titre">
          <span className="etiquette">Maîtrises</span>
          <span className="tres-discret">deux à +2, une à 0, une à -2</span>
        </div>

        <span className="tres-discret">Vos deux points forts (+2)</span>
        <div className="rangee">
          {COMPETENCES.map((c) => (
            <button
              key={c}
              type="button"
              className={`btn ${fortes.includes(c) ? 'btn--principal' : ''}`}
              onClick={() => basculerForte(c)}
              aria-pressed={fortes.includes(c)}
              aria-label={`${LIBELLE_COMPETENCE[c]} en point fort`}
            >
              {LIBELLE_COMPETENCE[c]}
            </button>
          ))}
        </div>

        <span className="tres-discret" style={{ marginTop: 4 }}>
          Votre point faible (-2)
        </span>
        <div className="rangee">
          {COMPETENCES.map((c) => (
            <button
              key={c}
              type="button"
              className={`btn ${faible === c ? 'btn--danger' : ''}`}
              onClick={() => definirFaible(c)}
              disabled={fortes.includes(c)}
              aria-pressed={faible === c}
              aria-label={`${LIBELLE_COMPETENCE[c]} en point faible`}
            >
              {LIBELLE_COMPETENCE[c]}
            </button>
          ))}
        </div>

        {maitrises && (
          <>
            <hr className="separateur" />
            <div className="pile pile--serree">
              {COMPETENCES.map((c) => (
                <div key={c} className="competence">
                  <span className="competence__nom">{LIBELLE_COMPETENCE[c]}</span>
                  <span className="competence__total">
                    {maitrises[c] > 0 ? '+' : ''}
                    {maitrises[c]}
                  </span>
                </div>
              ))}
            </div>
            {!maitrisesSuiventLeProfil(maitrises) && (
              <p className="alerte alerte--erreur">Cette répartition ne suit pas le profil type.</p>
            )}
          </>
        )}
      </section>

      {erreur && <p className="alerte alerte--erreur">{erreur}</p>}

      <div className="rangee">
        <button type="button" className="btn btn--fantome" onClick={onAnnuler} disabled={enCours}>
          Annuler
        </button>
        <button
          type="button"
          className="btn btn--principal"
          style={{ flex: 1 }}
          onClick={soumettre}
          disabled={!valide || enCours}
        >
          {enCours ? 'Création…' : 'Entrer dans l’Entre-Monde'}
        </button>
      </div>
    </div>
  )
}
