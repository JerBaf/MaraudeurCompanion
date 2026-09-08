/**
 * La barre d'onglets, commune à l'écran joueuse et à l'écran MJ.
 *
 * Les deux la portaient à l'identique, à une ligne près — la puce « • » du tour
 * actif. Une barre recopiée finit par diverger sur ce qui compte : le rôle
 * `tablist`, l'état `aria-selected`, la classe active.
 *
 * Générique sur la clé plutôt que sur une liste de chaînes : chaque écran garde
 * son propre type `Onglet` fermé, donc son `switch` d'affichage exhaustif.
 */
export function Onglets<T extends string>({
  onglets,
  actif,
  libelle,
  onChoisir,
}: {
  onglets: readonly T[]
  actif: T
  /** Le texte du bouton. Une fonction, pour que l'appelant puisse y ajouter une marque. */
  libelle: (cle: T) => string
  onChoisir: (cle: T) => void
}) {
  return (
    <div className="onglets" role="tablist">
      {onglets.map((cle) => (
        <button
          key={cle}
          type="button"
          role="tab"
          aria-selected={actif === cle}
          className={`onglet ${actif === cle ? 'onglet--actif' : ''}`}
          onClick={() => onChoisir(cle)}
        >
          {libelle(cle)}
        </button>
      ))}
    </div>
  )
}
