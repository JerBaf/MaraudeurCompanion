import type { Catalog } from './catalog.ts'
import { tirerCycles, type Rng } from './random.ts'
import { TAILLE_GRIMOIRE } from './campfire.ts'
import {
  COMPETENCES,
  type Character,
  type CharacterSecret,
  type Competence,
  type EtatPassifs,
  type Maitrises,
} from './types.ts'

/** Points de Foi de départ : « Les joueuses commencent toutes avec 2 Points de Foi ». */
export const FOI_DE_DEPART = 2

/** Profil de maîtrise type : deux +2, un 0, un -2. */
export const PROFIL_MAITRISE_TYPE = [2, 2, 0, -2] as const

export function maitrisesVierges(): Maitrises {
  return { physique: 0, roublardise: 0, esprit: 0, social: 0 }
}

/**
 * Vérifie que la répartition suit le profil type du PDF.
 *
 * C'est un garde-fou pour l'écran de création, pas une loi : la MJ peut toujours
 * imposer un profil différent depuis son écran d'édition.
 */
export function maitrisesSuiventLeProfil(m: Maitrises): boolean {
  const valeurs = COMPETENCES.map((c) => m[c]).sort((a, b) => a - b)
  const attendu = [...PROFIL_MAITRISE_TYPE].sort((a, b) => a - b)
  return valeurs.every((v, i) => v === attendu[i])
}

export interface DemandeCreation {
  id: string
  nom: string
  classeId: string
  maitrises: Maitrises
  claimedBy?: string | null
}

export interface PersonnageCree {
  char: Character
  /** 🔒 À écrire dans la collection réservée à la MJ, jamais avec la fiche. */
  secret: CharacterSecret
}

/**
 * Crée un personnage et son enveloppe secrète.
 *
 * Le nombre de cycles (1d4+2) est tiré ici et part immédiatement dans
 * `CharacterSecret` : il ne doit jamais toucher le document de fiche, qui est
 * lisible par toute la table.
 */
export function creerPersonnage(
  demande: DemandeCreation,
  catalog: Catalog,
  rng: Rng,
  maintenant: number,
): PersonnageCree {
  const classe = catalog.classe(demande.classeId)
  if (!classe) throw new Error(`Classe inconnue : ${demande.classeId}`)

  const sorts = [...classe.sortsIds]

  const char: Character = {
    id: demande.id,
    nom: demande.nom,
    classeId: classe.id,
    avatarSeed: `${demande.id}:${demande.nom}`,
    maitrises: { ...demande.maitrises },
    fatigue: { max: classe.fatigueMax, coches: 0 },
    brulures: 0,
    foi: FOI_DE_DEPART,
    marques: 0,
    sixthSensBase: classe.sixthSensBase,
    sixthSensUtilises: 0,
    lumens: 0,
    actionsRapidesUtilisees: 0,
    equipe: { arme: null, armure: null, bibelot: null },
    // Le Grimoire n'accepte que 3 sorts : les suivants attendent dans le sac à dos.
    grimoire: sorts.slice(0, TAILLE_GRIMOIRE),
    possede: { sorts, equipements: [], ameliorations: [] },
    sortsEpuises: [],
    cicatrices: [],
    passifs: passifsInitiaux(classe.passifMoteur),
    modifiers: [],
    claimedBy: demande.claimedBy ?? null,
    createdAt: maintenant,
    updatedAt: maintenant,
  }

  const secret: CharacterSecret = {
    characterId: demande.id,
    cyclesTotal: tirerCycles(rng),
    cyclesConsommes: 0,
    notesMJ: '',
  }

  return { char, secret }
}

function passifsInitiaux(moteur: string | undefined): EtatPassifs {
  switch (moteur) {
    case 'dusk-hexcore':
      return { hexcore: 'overdrive' }
    case 'trickster-voie':
      return { voieTrickster: 'illusionniste' }
    case 'soulshifter-vies':
      return { viesConnues: [1, 2], vieActive: null }
    default:
      return {}
  }
}

/** Répartition rapide proposée par l'écran de création. */
export function appliquerProfil(
  excellentes: [Competence, Competence],
  mediocre: Competence,
): Maitrises {
  const m = maitrisesVierges()
  for (const c of COMPETENCES) {
    if (excellentes.includes(c)) m[c] = 2
    else if (c === mediocre) m[c] = -2
    else m[c] = 0
  }
  return m
}
