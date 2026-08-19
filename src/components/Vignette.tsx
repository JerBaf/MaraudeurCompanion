import type { ReactNode } from 'react'

/**
 * Valeur mise en avant, dans son propre encadré.
 *
 * Sert aux chiffres qu'on doit pouvoir lire d'un coup d'œil sans chercher —
 * l'Évasion en premier lieu, qu'on consulte à chaque attaque reçue.
 */
export function Vignette({
  libelle,
  valeur,
  note,
  teinte,
}: {
  libelle: string
  valeur: ReactNode
  /** Ligne de détail sous la valeur : d'où elle vient. */
  note?: string
  teinte?: string
}) {
  return (
    <div className="vignette" style={teinte ? ({ '--teinte': teinte } as React.CSSProperties) : undefined}>
      <span className="etiquette">{libelle}</span>
      <span className="vignette__valeur">{valeur}</span>
      {note && <span className="vignette__note">{note}</span>}
    </div>
  )
}
