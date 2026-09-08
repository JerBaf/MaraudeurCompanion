import { useState } from 'react'

import { LanceurDes } from '../../components/LanceurDes.tsx'
import { journaliser, modifierPersonnage } from '../../data/repo.ts'
import { tirerEffetAleatoire, type Des } from '../../domain/random.ts'
import type { Character } from '../../domain/types.ts'

/**
 * L'Effet Aléatoire de l'Arcane, déclenché par un 6 au dé du sort.
 *
 * « La magie se manifeste de manière puissante et incontrôlable » : la joueuse
 * lance 2d4, un blanc pour la force positive et un noir pour la négative. Le
 * plus haut donne la puissance et le signe ; un double ajoute une Cicatrice.
 *
 * C'est un second jet, demandé après coup : le dé du sort ne pouvait pas
 * l'annoncer d'avance, et le lancer d'office aurait fait passer sous les yeux
 * un résultat que personne n'attendait encore.
 */

const DEUX_D4: Des[] = [{ nombre: 2, faces: 4 }]

export function EffetAleatoire({
  char,
  sortNom,
  onFini,
}: {
  char: Character
  sortNom: string
  onFini: () => void
}) {
  const [resultat, setResultat] = useState<ReturnType<typeof tirerEffetAleatoire> | null>(null)
  const [cicatricePrise, setCicatricePrise] = useState(false)

  function prendreLaCicatrice() {
    const texte = `Effet Aléatoire de l’Arcane — ${sortNom}`
    void modifierPersonnage(char, (c) => ({ ...c, cicatrices: [...c.cicatrices, texte] }))
    void journaliser(char.nom, 'cicatrice', `${char.nom} prend une Cicatrice : ${texte}.`)
    setCicatricePrise(true)
  }

  return (
    <section className="carte pile pile--serree">
      <div className="carte__titre">
        <span className="etiquette">Effet Aléatoire</span>
        <button type="button" className="btn btn--fantome" onClick={onFini}>
          Fermer
        </button>
      </div>

      {!resultat && (
        <>
          <p className="discret" style={{ margin: 0 }}>
            Un 6 : la magie de « {sortNom} » vous échappe. Lancez 2d4 — un blanc pour la force
            positive, un noir pour la négative. Puis tirez une carte du Random Deck.
          </p>
          <LanceurDes
            des={DEUX_D4}
            libelle="Tirer l’Effet Aléatoire"
            onJet={(rng) => {
              const r = tirerEffetAleatoire(rng)
              setResultat(r)
              void journaliser(
                char.nom,
                'arcane',
                `${char.nom} — Effet Aléatoire sur « ${sortNom} » : blanc ${r.blanc}, noir ${r.noir} → ` +
                  `puissance ${r.puissance} ${r.signe}${r.cicatrice ? ', double : Cicatrice' : ''}.`,
              )
            }}
          />
        </>
      )}

      {resultat && (
        <>
          <p style={{ margin: 0 }}>
            Blanc {resultat.blanc} · noir {resultat.noir} → <strong>{resultat.puissance}</strong>{' '}
            Point(s) d’Énergie, force {resultat.signe === 'positif' ? 'positive' : 'négative'}.
          </p>

          {resultat.cicatrice && !cicatricePrise && (
            <button type="button" className="btn btn--danger btn--large" onClick={prendreLaCicatrice}>
              Double : prendre une Cicatrice
            </button>
          )}
          {cicatricePrise && <p className="alerte alerte--info">Cicatrice inscrite sur la fiche.</p>}
        </>
      )}
    </section>
  )
}
