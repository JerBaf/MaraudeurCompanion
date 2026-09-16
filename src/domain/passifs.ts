import type { Catalog } from './catalog.ts'
import { decrireCible, descripteur, lireElement, type Cible } from './elements.ts'
import type {
  Character,
  ChoixClasse,
  ConditionBascule,
  ConditionReaction,
  EffetPassif,
  KindRegle,
  Operation,
  OptionChoixClasse,
  Passif,
  PorteurEffets,
  Regle,
  VerrouChoix,
} from './types.ts'

/**
 * Les Passifs.
 *
 * Un passif est un changement qui se produit sans que la joueuse l'actionne.
 * Deux régimes de déclenchement, un seul modèle d'effet :
 *
 *  - **permanent** — en vigueur tant que la source l'est, éventuellement sous
 *    condition de seuil. Il se compile en `Modifier` (voir `modifiers.ts`) et
 *    n'est jamais persisté : si les brûlures changent, le bonus suit.
 *  - **réaction** — armé par un changement d'Élément Variable. Le moteur de
 *    modificateurs sait ajuster une valeur affichée ; il ne sait pas *réagir* à
 *    un changement. « Quand tu prends une Marque, gagne un Point de Foi »
 *    demande de comparer l'état d'avant à celui d'après.
 *
 * Deux bornes, sans lesquelles les réactions seraient ingérables :
 *
 *  - **une seule passe**. Une réaction ne peut pas en réveiller une autre. Sans
 *    cela, « +1 Foi quand la Foi augmente » bouclerait à l'infini, et une
 *    cascade serait de toute façon impossible à suivre à table.
 *  - **le résultat reste borné** par les plafonds dérivés : une réaction ne
 *    fait pas déborder une jauge.
 *
 * Un passif s'arme au régime de sa source — objet **porté**, amélioration
 * **possédée**, classe du personnage. Un talisman au fond du sac ne réagit à rien.
 *
 * ⚠️ Ce module dit *ce que sont* les passifs et *lesquels sont en vigueur* ; il
 * ne les résout pas. La résolution vit dans `reactions.ts`, en aval : elle a
 * besoin des plafonds dérivés, donc de `competences.ts`, qui s'appuie
 * lui-même sur `modifiers.ts` — lequel appelle `passifsActifs`. Séparer les
 * deux est ce qui empêche ce cycle de se refermer.
 */

// ---------------------------------------------------------------------------
// Écrire une opération
// ---------------------------------------------------------------------------

/**
 * Une opération s'écrit-elle directement sur la fiche, ou devient-elle un
 * modificateur ?
 *
 * **Ce n'est pas un choix d'auteur, c'est une conséquence de la cible.** Une
 * jauge (Foi, Lumens, Marques, Fatigue, Brûlures) se met à jour d'un cran ; une
 * statistique recalculée (compétence, Évasion, coût des sorts) ou un plafond ne
 * se stocke jamais — la règle d'or du moteur — et reçoit donc un modificateur.
 */
export function estEcritureDirecte(cible: Cible): boolean {
  return cible.aspect === 'valeur' && descripteur(cible.element).ecrire !== undefined
}

/** La valeur visée par une opération, ou `null` si elle ne s'écrit pas ainsi. */
export function valeurVisee(operation: Operation, courante: number): number | null {
  const { op } = operation
  if (op.kind === 'add') return courante + op.value
  if (op.kind === 'set') return op.value
  // `avantage` et `desavantage` n'ont pas de sens sur une jauge, et une
  // opération variable (`add-x`, `add-de`) doit avoir été résolue avant.
  return null
}

/**
 * Ramène une opération variable à un chiffre.
 *
 * `add-x` vaut le X payé au lancement d'un sort — ou, dans une réaction,
 * l'ampleur du changement qui l'a armée. `add-de` vaut le dé du sort. Sans la
 * valeur attendue, l'opération reste telle quelle, et rien ne l'applique.
 */
