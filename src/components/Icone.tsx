import { useEffect, useState } from 'react'

/**
 * Icône d'un élément de catalogue.
 *
 * Les fichiers vivent dans `public/icons/<nom>.svg` (jeu game-icons.net,
 * CC-BY 3.0, récupérable via `npm run icons`). Tant qu'un fichier manque, on
 * affiche un jeton coloré déduit du nom : l'app reste lisible et il est visible
 * d'un coup d'œil quelles icônes restent à fournir.
 *
 * Pour remplacer une icône par un dessin à vous, déposez simplement votre
 * fichier sous le même nom — aucun code à toucher.
 */

interface Props {
  nom: string
  taille?: number
  /** Texte alternatif. Vide par défaut : l'icône est presque toujours décorative. */
  libelle?: string
}

/** Teinte stable déduite du nom, pour que chaque objet garde la même couleur. */
function teinteDe(nom: string): number {
  let h = 0
  for (let i = 0; i < nom.length; i += 1) h = (h * 31 + nom.charCodeAt(i)) % 360
  return h
}

function initialesDe(nom: string): string {
  const mots = nom.split('-').filter(Boolean)
  if (mots.length === 0) return '?'
  if (mots.length === 1) return (mots[0] as string).slice(0, 2).toUpperCase()
  return `${(mots[0] as string)[0]}${(mots[1] as string)[0]}`.toUpperCase()
}

export function Icone({ nom, taille = 28, libelle }: Props) {
  const [introuvable, setIntrouvable] = useState(false)

  // Un changement d'icône doit redonner sa chance au fichier.
  useEffect(() => setIntrouvable(false), [nom])

  const style = { '--taille': `${taille}px` } as React.CSSProperties

  if (introuvable) {
    const h = teinteDe(nom)
    return (
      <span
        className="icone icone--repli"
        style={{ ...style, background: `hsl(${h} 42% 62%)` }}
        title={libelle ?? nom}
        aria-hidden={libelle ? undefined : true}
        role={libelle ? 'img' : undefined}
        aria-label={libelle}
      >
        {initialesDe(nom)}
      </span>
    )
  }

  return (
    <img
      className="icone"
      style={style}
      src={`${import.meta.env.BASE_URL}icons/${nom}.svg`}
      alt={libelle ?? ''}
      onError={() => setIntrouvable(true)}
    />
  )
}
