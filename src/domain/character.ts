import type { Catalog } from './catalog.ts'
import { jetonsCampVierges, TAILLE_GRIMOIRE } from './campfire.ts'
import { FOI_DE_DEPART, normaliserCible } from './elements.ts'
import {
  COMPETENCES,
  type Character,
  type CharacterSecret,
  type Competence,
  type EtatPassifs,
  type Maitrises,
} from './types.ts'

/** Profil de maîtrise type : deux +3, un 0, un -3. */
export const PROFIL_MAITRISE_TYPE = [3, 3, 0, -3] as const

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

/** L'ancien profil, du temps où les maîtrises allaient de -2 à +2. */
const ANCIEN_PROFIL_MAITRISE = [2, 2, 0, -2] as const

/**
 * Convertit une fiche restée à l'ancienne échelle ±2 vers la nouvelle, ±3.
 *
 * ⚠️ La conversion ne s'applique **qu'aux fiches dont la répartition suit encore
 * exactement l'ancien profil type** — deux +2, un 0, un -2. Une joueuse que la
 * MJ a écartée du profil à la main a été mise là volontairement : remonter ses
 * valeurs effacerait cet arbitrage sans le dire. Le cas échéant, la MJ corrige
 * depuis son écran, boutons `−` / `+`.
 *
 * Les modificateurs ne sont pas touchés : ils s'ajoutent à la maîtrise et gardent
 * le sens qu'ils avaient (un Fardeau vaut toujours un désavantage).
 */
export function convertirAncienProfil(m: Maitrises): Maitrises {
  const valeurs = COMPETENCES.map((c) => m[c]).sort((a, b) => a - b)
  const ancien = [...ANCIEN_PROFIL_MAITRISE].sort((a, b) => a - b)
  if (!valeurs.every((v, i) => v === ancien[i])) return m

  const [forte, , neutre, faible] = PROFIL_MAITRISE_TYPE
  const converti = maitrisesVierges()
  for (const c of COMPETENCES) {
    converti[c] = m[c] > 0 ? forte : m[c] < 0 ? faible : neutre
  }
  return converti
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
    bruluresConsommees: 0,
    foi: FOI_DE_DEPART,
    marques: 0,
    sixthSensBase: classe.sixthSensBase,
    sixthSensUtilises: 0,
    lumens: 0,
    actionsRapidesUtilisees: 0,
    equipe: { arme: null, armure: null, bibelot: null },
    // Le Grimoire n'accepte que 3 sorts : les suivants attendent dans le sac à dos.
    grimoire: sorts.slice(0, TAILLE_GRIMOIRE),
    possede: { sorts, equipements: [], ameliorations: [], quetes: [] },
    investissements: [],
    jetonsCamp: jetonsCampVierges(),
    chargesObjets: {},
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
 *
 * C'est aussi le bon endroit pour les **conversions de règle** — ainsi
 * `convertirAncienProfil`, qui fait passer les maîtrises de ±2 à ±3. La fiche
 * s'affiche corrigée dès la lecture, et la correction se persiste à la première
 * écriture venue : aucune migration en masse à lancer, et rien à réparer si une
 * joueuse rejoint la table avec un vieux document.
 */
export function normaliserPersonnage(brut: Character): Character {
  return {
    ...brut,
    // Reconstruite à l'identique de `creerPersonnage` : une fiche antérieure au
    // champ retrouve donc la teinte d'avatar qu'elle aurait toujours eue.
    avatarSeed: brut.avatarSeed ?? `${brut.id}:${brut.nom}`,
    maitrises: convertirAncienProfil({ ...maitrisesVierges(), ...(brut.maitrises ?? {}) }),
    fatigue: brut.fatigue ?? { max: 4, coches: 0 },
    brulures: brut.brulures ?? 0,
    bruluresConsommees: brut.bruluresConsommees ?? 0,
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
      quetes: brut.possede?.quetes ?? [],
    },
    investissements: brut.investissements ?? [],
    jetonsCamp: { ...jetonsCampVierges(), ...(brut.jetonsCamp ?? {}) },
    chargesObjets: brut.chargesObjets ?? {},
    sortsEpuises: brut.sortsEpuises ?? [],
    cicatrices: brut.cicatrices ?? [],
    passifs: normaliserChoixDeClasse(brut.passifs ?? {}),
    // Les Serments et Fardeaux engagés dorment en base sous l'ancienne forme de
    // cible (`competence-sauf`, `fatigue-max`…) : sans cette conversion ils
    // cesseraient de s'appliquer, sans rien signaler.
    modifiers: (brut.modifiers ?? []).map((m) => ({ ...m, target: normaliserCible(m.target) })),
    claimedBy: brut.claimedBy ?? null,
  }
}

/**
 * Replie les deux anciens champs de choix de classe dans `choix`.
 *
 * `hexcore` et `voieTrickster` étaient un champ par classe : en ajouter une
 * demandait de toucher au type. Ils se lisent désormais comme n'importe quel
 * choix — et les fiches déjà en base les portent encore, d'où cette conversion,
 * sur le modèle de `classeId` absorbé par `classesIds`.
 */
function normaliserChoixDeClasse(passifs: EtatPassifs): EtatPassifs {
  const choix = { ...(passifs.choix ?? {}) }
  if (passifs.hexcore && choix.hexcore === undefined) choix.hexcore = passifs.hexcore
  if (passifs.voieTrickster && choix.voie === undefined) choix.voie = passifs.voieTrickster
  return { ...passifs, choix }
}

function passifsInitiaux(moteur: string | undefined): EtatPassifs {
  switch (moteur) {
    case 'dusk-hexcore':
      return { choix: { hexcore: 'overdrive' } }
    case 'trickster-voie':
      return { choix: { voie: 'illusionniste' } }
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
  // Les valeurs sont lues dans le profil type — deux fortes, une neutre, une
  // faible, dans cet ordre — et non réécrites ici : `maitrisesSuiventLeProfil`
  // valide ensuite exactement ce que cette fonction produit.
  const [forte, , neutre, faible] = PROFIL_MAITRISE_TYPE

  const m = maitrisesVierges()
  for (const c of COMPETENCES) {
    if (excellentes.includes(c)) m[c] = forte
    else if (c === mediocre) m[c] = faible
    else m[c] = neutre
  }
  return m
}