export function resoudreOperation(
  operation: Operation,
  valeurs: { x?: number; de?: number | null },
): Operation {
  const { op } = operation
  if (op.kind === 'add-x' && valeurs.x !== undefined) {
    return { ...operation, op: { kind: 'add', value: valeurs.x } }
  }
  if (op.kind === 'add-de' && valeurs.de != null) {
    return { ...operation, op: { kind: 'add', value: valeurs.de } }
  }
  return operation
}

/**
 * Un passif permanent produit-il quelque chose que le moteur sait appliquer ?
 *
 * Une écriture de jauge en permanence n'aurait pas de sens — elle se
 * réappliquerait à chaque rendu.
 */
export function estPermanentApplicable(passif: Passif): boolean {
  return passif.declenchement.kind === 'permanent'
}

// ---------------------------------------------------------------------------
// Voie de la Flamme
// ---------------------------------------------------------------------------

/**
 * Voie de la Flamme — la progression de la Magie du Sang.
 *
 * Les paliers sont **cumulatifs** : à 7 brûlures on conserve le 6th Sens
 * supplémentaire du palier 4-6 et on gagne en plus l'avantage en Physique.
 * C'est `condition` qui le dit, et non plus une branche de code : ajouter un
 * palier, c'est ajouter une entrée à cette liste.
 *
 * ⚠️ Ces passifs restent **en code** plutôt qu'au catalogue, à dessein. Le
 * contenu semé n'atteint une table qu'à la connexion de la MJ
 * (`amorcerSiNecessaire`) : les y déplacer priverait les joueuses de la Voie de
 * la Flamme entre un déploiement et cette connexion. Ils passent en revanche
 * par le même mécanisme que tout le reste, si bien que les basculer au
 * catalogue le jour venu ne sera qu'un déplacement de données.
 */
export const PASSIFS_FLAMME: Passif[] = [
  {
    id: 'perception',
    libelle: 'Voie de la Flamme (4+)',
    declenchement: { kind: 'permanent', condition: { element: { kind: 'brulures' }, seuil: 4 } },
    effet: {
      texte: 'Perception accrue de la chaleur : un point de 6th Sens supplémentaire.',
      operations: [
        {
          kind: 'ajuster',
          // Un plafond, pas une valeur : le palier hausse le maximum.
          cible: { element: { kind: 'sixth-sens' }, aspect: 'plafond' },
          op: { kind: 'add', value: 1 },
        },
      ],
    },
  },
  {
    id: 'fureur',
    libelle: 'Voie de la Flamme (7+)',
    declenchement: { kind: 'permanent', condition: { element: { kind: 'brulures' }, seuil: 7 } },
    effet: {
      texte: 'Le brasier vous porte : avantage sur tous les jets de Physique.',
      operations: [
        {
          kind: 'ajuster',
          cible: { element: { kind: 'competence', competence: 'physique' }, aspect: 'valeur' },
          op: { kind: 'avantage' },
        },
      ],
    },
  },
]

/** Les paliers atteints, du plus bas au plus haut. */
export function paliersFlammeAtteints(brulures: number): Passif[] {
  return PASSIFS_FLAMME.filter((p) => {
    const c = p.declenchement.kind === 'permanent' ? p.declenchement.condition : undefined
    return c !== undefined && brulures >= c.seuil
  })
}

// ---------------------------------------------------------------------------
// Les passifs en vigueur
// ---------------------------------------------------------------------------

export type ProvenancePassif =
  | 'equipement'
  | 'amelioration'
  | 'classe'
  | 'type-magique'
  /** Découle de l'état du personnage, sans qu'il l'ait choisi : Voie de la Flamme. */
  | 'derive'

export interface PassifActif {
  passif: Passif
  /** Nom de l'entrée qui l'accorde. */
  source: string
  provenance: ProvenancePassif
  /** Identifiant de l'entrée, pour distinguer deux sources homonymes. */
  ref: string
  /** Passif d'une option de classe : le verrou de son choix, qui dit qui l'a décidé. */
  verrou?: VerrouChoix
}

