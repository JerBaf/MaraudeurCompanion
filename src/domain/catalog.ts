import type {
  Amelioration,
  Classe,
  EntreeCatalogue,
  Equipement,
  Investissement,
  Sort,
} from './types.ts'

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
  entree(id: string): EntreeCatalogue | undefined
  toutes(): EntreeCatalogue[]
  classes(): Classe[]
  sorts(): Sort[]
  equipements(): Equipement[]
  investissements(): Investissement[]
  ameliorations(): Amelioration[]
}

export function createCatalog(entrees: readonly EntreeCatalogue[]): Catalog {
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
    entree: (id) => parId.get(id),
    toutes: () => [...entrees],
    classes: () => filtrer('classe'),
    sorts: () => filtrer('sort'),
    equipements: () => filtrer('equipement'),
    investissements: () => filtrer('investissement'),
    ameliorations: () => filtrer('amelioration'),
  }
}
