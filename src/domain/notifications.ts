import type { Catalog } from './catalog.ts'
import {
  COUT_GRATUIT,
  coutDe,
  decrireBranche,
  decrirePart,
  disponiblePour,
  estGratuit,
  fixe,
  montantPart,
  payerCout,
  peutPayerBranche,
  type BrancheCout,
  type Cout,
  type ResultatPaiement,
} from './couts.ts'
import type { Character } from './types.ts'

/**
 * Les Notifications.
 *
 * Une notification, c'est la MJ qui sollicite une ou plusieurs joueuses hors
 * des grands modes de table : titiller un 6th Sens, proposer un choix, remettre
 * un objet, montrer une illustration. Elle ne change pas le mode et n'interrompt
 * pas le reste de la table.
 *
 * Le modèle tient en une phrase : **une notification propose des options ;
 * répondre, c'est payer le coût d'une option et, éventuellement, en subir
 * l'effet sur sa fiche.** Tous les types s'y ramènent, jusqu'à l'Illustration
 * dont « Passer » n'est que l'unique option gratuite.
 *
 * Le coût réutilise le moteur de `couts.ts` sans rien y ajouter : « Payer 10
 * Lumens » s'écrit `coutDe(fixe('lumens', 10))`, et « 2 Foi OU 10 Lumens » était
 * déjà exprimable.
 *
 * ⚠️ Ce type masque le `Notification` du DOM. Le projet n'utilise pas l'API Web
 * Notification, et l'import explicite lève toute ambiguïté.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface OptionNotification {
  id: string
  libelle: string
  /** `COUT_GRATUIT` si l'option ne coûte rien. */
  cout: Cout
}

/**
 * Ce que la notification transporte.
 *
 * Un `kind` = une entrée du registre `TYPES` ci-dessous, et rien d'autre à
 * toucher ailleurs.
 */
export type ContenuNotification =
  | { kind: 'sixth-sens' }
  | { kind: 'choix'; options: OptionNotification[] }
  | { kind: 'equipement'; equipementId: string }
  | { kind: 'quete'; queteId: string }
  /** L'adresse **directe** de l'image, pas celle d'une page — voir `urlIllustration`. */
  | { kind: 'image'; url: string }

export type KindNotification = ContenuNotification['kind']

export interface ReponseNotification {
  optionId: string
  repondueLe: number
}

export interface Notification {
  id: string
  /** Les personnages visés. Chacun répond pour lui-même. */
  cibles: string[]
  /** Le contexte, affiché au-dessus des options. */
  texte: string
  contenu: ContenuNotification
  /** Réponse verrouillée de chaque cible, indexée par identifiant de personnage. */
  reponses: Record<string, ReponseNotification>
  envoyeeLe: number
}

// ---------------------------------------------------------------------------
// Le registre
// ---------------------------------------------------------------------------

interface TypeNotification<C extends ContenuNotification> {
  libelle: string
  /** Les options proposées à la joueuse, dérivées du contenu. */
  options(contenu: C): OptionNotification[]
  /** Ce que la réponse fait à la fiche, au-delà du paiement du coût. */
  appliquer?(char: Character, contenu: C, optionId: string): Character
  /** Absent = le texte de la MJ est obligatoire. Une illustration se passe de légende. */
  texteRequis?: boolean
}

/**
 * Les types de notification.
 *
 * **C'est ici, et nulle part ailleurs, qu'on ajoute un type.** L'écran de la
 * joueuse ne connaît que des options et des coûts ; seul le formulaire de la MJ
 * a besoin d'un fragment de saisie propre au nouveau contenu.
 *
 * 🔒 Aucun type ne transporte de secret. Les joueuses partagent un compte
 * Firebase : un document lisible par l'une l'est par toutes. Le 6th Sens ne
 * porte donc que l'amorce publique — l'information révélée par « Écouter » se
 * donne de vive voix.
 */
