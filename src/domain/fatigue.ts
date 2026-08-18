import type { Catalog } from './catalog.ts'
import type { Rng } from './random.ts'
import { SLOTS_EQUIPEMENT, type Character, type CharacterSecret, type SlotEquipement } from './types.ts'

// ---------------------------------------------------------------------------
// Points de Fatigue
// ---------------------------------------------------------------------------

export interface ResultatFatigue {
  char: Character
  /** Toutes les cases sont cochées : le cycle s'achève, la MJ doit intervenir. */
  grillePleine: boolean
}

/** Coche `nombre` Points de Fatigue (ou en décoche si `nombre` est négatif). */
export function ajusterFatigue(char: Character, nombre: number): ResultatFatigue {
  const coches = Math.max(0, Math.min(char.fatigue.max, char.fatigue.coches + nombre))
  return {
    char: { ...char, fatigue: { ...char.fatigue, coches } },
    grillePleine: coches >= char.fatigue.max,
  }
}

export function fatigueRestante(char: Character): number {
  return Math.max(0, char.fatigue.max - char.fatigue.coches)
}

// ---------------------------------------------------------------------------
// Détachement
// ---------------------------------------------------------------------------

export interface ElementDetachable {
  id: string
  kind: 'sort' | 'equipement'
  nom: string
  icone: string
  /** Équipé dans un des 3 slots, ou présent dans les 3 sorts du Grimoire. */
  actif: boolean
}

/**
 * Ensemble dans lequel le Détachement tire l'élément perdu.
 *
 * Choix arrêté avec la MJ : **tout ce que possède le personnage**, sorts connus
 * et équipements, sac à dos compris. En sont exclus :
 *  - les améliorations, que le PDF déclare explicitement non éligibles ;
 *  - le matériel de base (rations, catalyseur, paquetage de survie).
 */
export function poolDetachement(char: Character, catalog: Catalog): ElementDetachable[] {
  const pool: ElementDetachable[] = []

  for (const id of char.possede.sorts) {
    const sort = catalog.sort(id)
    if (!sort) continue
    pool.push({
      id,
      kind: 'sort',
      nom: sort.nom,
      icone: sort.icone,
      actif: char.grimoire.includes(id),
    })
  }

  const equipes = new Set(Object.values(char.equipe).filter(Boolean) as string[])
  for (const id of char.possede.equipements) {
    const eq = catalog.equipement(id)
    if (!eq || eq.materielDeBase) continue
    pool.push({ id, kind: 'equipement', nom: eq.nom, icone: eq.icone, actif: equipes.has(id) })
  }

  return pool
}

export interface ResultatDetachement {
  char: Character
  perdu: ElementDetachable | null
  /** Ce qui a été proposé au tirage, pour l'afficher et le journaliser. */
  pool: ElementDetachable[]
}

/**
 * Effectue un Détachement : un élément tiré au hasard est perdu **à jamais**.
 * Il disparaît aussi des slots actifs s'il y était.
 */
export function effectuerDetachement(
  char: Character,
  catalog: Catalog,
  rng: Rng,
): ResultatDetachement {
  const pool = poolDetachement(char, catalog)
  if (pool.length === 0) return { char, perdu: null, pool }

  const perdu = rng.pick(pool)
  return { char: retirerElement(char, perdu), perdu, pool }
}

/** Retire définitivement un élément du personnage, slots actifs compris. */
export function retirerElement(char: Character, element: ElementDetachable): Character {
  if (element.kind === 'sort') {
    return {
      ...char,
      possede: { ...char.possede, sorts: char.possede.sorts.filter((s) => s !== element.id) },
      grimoire: char.grimoire.filter((s) => s !== element.id),
      sortsEpuises: char.sortsEpuises.filter((s) => s !== element.id),
    }
  }

  const equipe = { ...char.equipe }
  for (const slot of SLOTS_EQUIPEMENT as readonly SlotEquipement[]) {
    if (equipe[slot] === element.id) equipe[slot] = null
  }
  return {
    ...char,
    possede: {
      ...char.possede,
      equipements: char.possede.equipements.filter((e) => e !== element.id),
    },
    equipe,
  }
}

// ---------------------------------------------------------------------------
// Cycles et fin de personnage
// ---------------------------------------------------------------------------

export function cyclesRestants(secret: CharacterSecret): number {
  return Math.max(0, secret.cyclesTotal - secret.cyclesConsommes)
}

export interface ResolutionGrillePleine {
  char: Character
  secret: CharacterSecret
  /** Le dernier cycle est achevé : le personnage disparaît. */
  finDuPersonnage: boolean
  detachement: ResultatDetachement | null
  cicatriceObtenue: boolean
}

/**
 * Résout une grille de Fatigue entièrement cochée, côté MJ.
 *
 * Suit le diagramme du PDF : le cycle est consommé, puis soit c'est la fin du
 * personnage, soit elle effectue un Détachement, obtient une Cicatrice et
 * retrouve l'intégralité de ses Points de Fatigue.
 *
 * 🔒 `secret` ne doit jamais transiter vers un écran joueuse : le nombre de
 * cycles restants est précisément ce qui doit rester inconnu pour maintenir la
 * tension (« chaque cycle passé pourrait être le dernier »).
 */
export function resoudreGrillePleine(
  char: Character,
  secret: CharacterSecret,
  catalog: Catalog,
  rng: Rng,
): ResolutionGrillePleine {
  const apres: CharacterSecret = { ...secret, cyclesConsommes: secret.cyclesConsommes + 1 }

  if (cyclesRestants(apres) <= 0) {
    return { char, secret: apres, finDuPersonnage: true, detachement: null, cicatriceObtenue: false }
  }

  const detachement = effectuerDetachement(char, catalog, rng)
  return {
    char: {
      ...detachement.char,
      fatigue: { ...detachement.char.fatigue, coches: 0 },
      cicatrices: [...detachement.char.cicatrices, 'Cicatrice à décrire par la MJ'],
    },
    secret: apres,
    finDuPersonnage: false,
    detachement,
    cicatriceObtenue: true,
  }
}
