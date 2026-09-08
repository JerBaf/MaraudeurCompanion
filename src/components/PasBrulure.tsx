import { journaliser, modifierPersonnage } from '../data/repo.ts'
import type { Catalog } from '../domain/catalog.ts'
import { computeFatigueMax } from '../domain/competences.ts'
import { bruluresDisponibles, consommerBrulures } from '../domain/magie.ts'
import type { Character } from '../domain/types.ts'

/**
 * Dépenser une brûlure pour majorer un jet.
 *
 * « Chaque brûlure peut être consommée pour ajouter un +1 à n'importe quel
 * jet. » La règle existait dans le PDF et dans un commentaire, mais nulle part
 * à l'écran : la joueuse décochait ses pastilles à la main et ajoutait de tête.
 *
 * La dépense est **immédiate et irréversible**, comme un appui sur la barre de
 * brûlures : `consommerBrulures` sait déjà reconnaître la neuvième et déclencher
 * la Combustion, il n'y a donc rien à répéter ici. C'est aussi pourquoi le bouton
 * n'a pas de pendant « −1 » : on ne récupère pas une brûlure dépensée.
 */
export function PasBrulure({
  char,
  catalog,
  onDepense,
}: {
  char: Character
  catalog: Catalog
  /** Appelé une fois la brûlure prélevée, pour ajouter le +1 au jet en cours. */
  onDepense: (recit: string | null) => void
}) {
  const disponibles = bruluresDisponibles(char)

  function depenser() {
    if (disponibles === 0) return
    const r = consommerBrulures(char, 1)
    const fatigueMax = computeFatigueMax(char, catalog).max

    void modifierPersonnage(char, (c) => ({
      ...c,
      brulures: r.brulures,
      bruluresConsommees: r.bruluresConsommees,
      fatigue: { ...c.fatigue, coches: Math.min(fatigueMax, c.fatigue.coches + r.fatigueAjoutee) },
    }))

    if (r.combustion) {
      void journaliser(char.nom, 'combustion', `${char.nom} atteint la Combustion.`)
    }
    onDepense(r.combustion ? 'Combustion ! 1 Point de Fatigue, les marques s’effacent.' : null)
  }

  // Sans brûlure à dépenser, un bouton grisé n'est que du bruit sur un
  // téléphone : la ligne réapparaît d'elle-même dès la première marque.
  if (disponibles === 0) return null

  return (
    <div className="rangee">
      <button type="button" className="pas" aria-label="Dépenser une brûlure pour +1" onClick={depenser}>
        +1
      </button>
      <span className="tres-discret">
        brûlure — {disponibles} disponible(s)
      </span>
    </div>
  )
}