const TYPES: { [K in KindNotification]: TypeNotification<Extract<ContenuNotification, { kind: K }>> } = {
  'sixth-sens': {
    libelle: '6th Sens',
    options: () => [
      { id: 'ecouter', libelle: 'Écouter', cout: coutDe(fixe('sixth-sens', 1)) },
      { id: 'laisser', libelle: 'Laisse passer', cout: COUT_GRATUIT },
    ],
  },

  choix: {
    libelle: 'Choix secret',
    options: (contenu) => contenu.options,
  },

  equipement: {
    libelle: 'Nouvel équipement',
    // L'objet n'arrive qu'à l'accusé de réception : c'est ce geste qui le fait
    // entrer dans le sac, et la MJ voit qu'il a bien été pris.
    options: () => [{ id: 'prendre', libelle: 'Prendre', cout: COUT_GRATUIT }],
    appliquer: (char, contenu) => ({
      ...char,
      possede: {
        ...char.possede,
        equipements: [...char.possede.equipements, contenu.equipementId],
      },
    }),
  },

  quete: {
    libelle: 'Quête',
    // Les deux options sont gratuites : accepter une quête n'a pas de prix, et
    // refuser doit rester sans conséquence. Ce qui les distingue est l'effet.
    options: () => [
      { id: 'accepter', libelle: 'Accepter', cout: COUT_GRATUIT },
      { id: 'refuser', libelle: 'Refuser', cout: COUT_GRATUIT },
    ],
    appliquer: (char, contenu, optionId) => {
      if (optionId !== 'accepter') return char
      // La MJ peut proposer deux fois la même quête ; la possession est un
      // ensemble, pas une pile.
      if (char.possede.quetes.includes(contenu.queteId)) return char
      return {
        ...char,
        possede: { ...char.possede, quetes: [...char.possede.quetes, contenu.queteId] },
      }
    },
  },

  image: {
    libelle: 'Illustration',
    // Regarder une image ne touche pas la fiche : pas d'`appliquer`. « Passer »
    // n'est là que pour retirer l'illustration de l'écran — et la MJ voit du
    // même coup qui a fini de la regarder.
    texteRequis: false,
    options: () => [{ id: 'passer', libelle: 'Passer', cout: COUT_GRATUIT }],
  },
}

export function libelleType(notif: Notification): string {
  return TYPES[notif.contenu.kind].libelle
}

/** Vrai si la MJ doit écrire un texte avant de pouvoir envoyer ce type. */
export function texteRequis(kind: KindNotification): boolean {
  return TYPES[kind].texteRequis !== false
}

/**
 * L'adresse d'affichage d'une illustration.
 *
 * Sur Cosmos, « Copier l'adresse de l'image » donne l'URL de la vignette telle
 * qu'elle était affichée — `?format=webp&w=400` —, illisible en plein écran. On
 * retire la largeur pour obtenir la pleine résolution, et rien d'autre : un
 * `rect=` est un recadrage que la MJ a peut-être voulu. Toute autre source
 * passe intacte, et une chaîne qui n'est pas une URL aussi — c'est
 * `contenuComplet` qui refuse l'envoi, pas cette fonction.
 */
export function urlIllustration(url: string): string {
  const brut = url.trim()
  try {
    const adresse = new URL(brut)
    if (adresse.hostname !== 'cdn.cosmos.so') return brut
    adresse.searchParams.delete('w')
    return adresse.toString()
  } catch {
    return brut
  }
}

export const KINDS_NOTIFICATION = Object.keys(TYPES) as KindNotification[]

export const LIBELLE_KIND_NOTIFICATION = Object.fromEntries(
  KINDS_NOTIFICATION.map((k) => [k, TYPES[k].libelle]),
) as Record<KindNotification, string>

export function optionsDe(notif: Notification): OptionNotification[] {
  // Le registre est indexé par `kind` et chaque entrée ne reçoit que le contenu
  // de son propre type ; TypeScript ne sait pas relier les deux côtés d'un
  // `Record`, d'où l'unique conversion de tout le module.
  const type = TYPES[notif.contenu.kind] as TypeNotification<ContenuNotification>
  return type.options(notif.contenu)
}

export function optionDe(notif: Notification, optionId: string): OptionNotification | null {
  return optionsDe(notif).find((o) => o.id === optionId) ?? null
}

export function libelleOption(notif: Notification, optionId: string): string {
  return optionDe(notif, optionId)?.libelle ?? optionId
}

/** Vrai si répondre par cette option coûte quelque chose — la MJ veut le voir. */
export function optionCouteuse(notif: Notification, optionId: string): boolean {
  const option = optionDe(notif, optionId)
  return option !== null && !estGratuit(option.cout)
}

// ---------------------------------------------------------------------------
// Ce qu'on propose à la joueuse
// ---------------------------------------------------------------------------

