import { COUT_GRATUIT, type Cout, type PartCout } from './couts.ts'
import { normaliserCible, type Cible } from './elements.ts'
import type {
  Actif,
  Amelioration,
  Classe,
  CoutSort,
  CoutUsage,
  Declencheur,
  Dossier,
  EntreeCatalogue,
  Equipement,
  Investissement,
  Modifier,
  Passif,
  Sort,
  TypeMagique,
} from './types.ts'

/**
 * Identifiant de l'Actif issu de l'ancienne table unique d'un objet.
 *
 * Stable et connu : il entre dans la clé de charges, et c'est lui qui permet à
 * un objet déjà entamé de garder son compteur après conversion.
 */
export const ACTIF_PRINCIPAL = 'principal'

/**
 * Accès en lecture au contenu du jeu.
 *
 * Le domaine ne sait pas d'où vient le catalogue : il est seedé depuis
 * `src/content/seed.ts`, puis stocké dans Firestore et éditable depuis l'écran MJ.
 * Cette indirection permet de tester les règles sans base de données.
 */
export interface Catalog {
  classe(id: string): Classe | undefined
  sort(id: string): Sort | undefined
  equipement(id: string): Equipement | undefined
  investissement(id: string): Investissement | undefined
  amelioration(id: string): Amelioration | undefined
  typeMagique(id: string): TypeMagique | undefined
  dossier(id: string): Dossier | undefined
  entree(id: string): EntreeCatalogue | undefined
  toutes(): EntreeCatalogue[]
  classes(): Classe[]
  sorts(): Sort[]
  equipements(): Equipement[]
  investissements(): Investissement[]
  ameliorations(): Amelioration[]
  typesMagiques(): TypeMagique[]
  dossiers(): Dossier[]
}

/**
 * Comble et convertit une entrée lue en base.
 *
 * ⚠️ **Pendant de `normaliserPersonnage`, et même point de vigilance.** Un
 * document Firestore écrit hier ne contient pas les champs ajoutés aujourd'hui,
 * et l'amorçage n'écrase jamais l'existant : le contenu déjà saisi par la MJ ne
 * sera *jamais* réécrit par le seed. Toute évolution du modèle de contenu doit
 * donc recevoir ici sa traduction, et les écrans n'ont plus à s'en soucier.
 *
 * Idempotente : une entrée déjà au format courant la traverse inchangée.
 */
export function normaliserEntree(brut: EntreeCatalogue): EntreeCatalogue {
  switch (brut.kind) {
    case 'equipement':
      return {
        ...brut,
        passifs: normaliserPassifs(brut),
        ...(brut.actifs ?? brut.effetsActifs ? { actifs: normaliserActifs(brut) } : {}),
      }
    case 'amelioration':
      return { ...brut, passifs: normaliserPassifs(brut) }
    case 'sort':
      return {
        ...brut,
        cout: normaliserCoutSort(brut.cout),
        // `magie` portait une union fermée ; son nom devient l'identifiant du
        // type magique, et les trois d'origine sont semés sous ces mêmes noms.
        magieId: brut.magieId ?? brut.magie ?? 'arcane',
        // Le drapeau `illusion` ne savait décrire que la voie Illusionniste ;
        // le champ nomme désormais l'option de classe qui donne accès au sort.
        ...(brut.requiertPassif ?? brut.illusion
          ? { requiertPassif: brut.requiertPassif ?? 'illusionniste' }
          : {}),
      }
    default:
      return brut
  }
}

/**
 * Les deux anciens tableaux deviennent des `Passif`.
 *
 * `modificateurs` portait les ajustements permanents, `declencheurs` les
 * réactions : ils ne différaient que par leur déclenchement, jamais par leur
 * effet. Les réunir, c'est permettre à une réaction d'accorder un bonus
 * d'Évasion — ce qu'aucun des deux ne savait faire.
 *
 * Les identifiants sont dérivés de la position d'origine : stables d'une
 * lecture à l'autre, ce dont dépendent les clés de rendu et les identifiants
 * de modificateurs dérivés.
 */
function normaliserPassifs(porteur: Equipement | Amelioration): Passif[] {
  const deja = porteur.passifs ?? []

  /*
   * Le libellé reste vide, à dessein : le moteur retombe alors sur le nom du
   * porteur, relu à chaque rendu. C'est ce repli qui rend inutile la recopie
   * des libellés à l'enregistrement — et qui répare au passage ceux qui ont
   * été figés en base avant qu'on ne s'en aperçoive, par exemple sur un objet
   * dont les passifs avaient été composés avant qu'il ne soit nommé.
   */
  const permanents = (porteur.modificateurs ?? []).map((m, i) =>
    passifPermanent(`legacy-mod-${i}`, '', normaliserCible(m.target), m.op),
  )
  const reactifs = (porteur.declencheurs ?? []).map((d, i) => passifReactif(`legacy-decl-${i}`, d))

  return [...deja, ...permanents, ...reactifs]
}

function passifPermanent(
  id: string,
  libelle: string,
  cible: Cible,
  op: Modifier['op'],
): Passif {
  return {
    id,
    libelle,
    declenchement: { kind: 'permanent' },
    effet: { texte: '', operations: [{ kind: 'ajuster', cible, op }] },
  }
}

