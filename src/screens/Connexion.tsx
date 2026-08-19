import { useState, type FormEvent } from 'react'

import { CODE_TABLE_LOCAL, PIN_MJ_LOCAL } from '../config.ts'
import { auth, EN_MODE_LOCAL, ErreurAuth } from '../store/index.ts'

/**
 * Porte d'entrée : un code de table pour les joueuses, un PIN pour la MJ.
 *
 * Ces deux valeurs sont les mots de passe de deux comptes Firebase distincts.
 * Ce n'est donc pas un simple filtre d'affichage : sans le bon mot de passe,
 * aucune donnée n'est lisible, et le PIN MJ est ce qui déverrouille l'accès aux
 * secrets (les cycles restants notamment).
 */
export function Connexion() {
  const [onglet, setOnglet] = useState<'joueuse' | 'mj'>('joueuse')
  const [valeur, setValeur] = useState('')
  const [erreur, setErreur] = useState<string | null>(null)
  const [enCours, setEnCours] = useState(false)

  async function soumettre(e: FormEvent) {
    e.preventDefault()
    setErreur(null)
    setEnCours(true)
    try {
      if (onglet === 'joueuse') await auth.connecterJoueuse(valeur)
      else await auth.connecterMJ(valeur)
    } catch (err) {
      setErreur(err instanceof ErreurAuth ? err.message : 'Connexion impossible. Réessayez.')
    } finally {
      setEnCours(false)
    }
  }

  function changerOnglet(cible: 'joueuse' | 'mj') {
    setOnglet(cible)
    setValeur('')
    setErreur(null)
  }

  return (
    <div className="contenu" style={{ maxWidth: 400, paddingTop: 48 }}>
      <div className="pile">
        <header style={{ textAlign: 'center', marginBottom: 8 }}>
          <h1>Maraudeur</h1>
          <p className="discret" style={{ margin: '4px 0 0' }}>
            Companion de table — Entre-Monde
          </p>
        </header>

        <div className="onglets" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={onglet === 'joueuse'}
            className={`onglet ${onglet === 'joueuse' ? 'onglet--actif' : ''}`}
            onClick={() => changerOnglet('joueuse')}
          >
            Joueuse
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={onglet === 'mj'}
            className={`onglet ${onglet === 'mj' ? 'onglet--actif' : ''}`}
            onClick={() => changerOnglet('mj')}
          >
            MJ
          </button>
        </div>

        <form className="carte pile" onSubmit={soumettre}>
          <label className="champ">
            <span className="etiquette">
              {onglet === 'joueuse' ? 'Code de table' : 'PIN de la MJ'}
            </span>
            <input
              type={onglet === 'joueuse' ? 'text' : 'password'}
              value={valeur}
              onChange={(e) => setValeur(e.target.value)}
              autoComplete={onglet === 'joueuse' ? 'off' : 'current-password'}
              autoCapitalize={onglet === 'joueuse' ? 'characters' : 'off'}
              inputMode={onglet === 'mj' ? 'numeric' : 'text'}
              placeholder={onglet === 'joueuse' ? 'ENTREMONDE' : '••••'}
              required
              // eslint-disable-next-line jsx-a11y/no-autofocus
              autoFocus
            />
          </label>

          {erreur && <p className="alerte alerte--erreur">{erreur}</p>}

          <button type="submit" className="btn btn--principal btn--large" disabled={enCours || !valeur.trim()}>
            {enCours ? 'Connexion…' : 'Entrer'}
          </button>
        </form>

        {EN_MODE_LOCAL && (
          <div className="alerte alerte--info">
            <strong>Mode local</strong> — les données restent dans ce navigateur et se
            synchronisent entre onglets. Code de table <code>{CODE_TABLE_LOCAL}</code>, PIN MJ{' '}
            <code>{PIN_MJ_LOCAL}</code>. Renseignez <code>FIREBASE_CONFIG</code> dans{' '}
            <code>src/config.ts</code> pour passer à la vraie table.
          </div>
        )}
      </div>
    </div>
  )
}
