import { COUT_GRATUIT, coutDe, fixe, variable } from '../domain/couts.ts'
import type {
  Classe,
  EntreeCatalogue,
  Equipement,
  Investissement,
  Sort,
  TypeMagique,
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
    magieId: 'sang',
    cout: coutDe(variable('brulures', { min: 1 })),
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
    magieId: 'sang',
    cout: coutDe(fixe('brulures', 1)),
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
    magieId: 'miracle',
    cout: coutDe(fixe('foi', 3)),
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
    magieId: 'miracle',
    cout: coutDe(fixe('foi', 2)),
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
    magieId: 'sang',
    cout: coutDe(variable('brulures', { min: 1 })),
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
    magieId: 'miracle',
    // Les Marques sont **concédées** : le sort les fait prendre, il n'en retire pas.
    cout: coutDe(variable('marques', { min: 1, max: 3, sens: 'prendre' })),
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
    magieId: 'arcane',
    cout: COUT_GRATUIT,
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
    magieId: 'arcane',
    cout: COUT_GRATUIT,
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
    magieId: 'arcane',
    cout: COUT_GRATUIT,
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
    magieId: 'arcane',
    cout: COUT_GRATUIT,
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
    magieId: 'arcane',
    cout: COUT_GRATUIT,
    de: null,
    duree: '1 minute',
    effet: 'Crée une illusion sensorielle mineure.',
    requiertPassif: 'illusionniste',
  },
  {
    kind: 'sort',
    id: 'mage-hand',
    nom: 'Mage hand',
    icone: 'glowing-hands',
    seed: true,
    classeId: 'trickster',
    magieId: 'arcane',
    cout: COUT_GRATUIT,
    de: null,
    duree: '10 minutes',
    effet:
      "Crée une main magique capable de se déplacer à une portée Moyenne. Elle peut soulever jusqu'à dix kilogrammes et répond aux commandes de son invocateur.",
    requiertPassif: 'illusionniste',
  },
  {
    kind: 'sort',
    id: 'polymorph',
    nom: 'Polymorph',
    icone: 'transform',
    seed: true,
    classeId: 'trickster',
    magieId: 'arcane',
    cout: COUT_GRATUIT,
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
    magieId: 'arcane',
    cout: COUT_GRATUIT,
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
    magieId: 'miracle',
    cout: coutDe(fixe('foi', 1), variable('foi')),
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
    magieId: 'miracle',
    cout: coutDe(fixe('foi', 2)),
    de: null,
    duree: '1 minute',
    effet:
      "Une gerbe d'étincelles et de feu d'artifice apparaît dans une zone de 3 mètres de diamètre à portée Moyenne. Toute créature présente dans la zone est aveuglée et assourdie.",
  },
]

// ---------------------------------------------------------------------------
// Astromancien
// ---------------------------------------------------------------------------

