import { useEffect, useState } from 'react'

import { Icone } from '../../components/Icone.tsx'
import { enregistrerModele, nouveauModele, supprimerModele, surBestiaire } from '../../data/repo.ts'
import type { ModeleAdversaire } from '../../domain/types.ts'

/**
 * Bestiaire de la MJ.
 *
 * 🔒 Vit dans une collection refusée aux joueuses, et non dans le catalogue :
 * il contient l'Évasion et le seuil de Fatigue de chaque créature, y compris
 * celles dont l'Évasion reste masquée en combat.
 *
 * Une créature écrite ici est réutilisable de session en session : on la dépose
 * en un clic depuis le panneau de combat, et les exemplaires sont numérotés
 * automatiquement.
 */
export function Bestiaire() {
  const [modeles, setModeles] = useState<ModeleAdversaire[]>([])
  const [edition, setEdition] = useState<ModeleAdversaire | null>(null)

  useEffect(() => surBestiaire(setModeles), [])

  async function enregistrer() {
    if (!edition?.nom.trim()) return
    await enregistrerModele({ ...edition, nom: edition.nom.trim() })
    setEdition(null)
  }

  return (
    <section className="carte pile pile--serree">
      <div className="carte__titre">
        <span className="etiquette">Bestiaire</span>
        <span className="tres-discret">{modeles.length} créature(s) · visible de vous seule</span>
      </div>

      <p className="discret" style={{ margin: 0 }}>
        Vos créatures, réutilisables d'une session à l'autre. Le seuil de Fatigue indique combien
        de dégâts elles encaissent avant de tomber ; laissez-le vide pour en juger vous-même.
      </p>

      {modeles.length === 0 && !edition && <p className="vide">Aucune créature enregistrée.</p>}

      {modeles.map((m) => (
        <div key={m.id} className="objet">
          <Icone nom={m.icone} taille={30} />
          <span className="objet__corps">
            <span className="objet__nom">{m.nom}</span>
            <span className="objet__meta">
              Évasion {m.evasion}
              {m.fatigueMax ? ` · seuil ${m.fatigueMax}` : ' · seuil non renseigné'}
            </span>
          </span>
          <button type="button" className="btn" onClick={() => setEdition(m)}>
            Modifier
          </button>
          <button
            type="button"
            className="btn btn--danger"
            onClick={() => {
              if (confirm(`Supprimer « ${m.nom} » du bestiaire ?`)) void supprimerModele(m.id)
            }}
            aria-label={`Supprimer ${m.nom}`}
          >
            ×
          </button>
        </div>
      ))}

      {edition ? (
        <div className="carte pile pile--serree" style={{ background: 'var(--encre)' }}>
          <span className="etiquette">
            {modeles.some((m) => m.id === edition.id) ? 'Modifier la créature' : 'Nouvelle créature'}
          </span>

          <label className="champ">
            <span className="tres-discret">Nom</span>
            <input
              type="text"
              value={edition.nom}
              onChange={(e) => setEdition({ ...edition, nom: e.target.value })}
              placeholder="Carcasse"
            />
          </label>

          <div className="rangee">
            <label className="champ" style={{ flex: 1, minWidth: 110 }}>
              <span className="tres-discret">Évasion</span>
              <input
                type="number"
                min={0}
                value={edition.evasion}
                onChange={(e) =>
                  setEdition({ ...edition, evasion: Math.max(0, Number(e.target.value) || 0) })
                }
              />
            </label>
            <label className="champ" style={{ flex: 1, minWidth: 110 }}>
              <span className="tres-discret">Seuil de Fatigue 🔒</span>
              <input
                type="number"
                min={0}
                value={edition.fatigueMax || ''}
                placeholder="—"
                onChange={(e) =>
                  setEdition({ ...edition, fatigueMax: Math.max(0, Number(e.target.value) || 0) })
                }
              />
            </label>
          </div>

          <label className="champ">
            <span className="tres-discret">Icône — nom d'un fichier de public/icons</span>
            <input
              type="text"
              value={edition.icone}
              onChange={(e) => setEdition({ ...edition, icone: e.target.value.trim() })}
              placeholder="spectre"
            />
          </label>

          <div className="rangee">
            <button type="button" className="btn btn--fantome" onClick={() => setEdition(null)}>
              Annuler
            </button>
            <button
              type="button"
              className="btn btn--principal"
              style={{ flex: 1 }}
              onClick={() => void enregistrer()}
              disabled={!edition.nom.trim()}
            >
              Enregistrer
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className="btn btn--principal btn--large"
          onClick={() => setEdition(nouveauModele())}
        >
          Ajouter une créature
        </button>
      )}
    </section>
  )
}
