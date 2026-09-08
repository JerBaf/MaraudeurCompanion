import { useState } from 'react'

import { useModeDes } from '../hooks/useDes.ts'
import {
  cryptoRng,
  decrireDes,
  nombreDeDes,
  rngManuel,
  type Des,
  type Rng,
} from '../domain/random.ts'

/**
 * Le geste « je lance ce dé », posé partout où un jet a lieu.
 *
 * Ce n'est **pas** un écran de jets : il n'existe qu'à l'endroit de la chose
 * qu'on lance — la ligne d'une compétence, le bouton d'un sort, l'Actif d'un
 * objet. Une joueuse qui veut lancer son Physique touche son Physique.
 *
 * Il rend un `Rng`, jamais un nombre : c'est ce qui lui permet d'alimenter
 * indifféremment `lancerSort`, `utiliserActif` ou `jetCompetence` sans rien
 * connaître de leurs règles. Les dés demandés viennent de fonctions qui vivent
 * à côté du code qui les consomme (`desDuSort`, `desDeActif`,
 * `desJetCompetence`), pour que les deux ne puissent pas se désynchroniser.
 */
export function LanceurDes({
  des,
  libelle = 'Lancer',
  disabled,
  onJet,
}: {
  /** Les dés demandés, dans l'ordre où le domaine les consomme. */
  des: Des[]
  /** Texte du bouton quand c'est l'application qui lance. */
  libelle?: string
  disabled?: boolean
  onJet: (rng: Rng) => void
}) {
  const mode = useModeDes()
  // L'exception ponctuelle : inverser la préférence pour ce jet-ci seulement.
  // Une joueuse sans dés peut vouloir lancer son Test de Compétence à la main
  // pour la solennité, et l'inverse arrive aussi.
  const [exception, setException] = useState(false)
  const [saisies, setSaisies] = useState<string[]>([])

  // Un lot « 2d4 » demande deux saisies : on aplatit pour étiqueter chaque champ.
  const faces = des.flatMap((d) => Array.from({ length: d.nombre }, () => d.faces))

  // Rien à lancer — une table déterministe, un sort sans dé : pas de choix à
  // offrir, le geste est direct.
  if (nombreDeDes(des) === 0) {
    return (
      <button
        type="button"
        className="btn btn--principal"
        disabled={disabled}
        onClick={() => onJet(cryptoRng)}
      >
        {libelle}
      </button>
    )
  }

  const manuel = (mode === 'main') !== exception

  const bascule = (
    <button
      type="button"
      className="btn btn--fantome pas"
      aria-label={manuel ? 'Laisser l’application lancer ce dé' : 'Saisir mon propre résultat'}
      title={manuel ? 'Laisser l’application lancer' : 'Saisir mon propre résultat'}
      onClick={() => {
        setException((e) => !e)
        setSaisies([])
      }}
    >
      {manuel ? '🎲' : '⌨'}
    </button>
  )

  if (!manuel) {
    return (
      <div className="rangee">
        <button
          type="button"
          className="btn btn--principal"
          disabled={disabled}
          onClick={() => onJet(cryptoRng)}
        >
          {libelle} <span className="tres-discret">{decrireDes(des)}</span>
        </button>
        {bascule}
      </div>
    )
  }

  const nombres = faces.map((_, i) => Number(saisies[i]))
  const complet = faces.every((f, i) => {
    const v = nombres[i] ?? Number.NaN
    return saisies[i] !== undefined && saisies[i] !== '' && Number.isInteger(v) && v >= 1 && v <= f
  })

  return (
    <div className="rangee">
      {faces.map((f, i) => (
        <input
          key={i}
          type="number"
          inputMode="numeric"
          className="de-saisi"
          min={1}
          max={f}
          value={saisies[i] ?? ''}
          placeholder={`d${f}`}
          aria-label={`Résultat du d${f}`}
          onChange={(e) =>
            setSaisies((s) => {
              const copie = [...s]
              copie[i] = e.target.value
              return copie
            })
          }
        />
      ))}
      <button
        type="button"
        className="btn btn--principal"
        disabled={disabled || !complet}
        onClick={() => {
          onJet(rngManuel(nombres))
          setSaisies([])
        }}
      >
        {libelle}
      </button>
      {bascule}
    </div>
  )
}
