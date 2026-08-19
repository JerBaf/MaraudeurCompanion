/**
 * Remontée des erreurs de stockage vers l'écran.
 *
 * Sans ce canal, un refus des règles Firestore ne se voit que dans la console
 * du navigateur : l'app afficherait une table vide, sans rien dire. C'est
 * exactement le genre de panne silencieuse qu'on rencontre en configurant
 * Firebase pour la première fois — et la plus pénible à diagnostiquer.
 */

export interface ErreurStockage {
  chemin: string
  operation: 'lecture' | 'écriture'
  code: string
  message: string
  ts: number
}

const ecouteurs = new Set<(e: ErreurStockage | null) => void>()
let derniere: ErreurStockage | null = null

export function signalerErreur(
  chemin: string,
  operation: ErreurStockage['operation'],
  brute: unknown,
): void {
  const code = (brute as { code?: string })?.code ?? 'inconnu'
  const message = (brute as { message?: string })?.message ?? String(brute)
  derniere = { chemin, operation, code, message, ts: Date.now() }
  console.error(`[stockage] ${operation} refusée sur ${chemin}`, brute)
  for (const cb of ecouteurs) cb(derniere)
}

export function effacerErreur(): void {
  derniere = null
  for (const cb of ecouteurs) cb(null)
}

export function surErreurStockage(cb: (e: ErreurStockage | null) => void): () => void {
  ecouteurs.add(cb)
  cb(derniere)
  return () => {
    ecouteurs.delete(cb)
  }
}

/**
 * Traduit les codes Firestore et Firebase Auth en conseils actionnables.
 * Les deux causes de très loin les plus fréquentes lors de la mise en route
 * sont des règles non publiées et un domaine non autorisé.
 */
export function expliquer(e: ErreurStockage): string {
  if (e.code.includes('permission-denied')) {
    return (
      "Firestore a refusé l'accès. Le plus probable : les règles de sécurité n'ont pas été " +
      'publiées. Copiez firebase/firestore.rules dans la console Firebase → Firestore → Règles, ' +
      'puis Publier. Vérifiez aussi que vous êtes bien connecté avec le bon compte.'
    )
  }
  if (e.code.includes('unauthenticated')) {
    return 'Session expirée. Déconnectez-vous et reconnectez-vous.'
  }
  if (e.code.includes('unavailable') || e.code.includes('network')) {
    return 'Firestore est injoignable. Vérifiez votre connexion internet.'
  }
  if (e.code.includes('not-found')) {
    return (
      "La base Firestore n'existe pas encore. Créez-la dans la console Firebase → " +
      'Firestore Database → Créer une base de données.'
    )
  }
  return e.message
}