const SORTS_ASTROMANCIEN: Sort[] = [
  {
    kind: 'sort',
    id: 'vanish',
    nom: 'Vanish',
    icone: 'invisible',
    seed: true,
    classesIds: ['astromancien'],
    magieId: 'miracle',
    // Une Marque **prise** : c'est ce qui la fait valoir un Point de Foi sous Ito.
    cout: coutDe(fixe('marques', 1, { sens: 'prendre' })),
    de: null,
    duree: '1 minute',
    effet:
      "Prélève toute la Lumière de la cible et la rend invisible aux yeux du monde, comme si son âme avait quitté l'Entre-Monde.",
  },
  {
    kind: 'sort',
    id: 'lightfall',
    nom: 'Lightfall',
    icone: 'sunbeams',
    seed: true,
    classesIds: ['astromancien'],
    magieId: 'miracle',
    // Le Point de Foi qui déplace la zone se paie à la main, quand la fiction le demande.
    cout: coutDe(fixe('foi', 2)),
    de: null,
    duree: 'Instantanée',
    effet:
      "Précipite la Lumière alentour en une pluie continuelle de faisceaux lumineux aussi tranchants que des rasoirs, infligeant 2 Points d'Énergie à quiconque s'y trouve. La zone fait 8 m³ (2 m × 2 m × 2 m) et est fixe. Elle peut être déplacée moyennant 1 Point de Foi supplémentaire.",
  },
  {
    kind: 'sort',
    id: 'lightweb',
    nom: 'Lightweb',
    icone: 'spider-web',
    seed: true,
    classesIds: ['astromancien'],
    magieId: 'miracle',
    cout: coutDe(fixe('foi', 3)),
    de: null,
    duree: 'Instantanée',
    effet:
      "Crée une toile de lumière qui permet de résorber les plaies d'une âme blessée. Soigne 1 Point de Fatigue à la cible.",
  },
  {
    kind: 'sort',
    id: 'amaterasu',
    nom: 'Amaterasu',
    icone: 'sunrise',
    seed: true,
    classesIds: ['astromancien'],
    magieId: 'miracle',
    cout: coutDe(fixe('lumens', 50)),
    de: null,
    duree: 'Instantanée',
    effet: 'Votre Bonne Étoile change la Lumière en Foi : dépensez 50 Lumens pour regagner un Point de Foi.',
    /*
     * Le pouvoir de l'étoile Amaterasu. Le PDF tient toute capacité de classe
     * pour un Sort : débloqué par l'option, il vit hors des emplacements, hors
     * boutique et hors Détachement, comme les illusions de l'Illusionniste.
     */
    requiertPassif: 'amaterasu',
    actifs: [
      {
        id: 'foi',
        nom: 'Amaterasu',
        table: {
          faces: 1,
          entrees: [
            {
              texte: '',
              operations: [
                {
                  kind: 'ajuster',
                  cible: { element: { kind: 'foi' }, aspect: 'valeur' },
                  op: { kind: 'add', value: 1 },
                },
              ],
            },
          ],
        },
      },
    ],
  },
]

// ---------------------------------------------------------------------------
// Earthborn
// ---------------------------------------------------------------------------

/*
 * Le « sur un 6 » de ces sorts n'est pas une table : c'est l'Âme de Géant de la
 * classe qui le déclenche, et le texte qui en dit l'ampleur.
 */
const SORTS_EARTHBORN: Sort[] = [
  {
    kind: 'sort',
    id: 'terraformation',
    nom: 'Terraformation',
    icone: 'earth-spit',
    seed: true,
    classesIds: ['earthborn'],
    magieId: 'arcane',
    cout: COUT_GRATUIT,
    de: '1d6',
    duree: 'Instantanée',
    effet:
      "Vous pouvez modeler la terre devant vous et lui faire prendre la forme souhaitée. La quantité maximum de terre correspond à une voiture. Cependant, sur un 6, l'Âme de Géant résonne en vous et vous pouvez modeler l'équivalent d'une maison à la place.",
  },
  {
    kind: 'sort',
    id: 'river-song',
    nom: 'River Song',
    icone: 'waterfall',
    seed: true,
    classesIds: ['earthborn'],
    magieId: 'arcane',
    cout: COUT_GRATUIT,
    de: '1d6',
    duree: 'Instantanée',
    effet:
      "Fait apparaître une petite source à l'endroit désiré. Sur un 6, l'Âme de Géant résonne en vous et c'est un véritable torrent qui apparaît.",
  },
  {
    kind: 'sort',
    id: 'burning-soul',
    nom: 'Burning Soul',
    icone: 'fire-silhouette',
    seed: true,
    classesIds: ['earthborn'],
    magieId: 'sang',
    cout: coutDe(fixe('brulures', 3)),
    de: null,
    duree: 'Instantanée',
    effet:
      "Tout votre corps devient incandescent, rayonnant d'une chaleur qui pourrait faire fondre presque n'importe quel métal, ou embraser n'importe quel végétal.",
  },
]

// ---------------------------------------------------------------------------
// Eclipsed
// ---------------------------------------------------------------------------

