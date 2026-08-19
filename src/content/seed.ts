import type {
  Classe,
  EntreeCatalogue,
  Equipement,
  Investissement,
  Sort,
  VieSoulshifter,
} from '../domain/types.ts'

/**
 * Contenu livré avec l'app.
 *
 * Cette graine est versionnée dans le repo, puis importée dans Firestore au
 * premier démarrage. Une fois en base, tout est éditable depuis l'écran MJ :
 * ce fichier reste le filet de sécurité et le point de départ d'une table neuve.
 *
 * Toutes les entrées portent `seed: true`, ce qui les protège de la suppression
 * accidentelle depuis l'écran MJ (elles restent modifiables).
 */

// ---------------------------------------------------------------------------
// Dusk Hunter
// ---------------------------------------------------------------------------

const SORTS_DUSK: Sort[] = [
  {
    kind: 'sort',
    id: 'burst',
    nom: 'Burst',
    icone: 'fire-ray',
    seed: true,
    classeId: 'dusk-hunter',
    magie: 'sang',
    cout: { kind: 'brulures-variable' },
    de: null,
    duree: 'Instantané',
    effet:
      "Envoie une gerbe de flamme dans la direction donnée à portée moyenne, infligeant X dégâts, où X est le coût payé en brûlure. Le faisceau est similaire à celui d'une lance à incendie et ne peut en général toucher qu'une cible.",
  },
  {
    kind: 'sort',
    id: 'heat-track',
    nom: 'Heat track',
    icone: 'heat-haze',
    seed: true,
    classeId: 'dusk-hunter',
    magie: 'sang',
    cout: { kind: 'brulures', valeur: 1 },
    de: null,
    duree: '1 minute',
    effet:
      'Peut sentir les traces de chaleur environnantes à une portée de 10 mètres. Cela peut être des personnes ou des sources de chaleur actives (brasier, bougie, …).',
  },
  {
    kind: 'sort',
    id: 'first-aid',
    nom: 'First Aid',
    icone: 'healing',
    seed: true,
    classeId: 'dusk-hunter',
    magie: 'miracle',
    cout: { kind: 'foi', valeur: 3 },
    de: null,
    duree: 'Instantané',
    effet:
      "Le Hexcore se charge en énergie vitale qui finit par s'écouler de lui. Soigne un point de Fatigue à la cible.",
  },
  {
    kind: 'sort',
    id: 'prey-impulse',
    nom: 'Prey Impulse',
    icone: 'lightning-arc',
    seed: true,
    classeId: 'dusk-hunter',
    magie: 'miracle',
    cout: { kind: 'foi', valeur: 2 },
    de: null,
    duree: '1 heure',
    effet:
      "Une cible à portée de contact se prend une violente décharge, l'assommant sur le coup. L'effet dure maximum 1 heure ou jusqu'à ce que la cible reçoive des dégâts.",
  },
  // « Futurs sorts » du PDF : présents au catalogue pour la boutique,
  // mais non accordés d'office à la classe.
  {
    kind: 'sort',
    id: 'take-it-slow',
    nom: 'Take it slow',
    icone: 'time-trap',
    seed: true,
    classeId: 'dusk-hunter',
    magie: 'sang',
    cout: { kind: 'brulures-variable' },
    de: null,
    duree: 'X secondes',
    effet:
      "Le Hexcore accélère les battements du cœur au point de presque figer le temps. Pendant X secondes, où X est le nombre de brûlures dépensées, le temps est figé pour tout le monde sauf le Dusk Hunter.",
  },
  {
    kind: 'sort',
    id: 'sundown',
    nom: 'Sundown',
    icone: 'eclipse',
    seed: true,
    classeId: 'dusk-hunter',
    magie: 'miracle',
    cout: { kind: 'marques-variable', max: 3 },
    de: null,
    duree: 'X minutes',
    effet:
      "Absorbe toute lumière alentour pendant X minutes, où X est le nombre de Marques concédées (maximum 3). La lumière est absorbée par le Hexcore et restitue X Points de Foi.",
  },
]

// ---------------------------------------------------------------------------
// Soulshifter
// ---------------------------------------------------------------------------

