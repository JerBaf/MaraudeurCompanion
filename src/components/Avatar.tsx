import type { Catalog } from '../domain/catalog.ts'
import { LIBELLE_SLOT, SLOTS_EQUIPEMENT, type Character, type SlotEquipement } from '../domain/types.ts'
import { Icone } from './Icone.tsx'

/**
 * Avatar abstrait du personnage, avec les 3 emplacements d'équipement en
 * surimpression — la disposition « inventaire » demandée dans les guidelines.
 *
 * La silhouette est dessinée en SVG et teintée à partir de `avatarSeed`, si bien
 * que chaque personnage garde son allure d'une session à l'autre sans qu'aucune
 * image n'ait à être stockée.
 */

interface Props {
  char: Character
  catalog: Catalog
  /** Appelé au toucher d'un emplacement. Absent = affichage seul. */
  onSlot?: (slot: SlotEquipement) => void
}

function teinteDe(graine: string): number {
  let h = 0
  for (let i = 0; i < graine.length; i += 1) h = (h * 37 + graine.charCodeAt(i)) % 360
  return h
}

export function Avatar({ char, catalog, onSlot }: Props) {
  const teinte = teinteDe(char.avatarSeed)

  return (
    <div className="avatar">
      <div className="avatar__silhouette">
        <Silhouette teinte={teinte} />
      </div>

      <div className="avatar__slots">
        {SLOTS_EQUIPEMENT.map((slot) => {
          const id = char.equipe[slot]
          const objet = id ? catalog.equipement(id) : undefined
          const Balise = onSlot ? 'button' : 'div'

          return (
            <Balise
              key={slot}
              {...(onSlot ? { type: 'button' as const, onClick: () => onSlot(slot) } : {})}
              className={`slot ${objet ? 'slot--rempli' : 'slot--vide'}`}
              title={objet ? objet.nom : `${LIBELLE_SLOT[slot]} — vide`}
            >
              {objet ? (
                <Icone nom={objet.icone} taille={30} />
              ) : (
                <span aria-hidden="true" style={{ fontSize: '1.1rem', opacity: 0.5 }}>
                  +
                </span>
              )}
              <span className="slot__libelle">{objet ? objet.nom : LIBELLE_SLOT[slot]}</span>
            </Balise>
          )
        })}
      </div>
    </div>
  )
}

function Silhouette({ teinte }: { teinte: number }) {
  const trait = `hsl(${teinte} 45% 62%)`
  const remplissage = `hsl(${teinte} 30% 22%)`

  return (
    <svg viewBox="0 0 120 160" width="100%" height="100%" role="img" aria-label="Silhouette du personnage">
      <defs>
        <linearGradient id={`halo-${teinte}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={trait} stopOpacity="0.30" />
          <stop offset="100%" stopColor={trait} stopOpacity="0" />
        </linearGradient>
      </defs>

      <rect width="120" height="160" fill={`url(#halo-${teinte})`} />

      {/* Manteau */}
      <path
        d="M60 44c-16 0-27 9-31 24l-8 78h78l-8-78c-4-15-15-24-31-24z"
        fill={remplissage}
        stroke={trait}
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      {/* Capuche */}
      <path
        d="M60 18c-12 0-20 9-20 21 0 8 4 13 9 16 4 2 18 2 22 0 5-3 9-8 9-16 0-12-8-21-20-21z"
        fill={remplissage}
        stroke={trait}
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      {/* Ombre du visage */}
      <ellipse cx="60" cy="41" rx="11" ry="8" fill="#0b0a09" opacity="0.85" />
      {/* Deux lueurs en guise de regard */}
      <circle cx="56" cy="40" r="1.7" fill={trait} />
      <circle cx="64" cy="40" r="1.7" fill={trait} />
      {/* Pli central du manteau */}
      <path d="M60 68v78" stroke={trait} strokeWidth="1" opacity="0.4" />
    </svg>
  )
}
