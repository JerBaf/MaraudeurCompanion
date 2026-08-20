# Passation — Maraudeur Companion

Document destiné à un agent qui reprend le projet. **Lisez d'abord les trois PDF de
`docs/`** (`Rules_For_Agents.pdf`, `Classes.pdf`, `Guidelines.pdf`) : ce document suppose
les règles du jeu connues et porte sur le code, l'architecture, les décisions et les
pièges.

Lisez aussi [`CLAUDE.md`](../CLAUDE.md) à la racine : il fixe les contraintes de travail
et prime sur vos habitudes.

---

## 1. État du projet

Companion app de table pour le JDR maison « Entre-Monde ». La MJ (Jeremy) pilote depuis
un ordinateur, les joueuses depuis leur téléphone, tout se synchronise en temps réel.

**En ligne :** `https://jerbaf.github.io/MaraudeurCompanion/`
**Dépôt public :** `JerBaf/MaraudeurCompanion`

| Commande | Effet |
|---|---|
| `npm run dev` | serveur de développement |
| `npm test` | 173 tests — 145 de domaine, 28 de rendu |
| `npm run typecheck` | TypeScript strict |
| `npm run build` | `tsc --noEmit && vite build` |
| `npm run icons` | télécharge les icônes manquantes et régénère `src/content/icones.ts` |

Un `git push` sur `main` déclenche GitHub Actions : tests → build → publication.
**Les tests bloquent le déploiement** — un test rouge, et le site n'est pas mis à jour.

### Ce qui fonctionne

Les trois lots sont livrés : socle et phase Standard, mode Combat, Feu de Camp.
Création de personnage, fiche vivante, moteur de modificateurs, secret des cycles,
combat complet (initiative, adversaires, dégâts partagés, actions alternatives),
feu de camp (cinq phases au camp initial, trois au repos court), bestiaire, éditeur de
catalogue.

### Ce qui reste

- **Le contenu.** Le catalogue ne contient que quelques exemples. La MJ doit saisir ses
  vrais équipements, améliorations et investissements via l'éditeur (Réglages).
  **N'écrivez pas ce contenu en dur** — voir le piège n° 1.
- **Les icônes.** 66 icônes `game-icons.net` (CC-BY), dont une palette d'armes, armures,
  bibelots et symboles proposée à la MJ (`PALETTE` dans `scripts/fetch-icons.mjs`). Elle
  veut à terme des dessins style Moebius/Ghibli ; déposer un fichier de même nom dans
  `public/icons/` suffit — le script n'écrase jamais un fichier existant.
- **Les upgrades annoncées** dans `Guidelines.pdf`, non commencées : nouvelles classes,
  QTE (mini-jeux poussés sur l'écran d'une joueuse), combat rapide type
  pierre-feuille-ciseau. Le champ `EtatTable.overlay` existe pour les accueillir.

---

## 2. Architecture

```
src/
  domain/      ⭐ les règles du jeu. TypeScript pur : ni React, ni Firebase, ni DOM.
  content/     le contenu livré (classes, sorts, exemples, rappels de règles)
  store/       stockage temps réel : implémentation locale et Firestore
  data/repo.ts opérations métier sur la table — le seul écrivain
  screens/     écrans joueuse et MJ
  components/  avatar, compteurs, icônes, objets dépliables, éditeur de passifs
firebase/      règles de sécurité Firestore
scripts/       téléchargement des icônes
```

**Règle de dépendance, à ne pas enfreindre :** `domain/` ne dépend de rien.
C'est ce qui permet de tester toutes les règles du jeu sans navigateur, en quelques
millisecondes, et c'est là que vivent les décisions délicates. Si vous êtes tenté
d'importer React ou Firestore dans `domain/`, c'est que la logique n'est pas à sa place.

Le flux est à sens unique :

```
Firestore ──> store ──> repo (souscriptions) ──> hooks ──> écrans
                 ^                                            │
                 └──────────── repo (écritures) <─────────────┘
```

`store/` expose une interface (`Store`) implémentée deux fois : `local.ts`
(localStorage + BroadcastChannel) et `firestore.ts`. Les écrans ne connaissent que
l'interface. Le choix se fait au chargement dans `store/index.ts`.

---

## 3. Les deux abstractions centrales

### Le moteur de modificateurs — `domain/modifiers.ts`, `domain/effets.ts`

