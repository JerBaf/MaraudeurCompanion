import { Icone } from '../../components/Icone.tsx'
import type { Catalog } from '../../domain/catalog.ts'
import { computeFatigueMax } from '../../domain/competences.ts'
import { fatigueRestante } from '../../domain/fatigue.ts'
import type { Character } from '../../domain/types.ts'

/**
 * Choix du personnage.
 *
 * La table ne réunit pas les mêmes joueuses chaque session : on affiche donc
 * tous les personnages de la campagne, et il suffit d'en toucher un pour le
 * reprendre exactement dans l'état où il a été laissé. Celui déjà associé à cet
 * appareil est mis en avant.
 */

interface Props {
  personnages: Character[]
  catalog: Catalog
  deviceId: string
  onChoisir: (char: Character) => void
  onCreer: () => void
}

export function Roster({ personnages, catalog, deviceId, onChoisir, onCreer }: Props) {
  const miens = personnages.filter((c) => c.claimedBy === deviceId)
  const autres = personnages.filter((c) => c.claimedBy !== deviceId)

  return (
    <div className="contenu pile">
      <header>
        <h1>Qui êtes-vous ce soir ?</h1>
        <p className="discret" style={{ margin: '4px 0 0' }}>
          Touchez votre personnage pour le retrouver dans l'état où vous l'avez laissé.
        </p>
      </header>

      {miens.length > 0 && (
        <section className="pile pile--serree">
          <span className="etiquette">Sur cet appareil</span>
          {miens.map((c) => (
            <CartePersonnage key={c.id} char={c} catalog={catalog} onClick={() => onChoisir(c)} />
          ))}
        </section>
      )}

      {autres.length > 0 && (
        <section className="pile pile--serree">
          <span className="etiquette">{miens.length > 0 ? 'Autres personnages' : 'Personnages de la table'}</span>
          {autres.map((c) => (
            <CartePersonnage key={c.id} char={c} catalog={catalog} onClick={() => onChoisir(c)} />
          ))}
        </section>
      )}

      {personnages.length === 0 && (
        <p className="vide">Aucun personnage pour l'instant. Créez le premier.</p>
      )}

      <button type="button" className="btn btn--principal btn--large" onClick={onCreer}>
        Créer un personnage
      </button>
    </div>
  )
}

function CartePersonnage({
  char,
  catalog,
  onClick,
}: {
  char: Character
  catalog: Catalog
  onClick: () => void
}) {
  const classe = catalog.classe(char.classeId)
  const restante = fatigueRestante(char, catalog)

  return (
    <button type="button" className="objet" onClick={onClick}>
      <Icone nom={classe?.icone ?? 'inconnu'} taille={36} />
      <span className="objet__corps">
        <span className="objet__nom">{char.nom}</span>
        <span className="objet__meta">
          {classe?.nom ?? char.classeId} · Fatigue {restante}/{computeFatigueMax(char, catalog).max} · {char.lumens} lumens
        </span>
      </span>
      {char.marques > 0 && <span className="puce puce--info">{char.marques} marque(s)</span>}
    </button>
  )
}