const SORTS_SOULSHIFTER: Sort[] = [
  {
    kind: 'sort',
    id: 'companion',
    nom: 'Companion',
    icone: 'ghost-ally',
    seed: true,
    classeId: 'soulshifter',
    magie: 'arcane',
    cout: { kind: 'aucun' },
    de: '1d6',
    duree: '10 minutes',
    effet:
      "Crée un familier qui accompagne le Soulshifter. Il peut faire des attaques à hauteur de 1d4 et possède 3 points de vie, sans évasion.",
  },
  {
    kind: 'sort',
    id: 'element',
    nom: 'Element',
    icone: 'orbital',
    seed: true,
    classeId: 'soulshifter',
    magie: 'arcane',
    cout: { kind: 'aucun' },
    de: '1d6',
    duree: 'Instantané',
    effet:
      "Manifeste l'élément de la personnalité en cours. Effectue X dégâts, où X est le nombre obtenu sur le d6. Le sort ne peut cibler qu'une seule cible à la fois.",
  },
  {
    kind: 'sort',
    id: 'tribue',
    nom: 'Tribue',
    icone: 'dorsal-scales',
    seed: true,
    classeId: 'soulshifter',
    magie: 'arcane',
    cout: { kind: 'aucun' },
    de: '1d6',
    duree: '10 minutes',
    effet: "S'imprègne de l'essence de la personnalité en cours.",
  },
  {
    kind: 'sort',
    id: 'sens',
    nom: 'Sens',
    icone: 'third-eye',
    seed: true,
    classeId: 'soulshifter',
    magie: 'arcane',
    cout: { kind: 'aucun' },
    de: '1d6',
    duree: '10 minutes',
    effet: 'Utilise la personnalité en cours pour augmenter ses sens.',
  },
]

/**
 * Vies passées du Soulshifter.
 *
 * La personnalité active recolore les quatre sorts et porte ses propres effets
 * mécaniques. Le passif tire un dé dont le nombre de faces est égal au nombre
 * de vies connues, une fois par heure.
 */
export const VIES_SOULSHIFTER: VieSoulshifter[] = [
  {
    face: 1,
    nom: 'Abaddon, Maître du Néant',
    precisions: {
      companion: 'Un spectre.',
      element: 'Boule de gravitation.',
      tribue:
        'Peut rendre invisible une personne volontaire. La cible prend 1 Marque (Oblivion) par minute.',
      sens: 'Peut ressentir si des éléments sont cachés.',
    },
  },
  {
    face: 2,
    nom: 'T-rexcité',
    precisions: {
      companion: 'Un dinosaure de taille moyenne.',
      element: 'Une liane.',
      tribue: 'Change sa peau en écaille, gagne +1 en Évasion.',
      sens: 'Gagne +4 en intimidation.',
    },
  },
]

// ---------------------------------------------------------------------------
// Trickster
// ---------------------------------------------------------------------------

const SORTS_TRICKSTER: Sort[] = [
  {
    kind: 'sort',
    id: 'ya-gat-fooled',
    nom: 'Ya gat fooled',
    icone: 'magic-swirl',
    seed: true,
    classeId: 'trickster',
    magie: 'arcane',
    cout: { kind: 'aucun' },
    de: null,
    duree: '1 minute',
    effet: 'Crée une illusion sensorielle mineure.',
    illusion: true,
  },
  {
    kind: 'sort',
    id: 'mage-hand',
    nom: 'Mage hand',
    icone: 'glowing-hands',
    seed: true,
    classeId: 'trickster',
    magie: 'arcane',
    cout: { kind: 'aucun' },
    de: null,
    duree: '10 minutes',
    effet:
      "Crée une main magique capable de se déplacer à une portée Moyenne. Elle peut soulever jusqu'à dix kilogrammes et répond aux commandes de son invocateur.",
    illusion: true,
  },
  {
    kind: 'sort',
    id: 'polymorph',
    nom: 'Polymorph',
    icone: 'transform',
    seed: true,
    classeId: 'trickster',
    magie: 'arcane',
    cout: { kind: 'aucun' },
    de: '1d6',
    duree: '1 heure',
    effet:
      "La créature ciblée change de forme et adopte celle d'une autre créature choisie. La cible obtient les caractéristiques et l'intelligence de la forme voulue. Si la créature reçoit des dégâts, le sort se brise. Les boss ont des résistances légendaires à Polymorph.",
  },
  {
    kind: 'sort',
    id: 'tame',
    nom: 'Tame',
    icone: 'beast-eye',
    seed: true,
    classeId: 'trickster',
    magie: 'arcane',
    cout: { kind: 'aucun' },
    de: '1d6',
    duree: '1 heure',
    effet:
      "Établit un contact avec une créature en vue. 1 : la créature est hostile envers vous. 2-3 : elle a une attitude positive mais ne se mettra pas en danger. 4-5 : elle vous obéit quoi que vous lui demandiez.",
  },
  {
    kind: 'sort',
    id: 'word-baboum',
    nom: 'Word: Baboum',
    icone: 'explosion-rays',
    seed: true,
    classeId: 'trickster',
    magie: 'miracle',
    cout: { kind: 'foi-plus-variable', base: 1 },
    de: null,
    duree: '1 heure',
    effet:
      "Crée une zone de 2 mètres de diamètre sur une surface ciblée à portée de main, qui explose au contact d'une créature. Des créatures nommées peuvent être exemptées. Les dégâts de la zone sont égaux à X, le coût supplémentaire payé au lancement.",
  },
  {
    kind: 'sort',
    id: 'word-crackers',
    nom: 'Word: Crackers',
    icone: 'firework-rocket',
    seed: true,
    classeId: 'trickster',
    magie: 'miracle',
    cout: { kind: 'foi', valeur: 2 },
    de: null,
    duree: '1 minute',
    effet:
      "Une gerbe d'étincelles et de feu d'artifice apparaît dans une zone de 3 mètres de diamètre à portée Moyenne. Toute créature présente dans la zone est aveuglée et assourdie.",
  },
]

