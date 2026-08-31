import { Icone } from './Icone.tsx'
import { FICTION_ACTIONS } from '../content/duel.ts'
import { MANCHES_MAX } from '../domain/duel.ts'
import { LIBELLE_ACTION_DUEL, type Duel, type MancheJouee } from '../domain/types.ts'

/**
 * La frise du combat rapide : les cinq manches, dans l'ordre, d'un coup d'œil.
 *
 * Le récit en toutes lettres disait tout mais ne montrait rien — il fallait
 * relire cinq phrases pour savoir où l'on en était. Ici chaque manche est une
 * case : les deux actions jouées face à face, le résultat dessous, et les
 * manches à venir en creux. Le nombre de cases vient de `MANCHES_MAX` : allonger
 * un duel allonge la frise, sans rien à retoucher.
 *
 * La phrase n'est pas perdue pour autant : elle devient le `title` de la case.
 */
export function FriseDuel({
  duel,
  nomJoueuse,
  recit,
}: {
  duel: Duel
  nomJoueuse: string
  /** Le récit d'une manche, réutilisé en infobulle et pour les lecteurs d'écran. */
  recit: (manche: MancheJouee) => string
}) {
  const cases = Array.from({ length: MANCHES_MAX }, (_, i) => duel.historique[i] ?? null)
  const enCours = duel.historique.length

  return (
    <section className="carte pile pile--serree">
      <div className="carte__titre">
        <span className="etiquette">Déroulé</span>
        <span className="tres-discret">
          {nomJoueuse} contre {duel.adversaireNom}
        </span>
      </div>

      <ol className="frise">
        {cases.map((manche, i) => (
          <li
            key={i}
            className={
              'frise__manche ' +
              (manche
                ? `frise__manche--${manche.issue}`
                : i === enCours && duel.issue === null
                  ? 'frise__manche--ouverte'
                  : 'frise__manche--avenir')
            }
            {...(manche ? { title: recit(manche) } : {})}
          >
            <span className="frise__numero">{i + 1}</span>

            {manche ? (
              <>
                <span className="frise__coups">
                  <Marque action={manche.actionJoueuse} camp="joueuse" />
                  <Marque action={manche.actionAdversaire} camp="adversaire" />
                </span>
                <span className="frise__issue">{verdict(manche)}</span>
                <span className="tres-discret frise__lecture">{recit(manche)}</span>
              </>
            ) : (
              <span className="frise__attente" aria-hidden="true">
                ·
              </span>
            )}
          </li>
        ))}
      </ol>
    </section>
  )
}

function Marque({ action, camp }: { action: MancheJouee['actionJoueuse']; camp: string }) {
  return (
    <span className={`frise__coup frise__coup--${camp}`} title={LIBELLE_ACTION_DUEL[action]}>
      <Icone nom={FICTION_ACTIONS[action].icone} taille={20} />
    </span>
  )
}

/** Le résultat en trois caractères : qui marque, combien, et pourquoi. */
function verdict(manche: MancheJouee): string {
  if (manche.issue === 'clash') return 'Clash'
  const signe = manche.issue === 'joueuse' ? '+' : '−'
  return `${signe}${manche.points}${manche.flow ? ' Flow' : ''}`
}