function passifReactif(id: string, d: Declencheur): Passif {
  return {
    id,
    libelle: '',
    declenchement: {
      kind: 'reaction',
      // Les déclencheurs ne savaient viser que soi-même.
      quand: { element: { kind: d.quand }, sens: d.sens, chez: 'soi' },
    },
    effet: {
      texte: '',
      operations: [
        {
          kind: 'ajuster',
          cible: { element: { kind: d.alors }, aspect: 'valeur' },
          op: { kind: 'add', value: d.delta },
        },
      ],
    },
  }
}

/**
 * Les six formes de `CoutSort` deviennent des `Cout` génériques.
 *
 * Chacune tient en une branche unique : l'ancien format ne savait pas exprimer
 * de « OU ». `brulures-variable` porte un `min: 1` — le sort exigeait au moins
 * une brûlure, et `disponibiliteSort` le vérifiait à part.
 */
export function normaliserCoutSort(brut: Cout | CoutSort): Cout {
  if ('branches' in brut) return brut

  const une = (...parts: PartCout[]): Cout => ({ branches: [{ parts }] })

  switch (brut.kind) {
    case 'aucun':
      return COUT_GRATUIT
    case 'foi':
      return une({ kind: 'fixe', element: { kind: 'foi' }, valeur: brut.valeur })
    case 'foi-plus-variable':
      return une(
        { kind: 'fixe', element: { kind: 'foi' }, valeur: brut.base },
        { kind: 'variable', element: { kind: 'foi' } },
      )
    case 'brulures':
      return une({ kind: 'fixe', element: { kind: 'brulures' }, valeur: brut.valeur })
    case 'brulures-variable':
      return une({ kind: 'variable', element: { kind: 'brulures' }, min: 1 })
    case 'marques-variable':
      return une({ kind: 'variable', element: { kind: 'marques' }, max: brut.max })
  }
}

/**
 * L'unique table d'un objet devient son premier Actif.
 *
 * L'identifiant `principal` est stable : c'est lui qui, combiné à celui de
 * l'objet, formera la clé de charges — et le repli sur la clé nue permet aux
 * charges déjà entamées de survivre à la conversion (voir `chargesRestantes`).
 */
function normaliserActifs(eq: Equipement): Actif[] {
  if (eq.actifs) return eq.actifs

  const legacy = eq.effetsActifs
  if (!legacy) return []

  return [
    {
      id: ACTIF_PRINCIPAL,
      nom: eq.nom,
      table: {
        faces: legacy.faces,
        entrees: legacy.effets.map((texte) => ({ texte })),
      },
      ...usagesDepuisCoutUsage(legacy.cout),
    },
  ]
}

function usagesDepuisCoutUsage(cout: CoutUsage): Pick<Actif, 'usages' | 'cout'> {
  switch (cout.kind) {
    case 'charges':
      return { usages: { max: cout.max, recharge: { kind: 'rituel', description: cout.rituel } } }
    /*
     * Un consommable ne se rechargeait pas et se détruisait à la dernière
     * charge. Il ne se détruit plus : à zéro il reste en inventaire, marqué,
     * et c'est la MJ ou la joueuse qui l'en retire.
     */
    case 'consommable':
      return { usages: { max: cout.max, recharge: { kind: 'aucune' } } }
    /*
     * Ni compteur ni recharge : la contrepartie s'applique à table. Elle devient
     * une part narrative, que le moteur affiche sans savoir la prélever.
     */
    case 'paiement':
      return { cout: { branches: [{ parts: [{ kind: 'narratif', description: cout.description }] }] } }
  }
}

/**
 * ⚠️ La normalisation vit **ici** et non chez l'appelant : `createCatalog` est
 * le seul chemin par lequel une entrée devient lisible par le domaine, et il en
 * existe trois usages (la souscription temps réel, le lancement d'un feu de
 * camp qui relit la collection, et l'export JSON). Normaliser en amont les
 * aurait obligés à y penser chacun de leur côté.
 */
export function createCatalog(entreesBrutes: readonly EntreeCatalogue[]): Catalog {
  const entrees = entreesBrutes.map(normaliserEntree)

  const parId = new Map<string, EntreeCatalogue>()
  for (const e of entrees) parId.set(e.id, e)

  const filtrer = <K extends EntreeCatalogue['kind']>(kind: K) =>
    entrees.filter((e): e is Extract<EntreeCatalogue, { kind: K }> => e.kind === kind)

  const typed = <K extends EntreeCatalogue['kind']>(id: string, kind: K) => {
    const e = parId.get(id)
    return e?.kind === kind ? (e as Extract<EntreeCatalogue, { kind: K }>) : undefined
  }

  return {
    classe: (id) => typed(id, 'classe'),
    sort: (id) => typed(id, 'sort'),
    equipement: (id) => typed(id, 'equipement'),
    investissement: (id) => typed(id, 'investissement'),
    amelioration: (id) => typed(id, 'amelioration'),
    typeMagique: (id) => typed(id, 'type-magique'),
    dossier: (id) => typed(id, 'dossier'),
    entree: (id) => parId.get(id),
    toutes: () => [...entrees],
    classes: () => filtrer('classe'),
    sorts: () => filtrer('sort'),
    equipements: () => filtrer('equipement'),
    investissements: () => filtrer('investissement'),
    ameliorations: () => filtrer('amelioration'),
    typesMagiques: () => filtrer('type-magique'),
    dossiers: () => filtrer('dossier'),
  }
}