function recolter(
  out: PassifActif[],
  porteur: (PorteurEffets & { id: string; nom: string }) | undefined,
  provenance: ProvenancePassif,
) {
  porteur?.passifs?.forEach((passif) =>
    out.push({ passif, source: porteur.nom, provenance, ref: porteur.id }),
  )
}

// ---------------------------------------------------------------------------
// Choix de classe
// ---------------------------------------------------------------------------

/**
 * L'option est-elle à la portée de ce personnage ? Une option verrouillée par
 * une Amélioration reste hors d'atteinte tant que la joueuse ne la possède pas.
 */
export function optionAccessible(char: Character, option: OptionChoixClasse): boolean {
  return (
    option.requiertAmelioration === undefined ||
    char.possede.ameliorations.includes(option.requiertAmelioration)
  )
}

/**
 * L'option retenue pour un choix de classe, ou `undefined` si rien n'a été choisi.
 *
 * ⚠️ **Pas de repli sur la première option.** Il serait tentant d'en imposer
 * une par défaut, mais l'ordre de la liste est un détail de rédaction : s'y
 * fier accorderait Conteur à tout Trickster dont la voie n'est pas encore
 * décidée. Un défaut n'existe que si la MJ l'a écrit (`ChoixClasse.defaut`),
 * et il se **lit** sans s'écrire. Les deux défauts d'avant ce champ — Hexcore et
 * voie du Trickster — se posent encore à la création (`passifsInitiaux`).
 *
 * Une option devenue inaccessible — l'Amélioration retirée — n'agit plus.
 */
export function optionRetenue(
  char: Character,
  choix: ChoixClasse,
): OptionChoixClasse | undefined {
  const id = char.passifs.choix?.[choix.id] ?? choix.defaut
  const option = id === undefined ? undefined : choix.options.find((o) => o.id === id)
  return option && optionAccessible(char, option) ? option : undefined
}

/**
 * Où l'on se trouve quand on veut changer un choix.
 *
 * `fiche` : la fiche de la joueuse, en cours de session. `feu-de-camp` : la
 * phase Sorts du camp. `mj` : l'écran de la MJ, qui arbitre et passe outre
 * tous les verrous.
 */
export type MomentChoix = 'fiche' | 'feu-de-camp' | 'mj'

/** Le jeton de ce choix est-il encore disponible ? */
export function jetonDisponible(char: Character, choix: ChoixClasse): boolean {
  return char.passifs.jetonsChoix?.[choix.id] == null
}

/**
 * Le choix peut-il changer, ici et maintenant ?
 *
 * ⚠️ Un verrou à jeton laisse le **premier** choix libre (décision de la MJ) :
 * le jeton ne se demande qu'à qui remplace une option déjà stockée.
 */
export function peutChangerOption(
  char: Character,
  choix: ChoixClasse,
  moment: MomentChoix,
): boolean {
  if (moment === 'mj') return true
  switch (choix.verrou) {
    case 'libre':
      return true
    case 'feu-de-camp':
      return moment === 'feu-de-camp'
    case 'jeton':
      return char.passifs.choix?.[choix.id] === undefined || jetonDisponible(char, choix)
    case 'automatique':
      return false
  }
}

/**
 * Retient une option, et consomme le jeton si le verrou le demande.
 *
 * Rend la fiche **inchangée** quand le changement est refusé, plutôt que de
 * lever : la transformation s'exécute dans un `void modifierPersonnage(…)`, où
 * une erreur se perdrait sans bruit. La MJ ne consomme jamais le jeton — elle
 * arbitre, elle ne joue pas l'heure de la joueuse.
 */
export function retenirOption(
  char: Character,
  choix: ChoixClasse,
  optionId: string,
  moment: MomentChoix,
  maintenant: number,
): Character {
  const option = choix.options.find((o) => o.id === optionId)
  if (!option || !optionAccessible(char, option) || !peutChangerOption(char, choix, moment)) {
    return char
  }

  const stockee = char.passifs.choix?.[choix.id]
  if (stockee === optionId) return char

  const consomme = choix.verrou === 'jeton' && stockee !== undefined && moment !== 'mj'
  return {
    ...char,
    passifs: {
      ...char.passifs,
      choix: { ...(char.passifs.choix ?? {}), [choix.id]: optionId },
      ...(consomme
        ? { jetonsChoix: { ...(char.passifs.jetonsChoix ?? {}), [choix.id]: maintenant } }
        : {}),
    },
  }
}

