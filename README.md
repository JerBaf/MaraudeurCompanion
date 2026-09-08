# Maraudeur Companion

Companion app de table pour le jeu de rôle **Entre-Monde**.
La MJ pilote depuis un ordinateur, les joueuses depuis leur téléphone, et tout
se synchronise en temps réel.

**En service à la table.** La fiche de personnage et la phase Standard, le mode Combat,
le Feu de Camp, le Combat rapide, les Quêtes, les Notifications poussées sur l'écran
d'une joueuse, et les jets de dés — au choix de chacune, dans l'app ou saisis après un
lancer physique. La MJ saisit son contenu depuis l'éditeur de catalogue.

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

> ⚠️ **À republier après chaque mise à jour qui touche ce fichier.** Les règles
> ne sont pas déployées par le CI : elles ne vivent que dans la console Firebase,
> et une collection ajoutée au code sans sa règle est refusée en production —
> silencieusement du point de vue de la table, qui voit juste une action « qui ne
> marche pas ». C'est arrivé pour `duels/` et `notifications/`, ajoutées après
> le bestiaire.
>
> En cas de doute, republiez : l'opération est idempotente et sans risque.
> `git log -- firebase/firestore.rules` dit quand le fichier a bougé pour la
> dernière fois.

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
  data/       opérations métier sur la table — `repo`, le seul écrivain
  hooks/      abonnements et préférences d'appareil
  screens/    écrans joueuse et MJ
  components/ avatar, compteurs, icônes, lanceur de dés
firebase/     règles de sécurité Firestore
scripts/      téléchargement des icônes
```

`src/domain/` ne dépend de rien : c'est ce qui permet de tester les règles sans
navigateur, et c'est là que vivent les décisions délicates (moteur de
modificateurs, Détachement, Combustion, cycles).

> **Pour aller plus loin**, tout est dans [`docs/PASSATION.md`](docs/PASSATION.md) :
> l'architecture détaillée et l'ordre des couches (§2), les abstractions centrales —
> moteur de modificateurs, horloge de combat, jets de dés (§3), le modèle Firestore
> et ce qui doit rester secret (§4), les décisions de règles arrêtées avec la MJ (§5),
> et surtout **les pièges** (§6), qui est la section à lire avant de toucher au code.
>
> Ce README s'arrête volontairement à l'installation et à l'exploitation : ce qui
> était redit aux deux endroits finissait par y diverger.

---

## Décisions de règles

Les PDF laissaient des points ouverts ; ils ont été tranchés avec la MJ et sont
consignés une seule fois, dans
[`docs/PASSATION.md` §5](docs/PASSATION.md) — une cinquantaine d'entrées, des
Points de Fatigue par classe au Jet d'Arcane, en passant par qui lance les dés.

Ce README en portait un extrait plus court, qui avait déjà divergé sur deux
points. Une décision de règle se lit désormais à un seul endroit.

---

## Icônes

Les icônes viennent de [game-icons.net](https://game-icons.net), sous licence
[CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) — voir
[`public/icons/CREDITS.md`](public/icons/CREDITS.md).

Pour remplacer une icône par un dessin à vous (style Moebius ou Ghibli), déposez
votre fichier dans `public/icons/` sous le même nom : aucun code à toucher, et
`npm run icons` ne l'écrasera pas. Le script régénère `src/content/icones.ts`,
la liste que proposent les sélecteurs d'icônes du bestiaire et du catalogue.

---

## Une limite à connaître

**L'amorçage n'écrase jamais une entrée existante.** C'est volontaire — sans quoi
il effacerait vos modifications à chaque déploiement. Mais cela signifie que le
contenu livré avec l'app n'atteint **pas** une base déjà initialisée.

Conséquence pratique : tout ce qui doit évoluer passe par l'éditeur de catalogue,
ou est **dérivé** plutôt que stocké (c'est ainsi que les illusions du Trickster
sont devenues visibles sans migration). Le bouton « Réinitialiser le catalogue »
force la réécriture, mais écrase aussi vos propres entrées.