// ---------------------------------------------------------------------------
// Classes
// ---------------------------------------------------------------------------

const CLASSES: Classe[] = [
  {
    kind: 'classe',
    id: 'dusk-hunter',
    nom: 'Dusk Hunter',
    icone: 'burning-embers',
    seed: true,
    fatigueMax: 5,
    sixthSensBase: 1,
    passifMoteur: 'dusk-hexcore',
    lore:
      "Il y a des moments où les événements sont trop terribles et le monde trop cruel pour survivre. Et c'est alors que l'homme se brise. De lui ne restent que les cendres de ce qu'il a été, et le brasier incandescent de sa vengeance qui vient illuminer le crépuscule de sa vie. Pour pallier ce qui lui a été arraché, il a recours aux technologies les plus obscures et se voit attribuer un Hexcore.",
    passifTexte:
      "Les Dusk Hunter peuvent alterner entre deux configurations du Hexcore. Overheat : chaque fois qu'une source devrait générer X brûlures, elle en génère X+1. Overdrive : toutes les Attaques Armées ont un bonus de +1 Point d'Énergie. Changer de configuration prend un tour de combat.",
    sortsIds: ['burst', 'heat-track', 'first-aid', 'prey-impulse'],
  },
  {
    kind: 'classe',
    id: 'soulshifter',
    nom: 'Soulshifter',
    icone: 'spectre',
    seed: true,
    fatigueMax: 4,
    sixthSensBase: 1,
    passifMoteur: 'soulshifter-vies',
    lore:
      "Le Soulshifter a vécu un événement traumatique qui a tellement bousculé sa vie qu'elle commence à se mêler avec celles passées. À tout moment, ses ancêtres peuvent reprendre le dessus et revenir à la vie à travers lui.",
    passifTexte:
      "Une fois par heure, le Soulshifter peut lancer un dé dont les faces correspondent au nombre de vies passées connues. La valeur du dé donne la vie dont il va revêtir la peau pour la prochaine heure. Les sorts sont partagés, mais la personnalité en influence la couleur et les effets.",
    sortsIds: ['companion', 'element', 'tribue', 'sens'],
  },
  {
    kind: 'classe',
    id: 'trickster',
    nom: 'Trickster',
    icone: 'top-hat',
    seed: true,
    fatigueMax: 4,
    sixthSensBase: 1,
    passifMoteur: 'trickster-voie',
    lore:
      "Le Trickster incarne l'essence même de la magie, celle qui transforme toute illusion en moment enchanteur. Que ce soit avec des tours, des acolytes ou par ses mots, il peut retourner n'importe quelle situation en usant simplement de sa malice.",
    passifTexte:
      "Le Trickster choisit sa voie à la phase Grimoire du Feu de Camp. Conteur : le coût en Points de Foi des sorts « Word: » est réduit de 1. Illusionniste : les illusions (Ya gat fooled, Mage hand) sont utilisables à volonté, sans contrepartie et hors des 3 slots du Grimoire.",
    sortsIds: ['polymorph', 'tame', 'word-baboum', 'word-crackers'],
  },
]