**Aucune valeur affichée n'est stockée.** Compétences, Évasion, 6ᵉ Sens, Actions Rapides
et coûts de sorts sont recalculés à chaque rendu :

```
valeur affichée = base + Σ(modificateurs explicites) + Σ(modificateurs dérivés)
```

- **Explicites** : persistés dans `Character.modifiers`. Fardeau, Serment, Marque,
  Esquive, Diversion, ajustements de la MJ.
- **Dérivés** : recalculés par `derivedModifiers(char, catalog)`, **jamais écrits en
  base**. Voie de la Flamme, Overdrive, Conteur, bonus d'armure portée, améliorations.

C'est cette séparation qui rend l'exigence « les modificateurs doivent être dynamiques »
tenable : si les brûlures passent de 3 à 5, le point de 6ᵉ Sens supplémentaire apparaît
sans qu'aucun écran n'ait eu à y penser, et rien ne peut se désynchroniser.

> **Les passifs se composent en données, depuis l'écran Réglages.**
> `Equipement.modificateurs` et `Amelioration.modificateurs` sont appliqués par
> `derivedModifiers`, et `EditeurModificateurs` (`components/`) permet à la MJ de les
> saisir : cible — une compétence, toutes, Évasion, 6ᵉ Sens, Points d'Énergie d'attaque —
> et opération — chiffre, avantage, désavantage. **Aucune ligne de code ne connaît le
> talisman qu'elle vient de créer.** Un test de rendu suit ce parcours de bout en bout.
>
> Deux cibles restent hors de l'éditeur, délibérément : `cout-sort` sert au passif Conteur
> et `competence-sauf` au Serment. Ce sont des mécaniques de règle, pas du contenu.

`domain/effets.ts` en donne une vue unifiée pour l'affichage : chaque effet porte une
**origine** parmi six — `choisi`, `feu-de-camp`, `derive`, `equipement`, `mj`,
`temporaire` — qui détermine *qui a le droit de le changer*. C'est cette taxonomie qui
permet à l'écran de n'offrir un contrôle que là où la règle l'autorise.

Deux effets ne passent pas par des modificateurs et c'est voulu :
- **Overheat** (Dusk Hunter) transforme le *gain* de brûlures — c'est un hook,
  `gainBrulureEffectif` dans `magie.ts`.
- **Illusionniste** (Trickster) débloque des sorts — voir `sortsHorsEmplacement`.

### L'horloge de combat — `domain/combat.ts`

Un combat n'avance pas par tours mais par **moments** : chaque tour contient trois
activations (avant la MJ, la MJ, après la MJ), numérotées sur une seule ligne du temps.

```
tour 1 : 0 (avant-mj) · 1 (mj) · 2 (après-mj)
tour 2 : 3 (avant-mj) · 4 (mj) · 5 (après-mj)
```

Indispensable, parce que « jusqu'au prochain tour » ne veut pas dire la même chose selon
qui bénéficie de l'effet, ni selon sa nature :

| Effet | Nature | Vit jusqu'à |
|---|---|---|
| **Esquiver** | défensif | la prochaine activation de la joueuse — il doit couvrir le moment de la MJ, sinon il ne protège de rien |
| **Faire diversion** | offensif | la **fin** de la prochaine activation de la bénéficiaire — celle en cours si c'est déjà son sous-groupe |

Conséquence concrète : une joueuse « après-MJ » qui aide une alliée « avant-MJ » lui donne
un bonus pour le **tour suivant** ; la même aide rendue à quelqu'un de son propre
sous-groupe ne vaut que pour le tour en cours. `echeanceEsquive` et `echeanceDiversion`
calculent ces bornes, `expireModifiers` les applique.

⚠️ **L'expiration est évaluée à chaque changement de sous-groupe**, pas seulement au
changement de tour (`avancerSousGroupe` dans `repo.ts`). Simplifier cela casse la règle.

---

## 4. Modèle Firestore et sécurité

### Le principe qui commande tout le découpage

**Firestore ne sait pas restreindre la lecture champ par champ.** Un document lisible est
lisible *en entier*, quelle que soit l'interface. Masquer une valeur à l'écran ne protège
rien : la console du navigateur la révèle.

Tout ce qui doit rester secret vit donc dans une **collection ou un document séparé**,
refusé aux joueuses par les règles.

