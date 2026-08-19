/**
 * Storage en mémoire pour les tests de rendu.
 *
 * Deux obstacles se cumulent hors navigateur : Node ≥ 22 expose un
 * `localStorage` global inerte (indisponible sans `--localstorage-file`), et
 * l'environnement jsdom de vitest ne fournit pas toujours le sien selon les
 * versions. Résultat : `localStorage` est `undefined` alors que l'app compte
 * dessus pour retenir le rôle, l'appareil et l'état de la table.
 *
 * Plutôt que de chercher la bonne combinaison de versions, on installe une
 * implémentation minimale mais complète — `length` et `key()` compris, dont
 * `src/store/local.ts` se sert pour parcourir les collections.
 *
 * Ce fichier s'exécute aussi devant les tests en environnement Node, d'où le
 * garde sur `window`.
 */

class StorageMemoire implements Storage {
  private donnees = new Map<string, string>()

  get length(): number {
    return this.donnees.size
  }

  key(index: number): string | null {
    return [...this.donnees.keys()][index] ?? null
  }

  getItem(cle: string): string | null {
    return this.donnees.get(cle) ?? null
  }

  setItem(cle: string, valeur: string): void {
    this.donnees.set(String(cle), String(valeur))
  }

  removeItem(cle: string): void {
    this.donnees.delete(cle)
  }

  clear(): void {
    this.donnees.clear()
  }

  [nom: string]: unknown
}

if (typeof window !== 'undefined') {
  // Deux stockages distincts : l'app range les données de la table dans
  // `localStorage` et le rôle de l'onglet dans `sessionStorage`.
  for (const nom of ['localStorage', 'sessionStorage'] as const) {
    const storage = new StorageMemoire()
    for (const cible of [globalThis, window]) {
      Object.defineProperty(cible, nom, { value: storage, configurable: true, writable: true })
    }
  }
}