/**
 * Un bouton de l'écran : une option, et la branche de coût qu'il paierait.
 *
 * Options et branches sont aplaties ensemble parce qu'elles posent la même
 * question — « qu'est-ce que je paie ? ». Un coût à branche unique, cas de
 * loin le plus fréquent, donne exactement un bouton par option ; « 2 Foi OU
 * 10 Lumens » en donne deux, et l'écran n'a rien à savoir de ce cas.
 */
export interface ChoixPropose {
  option: OptionNotification
  /** Index de la branche dans `option.cout.branches`. `0` si le coût est gratuit. */
  branche: number
  /** Le coût en toutes lettres, ou `null` si l'option est gratuite. */
  libelleCout: string | null
  payable: boolean
  /** Ce qui manque, quand la branche n'est pas payable. */
  raison: string | null
}

/**
 * Ce qui manque pour payer une branche.
 *
 * ⚠️ Une part variable — le « X » — est comptée à son minimum : une
 * notification ne demande pas de choisir un montant, et la MJ n'a aucune raison
 * d'en mettre une. C'est exactement ce que `payerCout` prélèvera.
 */
function manque(char: Character, catalog: Catalog, branche: BrancheCout): string {
  const manquants = branche.parts
    .map((part) => {
      if (part.kind === 'narratif') return null
      const montant = montantPart(part, 0)
      const dispo = disponiblePour(char, catalog, part.element)
      if (dispo >= montant) return null
      return `${decrirePart(part, montant)} — il vous en manque ${montant - dispo}`
    })
    .filter((m): m is string => m !== null)

  return manquants.length > 0 ? manquants.join(' · ') : 'Coût impayable.'
}

export function choixProposes(
  char: Character,
  catalog: Catalog,
  notif: Notification,
): ChoixPropose[] {
  return optionsDe(notif).flatMap((option): ChoixPropose[] => {
    if (estGratuit(option.cout)) {
      return [{ option, branche: 0, libelleCout: null, payable: true, raison: null }]
    }

    return option.cout.branches.map((branche, index) => {
      const payable = peutPayerBranche(char, catalog, branche)
      return {
        option,
        branche: index,
        libelleCout: decrireBranche(branche),
        payable,
        raison: payable ? null : manque(char, catalog, branche),
      }
    })
  })
}

// ---------------------------------------------------------------------------
// Répondre
// ---------------------------------------------------------------------------

/**
 * Paie l'option choisie, puis lui applique son effet.
 *
 * Lève si l'option est inconnue ou la branche impayable — c'est `payerCout` qui
 * tranche, comme pour un sort ou un Actif d'objet.
 */
export function repondre(
  char: Character,
  catalog: Catalog,
  notif: Notification,
  optionId: string,
  branche = 0,
): ResultatPaiement {
  const option = optionDe(notif, optionId)
  if (!option) throw new Error(`Option de notification inconnue : ${optionId}`)

  const paiement = payerCout(char, catalog, option.cout, { branche })
  const type = TYPES[notif.contenu.kind] as TypeNotification<ContenuNotification>

  return {
    char: type.appliquer?.(paiement.char, notif.contenu, optionId) ?? paiement.char,
    recits: paiement.recits,
  }
}

// ---------------------------------------------------------------------------
// Composer
// ---------------------------------------------------------------------------

/** Le contenu vierge d'un type, pour le formulaire de la MJ. */
export function contenuVierge(kind: KindNotification): ContenuNotification {
  switch (kind) {
    case 'sixth-sens':
      return { kind }
    case 'choix':
      return {
        kind,
        options: [
          { id: 'a', libelle: '', cout: COUT_GRATUIT },
          { id: 'b', libelle: '', cout: COUT_GRATUIT },
        ],
      }
    case 'equipement':
      return { kind, equipementId: '' }
    case 'quete':
      return { kind, queteId: '' }
    case 'image':
      return { kind, url: '' }
  }
}

/** Vrai si le contenu est complet ; la MJ ne peut pas envoyer avant. */
export function contenuComplet(contenu: ContenuNotification): boolean {
  switch (contenu.kind) {
    case 'sixth-sens':
      return true
    case 'choix':
      return contenu.options.length >= 2 && contenu.options.every((o) => o.libelle.trim() !== '')
    case 'equipement':
      return contenu.equipementId !== ''
    case 'quete':
      return contenu.queteId !== ''
    case 'image':
      return /^https?:\/\/\S+$/.test(contenu.url.trim())
  }
}

/** Les cibles qui n'ont pas encore répondu. */
export function enAttente(notif: Notification): string[] {
  return notif.cibles.filter((id) => notif.reponses[id] === undefined)
}