```
/tables/entre-monde/
  state/current              public  mode · combat · campfireId · sessionId · overlay
  characters/{id}            public  la fiche — tout ce que les joueuses peuvent voir
  adversaries/{id}           public  nom · evasion · evasionPublique · degatsSubis · icone
  catalog/{id}               public  classes, sorts, équipements, améliorations, investissements
  campfires/{id}             lecture publique, écriture MJ — un camp LANCÉ : phase · brief · offres
  sessions/{id}              lecture publique, écriture MJ — numero · ouverteLe

  secrets/{characterId}      🔒 MJ   cyclesTotal · cyclesConsommes · notesMJ
  secrets/adversaires        🔒 MJ   seuils de Fatigue des adversaires en jeu
  secrets/campfire-brouillon 🔒 MJ   le camp EN PRÉPARATION
  bestiary/{id}              🔒 MJ   modèles de créatures : évasion, seuil
  log/{id}                   🔒 MJ   journal — écriture ouverte, lecture réservée
```

Quatre secrets, quatre raisons :

- **Les cycles** (`1d4+2`, combien de vies reste-t-il) : le PDF insiste, la joueuse ne
  doit *jamais* les connaître. Ils ne transitent même pas par son appareil — la MJ les
  saisit à la main sur son écran.
- **Le bestiaire** : contient l'Évasion et le seuil de Fatigue de chaque créature, y
  compris celles dont l'Évasion est volontairement masquée en combat. Le ranger dans
  `catalog/` aurait tout révélé.
- **Les seuils d'adversaires** : les joueuses voient les dégâts *cumulés*, jamais la
  réserve restante. C'est la MJ qui annonce la chute.
- **Le brouillon de camp** : les joueuses lisent toute la collection `campfires`. Y
  écrire une préparation leur livrerait le brief et les offres avant l'annonce.
  **Lancer un camp, c'est publier le brouillon.**

### Authentification

Deux comptes Firebase Auth (Email/Password), pas de serveur :

| Compte | Mot de passe | Rôle |
|---|---|---|
| `table@maraudeur.local` | le **code de table** | joueuses |
| `mj@maraudeur.local` | le **PIN MJ** | la MJ |

Les règles distinguent les rôles sur l'adresse du compte (`request.auth.token.email`),
pas sur un drapeau applicatif : un écran ne peut pas s'auto-proclamer MJ.

