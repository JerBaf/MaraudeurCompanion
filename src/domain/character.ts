import type { Catalog } from './catalog.ts'
import { jetonsCampVierges, TAILLE_GRIMOIRE } from './campfire.ts'
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

/**
 * Crée la fiche d'un personnage.
 *
 * ⚠️ Ne tire **pas** les cycles. Le nombre de cycles (1d4+2) ne doit jamais
 * transiter par l'appareil de la joueuse : son navigateur en garderait la trace
 * et il suffirait d'ouvrir la console au bon moment pour le connaître, ce que
 * le système veut précisément empêcher (« chaque cycle passé pourrait être le
 * dernier »).
 *
 * Les cycles sont saisis par la MJ depuis son écran, quand elle le décide.
 */
export function creerPersonnage(
  demande: DemandeCreation,
  catalog: Catalog,
  maintenant: number,
): Character {
  const classe = catalog.classe(demande.classeId)
  if (!classe) throw new Error(`Classe inconnue : ${demande.classeId}`)

  const sorts = [...classe.sortsIds]

  return {
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
    investissements: [],
    jetonsCamp: jetonsCampVierges(),
    sortsEpuises: [],
    cicatrices: [],
    passifs: passifsInitiaux(classe.passifMoteur),
    modifiers: [],
    claimedBy: demande.claimedBy ?? null,
    createdAt: maintenant,
    updatedAt: maintenant,
  }
}

/**
 * Enveloppe secrète vierge, créée par la MJ.
 *
 * `cyclesTotal` à 0 signifie « pas encore renseigné » : la MJ tire ses dés à sa
 * table et saisit la valeur quand elle le souhaite.
 */
export function secretVierge(characterId: string): CharacterSecret {
  return { characterId, cyclesTotal: 0, cyclesConsommes: 0, notesMJ: '' }
}

/** Vrai tant que la MJ n'a pas renseigné le nombre de cycles. */
export function cyclesNonRenseignes(secret: CharacterSecret | null): boolean {
  return secret === null || secret.cyclesTotal <= 0
}

/**
 * Comble les champs absents d'une fiche lue en base.
 *
 * ⚠️ **Point de vigilance permanent du projet.** Un document Firestore écrit
 * hier ne contient pas les champs ajoutés aujourd'hui. Le type `Character` les
 * déclare pourtant obligatoires : le compilateur est donc rassurant à tort, et
 * le premier `.filter()` sur un champ absent lève une erreur en pleine session.
 *
 * Le problème s'est présenté trois fois — illusions du Trickster, contenu du
 * catalogue, puis `investissements` — d'où cette normalisation unique plutôt
 * que des `?? []` disséminés : **tout ajout de champ à `Character` doit recevoir
 * ici sa valeur neutre**, et les écrans n'ont plus jamais à s'en soucier.
 *
 * Appliquée dans `surPersonnages` (`data/repo.ts`), seul chemin par lequel une
 * fiche entre dans l'application.
 */
export function normaliserPersonnage(brut: Character): Character {
  return {
    ...brut,
    maitrises: { ...maitrisesVierges(), ...(brut.maitrises ?? {}) },
    fatigue: brut.fatigue ?? { max: 4, coches: 0 },
    brulures: brut.brulures ?? 0,
    foi: brut.foi ?? FOI_DE_DEPART,
    marques: brut.marques ?? 0,
    sixthSensBase: brut.sixthSensBase ?? 1,
    sixthSensUtilises: brut.sixthSensUtilises ?? 0,
    lumens: brut.lumens ?? 0,
    actionsRapidesUtilisees: brut.actionsRapidesUtilisees ?? 0,
    equipe: {
      arme: brut.equipe?.arme ?? null,
      armure: brut.equipe?.armure ?? null,
      bibelot: brut.equipe?.bibelot ?? null,
    },
    grimoire: brut.grimoire ?? [],
    possede: {
      sorts: brut.possede?.sorts ?? [],
      equipements: brut.possede?.equipements ?? [],
      ameliorations: brut.possede?.ameliorations ?? [],
    },
    investissements: brut.investissements ?? [],
    jetonsCamp: { ...jetonsCampVierges(), ...(brut.jetonsCamp ?? {}) },
    sortsEpuises: brut.sortsEpuises ?? [],
    cicatrices: brut.cicatrices ?? [],
    passifs: brut.passifs ?? {},
    modifiers: brut.modifiers ?? [],
    claimedBy: brut.claimedBy ?? null,
  }
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
