import { useEffect, useState } from 'react'

import { Onglets } from '../../components/Onglets.tsx'
import { modifierPersonnage } from '../../data/repo.ts'
import type { Catalog } from '../../domain/catalog.ts'
import { estSonTour } from '../../domain/combat.ts'
import type { Notification } from '../../domain/notifications.ts'
import type { Adversaire, Character, EtatTable } from '../../domain/types.ts'
import { OngletCampfire } from './OngletCampfire.tsx'
import { OngletCombat } from './OngletCombat.tsx'
import { OngletDuel } from './OngletDuel.tsx'
import { OngletFiche } from './OngletFiche.tsx'
import { OngletQuetes } from './OngletQuetes.tsx'
import { OngletSac } from './OngletSac.tsx'
import { OngletSorts } from './OngletSorts.tsx'
import { OverlayNotifications } from './OverlayNotifications.tsx'

/**
 * L'écran de la joueuse : un bandeau, une barre d'onglets, et l'onglet actif.
 *
 * Rien d'autre. Chaque onglet vit dans son fichier, y compris les trois qui
 * étaient ici — Fiche, Sorts, Équipement : quatre onglets sur sept avaient déjà
 * le leur, et la moitié restante faisait de cet aiguillage un fichier de mille
 * lignes qu'on ouvrait pour tout autre chose que l'aiguillage.
 */

interface Props {
  char: Character
  catalog: Catalog
  etat: EtatTable | null
  adversaires: Adversaire[]
  personnages: Character[]
  notifications: Notification[]
  onQuitter: () => void
}

type Onglet = 'fiche' | 'combat' | 'duel' | 'camp' | 'quetes' | 'sorts' | 'sac'

const LIBELLE_ONGLET: Record<Onglet, string> = {
  fiche: 'Fiche',
  combat: 'Combat',
  duel: 'Combat rapide',
  camp: 'Feu de camp',
  quetes: 'Quêtes',
  sorts: 'Sorts',
  // L'onglet montre désormais tout l'équipement, porté compris : « Sac à dos »
  // ne décrivait plus que la moitié de son contenu.
  sac: 'Équipement',
}

export function Fiche({
  char,
  catalog,
  etat,
  adversaires,
  personnages,
  notifications,
  onQuitter,
}: Props) {
  const [onglet, setOnglet] = useState<Onglet>('fiche')
  const classe = catalog.classe(char.classeId)

  const enCombat = etat?.mode === 'combat'
  const auCamp = etat?.mode === 'campfire'
  const enDuel = etat?.mode === 'duel'
  const monTour = enCombat && estSonTour(char, etat.combat)

  // Combat, Combat rapide et Feu de camp *ajoutent* un onglet, ils n'en
  // remplacent aucun : la fiche reste consultable à tout moment.
  const onglets: Onglet[] = [
    'fiche',
    ...(enCombat ? (['combat'] as const) : []),
    ...(enDuel ? (['duel'] as const) : []),
    ...(auCamp ? (['camp'] as const) : []),
    'quetes',
    'sorts',
    'sac',
  ]
  const ongletActif = onglets.includes(onglet) ? onglet : 'fiche'

  // Quand la MJ lance un feu de camp, un combat ou un duel, on y amène la
  // joueuse : sans cela, elle resterait sur sa fiche sans voir que la table a
  // basculé.
  useEffect(() => {
    if (auCamp) setOnglet('camp')
    else if (enDuel) setOnglet('duel')
    else if (enCombat) setOnglet('combat')
    else setOnglet('fiche')
  }, [auCamp, enCombat, enDuel])

  const maj = (transformer: (c: Character) => Character) => {
    void modifierPersonnage(char, transformer)
  }

  return (
    <>
      <OverlayNotifications char={char} catalog={catalog} notifications={notifications} />

      <header className="bandeau">
        <button type="button" className="btn btn--fantome pas" onClick={onQuitter} aria-label="Changer de personnage">
          ←
        </button>
        <span className="bandeau__titre">
          {char.nom}
          <span className="tres-discret"> · {classe?.nom ?? char.classeId}</span>
        </span>
        {monTour && <span className="puce puce--ambre">À vous</span>}
      </header>

      <div className="contenu pile">
        <Onglets
          onglets={onglets}
          actif={ongletActif}
          libelle={(cle) => `${LIBELLE_ONGLET[cle]}${cle === 'combat' && monTour ? ' •' : ''}`}
          onChoisir={setOnglet}
        />

        {ongletActif === 'fiche' && <OngletFiche char={char} catalog={catalog} maj={maj} />}
        {ongletActif === 'combat' && etat && (
          <OngletCombat
            char={char}
            catalog={catalog}
            etat={etat}
            adversaires={adversaires}
            personnages={personnages}
          />
        )}
        {ongletActif === 'duel' && etat && (
          <OngletDuel char={char} etat={etat} personnages={personnages} />
        )}
        {ongletActif === 'camp' && etat && (
          <OngletCampfire char={char} catalog={catalog} etat={etat} personnages={personnages} />
        )}
        {ongletActif === 'quetes' && <OngletQuetes char={char} catalog={catalog} />}
        {ongletActif === 'sorts' && <OngletSorts char={char} catalog={catalog} maj={maj} />}
        {ongletActif === 'sac' && <OngletSac char={char} catalog={catalog} />}
      </div>
    </>
  )
}