**Compromis assumé et documenté :** toutes les joueuses partagent un UID. Les règles ne
peuvent donc pas empêcher Maya d'éditer la fiche de Lila. L'appartenance est gérée au
niveau applicatif (l'appareil « réclame » un personnage via `claimedBy`). Acceptable
pour une table entre amies, pas contre un adversaire.

La configuration Firebase est dans `src/config.ts`, commitée dans un dépôt public.
**C'est normal** : elle est de toute façon lisible dans le JavaScript livré. Ce qui
protège, ce sont les règles et les deux mots de passe.

---

## 5. Décisions de règles arrêtées avec la MJ

Les PDF laissaient des points ouverts. Voici ce qui a été tranché, et pourquoi.
**Ne revenez pas dessus sans le lui demander.**

| Point | Décision | Raison |
|---|---|---|
| Points de Fatigue | Dusk Hunter **5**, Soulshifter **4**, Trickster **4** | absent des PDF, choisi par la MJ |
| Arcane, d6 → Points d'Énergie | PE = résultat du dé | lecture la plus directe |
| Cristal épuisé | sur **1 et 2** | le texte fait foi contre la table du PDF, qui se contredisait |
| Pool du Détachement | tous sorts et équipements possédés, **sac à dos compris** ; hors améliorations et matériel de base | le PDF exclut explicitement les améliorations |
| Voie de la Flamme | paliers **cumulatifs** | à 7 brûlures on garde le 6ᵉ Sens du seuil 4 |
| Illusions du Trickster | **dérivées du passif**, pas possédées | « donne accès à » ≠ « possède » |
| Marques | plafond **3**, rien d'automatique | la MJ dépense à la main |
| Feu de camp | qualifié **initial** ou **repos court** ; la notion de journée de fiction est abandonnée | un camp initial ouvre la session : il rend 1 Point de Fatigue, le 6ᵉ Sens et les Actions Rapides, lève Fardeaux/Serments/Marques et ouvre Banque, Brief et gains de Foi. Un repos court ne rend que les cristaux et n'ouvre que Boutique, Grimoire, Armurerie |
| Jetons de camp | portés par la **fiche**, et datés (n° de session, id de camp) | voir piège n° 8 |
| Ouverture de session | **le camp initial l'ouvre**, dans le même geste | deux boutons distincts pouvaient être joués dans le désordre : deux camps initiaux d'affilée laissaient les joueuses bloquées à la Banque |
| Points de Foi | remis à **2** à chaque camp initial | contre le PDF, qui les conservait « de jour en jour » ; décision de la MJ |
| Recueillir | l'app **tire la thématique**, la joueuse écrit dans son carnet | un seul tirage, sans relance ; rien de ce qu'elle rédige ne transite par l'app. Liste dans `src/content/questions-recueil.json` |
| Fardeau / Fatigue | la case **change de fiche** | prendre un point « à la place » d'une autre PJ doit la soulager ; seules les alliées ayant une case cochée sont proposées |
| Osselets | toutes les faces sauf le **4** brûlent | seule la face 4 est vierge ; Overheat ajoute 1 au **total** du jet, pas 1 par dé |
| Brûlures | deux compteurs : **acquises** et **consommées** | une brûlure dépensée ne disparaît pas, elle devient inactive — voir l'encadré ci-dessous |
| Combustion | à la **neuvième consommée**, jamais au gain | accumuler neuf marques sans en dépenser aucune ne brûle personne |
| Voie de la Flamme | lue sur les brûlures **acquises** | la marque reste sur la peau une fois dépensée, donc le palier tient |
| Sorts et classes | `classesIds`, plusieurs classes possibles ; vide = ouvert à toutes | la boutique ne propose que le générique et la classe de la joueuse |
| Objets à effets actifs | une table `1d{faces}`, une contrepartie parmi trois | même modèle pour l'Attaque Spéciale d'une arme et pour une potion — une table à une face rend l'effet déterministe |
| Charges | par identifiant d'objet, sur la fiche ; **clé absente = objet au complet** | évite d'initialiser à chaque acquisition — achat, don de la MJ, fiche ancienne |
| Recharge | **à la main par la MJ**, jamais au feu de camp | le PDF attache un rituel propre à chaque objet ; c'est la fiction qui décide |
| Consommable | charges non rechargeables ; à zéro l'objet est **détruit et déséquipé** | cas dégénéré des charges, pas un second mécanisme |
| Passifs de sorts | **non** : seuls équipements et améliorations en portent | un passif permanent se modélise par une amélioration ; évite un troisième régime d'activation |
| Plafonds de ressource | **dérivés**, comme le 6ᵉ Sens | une dague qui coûte un Point de Fatigue rend la case dès qu'on la range |
| Passifs réactifs | « quand telle jauge bouge, telle autre varie », **une seule passe** | voir l'encadré ci-dessous |
| Usage d'un objet | depuis la **fiche**, sous l'avatar, donc seulement s'il est **porté** | le PDF limite la joueuse à ses trois emplacements pendant la session |
| Rareté | palette nommée, `Equipement.rarete` ; absent = commun | la couleur veut dire quelque chose à table, et suit l'objet partout |
| Entrées `seed` | **supprimables** | le drapeau ne sert plus qu'à les faire revenir à la réinitialisation |
| Cristal épuisé | signalé **par la joueuse**, sur un sort d'Arcane préparé | elle lance son d6 à table ; seul un sort préparé peut être lancé, donc s'épuiser |
| Inventaire joueuse | chaque onglet montre **tout**, marqué de ce qui est en jeu | comparer un objet porté à un objet en réserve demandait deux onglets |
| Résolution du camp | à **l'ouverture** | voir piège n° 4 |
| Session | ouverte par le lancement d'un camp initial | c'est là que les investissements rendent leurs comptes |
| Cycles | **saisis à la main** par la MJ | ne doivent jamais transiter par l'appareil d'une joueuse |
| Dés | physiques à table | l'app ne tire que le Détachement, les osselets, la personnalité Soulshifter et les risques d'investissement |
| Combat | la joueuse saisit jet et cible, l'app applique | la MJ peut corriger |
| Offres de boutique | tirage assisté que la MJ ajuste | 3 offres × 5 joueuses = trop de choix manuels |
| Rythme du camp | la MJ pilote la phase | garde la table groupée |
| Écran MJ pendant le camp | **miroir** de l'écran d'une joueuse, actions neutralisées, contrôles d'édition à leur place | un seul rendu à maintenir ; permet de retoucher brief et offres camp lancé |

### Les passifs réactifs passent par un point unique

`resoudreDeclencheurs` (`domain/declencheurs.ts`) compare l'état d'avant à celui d'après et
applique ce qui s'est armé. Elle est appelée depuis **`modifierPersonnage` et nulle part
ailleurs** : c'est le seul endroit qui dispose des deux états. La brancher dans les écrans
aurait produit des déclencheurs qui partent ou non selon qui a bougé la ressource — c'est
d'ailleurs pourquoi l'écran MJ est passé de `enregistrerPersonnage` à `modifierPersonnage`.

Trois bornes à ne pas lever :

- **une seule passe** : un déclencheur ne peut pas en réveiller un autre. Sans cela,
  « +1 Foi quand la Foi augmente » bouclerait à l'infini ;
- **le résultat reste borné** par les plafonds dérivés — un déclencheur ne fait pas déborder
  une jauge, et quand rien ne bouge il ne raconte rien ;
- **même régime d'activation que les modificateurs** : objet porté, amélioration possédée.

⚠️ Un déclencheur ne produit **aucun modificateur** — il réagit au lieu d'ajuster. `effetsActifs`
(`domain/effets.ts`) part des modificateurs : il faut donc l'y ajouter explicitement, sans quoi
une amélioration qui n'accorde qu'un passif réactif n'apparaît nulle part. Même piège pour tout
passif futur qui ne passerait pas par le moteur — c'est déjà le cas d'Overheat et d'Illusionniste.

`modifierPersonnage` lit le catalogue dans `catalogueCourant`, un cache alimenté par
`surCatalogue`. Tant qu'il est nul — avant la première réponse — aucun déclencheur ne part,
ce qui est le bon comportement : rien ne doit s'appliquer sur un catalogue inconnu.

### Les brûlures se comptent deux fois

C'est la règle la plus facile à re-simplifier par erreur. Une brûlure **acquise** ne
disparaît pas quand on la dépense : la marque reste sur la peau, seule son usage est
consommé. D'où deux champs sur la fiche :

```
brulures            marques acquises, plafonnées à 9  → porte la Voie de la Flamme
bruluresConsommees  part déjà dépensée               → la 9ᵉ déclenche la Combustion
disponibles = brulures − bruluresConsommees          → ce qui paie encore un sort
```

Trois conséquences qu'un seul compteur ne peut pas rendre :

- **Gagner des brûlures ne brûle jamais.** `appliquerGainBrulures` plafonne à 9 et
  s'arrête là ; le surplus est perdu. C'est `consommerBrulures` qui déclenche la
  Combustion, à la neuvième dépensée — 1 Point de Fatigue, et les deux compteurs
  repartent à zéro.
- **Les paliers se lisent sur l'acquis.** Une joueuse à 8 acquises / 8 consommées n'a
  plus rien à dépenser mais garde ses deux paliers de la Voie de la Flamme.
- **La Combustion volontaire donne 9 brûlures *dépensables*** (`bruluresConsommees: 0`)
  contre 1 Point de Fatigue. La ramener à « 9 consommées » lui retirerait tout intérêt.

La barre de neuf pastilles porte les deux compteurs à la fois : un clic marque la brûlure
acquise (orange), un deuxième la marque dépensée (rouge), un troisième l'efface —
`basculerCaseBrulure` dans `magie.ts`. Les deux compteurs étant des **préfixes**, effacer
une case efface aussi tout ce qui la suit ; une barre trouée n'aurait pas de sens.

---

## 6. ⚠️ Pièges, bugs et corner cases

**La section la plus importante de ce document.**

### 6.1 Pièges structurels — ils ont déjà mordu trois fois

#### Piège n° 1 : l'amorçage n'écrase jamais

`amorcerSiNecessaire` (`repo.ts`) n'écrit une entrée de catalogue **que si elle n'existe
pas**. C'est volontaire — sinon chaque déploiement effacerait les modifications de la MJ.

**Conséquence : le contenu que vous écrivez dans `src/content/seed.ts` n'atteindra
jamais une base déjà initialisée.** Modifier la description d'un sort dans le seed n'a
aucun effet sur la table réelle.

Ce piège a coûté un aller-retour complet sur les illusions du Trickster. Les parades,
par ordre de préférence :

1. **Dériver plutôt que stocker** — la capacité se recalcule depuis l'état, donc elle
   apparaît immédiatement partout ;
2. **Passer par l'éditeur de catalogue** (Réglages) — c'est la voie prévue pour le
   contenu ;
3. En dernier recours, le bouton « Réinitialiser le catalogue », qui **écrase aussi les
   entrées de la MJ**.

#### Piège n° 2 : ajouter un champ à `Character` ne l'ajoute pas aux fiches existantes

Un document Firestore écrit hier ne contient pas le champ ajouté aujourd'hui. Le type
`Character` le déclare pourtant obligatoire : **le compilateur est rassurant à tort**, et
le premier `.filter()` lève une erreur en pleine session.

Survenu trois fois — illusions, catalogue, puis `investissements` (qui faisait planter
« Ouvrir une nouvelle session »).

**Parade en place :** `normaliserPersonnage` (`domain/character.ts`), appliquée dans
`surPersonnages` (`repo.ts`), seul chemin par lequel une fiche entre dans l'application.

> **Si vous ajoutez un champ à `Character`, donnez-lui sa valeur neutre dans
> `normaliserPersonnage`.** C'est la seule chose à retenir de cette section.

Trois tests gardent cette régression (`describe('normalisation des fiches lues en base')`).

#### Piège n° 3 : la lecture Firestore est tout-ou-rien

Déjà dit en § 4, mais il mérite d'être répété : **ne mettez jamais une valeur secrète
dans un document public**, même « masquée » à l'écran. Si un champ doit être caché, il
change de document.

### 6.2 Pièges de conception — ne les « simplifiez » pas

#### Piège n° 4 : le camp se résout à l'ouverture, pas à la fermeture

`lancerCampfire` applique `resoudreCampPourPersonnage` à toutes les fiches — Fatigue
rendue, cristaux étudiés, effets de la session écoulée levés.

Le faire à la fermeture **effacerait le Serment que la joueuse vient d'engager à la phase
Grimoire**, alors qu'il vaut pour la session qui commence. Arriver au camp initial clôt la
session écoulée ; ce qu'on y engage vaut pour la suivante.

Un test garde ce cas (`describe('ordonnancement du Feu de Camp')`).

#### Piège n° 8 : un état écrit par la joueuse doit vivre dans un document qu'elle peut écrire

Les jetons de Feu de Camp — Recueillir, Fardeau, Serment, investissement, acquisition —
vivaient dans `sessions/{id}`, dont les règles réservent l'écriture à la MJ. C'est pourtant
l'écran des **joueuses** qui les posait. En local rien ne se voyait (`localStore` n'applique
aucune règle) ; en production les six écritures étaient refusées, et comme chaque handler
écrivait la fiche **avant** le jeton, la récompense partait sans la limite : Foi gagnée en
boucle, achats illimités, « Achat impossible » affiché après un achat réussi.