// ---------------------------------------------------------------------------
// Équipement
//
// Le catalogue réel arrive au Lot 3, avec la Boutique et l'Armurerie. On ne
// pose ici que le matériel de base cité par le PDF (« rations, catalyseur,
// paquetage de survie ») et un exemple par slot, de quoi valider l'affichage
// des 3 emplacements et le tirage de Détachement.
// ---------------------------------------------------------------------------

const EQUIPEMENTS: Equipement[] = [
  {
    kind: 'equipement',
    id: 'rations',
    nom: 'Rations',
    icone: 'meat',
    seed: true,
    slot: 'bibelot',
    materielDeBase: true,
    description: 'Matériel de base : hors des 3 emplacements, exclu du Détachement.',
  },
  {
    kind: 'equipement',
    id: 'catalyseur',
    nom: 'Catalyseur',
    icone: 'crystal-shine',
    seed: true,
    slot: 'bibelot',
    materielDeBase: true,
    description: 'Conserve les Lumens sous forme de lumière pure. Matériel de base.',
  },
  {
    kind: 'equipement',
    id: 'paquetage-survie',
    nom: 'Paquetage de survie',
    icone: 'backpack',
    seed: true,
    slot: 'bibelot',
    materielDeBase: true,
    description: 'Matériel de base : hors des 3 emplacements, exclu du Détachement.',
  },
  {
    kind: 'equipement',
    id: 'lame-simple',
    nom: 'Lame simple',
    icone: 'broadsword',
    seed: true,
    slot: 'arme',
    prix: 20,
    description: "Une arme de contact sans fioriture. Inflige 1d4 Points d'Énergie.",
  },
  {
    kind: 'equipement',
    id: 'cuirasse-usee',
    nom: 'Cuirasse usée',
    icone: 'breastplate',
    seed: true,
    slot: 'armure',
    prix: 40,
    bonusEvasion: 1,
    description: "Cabossée mais fidèle. Ajoute +1 à l'Évasion.",
  },
  {
    kind: 'equipement',
    id: 'lanterne-felee',
    nom: 'Lanterne fêlée',
    icone: 'lantern-flame',
    seed: true,
    slot: 'bibelot',
    prix: 15,
    description: "Diffuse une lueur chiche, mais une lueur tout de même.",
  },
]

// ---------------------------------------------------------------------------
// Investissements (phase Banque)
// ---------------------------------------------------------------------------

const INVESTISSEMENTS: Investissement[] = [
  {
    kind: 'investissement',
    id: 'location-chambre',
    nom: 'Location de chambre',
    icone: 'wooden-door',
    seed: true,
    cout: 150,
    beneficeTexte: '50 lumens au début de chaque session à partir de la suivante.',
    risqueTexte:
      "Au début de chaque session, chaque chambre a 20 % de chances indépendantes d'avoir besoin d'une rénovation à 50 lumens.",
    limiteTexte: '3 chambres toutes sessions confondues.',
    gainRecurrent: 50,
    probabiliteRisque: 0.2,
    coutRisque: 50,
    limiteTotale: 3,
  },
  {
    kind: 'investissement',
    id: 'transport-materiel',
    nom: 'Transport de matériel',
    icone: 'cargo-crate',
    seed: true,
    cout: 70,
    beneficeTexte: '100 lumens au début de la prochaine session.',
    risqueTexte: '10 % de chances que la cargaison se perde, ne laissant aucun bénéfice.',
    limiteTexte: '1× par session.',
    gainProchainSession: 100,
    probabiliteRisque: 0.1,
    limiteParSession: 1,
  },
  {
    kind: 'investissement',
    id: 'loto',
    nom: 'Loto',
    icone: 'dice-six-faces-three',
    seed: true,
    cout: 10,
    beneficeTexte: '100 lumens immédiatement.',
    risqueTexte: "Il n'y a que 25 % de chances de remporter les 100 lumens.",
    limiteTexte: '1× par session.',
    gainImmediat: 100,
    probabiliteRisque: 0.75,
    limiteParSession: 1,
  },
]

// ---------------------------------------------------------------------------

export const SEED: EntreeCatalogue[] = [
  ...CLASSES,
  ...SORTS_DUSK,
  ...SORTS_SOULSHIFTER,
  ...SORTS_TRICKSTER,
  ...EQUIPEMENTS,
  ...INVESTISSEMENTS,
]

/** Tous les noms d'icônes référencés, pour le script de téléchargement. */
export const ICONES_REFERENCEES = [...new Set(SEED.map((e) => e.icone))].sort()
