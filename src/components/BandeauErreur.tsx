import { useEffect, useState } from 'react'

import { effacerErreur, expliquer, surErreurStockage, type ErreurStockage } from '../store/erreurs.ts'

/**
 * Bandeau d'alerte affiché dès qu'une opération de stockage échoue.
 *
 * Sans lui, un refus des règles Firestore se traduit par une table vide et
 * muette. Ici l'erreur est nommée, expliquée, et le chemin fautif est donné —
 * c'est ce qui fait la différence entre « ça ne marche pas » et « les règles
 * ne sont pas publiées ».
 */
export function BandeauErreur() {
  const [erreur, setErreur] = useState<ErreurStockage | null>(null)

  useEffect(() => surErreurStockage(setErreur), [])

  if (!erreur) return null

  return (
    <div className="bandeau-erreur" role="alert">
      <div className="bandeau-erreur__corps">
        <strong>Firestore a refusé une {erreur.operation}.</strong>
        <p style={{ margin: '4px 0' }}>{expliquer(erreur)}</p>
        <p className="tres-discret" style={{ margin: 0 }}>
          Chemin : <code>{erreur.chemin}</code> · code : <code>{erreur.code}</code>
        </p>
      </div>
      <button
        type="button"
        className="pas"
        onClick={effacerErreur}
        aria-label="Masquer cette erreur"
      >
        ×
      </button>
    </div>
  )
}
