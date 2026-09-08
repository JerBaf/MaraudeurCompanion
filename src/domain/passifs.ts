import type { Catalog } from './catalog.ts'
import { decrireCible, descripteur, lireElement, type Cible } from './elements.ts'
import type {
  Character,
  ChoixClasse,
  ConditionReaction,
  Effet,
  Operation,
  OptionChoixClasse,
  Passif,
  PorteurEffets,
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
  // `avantage`, `desavantage` et `add-x` n'ont pas de sens sur une jauge :
  // l'éditeur ne les propose pas, et le compilateur les refuse.
  return null
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
 * L'option retenue pour un choix de classe, ou `undefined` si rien n'a été choisi.
 *
 * ⚠️ **Pas de repli sur la première option.** Il serait tentant d'en imposer
 * une par défaut, mais l'ordre de la liste est un détail de rédaction : s'y
 * fier accorderait Conteur à tout Trickster dont la voie n'est pas encore
 * décidée. Le défaut se pose une fois, à la création (`passifsInitiaux`), et
 * les fiches antérieures le reçoivent par `normaliserPersonnage`.
 */
export function optionRetenue(
  char: Character,
  choix: ChoixClasse,
): OptionChoixClasse | undefined {
  const id = char.passifs.choix?.[choix.id]
  return id === undefined ? undefined : choix.options.find((o) => o.id === id)
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
  for (const { option } of optionsRetenues(char, catalog)) {
    option.passifs?.forEach((passif) =>
      out.push({
        passif,
        source: option.nom,
        provenance: 'classe',
        ref: `${classe?.id ?? char.classeId}:${option.id}`,
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
    case 'set':
      return `${nom} = ${op.value}`
    case 'avantage':
      return `${nom} : avantage (+d4)`
    case 'desavantage':
      return `${nom} : désavantage (−d4)`
  }
}

export function decrireEffet(effet: Effet): string {
  const operations = effet.operations ?? []
  if (operations.length === 0) return effet.texte
  const chiffre = operations.map(decrireOperationConcrete).join(' · ')
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

/** Vrai si le passage de `avant` à `apres` arme cette condition. */
export function conditionArmee(
  quand: ConditionReaction,
  avant: Character,
  apres: Character,
): boolean {
  const delta = lireElement(apres, quand.element) - lireElement(avant, quand.element)
  return quand.sens === 'augmente' ? delta > 0 : delta < 0
}