const SORTS_ECLIPSED: Sort[] = [
  {
    kind: 'sort',
    id: 'couleur-rouge',
    nom: '[Couleur] Rouge',
    icone: 'palette',
    seed: true,
    classesIds: ['eclipsed'],
    magieId: 'arcane',
    cout: COUT_GRATUIT,
    de: '1d6',
    duree: '1 heure',
    effet:
      'Vous vous habillez de la couleur la plus intense qui soit, et cela se voit. Ajoutez la valeur du d6 à votre compétence Social.',
    actifs: [
      {
        id: 'couleur',
        nom: '[Couleur] Rouge',
        table: {
          faces: 1,
          entrees: [
            {
              texte: '',
              operations: [
                {
                  kind: 'ajuster',
                  cible: {
                    element: { kind: 'competence', competence: 'social' },
                    aspect: 'valeur',
                  },
                  // Un modificateur que la joueuse dissipe quand l'heure a passé.
                  op: { kind: 'add-de' },
                },
              ],
            },
          ],
        },
      },
    ],
  },
  {
    kind: 'sort',
    id: 'animate',
    nom: 'Animate',
    icone: 'puppet',
    seed: true,
    classesIds: ['eclipsed'],
    magieId: 'arcane',
    cout: COUT_GRATUIT,
    de: '1d6',
    duree: '10 minutes',
    effet:
      "Un objet inanimé à distance moyenne prend vie et suit vos ordres. 1-2 : il n'en fait qu'à sa tête. 3-4 : il obéit, mais sa compréhension est limitée. 5 : il obéit au doigt et à l'œil.",
  },
  {
    kind: 'sort',
    id: 'draw',
    nom: 'Draw',
    icone: 'pencil-brush',
    seed: true,
    classesIds: ['eclipsed'],
    magieId: 'arcane',
    cout: COUT_GRATUIT,
    de: '1d6',
    duree: 'Instantanée',
    effet:
      "Crée un objet inanimé à une distance courte ou moyenne. La qualité de l'objet varie selon le résultat du jet ; qualité et taille sont proportionnelles à l'objet voulu. 1-2 : qualité mauvaise, petite taille. 3-4 : qualité moyenne, taille moyenne. 5 : qualité excellente, grande taille.",
  },
  {
    kind: 'sort',
    id: 'vision-artiste',
    nom: "Vision d'Artiste",
    icone: 'crystal-ball',
    seed: true,
    classesIds: ['eclipsed'],
    magieId: 'arcane',
    cout: COUT_GRATUIT,
    de: '1d6',
    duree: 'Instantanée',
    effet:
      "Projette son esprit hors de son corps et visualise un lieu jusqu'à un kilomètre de distance. La vision est ensuite couchée sur papier et peut être lue comme un cliché instantané de l'état du lieu en question.",
  },
  // Les sorts Ombre : débloqués par l'état, ils ne s'achètent ni ne se perdent.
  {
    kind: 'sort',
    id: 'raging-claw',
    nom: 'Raging Claw',
    icone: 'claw-slashes',
    seed: true,
    classesIds: ['eclipsed'],
    magieId: 'ombre',
    requiertPassif: 'ombre',
    // « Jusqu'à » : lancé sur une seule Marque, le sort la vide.
    cout: coutDe(fixe('marques', 2, { auPlus: true })),
    de: '1d6',
    duree: 'Instantanée',
    effet:
      "Lancez une pièce. Sur « face », votre cible est l'alliée la plus proche ; sur « pile », l'adversaire la plus proche. Vous infligez 1d6 dégâts à la cible. S'il n'y a pas d'adversaire disponible, vous reportez votre rage sur les objets alentour.",
    actifs: [
      {
        id: 'piece',
        nom: 'Pile ou face',
        table: {
          faces: 2,
          entrees: [
            { texte: "Face : votre cible est l'alliée la plus proche." },
            { texte: "Pile : votre cible est l'adversaire la plus proche." },
          ],
        },
      },
    ],
  },
  {
    kind: 'sort',
    id: 'void-call',
    nom: 'Void Call',
    icone: 'vortex',
    seed: true,
    classesIds: ['eclipsed'],
    magieId: 'ombre',
    requiertPassif: 'ombre',
    cout: coutDe(fixe('marques', 4, { auPlus: true })),
    de: null,
    duree: 'Instantanée',
    effet:
      "Vous entendez un appel, irrésistible. La puissance déferle en vous et vous transcende, et votre être devient une porte vers l'Oblivion. Qui sait ce qui risque d'en sortir… Lancez 1d4 et exécutez l'effet associé.",
    actifs: [
      {
        id: 'appel',
        nom: 'Appel du Vide',
        table: {
          faces: 4,
          /*
           * Seul le 4 s'applique tout seul : les autres touchent des alliées, et
           * l'app ne sait pas qui est à la table ce soir.
           */
          entrees: [
            { texte: "1 : vous invoquez une créature de l'Oblivion." },
            { texte: '2 : tous les alliés prennent 2 Marques.' },
            { texte: '3 : tous les alliés prennent un désavantage en Esprit.' },
            {
              texte: "4 : vous résistez finalement à l'appel, mais prenez 1 Point de Fatigue.",
              operations: [
                {
                  kind: 'ajuster',
                  cible: { element: { kind: 'fatigue' }, aspect: 'valeur' },
                  op: { kind: 'add', value: 1 },
                },
              ],
            },
          ],
        },
      },
    ],
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
    choix: [
      {
        id: 'hexcore',
        libelle: 'Configuration du Hexcore',
        // Bascule libre : le PDF la paie d'un tour de combat, pas d'un verrou.
        verrou: 'libre',
        options: [
          {
            id: 'overdrive',
            nom: 'Overdrive',
            effet: "+1 Point d'Énergie à toutes les Attaques Armées",
            passifs: [
              {
                id: 'overdrive',
                libelle: 'Overdrive',
                declenchement: { kind: 'permanent' },
                effet: {
                  texte: "+1 Point d'Énergie à toutes les Attaques Armées",
                  operations: [
                    {
                      kind: 'ajuster',
                      cible: { element: { kind: 'energie-attaque' }, aspect: 'valeur' },
                      op: { kind: 'add', value: 1 },
                    },
                  ],
                },
              },
            ],
          },
          {
            id: 'overheat',
            nom: 'Overheat',
            /*
             * ⚠️ **Sans passif, et à dessein.** Overheat transforme le *gain*
             * de brûlures (X → X+1), ce qui n'est ni un ajustement de valeur ni
             * une réaction : une réaction s'armerait sur tout mouvement du
             * compteur, or la barre de brûlures sert aussi de bloc-notes —
             * cocher une case pour noter son total en offrirait une gratuite.
             * La mécanique reste dans `gainBrulureEffectif` (`brulures.ts`).
             */
            effet: 'Toute source de X brûlures en génère X+1',
          },
        ],
      },
    ],
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
      "Le Trickster choisit sa voie à la phase Sorts du Feu de Camp. Conteur : le coût en Points de Foi des sorts « Word: » est réduit de 1. Illusionniste : les illusions (Ya gat fooled, Mage hand) sont utilisables à volonté, sans contrepartie et hors des 3 emplacements.",
    choix: [
      {
        id: 'voie',
        libelle: 'Voie du Trickster',
        // Engagée au Feu de Camp, et valable jusqu'au suivant.
        verrou: 'feu-de-camp',
        options: [
          {
            id: 'conteur',
            nom: 'Conteur',
            effet: 'Le coût en Points de Foi des sorts « Word: » est réduit de 1',
            passifs: [
              {
                id: 'conteur',
                libelle: 'Conteur',
                declenchement: { kind: 'permanent' },
                effet: {
                  texte: 'Le coût en Points de Foi des sorts « Word: » est réduit de 1',
                  operations: [
                    {
                      kind: 'ajuster',
                      cible: {
                        element: {
                          kind: 'cout-sort',
                          // Le rabais porte sur la Foi, et sur elle seule : sans
                          // ce filtre il déborderait sur les coûts en brûlures.
                          filtre: { magieId: 'miracle', prefixeNom: 'Word:', element: 'foi' },
                        },
                        aspect: 'valeur',
                      },
                      op: { kind: 'add', value: -1 },
                    },
                  ],
                },
              },
            ],
          },
          {
            id: 'illusionniste',
            nom: 'Illusionniste',
            /*
             * Sans passif chiffré : la voie ne modifie aucune valeur, elle
             * débloque des sorts. C'est `Sort.requiertPassif` qui porte le lien,
             * si bien qu'ajouter une illusion au catalogue la rend aussitôt
             * disponible — sans toucher ni à la classe, ni au code.
             */
            effet: 'Ya gat fooled et Mage hand utilisables à volonté, hors emplacements',
          },
        ],
      },
    ],
    // Les illusions ne figurent pas ici : la voie Illusionniste y donne accès
    // en permanence, elles sont dérivées du catalogue et non possédées.
    sortsIds: ['polymorph', 'tame', 'word-baboum', 'word-crackers'],
  },
  {
    kind: 'classe',
    id: 'astromancien',
    nom: 'Astromancien',
    icone: 'night-sky',
    seed: true,
    fatigueMax: 4,
    sixthSensBase: 1,
    lore:
      "Qui n'a jamais levé les yeux au ciel, contemplant l'immensité de la Voie Lactée en rêvant de ce qui l'attendait au-delà de ces milliers d'étoiles ? L'Astromancien fait partie de celles et ceux qui s'y sont perdus, qui ont laissé leur tête dans les étoiles et ne cherchent pas particulièrement à la retrouver. Car c'est en se laissant envahir par leur chaleur, leur murmure et leur lumière qu'ils tirent leur pouvoir si secret.",
    passifTexte:
      "Bonne Étoile : une fois par heure, l'Astromancien peut choisir quelle est sa Bonne Étoile. Elle veille ainsi sur lui et lui prodigue des avantages uniques. Ito : à chaque fois que vous prenez une Marque, vous gagnez un Point de Foi. Amaterasu : vous pouvez dépenser 50 Lumens pour regagner un Point de Foi. D'autres étoiles peuvent être débloquées plus tard.",
    choix: [
      {
        id: 'etoile',
        libelle: 'Bonne Étoile',
        // « Une fois par heure » : l'heure de jeu, que seule la MJ connaît. Pas
        // d'étoile à la création, et le premier choix est libre.
        verrou: 'jeton',
        options: [
          {
            id: 'ito',
            nom: 'Ito',
            effet: 'Chaque Marque prise vous rend un Point de Foi',
            passifs: [
              {
                id: 'ito',
                libelle: 'Ito',
                declenchement: {
                  kind: 'reaction',
                  quand: { element: { kind: 'marques' }, sens: 'augmente', chez: 'soi' },
                },
                effet: {
                  texte: 'À chaque fois que vous prenez une Marque, vous gagnez un Point de Foi.',
                  operations: [
                    {
                      kind: 'ajuster',
                      cible: { element: { kind: 'foi' }, aspect: 'valeur' },
                      // Le X d'une réaction : un Point de Foi **par** Marque prise.
                      op: { kind: 'add-x' },
                    },
                  ],
                },
              },
            ],
          },
          {
            id: 'amaterasu',
            nom: 'Amaterasu',
            // Sans passif : l'étoile débloque le sort du même nom (`requiertPassif`).
            effet: 'Dépensez 50 Lumens pour regagner un Point de Foi',
          },
        ],
      },
    ],
    sortsIds: ['vanish', 'lightfall', 'lightweb'],
  },
  {
    kind: 'classe',
    id: 'earthborn',
    nom: 'Earthborn',
    icone: 'giant',
    seed: true,
    fatigueMax: 5,
    sixthSensBase: 1,
    lore:
      "Il y a des personnes dont l'âme porte les traces d'un lointain passé. Une appartenance à un peuple désormais disparu, mais dont l'héritage coule toujours au fond de leurs veines. Ce don les relie non pas par le sang, mais par leur appartenance à l'Entre-Monde, à la terre même qu'ils foulent à chaque instant. Toute l'énergie présente autour d'eux résonne de cet appel ancestral, celui de leurs aïeux, les Géants.",
    passifTexte:
      "Âme de Géant : lors d'un jet d'Arcane, si le résultat obtenu est 6, il n'y a pas d'Effet Aléatoire. À la place, cela appelle en vous votre Âme de Géant, et l'effet du sort lancé est ainsi décuplé.",
    passifs: [
      {
        id: 'ame-de-geant',
        libelle: 'Âme de Géant',
        declenchement: { kind: 'permanent' },
        effet: {
          texte:
            "Sur un 6 en Arcane, pas d'Effet Aléatoire : votre Âme de Géant résonne, et l'effet du sort est décuplé.",
          regles: [{ kind: 'ame-de-geant' }],
        },
      },
    ],
    sortsIds: ['terraformation', 'river-song', 'burning-soul'],
  },
  {
    kind: 'classe',
    id: 'eclipsed',
    nom: 'Eclipsed',
    icone: 'eclipse-flare',
    seed: true,
    fatigueMax: 4,
    sixthSensBase: 1,
    lore:
      "Ombre et Lumière. Deux faces d'une même pièce. Deux énergies que tout oppose, et pourtant qui restent intimement liées. Chaque personne porte un peu de cette ambiguïté en soi, mais certains êtres l'expriment de manière plus prononcée. Plus intense. Plus violente. Ces êtres sont la Lumière dans la nuit, l'Ombre qui obscurcit l'espoir. Des éclipses vivantes.",
    passifTexte:
      "De par leur nature ambivalente, les Eclipsed ont une plus grande tolérance à l'Oblivion : leur quota de Marques passe de 3 à 4, ce qui les rend plus difficiles à basculer du côté obscur. Mais s'iels atteignent le palier maximal, l'Eclipsed se laisse submerger par sa part d'ombre et révèle la face cachée de son existence. Lumière : l'Eclipsed peut sciemment prendre une Marque pour réussir automatiquement un Jet d'Arcane ou de Compétence. Ombre : vous oubliez tous vos sorts traditionnels (Arcane, Miracle ou Sang), remplacés par vos sorts Ombre ; vous devez choisir un sort Ombre comme action du tour, et chacun consomme une ou plusieurs Marques. L'Eclipsed revient à l'état Lumière lorsque ses Marques retombent à zéro.",
    passifs: [
      {
        id: 'tolerance-oblivion',
        libelle: "Tolérance à l'Oblivion",
        declenchement: { kind: 'permanent' },
        effet: {
          texte: 'Votre quota de Marques passe de 3 à 4.',
          operations: [
            {
              kind: 'ajuster',
              cible: { element: { kind: 'marques' }, aspect: 'plafond' },
              op: { kind: 'add', value: 1 },
            },
          ],
        },
      },
    ],
    choix: [
      {
        id: 'etat',
        libelle: 'État',
        /*
         * Un état qui dure : il ne bascule qu'aux extrémités de la jauge, et
         * jamais par la main de la joueuse. D'où un défaut — une Eclipsed neuve
         * est dans la Lumière — lu plutôt qu'écrit à la création.
         */
        verrou: 'automatique',
        defaut: 'lumiere',
        options: [
          {
            id: 'lumiere',
            nom: 'Lumière',
            effet: "Prenez une Marque pour réussir d'office un Jet d'Arcane ou de Compétence",
            bascule: { element: { kind: 'marques' }, comparaison: 'au-plus', seuil: 0 },
            passifs: [
              {
                id: 'lumiere',
                libelle: 'Lumière',
                declenchement: { kind: 'permanent' },
                effet: {
                  texte:
                    "Vous pouvez sciemment prendre une Marque pour réussir automatiquement un Jet d'Arcane ou de Compétence.",
                  regles: [
                    {
                      kind: 'reussite-automatique',
                      cout: coutDe(fixe('marques', 1, { sens: 'prendre' })),
                    },
                  ],
                },
              },
            ],
          },
          {
            id: 'ombre',
            nom: 'Ombre',
            effet: 'Vos sorts traditionnels sont oubliés : seuls vos sorts Ombre restent lançables',
            bascule: { element: { kind: 'marques' }, comparaison: 'au-moins', seuil: 'plafond' },
            passifs: [
              {
                id: 'ombre',
                libelle: 'Ombre',
                declenchement: { kind: 'permanent' },
                effet: {
                  texte:
                    "Vous oubliez vos sorts traditionnels : seuls vos sorts Ombre restent lançables, et l'un d'eux doit être votre action du tour. Chacun consomme des Marques ; à zéro, vous revenez à la Lumière.",
                  regles: [{ kind: 'sorts-suspendus' }],
                },
              },
            ],
          },
        ],
      },
    ],
    // Les sorts Ombre ne figurent pas ici : l'état y donne accès, ils ne se possèdent pas.
    sortsIds: ['couleur-rouge', 'animate', 'draw', 'vision-artiste'],
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
// Types magiques
// ---------------------------------------------------------------------------

/**
 * Les trois types magiques d'origine.
 *
 * ⚠️ **Leurs identifiants sont ceux que `Sort.magie` portait** — `arcane`,
 * `sang`, `miracle` — pour que les sorts déjà en base s'y rattachent sans
 * conversion. Les renommer délierait tout le contenu existant.
 *
 * La MJ peut en créer d'autres depuis son écran : c'est ce que le champ
 * `cristal` rend possible sans toucher au code, là où la mécanique de l'Hexite
 * était câblée sur le seul Arcane.
 */
const TYPES_MAGIQUES: TypeMagique[] = [
  {
    kind: 'type-magique',
    id: 'arcane',
    nom: 'Arcane',
    icone: 'crystal-shine',
    seed: true,
    description:
      "La magie des cristaux d'Hexite. Un jet de d6 en décide la puissance, et le cristal s'épuise sur un 1 ou un 2.",
    deParDefaut: '1d6',
    cristal: true,
  },
  {
    kind: 'type-magique',
    id: 'sang',
    nom: 'Magie du Sang',
    icone: 'fire-ray',
    seed: true,
    description:
      'La magie qui se paie en brûlures. Neuf marques consommées, et c’est la Combustion.',
    elementCoutParDefaut: 'brulures',
  },
  {
    kind: 'type-magique',
    id: 'miracle',
    nom: 'Miracle',
    icone: 'healing',
    seed: true,
    description: 'La magie de la Lumière, qui se paie en Points de Foi.',
    elementCoutParDefaut: 'foi',
  },
  {
    kind: 'type-magique',
    id: 'ombre',
    nom: 'Ombre',
    icone: 'shadow-grasp',
    seed: true,
    description:
      "La part d'ombre des Eclipsed. Ses sorts ne s'ouvrent qu'une fois l'Oblivion atteint, et consomment des Marques.",
    elementCoutParDefaut: 'marques',
  },
]

// ---------------------------------------------------------------------------

/*
 * Les sorts des trois classes venues ensuite ferment la liste : l'amorçage
 * écrit dans l'ordre, et les tests d'app attendent la dernière clé — `void-call`
 * — pour savoir que tout est en place.
 */
export const SEED: EntreeCatalogue[] = [
  ...CLASSES,
  ...TYPES_MAGIQUES,
  ...SORTS_DUSK,
  ...SORTS_SOULSHIFTER,
  ...SORTS_TRICKSTER,
  ...EQUIPEMENTS,
  ...INVESTISSEMENTS,
  ...SORTS_ASTROMANCIEN,
  ...SORTS_EARTHBORN,
  ...SORTS_ECLIPSED,
]
