export type VarianteCompteur = 'fatigue' | 'brulures' | 'foi' | 'marques' | 'sens' | 'rapides'

interface Props {
  libelle: string
  variante: VarianteCompteur
  valeur: number
  max: number
  /** Absent = lecture seule. */
  onChange?: (valeur: number) => void
  /** Phrase affichée sous le compteur (seuil atteint, effet en cours…). */
  note?: string
  /**
   * Second niveau, plus avancé que `valeur` : les brûlures acquises puis
   * dépensées. Les pastilles concernées prennent un troisième aspect.
   */
  consommee?: number
  /** Remplace le clic par défaut sur une pastille, quand il y a trois états. */
  onPastille?: (index: number) => void
}

/**
 * Compteur à pastilles.
 *
 * Toucher une pastille amène directement le compteur à cette valeur — c'est le
 * geste le plus rapide à table. Les boutons − et + restent là pour les
 * ajustements fins et pour l'accessibilité au clavier.
 */
export function Compteur({
  libelle,
  variante,
  valeur,
  max,
  onChange,
  note,
  consommee = 0,
  onPastille,
}: Props) {
  const borne = (v: number) => Math.max(0, Math.min(max, v))
  // Les boutons − et + n'ont de sens qu'avec `onChange` ; les pastilles peuvent
  // n'avoir que leur propre gestionnaire.
  const modifiable = onChange !== undefined
  const pastillesActives = modifiable || onPastille !== undefined

  return (
    <div className={`compteur compteur--${variante}`}>
      <div className="compteur__entete">
        <span className="etiquette">{libelle}</span>
        <span className="compteur__valeur">
          {valeur} / {max}
        </span>
      </div>

      <div className="compteur__rangee">
        {modifiable && (
          <button
            type="button"
            className="pas"
            onClick={() => onChange(borne(valeur - 1))}
            disabled={valeur <= 0}
            aria-label={`Retirer un point de ${libelle}`}
          >
            −
          </button>
        )}

        <div className="pastilles" role="group" aria-label={libelle}>
          {Array.from({ length: max }, (_, index) => {
            const epuisee = index < consommee
            const pleine = index < valeur
            return (
              <button
                key={index}
                type="button"
                className={`pastille ${pleine ? 'pastille--pleine' : ''} ${epuisee ? 'pastille--epuisee' : ''}`}
                disabled={!pastillesActives}
                onClick={() =>
                  onPastille
                    ? onPastille(index)
                    : // Retoucher la dernière pastille pleine la vide : sinon on
                      // ne pourrait jamais revenir à zéro d'un seul geste.
                      onChange?.(valeur === index + 1 ? index : index + 1)
                }
                aria-label={`${libelle} : ${index + 1}${epuisee ? ' (consommée)' : ''}`}
                aria-pressed={pleine}
              />
            )
          })}
        </div>

        {modifiable && (
          <button
            type="button"
            className="pas"
            onClick={() => onChange(borne(valeur + 1))}
            disabled={valeur >= max}
            aria-label={`Ajouter un point de ${libelle}`}
          >
            +
          </button>
        )}
      </div>

      {note && <p className="tres-discret" style={{ margin: 0 }}>{note}</p>}
    </div>
  )
}
