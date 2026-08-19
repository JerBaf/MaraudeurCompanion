import { useState } from 'react'

import { RAPPELS_COMBAT, SEQUENCE_COMBAT } from '../../content/regles-combat.ts'

/**
 * Rappels de règles et séquence de combat.
 *
 * Repliés par défaut : à table, on les ouvre pour trancher un doute, pas pour
 * les lire d'un bout à l'autre.
 */
export function RappelsCombat() {
  return (
    <div className="pile">
      <section className="carte pile pile--serree">
        <span className="etiquette">Séquence du combat</span>
        {SEQUENCE_COMBAT.map((e) => (
          <div key={e.etape} className="etape">
            <span className="etape__numero">{e.etape}</span>
            <div className="etape__corps">
              <span className="objet__nom">{e.titre}</span>
              <ul className="etape__liste">
                {e.details.map((d) => (
                  <li key={d}>{d}</li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </section>

      <section className="carte pile pile--serree">
        <span className="etiquette">Rappels de règles</span>
        {RAPPELS_COMBAT.map((r) => (
          <Rappel key={r.id} rappel={r} />
        ))}
      </section>
    </div>
  )
}

function Rappel({ rappel }: { rappel: (typeof RAPPELS_COMBAT)[number] }) {
  const [ouvert, setOuvert] = useState(false)

  return (
    <div>
      <button
        type="button"
        className="objet"
        onClick={() => setOuvert((o) => !o)}
        aria-expanded={ouvert}
      >
        <span className="objet__corps">
          <span className="objet__nom">{rappel.titre}</span>
        </span>
        <span className="tres-discret" aria-hidden="true">
          {ouvert ? '▾' : '▸'}
        </span>
      </button>

      {ouvert && (
        <div className="effet__detail">
          <p style={{ margin: 0 }}>{rappel.texte}</p>
          {rappel.table && (
            <div className="table-defilante">
              <table className="table-regle">
                <thead>
                  <tr>
                    {rappel.table.entetes.map((h) => (
                      <th key={h}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rappel.table.lignes.map((ligne, i) => (
                    <tr key={i}>
                      {ligne.map((cellule, j) => (
                        <td key={j}>{cellule}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