/** Une bascule en toutes lettres : « Marques ≥ maximum », « Marques ≤ 0 ». */
export function decrireBascule(bascule: ConditionBascule): string {
  const jauge = decrireCible({ element: bascule.element, aspect: 'valeur' })
  const seuil = bascule.seuil === 'plafond' ? 'maximum' : bascule.seuil
  return `${jauge} ${bascule.comparaison === 'au-moins' ? '≥' : '≤'} ${seuil}`
}

/** Rend le jeton d'un choix. Réservé à la MJ, seule à savoir où en est l'heure de jeu. */
export function rendreJetonChoix(char: Character, choixId: string): Character {
  const { [choixId]: _consomme, ...jetonsChoix } = char.passifs.jetonsChoix ?? {}
  return { ...char, passifs: { ...char.passifs, jetonsChoix } }
}

/** Toutes les options de classe actuellement retenues. */
export function optionsRetenues(
  char: Character,
  catalog: Catalog,
): { choix: ChoixClasse; option: OptionChoixClasse }[] {
  const classe = catalog.classe(char.classeId)
  const out: { choix: ChoixClasse; option: OptionChoixClasse }[] = []
  for (const choix of classe?.choix ?? []) {
    const option = optionRetenue(char, choix)
    if (option) out.push({ choix, option })
  }
  return out
}

/** Vrai si le personnage a retenu cette option, quel que soit le choix. */
export function aRetenu(char: Character, catalog: Catalog, optionId: string): boolean {
  return optionsRetenues(char, catalog).some(({ option }) => option.id === optionId)
}

/**
 * Les passifs en vigueur : équipement porté, améliorations possédées, classe du
 * personnage, et les types magiques — qui portent les progressions valant pour
 * quiconque, telle la Voie de la Flamme.
 */
export function passifsActifs(char: Character, catalog: Catalog): PassifActif[] {
  const out: PassifActif[] = []

  for (const id of Object.values(char.equipe)) {
    if (id) recolter(out, catalog.equipement(id), 'equipement')
  }
  for (const id of char.possede.ameliorations) {
    recolter(out, catalog.amelioration(id), 'amelioration')
  }
  const classe = catalog.classe(char.classeId)
  recolter(out, classe, 'classe')

  // Les options de classe retenues : Overdrive, Conteur… Elles n'étaient
  // jusqu'ici accessibles qu'en codant une branche par classe.
  for (const { choix, option } of optionsRetenues(char, catalog)) {
    option.passifs?.forEach((passif) =>
      out.push({
        passif,
        source: option.nom,
        provenance: 'classe',
        ref: `${classe?.id ?? char.classeId}:${option.id}`,
        verrou: choix.verrou,
      }),
    )
  }

  for (const type of catalog.typesMagiques()) recolter(out, type, 'type-magique')

  // La Voie de la Flamme vaut pour quiconque porte des brûlures, quelle que
  // soit sa classe : elle ne dépend d'aucune entrée de catalogue.
  for (const passif of PASSIFS_FLAMME) {
    out.push({ passif, source: passif.libelle, provenance: 'derive', ref: 'voie-flamme' })
  }

  return out
}

// ---------------------------------------------------------------------------
// Règles spéciales
// ---------------------------------------------------------------------------

/**
 * Le nom d'une règle, pour la joueuse et pour l'éditeur.
 *
 * ⚠️ Le prix d'une réussite automatique ne s'écrit pas ici : le décrire demande
 * `couts.ts`, qui dépend de ce module par `modifiers.ts`. L'écran qui propose la
 * réussite l'affiche lui-même.
 */
export const LIBELLE_REGLE: Record<KindRegle, string> = {
  'ame-de-geant': 'Âme de Géant',
  'reussite-automatique': 'Réussite automatique',
  'sorts-suspendus': 'Sorts préparés suspendus',
}