Deux leçons, l'une de placement, l'autre de forme :

1. **Le document suit le scripteur.** Les jetons sont désormais sur `Character.jetonsCamp`.
   La joueuse écrit déjà sa fiche : aucune règle à ouvrir, plus de clobber entre joueuses
   simultanées, et `normaliserPersonnage` couvre le piège n° 2 gratuitement.
2. **Un jeton porte sa portée dans sa valeur**, pas dans un booléen qu'il faudrait penser à
   remettre à zéro — c'est ce qui manquait à `achatFaitCeCamp`, jamais réinitialisé, si bien
   qu'« une acquisition par feu de camp » se comportait en « une par session ». Ils retiennent
   maintenant *quand* l'action a eu lieu (numéro de session, identifiant de camp) et la
   disponibilité se dérive. `peutInvestir` va plus loin et ne stocke rien du tout : il lit
   `char.investissements`, qui date déjà chaque prise.

Corollaire général : **le mode local ne prouve rien sur les permissions**. Avant de livrer un
chemin d'écriture nouveau côté joueuse, relisez `firebase/firestore.rules`.

#### Piège n° 5 : l'expiration se compte en activations, pas en tours

Voir § 3. Un bonus défensif et un bonus offensif ne vivent pas jusqu'au même instant.
Quatre tests couvrent les cas décrits par la MJ.

