# Maraudeur Companion

Companion app de table pour le jeu de rôle **Entre-Monde**.
La MJ pilote depuis un ordinateur, les joueuses depuis leur téléphone, et tout
se synchronise en temps réel.

État : **lots 1 et 2 livrés** — socle technique, phase Standard et mode Combat.
Le Feu de Camp (lot 3) suivra.

---

## Essayer tout de suite, sans rien configurer

```bash
npm install
npm run dev
```

Ouvrez **deux onglets du même navigateur** sur l'adresse affichée :

| Onglet | Connexion | Ce que vous voyez |
|---|---|---|
| 1 | onglet **MJ**, PIN `1234` | l'écran de supervision |
| 2 | onglet **Joueuse**, code `ENTREMONDE` | la création puis la fiche |

Connectez-vous **en MJ d'abord** : le catalogue s'installe à ce moment-là.
Modifiez ensuite une compétence côté MJ, l'écran joueuse bouge immédiatement.

> ⚠️ **Deux navigateurs différents ne partagent rien.**
> En mode local, les données vivent dans le `localStorage`, qui est cloisonné
> par navigateur : un onglet Firefox et un onglet Chrome sont deux tables
> distinctes, même sur la même adresse. Le catalogue amorcé dans l'un reste
> invisible dans l'autre.
>
> Pour faire dialoguer deux **appareils** (votre ordinateur et le téléphone
> d'une joueuse), il n'y a pas de raccourci : il faut configurer Firebase.

Le rôle est stocké dans le `sessionStorage`, propre à chaque onglet — c'est ce
qui permet d'être MJ dans l'un et joueuse dans l'autre en même temps.

> Le mode local n'offre **aucune sécurité réelle** : il sert à découvrir et à
> développer, jamais à une vraie session.

---

## Passer à la vraie table

### 1. Créer le projet Firebase

1. Sur [console.firebase.google.com](https://console.firebase.google.com),
   créez un projet (plan **Spark**, gratuit — largement suffisant pour six
   personnes et quelques sessions par mois).
2. **Firestore Database** → créer une base, en mode production.
3. **Authentication** → activer le fournisseur **Email/Password**, puis créer
   deux comptes :

   | Adresse | Mot de passe | Rôle |
   |---|---|---|
   | `table@maraudeur.local` | votre **code de table** | joueuses |
   | `mj@maraudeur.local` | votre **PIN MJ** | vous |

   Ce sont ces mots de passe que vous saisirez à l'écran de connexion. Pour
   changer le code de table plus tard, changez le mot de passe du premier compte.

### 2. Publier les règles de sécurité

Copiez le contenu de [`firebase/firestore.rules`](firebase/firestore.rules)
dans **Firestore → Règles**, puis **Publier**.

> ⚠️ **À republier après le lot 2** : le bestiaire a besoin de sa règle, et la
> règle du combat a été resserrée pour qu'une joueuse ne puisse plus faire
> avancer le tour.

⚠️ **Ne sautez pas cette étape.** C'est le seul mécanisme qui empêche une
joueuse de lire son nombre de cycles restants — et donc de savoir combien de vies
il lui reste, ce que le système veut précisément lui cacher.

### 3. Renseigner la configuration

Dans **Paramètres du projet → Vos applications → Web**, copiez l'objet de
configuration et collez-le dans [`src/config.ts`](src/config.ts) :

```ts
export const FIREBASE_CONFIG: FirebaseOptions | null = {
  apiKey: '…',
  authDomain: '…',
  projectId: '…',
  // …
}
```

Dès que cette valeur n'est plus `null`, l'app bascule sur Firestore.

> **Pourquoi ces valeurs peuvent être commitées dans un repo public ?**
> La configuration web Firebase n'est pas un secret : elle est de toute façon
> lisible dans le JavaScript livré au navigateur. Ce qui protège vos données,
> ce sont les règles de sécurité et les mots de passe des deux comptes — jamais
> l'obscurité de ces identifiants.

### 4. Activer la publication

Dans le repo GitHub : **Settings → Pages → Source : GitHub Actions**.

Ensuite, chaque `git push` sur `main` lance les tests, construit le site et le
publie sur `https://jerbaf.github.io/MaraudeurCompanion/`. Vous n'avez jamais de
build à faire à la main.

### 5. Première connexion

Connectez-vous **en MJ d'abord** : le catalogue (3 classes et leurs sorts)
s'installe automatiquement. Les joueuses peuvent ensuite créer leur personnage.

---

## Commandes

| Commande | Effet |
|---|---|
| `npm run dev` | serveur de développement |
| `npm test` | tests des règles du jeu et de l'aiguillage des écrans |
| `npm run typecheck` | vérification TypeScript stricte |
| `npm run build` | construction du site |
| `npm run icons` | télécharge les icônes manquantes depuis game-icons.net |

---

## Organisation du code

```
src/
  domain/     ⭐ les règles du jeu — TypeScript pur, sans React ni Firebase
  content/    le contenu livré (classes, sorts, équipement de base)
  store/      stockage temps réel : implémentation locale et Firestore
  data/       opérations métier sur la table (repo)
  screens/    écrans joueuse et MJ
  components/ avatar, compteurs, icônes
firebase/     règles de sécurité Firestore
scripts/      téléchargement des icônes
```

`src/domain/` ne dépend de rien : c'est ce qui permet de tester les règles sans
navigateur, et c'est là que vivent les décisions délicates (moteur de
modificateurs, Détachement, Combustion, cycles).

### Le moteur de modificateurs

Aucune valeur affichée n'est stockée. Compétences, Évasion, 6th Sens et coûts de
sorts sont recalculés à chaque rendu :

```
valeur affichée = base + Σ(modificateurs explicites) + Σ(modificateurs dérivés)
```

Les modificateurs *dérivés* — Voie de la Flamme, Overdrive, Conteur, armure
équipée — ne sont jamais écrits en base : ils se recalculent depuis l'état du
personnage et ne peuvent donc pas se désynchroniser. Si les brûlures passent de
3 à 5, le point de 6th Sens supplémentaire apparaît sans qu'aucun écran n'ait eu
à y penser.

---

## Décisions de règles

Quelques points que les PDF laissaient ouverts, tranchés avec la MJ :

| Point | Décision |
|---|---|
| Points de Fatigue | Dusk Hunter **5**, Soulshifter **4**, Trickster **4** |
| Arcane, d6 → Points d'Énergie | PE = résultat du dé (1→1 … 6→6) |
| Cristal épuisé | sur **1 et 2** (le texte fait foi sur la table du PDF) |
| Pool du Détachement | tous les sorts et équipements possédés, **sac à dos compris** ; hors améliorations et matériel de base |
| Feu de camp | qualifié **repos court** ou **fin de journée** — seul le second rend le 6th Sens et lève Fardeaux, Serments et Marques journalières |
| Dés | physiques à table ; l'app ne tire que le Détachement, les osselets, la personnalité Soulshifter et les risques d'investissement |
| Cycles (1d4+2) | **saisis à la main par la MJ** depuis son écran, modifiables à tout moment. Jamais tirés par l'app : la valeur ne doit à aucun moment transiter par l'appareil d'une joueuse |
| Bestiaire | écrit par la MJ, **hors du catalogue** : celui-ci est lisible par les joueuses, y ranger les Évasions et les seuils aurait tout révélé |
| Seuil de Fatigue d'un adversaire | 🔒 jamais dans le document que lisent les joueuses ; elles ne voient que les dégâts cumulés |
| Fin de combat | efface adversaires, initiatives et effets de tour, après confirmation |
| Voie de la Flamme | paliers **cumulatifs** : à 7 brûlures on conserve le 6th Sens du seuil 4 et on gagne l'avantage en Physique |
| Illusions du Trickster | disponibles en permanence, **hors des 3 emplacements** du Grimoire ; toute illusion acquise plus tard l'est aussi |

Les seuils de la Voie de la Flamme sont déclarés dans `PALIERS_FLAMME`
([`src/domain/modifiers.ts`](src/domain/modifiers.ts)) : en ajouter un revient à
ajouter une entrée, sans toucher au calcul ni aux écrans.

---

## Icônes

Les icônes viennent de [game-icons.net](https://game-icons.net), sous licence
[CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) — voir
[`public/icons/CREDITS.md`](public/icons/CREDITS.md).

Pour remplacer une icône par un dessin à vous (style Moebius ou Ghibli), déposez
votre fichier dans `public/icons/` sous le même nom : aucun code à toucher, et
`npm run icons` ne l'écrasera pas.
