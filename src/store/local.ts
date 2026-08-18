import { ErreurAuth, type Auth, type Chemin, type Role, type Store, type Unsubscribe } from './types.ts'

/**
 * Stockage local : localStorage pour la persistance, BroadcastChannel pour la
 * synchronisation entre onglets.
 *
 * Sert à deux choses : découvrir l'app sans avoir configuré Firebase, et
 * reproduire fidèlement le duo « écran MJ / écran joueuse » en ouvrant
 * simplement deux onglets — les mises à jour y sont bien instantanées.
 *
 * ⚠️ Aucune séparation de sécurité réelle : en mode local, les secrets de la MJ
 * sont dans le même localStorage que le reste. C'est acceptable parce que ce
 * mode ne sert qu'au développement, jamais à une vraie session.
 */

const PREFIXE = 'maraudeur:'
const CANAL = 'maraudeur-sync'

type Ecouteur = (chemin: Chemin) => void

class CanalLocal {
  private readonly ecouteurs = new Set<Ecouteur>()
  private readonly canal: BroadcastChannel | null

  constructor() {
    this.canal = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(CANAL) : null
    this.canal?.addEventListener('message', (e) => {
      const chemin = (e as MessageEvent<{ chemin: Chemin }>).data?.chemin
      if (chemin) this.notifierLocal(chemin)
    })
    // Filet de sécurité si BroadcastChannel n'est pas disponible.
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (e) => {
        if (e.key?.startsWith(PREFIXE)) this.notifierLocal(e.key.slice(PREFIXE.length))
      })
    }
  }

  ecouter(cb: Ecouteur): Unsubscribe {
    this.ecouteurs.add(cb)
    return () => this.ecouteurs.delete(cb)
  }

  diffuser(chemin: Chemin): void {
    this.notifierLocal(chemin)
    this.canal?.postMessage({ chemin })
  }

  private notifierLocal(chemin: Chemin): void {
    for (const cb of this.ecouteurs) cb(chemin)
  }
}

const canal = new CanalLocal()

function lire<T>(chemin: Chemin): T | null {
  const brut = localStorage.getItem(PREFIXE + chemin)
  if (brut === null) return null
  try {
    return JSON.parse(brut) as T
  } catch {
    return null
  }
}

/** Un chemin appartient à la collection s'il n'a qu'un segment de plus. */
function estEnfantDirect(chemin: Chemin, collection: Chemin): boolean {
  if (!chemin.startsWith(`${collection}/`)) return false
  return !chemin.slice(collection.length + 1).includes('/')
}

function lireCollection<T>(collection: Chemin): T[] {
  const out: T[] = []
  for (let i = 0; i < localStorage.length; i += 1) {
    const cle = localStorage.key(i)
    if (!cle?.startsWith(PREFIXE)) continue
    const chemin = cle.slice(PREFIXE.length)
    if (!estEnfantDirect(chemin, collection)) continue
    const valeur = lire<T>(chemin)
    if (valeur !== null) out.push(valeur)
  }
  return out
}

export const localStore: Store = {
  kind: 'local',

  subscribeDoc<T>(chemin: Chemin, cb: (valeur: T | null) => void): Unsubscribe {
    cb(lire<T>(chemin))
    return canal.ecouter((modifie) => {
      if (modifie === chemin) cb(lire<T>(chemin))
    })
  },

  subscribeCollection<T>(chemin: Chemin, cb: (valeurs: T[]) => void): Unsubscribe {
    cb(lireCollection<T>(chemin))
    return canal.ecouter((modifie) => {
      if (estEnfantDirect(modifie, chemin)) cb(lireCollection<T>(chemin))
    })
  },

  async getDoc<T>(chemin: Chemin): Promise<T | null> {
    return lire<T>(chemin)
  },

  async getCollection<T>(chemin: Chemin): Promise<T[]> {
    return lireCollection<T>(chemin)
  },

  async setDoc<T>(chemin: Chemin, valeur: T): Promise<void> {
    localStorage.setItem(PREFIXE + chemin, JSON.stringify(valeur))
    canal.diffuser(chemin)
  },

  async updateDoc(chemin: Chemin, patch: Record<string, unknown>): Promise<void> {
    const actuel = lire<Record<string, unknown>>(chemin) ?? {}
    localStorage.setItem(PREFIXE + chemin, JSON.stringify({ ...actuel, ...patch }))
    canal.diffuser(chemin)
  },

  async deleteDoc(chemin: Chemin): Promise<void> {
    localStorage.removeItem(PREFIXE + chemin)
    canal.diffuser(chemin)
  },
}

// ---------------------------------------------------------------------------
// Authentification simulée
// ---------------------------------------------------------------------------

const CLE_ROLE = `${PREFIXE}role`

/**
 * En mode local, le code de table et le PIN sont ceux du fichier de config.
 * Aucune vérification côté serveur : c'est un mode de développement.
 */
export function createLocalAuth(codeTable: string, pinMJ: string): Auth {
  const ecouteurs = new Set<(r: Role | null) => void>()
  let role: Role | null = (localStorage.getItem(CLE_ROLE) as Role | null) ?? null

  const definir = (r: Role | null) => {
    role = r
    if (r) localStorage.setItem(CLE_ROLE, r)
    else localStorage.removeItem(CLE_ROLE)
    for (const cb of ecouteurs) cb(r)
  }

  return {
    get role() {
      return role
    },
    async connecterJoueuse(code) {
      if (code.trim().toUpperCase() !== codeTable.toUpperCase()) {
        throw new ErreurAuth('Code de table incorrect.')
      }
      definir('joueuse')
    },
    async connecterMJ(pin) {
      if (pin.trim() !== pinMJ) throw new ErreurAuth('PIN MJ incorrect.')
      definir('mj')
    },
    async deconnecter() {
      definir(null)
    },
    onChange(cb) {
      ecouteurs.add(cb)
      return () => ecouteurs.delete(cb)
    },
  }
}