#### Piège n° 6 : les paliers de la Voie de la Flamme se cumulent

Un drapeau `VOIE_FLAMME_CUMULATIVE` a existé, puis a été remplacé par `PALIERS_FLAMME`,
une liste de seuils dont on obtient **tous** ceux atteints. Ajouter un palier = ajouter
une entrée. Ne réintroduisez pas d'énumération exclusive.

#### Piège n° 7 : ce qui ne doit jamais entrer dans un document public

- le seuil de Fatigue d'un adversaire (`instancierAdversaire` ne le recopie pas — un test
  le vérifie sur le JSON réellement écrit) ;
- le nombre de cycles (`creerPersonnage` ne le produit même pas) ;
- le brief et les offres d'un camp non lancé.

### 6.3 Pièges techniques

| Piège | Détail |
|---|---|
| **Deux configs Vite** | `vite.config.ts` et `vitest.config.ts` sont séparés à dessein : vitest 2 embarque Vite 5, le projet utilise Vite 6, et les mélanger fait diverger les types du plugin React. Ne les fusionnez pas. |
| **Les tests forcent le mode local** | `SOUS_TEST` dans `store/index.ts`. Sans cela, la suite dépendrait de la présence d'une config Firebase — elle casserait dès que `src/config.ts` est renseigné, **et bloquerait le déploiement** puisque GitHub Actions lance les tests avant le build. |
| **Polyfill Storage** | `src/test-setup.ts` installe un `localStorage`/`sessionStorage` en mémoire : Node ≥ 22 expose un `localStorage` global inerte, et jsdom ne fournit pas toujours le sien. |
| **`base` de Vite** | `base: '/MaraudeurCompanion/'` — le site est servi sous le nom du dépôt. Les chemins d'assets passent par `import.meta.env.BASE_URL`. |
| **`src/content/icones.ts` est généré** | par `npm run icons`, mais **suivi par git** : le build en dépend. Ne l'éditez pas à la main ; déposez un SVG dans `public/icons/` et relancez le script. |
| **Icônes normalisées** | les SVG de game-icons arrivent en tracé blanc sur carré noir plein. Le script retire le fond et teinte le tracé. Un fichier déposé par la MJ n'est jamais retouché. |
| **Taille du bundle** | ~750 Ko, 196 Ko compressés, dominés par Firebase. Acceptable sur mobile ; un découpage dynamique est possible si le chargement gêne. |