/**
 * La règle de ce type en vigueur, et le nom de ce qui l'accorde.
 *
 * Même régime que les modificateurs : seul un passif **permanent** dont la
 * condition est remplie accorde une règle.
 */
export function regleActive<K extends KindRegle>(
  char: Character,
  catalog: Catalog,
  kind: K,
): { regle: Extract<Regle, { kind: K }>; source: string } | null {
  for (const { passif, source } of passifsActifs(char, catalog)) {
    if (passif.declenchement.kind !== 'permanent' || !conditionRemplie(passif, char)) continue
    const regle = passif.effet.regles?.find(
      (r): r is Extract<Regle, { kind: K }> => r.kind === kind,
    )
    if (regle) return { regle, source: passif.libelle || source }
  }
  return null
}

/**
 * Le passif est-il en vigueur ?
 *
 * Seul un permanent sous condition de seuil peut ne pas l'être. Une réaction
 * est toujours en vigueur : elle est armée, elle attend son déclencheur — et
 * elle doit à ce titre figurer dans les effets en cours de la joueuse.
 */
export function conditionRemplie(passif: Passif, char: Character): boolean {
  if (passif.declenchement.kind !== 'permanent') return true
  const condition = passif.declenchement.condition
  if (!condition) return true
  return lireElement(char, condition.element) >= condition.seuil
}

// ---------------------------------------------------------------------------
// Description
// ---------------------------------------------------------------------------

export function decrireOperationConcrete(operation: Operation): string {
  const { cible, op } = operation
  const nom = decrireCible(cible)
  switch (op.kind) {
    case 'add':
      return `${nom} ${op.value > 0 ? '+' : ''}${op.value}`
    case 'add-x':
      return `${nom} + X`
    case 'add-de':
      return `${nom} + dé`
    case 'set':
      return `${nom} = ${op.value}`
    case 'avantage':
      return `${nom} : avantage (+d4)`
    case 'desavantage':
      return `${nom} : désavantage (−d4)`
  }
}

/**
 * L'effet en une ligne. Les règles s'y nomment à côté des chiffres : un passif
 * qui n'accorde qu'une règle ne doit pas s'afficher vide.
 */
export function decrireEffet(effet: EffetPassif): string {
  const chiffres = [
    ...(effet.operations ?? []).map(decrireOperationConcrete),
    ...(effet.regles ?? []).map((r) => LIBELLE_REGLE[r.kind]),
  ]
  if (chiffres.length === 0) return effet.texte
  const chiffre = chiffres.join(' · ')
  return effet.texte ? `${effet.texte} — ${chiffre}` : chiffre
}

function decrireCondition(quand: ConditionReaction): string {
  const chez =
    quand.chez === 'soi'
      ? ''
      : quand.chez === 'un-allie'
        ? ' chez une alliée'
        : ' chez quiconque'
  return `Quand ${decrireCible({ element: quand.element, aspect: 'valeur' })} ${quand.sens}${chez}`
}

/** Le passif en une phrase, pour l'écran des effets en cours. */
export function decrirePassif(passif: Passif): string {
  const effet = decrireEffet(passif.effet)
  const d = passif.declenchement

  if (d.kind === 'reaction') return `${decrireCondition(d.quand)} : ${effet}`
  if (d.condition) {
    return `${effet} — à partir de ${d.condition.seuil} ${decrireCible({ element: d.condition.element, aspect: 'valeur' })}`
  }
  return effet
}

/**
 * Le changement qui arme cette condition, ou 0 s'il ne l'arme pas.
 *
 * Signé comme le changement : une Marque perdue vaut −1. Son ampleur est le
 * « X » d'une réaction — deux Marques prises d'un coup valent deux Points de Foi.
 */
export function deltaArme(quand: ConditionReaction, avant: Character, apres: Character): number {
  const delta = lireElement(apres, quand.element) - lireElement(avant, quand.element)
  const arme = quand.sens === 'augmente' ? delta > 0 : delta < 0
  return arme ? delta : 0
}
