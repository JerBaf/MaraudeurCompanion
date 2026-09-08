import { useState } from 'react'

import { LanceurDes } from '../../components/LanceurDes.tsx'
import { PasBrulure } from '../../components/PasBrulure.tsx'
import { journaliser, modifierPersonnage } from '../../data/repo.ts'
import type { Catalog } from '../../domain/catalog.ts'
import { computeMarquesMax, type ValeurCompetence } from '../../domain/competences.ts'
import {
  ajouterTerme,
  decrireJet,
  decrireTermes,
  DES_DESTIN,
  desJetCompetence,
  forcerDestin,
  issueJet,
  jetCompetence,
  LIBELLE_ISSUE,
  termeBrulure,
  totalJet,
  type IssueJet,
  type Jet,
} from '../../domain/jets.ts'
import type { Rng } from '../../domain/random.ts'
import type { Character, Competence } from '../../domain/types.ts'

/**
 * Le Test de Compétence, déplié sous la ligne de la compétence qu'on lance.
 *
 * Il vit là et pas ailleurs : une joueuse qui veut lancer son Physique touche
 * son Physique. Regrouper les jets dans un écran unique aurait obligé à
 * re-choisir la compétence qu'on venait déjà de désigner du doigt.
 *
 * Le panneau reste en flux — jamais un overlay. Le seul `position: fixed` de
 * l'application est celui des notifications, et un jet ne doit pas masquer la
 * fiche qu'on est en train de lire.
 */

const CLASSE_ISSUE: Record<IssueJet, string> = {
  reussite: 'puce--avantage',
  echec: 'puce--desavantage',
  'echec-critique': 'puce--desavantage',
  indetermine: 'puce--info',
}

export function JetCompetence({
  char,
  catalog,
  competence,
  valeur,
}: {
  char: Character
  catalog: Catalog
  competence: Competence
  valeur: ValeurCompetence
}) {
  // Le seuil est facultatif : la MJ l'annonce à voix haute, ou pas du tout.
  // Sans lui, l'application affiche le total et se garde de juger.
  const [seuil, setSeuil] = useState('')
  const [jet, setJet] = useState<Jet | null>(null)
  // Le récit d'une Combustion vit hors du jet : elle se produit pendant qu'on
  // majore, et elle doit rester lisible une fois le total recalculé.
  const [recit, setRecit] = useState<string | null>(null)

  const seuilNombre = seuil === '' ? null : Number(seuil)
  const marquesMax = computeMarquesMax(char, catalog).max

  function poser(nouveau: Jet) {
    setJet(nouveau)
    void journaliser(char.nom, 'jet', decrireJet(nouveau))
  }

  function lancer(rng: Rng) {
    setRecit(null)
    poser(jetCompetence(char, catalog, competence, seuilNombre, rng))
  }

  function prendreUneMarque() {
    void modifierPersonnage(char, (c) => ({ ...c, marques: Math.min(marquesMax, c.marques + 1) }))
    void journaliser(char.nom, 'marque', `${char.nom} prend une Marque sur un échec critique.`)
    setRecit('Marque prise. La MJ décidera de ce qu’elle en fait.')
  }

  const issue = jet ? issueJet(jet) : null

  return (
    <div className="carte pile pile--serree" style={{ marginTop: 6 }}>
      <label className="champ">
        <span className="tres-discret">Seuil annoncé par la MJ — facultatif</span>
        <input
          type="number"
          inputMode="numeric"
          min={1}
          value={seuil}
          placeholder="Aucun : l’app affichera seulement le total"
          onChange={(e) => setSeuil(e.target.value)}
        />
      </label>

      <LanceurDes
        des={desJetCompetence(valeur.net)}
        libelle={jet ? 'Relancer' : 'Lancer'}
        onJet={lancer}
      />

      {jet && issue && (
        <>
          <div className="rangee rangee--entre">
            <span className="jet__total">{totalJet(jet)}</span>
            <span className={`puce ${CLASSE_ISSUE[issue]}`}>{LIBELLE_ISSUE[issue]}</span>
          </div>

          <p className="jet__termes" style={{ margin: 0 }}>
            {decrireTermes(jet.termes)}
          </p>

          {/* « Ajouter un +1 à n'importe quel jet par brûlure utilisée. » */}
          <PasBrulure
            char={char}
            catalog={catalog}
            onDepense={(r) => {
              setRecit(r)
              poser(ajouterTerme(jet, termeBrulure()))
            }}
          />

          {jet.destin === 'disponible' && (
            <>
              <hr className="separateur" />
              <p className="tres-discret" style={{ margin: 0 }}>
                Forcer le Destin ajoute un second d20 au total. S’il ne suffit pas, l’échec devient
                critique et la MJ pourra vous ajouter une Marque.
              </p>
              <LanceurDes
                des={DES_DESTIN}
                libelle="Forcer le Destin"
                onJet={(rng) => poser(forcerDestin(jet, rng))}
              />
            </>
          )}

          {issue === 'echec-critique' && (
            <button
              type="button"
              className="btn btn--danger btn--large"
              disabled={char.marques >= marquesMax}
              onClick={prendreUneMarque}
            >
              {char.marques >= marquesMax ? 'Déjà au seuil de Marques' : 'Prendre une Marque'}
            </button>
          )}
        </>
      )}

      {recit && <p className="alerte alerte--info">{recit}</p>}
    </div>
  )
}