### 6.4 Robustesse connue, non corrigée

À traiter si la table grandit ou si des incohérences apparaissent :

- **Écritures « dernier arrivé gagne ».** `enregistrerPersonnage` fait un `setDoc` du
  document entier. Deux appareils éditant la même fiche s'écrasent mutuellement.
  (Le cas jumeau au feu de camp a disparu avec le piège n° 8 : chaque joueuse n'écrit
  plus que sa propre fiche.)
- **Écritures multiples sans transaction.** `avancerSousGroupe`, `terminerCombat` et
  `lancerCampfire` écrivent N documents en séquence. Une coupure au milieu laisse un
  état partiel.
- **Aucun test automatisé des règles Firestore.** Elles se vérifient à la main dans la
  console du navigateur. L'émulateur Firebase permettrait de les tester, au prix d'une
  dépendance Java.
- **Le mode local est cloisonné par navigateur.** Firefox et Chrome sont deux tables
  distinctes. Pour deux appareils, il faut Firebase.

### 6.5 Corner cases de règles, tranchés mais discutables

Ce sont des interprétations. Si la MJ dit autre chose, elle a raison.

- **Avantage et désavantage s'annulent** un pour un (`netAvantage`). Le PDF ne tranche
  pas ; les listes brutes restent disponibles dans l'agrégat.
- **Les Actions Rapides** se calculent sur le Physique **effectif**, modificateurs
  compris — un Serment peut donc en retirer une.
