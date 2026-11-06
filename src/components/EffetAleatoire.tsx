import { useState } from 'react'

import { LanceurDes } from './LanceurDes.tsx'
import { journaliser, modifierPersonnage } from '../data/repo.ts'
import { tirerEffetAleatoire, type Des } from '../domain/random.ts'
import type { Character } from '../domain/types.ts'

/**
 * L'Effet Aléatoire : « la magie se manifeste de manière puissante et
 * incontrôlable ». 2d4, un blanc pour la force positive et un noir pour la
 * négative. Le plus haut donne la puissance et le signe ; un double ajoute une
 * Cicatrice.
 *
 * ⚠️ **Ce n'est plus un 6 en Arcane qui le déclenche** : la règle des 2d6 l'a
 * remplacé par l'Effet B, écrit dans le sort. La mécanique reste, devenue un
 * outil que la MJ sort quand la fiction l'appelle — d'où `cause`, qui dit
 * d'où elle vient, là où seul un nom de sort pouvait se lire avant.
 *
 * Vit dans `components/` et non plus sous `screens/joueuse/` depuis qu'il sert
 * à l'écran de la MJ.
 */

const DEUX_D4: Des[] = [{ nombre: 2, faces: 4 }]

export function EffetAleatoire({
  char,
  cause,
  onFini,
}: {
  char: Character
  /** Ce qui l'a déclenché, tel qu'il s'inscrira sur la Cicatrice. */
  cause: string
  onFini: () => void
}) {
  const [resultat, setResultat] = useState<ReturnType<typeof tirerEffetAleatoire> | null>(null)
  const [cicatricePrise, setCicatricePrise] = useState(false)

  function prendreLaCicatrice() {
    const texte = `Effet Aléatoire — ${cause}`
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
            La magie de « {cause} » échappe à tout contrôle. Lancez 2d4 — un blanc pour la force
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
                `${char.nom} — Effet Aléatoire (${cause}) : blanc ${r.blanc}, noir ${r.noir} → ` +
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