- **Combustion volontaire** amène à 9 brûlures et les conserve (sinon la manœuvre
  n'aurait aucun intérêt) ; le franchissement **passif** du seuil remet à zéro et le
  dépassement est perdu.
- **Les gains de Foi sont réservés au camp initial.** Le PDF les réserve au « premier feu
  de camp de la journée » ; sans notion de journée, le camp qui ouvre la session en tient
  lieu. Ils restent limités à une fois par session.
- **Effet Aléatoire de l'Arcane** : sur un double, `signe` vaut `positif` par
  convention, mais c'est la Cicatrice qui compte.
- **Le nom d'un adversaire retiré n'est pas réattribué** : trois Carcasses puis un
  retrait donne « Carcasse 4 » à la suivante, pour éviter la confusion à table.

---

## 7. Conventions de travail

### Ce qu'impose `CLAUDE.md`

- **Poser des questions.** La MJ y tient explicitement. Ne devinez pas une règle,
  demandez. Elle répond vite et précisément.
- **Penser générique.** Devant une nouvelle règle, cherchez comment l'intégrer proprement
  plutôt que de la câbler. Les paliers de Flamme et les origines d'effet en sont des
  exemples réussis.
- **Simplicité.** Rien de spéculatif, pas d'abstraction à usage unique, pas de
  configurabilité non demandée. Ce projet a péché par là : `combat.ts` et `campfire.ts`
  ont été écrits un lot en avance et sont restés inutilisés longtemps.
- **Changements chirurgicaux.** Ne « rangez » pas le code adjacent. Si vous voyez du code
  mort qui n'est pas le vôtre, signalez-le sans le supprimer.
- **Critères de vérification.** Annoncez `étape → vérification` avant de coder, et bouclez
  jusqu'au vert.

### Style du code

- **Le domaine est en français** : `resoudreAttaque`, `paliersFlammeAtteints`,
  `peutPrononcerSerment`. Les termes du jeu gardent leur casse (Évasion, Points de Foi,
  Feu de Camp, 6th Sens).
- **Les commentaires expliquent *pourquoi*, jamais *quoi*.** Un commentaire qui paraphrase
  le code est du bruit ; un commentaire qui dit « le faire à la fermeture effacerait le
  Serment » évite une régression. Les décisions non évidentes sont commentées sur place.
- **Marquez les secrets d'un 🔒** dans le code et la documentation. C'est devenu un signal
  de relecture.
- **Tests** : la règle va dans `domain/` et se teste sans navigateur ; le câblage se teste
  dans `app.test.tsx` avec `@testing-library/react`. Une régression rencontrée à table
  mérite systématiquement un test qui la reproduit.

---

## 8. Décisions revenues sur elles-mêmes

Cinq choix ont été faits, puis défaits. Les connaître évite de refaire le chemin inverse.

| Sujet | D'abord | Puis | Pourquoi |
|---|---|---|---|
| **Voie de la Flamme** | paliers exclusifs, drapeau `VOIE_FLAMME_CUMULATIVE` | liste de seuils cumulatifs `PALIERS_FLAMME` | la MJ les joue cumulatifs ; la liste rend le drapeau inutile et l'ajout d'un palier trivial |
| **Illusions du Trickster** | ajoutées à `possede.sorts` à la création | **dérivées** du passif via `sortsHorsEmplacement` | un correctif à la création n'atteint pas les fiches existantes ; et « donne accès à » ≠ « possède » |
| **Cycles (1d4+2)** | tirés par l'app à la création | **saisis par la MJ** sur son écran | tirés côté joueuse, son navigateur en gardait la trace — la console les révélait |
| **Nature du camp** | deux booléens indépendants, `finDeJournee` et `debutDeSession` | un `type: 'initial' \| 'repos-court'` et une table `PROFILS_CAMP` | les deux booléens pouvaient se contredire (Banque fermée sur un brouillon resté en phase `banque`), et `finDeJournee` valant `false` par défaut verrouillait silencieusement tous les gains de Foi |
| **Jetons de camp** | booléens dans `Session.jetons` | datés, sur `Character.jetonsCamp` | voir piège n° 8 : mauvais document (écriture refusée aux joueuses) et mauvaise forme (rien ne les réinitialisait) |

Le fil commun de ces retours : **préférer le dérivé au stocké**, **ne jamais faire transiter
par un appareil ce qu'il ne doit pas savoir**, et **ranger un état là où celui qui l'écrit a
le droit d'écrire**.

---

## 9. Par où commencer

1. Lisez les trois PDF, `CLAUDE.md`, puis ce document.
2. `npm install && npm run dev`, deux onglets **du même navigateur** (MJ, PIN `1234` ;
   joueuse, code `ENTREMONDE`). Connectez-vous **en MJ d'abord** : le catalogue s'installe
   à ce moment-là.
3. Parcourez `src/domain/rules.test.ts` — 104 tests qui décrivent le système mieux que
   n'importe quelle prose.
4. Demandez à la MJ ce qu'elle veut, et posez-lui vos questions avant de coder.
