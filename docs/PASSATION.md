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
| `npm test` | 285 tests — 242 de domaine, 7 de stockage, 36 de rendu |
| `npm run typecheck` | TypeScript strict |
| `npm run build` | `tsc --noEmit && vite build` |
| `npm run icons` | télécharge les icônes manquantes et régénère `src/content/icones.ts` |

Un `git push` sur `main` déclenche GitHub Actions : tests → build → publication.
**Les tests bloquent le déploiement** — un test rouge, et le site n'est pas mis à jour.

> Les comptes de tests cités dans ce document sont un **instantané**. Ils bougent à chaque
> ajout : `npm test` fait toujours foi. Ne les prenez pas pour une contrainte, seulement
> pour un ordre de grandeur de ce qui est couvert.

### Ce qui fonctionne

Les trois lots sont livrés : socle et phase Standard, mode Combat, Feu de Camp.
Création de personnage, fiche vivante, moteur de modificateurs, secret des cycles,
combat complet (initiative, adversaires, dégâts partagés, actions alternatives),
feu de camp (cinq phases au camp initial, trois au repos court), bestiaire, éditeur de
catalogue.

S'y ajoute le **Combat rapide** — le duel « Flow » de
`docs/Flow_v0.3_Playtest_Rules.docx` : un quatrième mode de table, cinq actions en anneau,
cinq manches, sans dés. Voir § 10.

Et une **refonte du modèle de contenu**, qui touche presque tout ce document. Quatre
vocabulaires séparés en sont devenus un seul — l'**Élément Variable** — d'où découlent les
Coûts (avec un « OU »), les Passifs (permanents, à seuil, ou en réaction), les Actifs et
leurs charges. Les types magiques et les dossiers sont passés au catalogue, les passifs de
classe en données, et l'app sait désormais **lancer un sort** : payer, tirer, appliquer.
Tout le contenu écrit sous l'ancien modèle se convertit à la lecture — voir pièges n° 1 et
n° 2 bis.

L'écran Réglages est enfin devenu **une barre d'onglets** : un onglet **Création** fabrique
n'importe quelle entrée — y compris une **Classe entière**, choix et passifs par option
compris, ce que rien ne permettait jusqu'ici — et les autres onglets ne servent plus qu'à
consulter et corriger. Bestiaire et Maintenance y ont chacun le leur.

### Ce qui reste

- **Le contenu.** Le catalogue ne contient que quelques exemples. La MJ doit saisir ses
  vrais équipements, améliorations et investissements via l'éditeur (Réglages).
  **N'écrivez pas ce contenu en dur** — voir le piège n° 1.
- **Les icônes.** 66 icônes `game-icons.net` (CC-BY), dont une palette d'armes, armures,
  bibelots et symboles proposée à la MJ (`PALETTE` dans `scripts/fetch-icons.mjs`). Elle
  veut à terme des dessins style Moebius/Ghibli ; déposer un fichier de même nom dans
  `public/icons/` suffit — le script n'écrase jamais un fichier existant.
- **Les upgrades annoncées** dans `Guidelines.pdf`, non commencées : nouvelles classes,
  et les QTE (mini-jeux poussés sur l'écran d'une joueuse). Le champ `EtatTable.overlay`
  les attend toujours — le combat rapide, lui, ne s'en sert pas, et pour une raison qui
  vaut sans doute aussi pour les QTE : voir le piège n° 11.

---

## 2. Architecture

```
src/
  domain/      ⭐ les règles du jeu. TypeScript pur : ni React, ni Firebase, ni DOM.
  content/     le contenu livré (classes, sorts, exemples, rappels de règles)
  store/       stockage temps réel : implémentation locale et Firestore
  data/repo.ts opérations métier sur la table — le seul écrivain
  screens/     écrans joueuse et MJ
  components/  avatar, compteurs, icônes, objets dépliables, filtres, éditeurs de contenu
firebase/      règles de sécurité Firestore
scripts/       téléchargement des icônes
```

**Règle de dépendance, à ne pas enfreindre :** `domain/` ne dépend de rien.
C'est ce qui permet de tester toutes les règles du jeu sans navigateur, en quelques
millisecondes, et c'est là que vivent les décisions délicates. Si vous êtes tenté
d'importer React ou Firestore dans `domain/`, c'est que la logique n'est pas à sa place.

**À l'intérieur de `domain/`, l'ordre des couches compte aussi.** Depuis l'unification du
modèle de contenu, une dizaine de modules s'empilent, et deux d'entre eux ont dû être
coupés en deux pour éviter un cycle — ce n'est pas de la coquetterie, TypeScript compile
un cycle sans broncher et la casse survient à l'exécution.

```
elements.ts     le vocabulaire : Élément Variable, Cible, registre. Ne dépend QUE de types.ts
brulures.ts     la Magie du Sang. Extrait de magie.ts pour que couts.ts puisse l'utiliser
modifiers.ts    l'agrégation, et le compilateur Passif → Modifier
competences.ts  les valeurs et plafonds dérivés
couts.ts        les Coûts, et la table des paiements
notifications.ts ce que la MJ pousse vers une joueuse — a besoin des Coûts
passifs.ts      ce que SONT les passifs, et lesquels sont en vigueur
reactions.ts    ce qu'ils FONT — a besoin des plafonds, donc vient après
lancement.ts    lancer un sort : payer, tirer, appliquer
```

`passifs.ts` / `reactions.ts` sont séparés parce que `modifiers.ts` appelle
`passifsActifs` : y mettre la résolution refermerait
`modifiers → passifs → competences → modifiers`. Même raison pour la table des paiements,
qui vit dans `couts.ts` et non dans le registre — dépenser une brûlure demande
`brulures.ts`, qu'`elements.ts` ne peut pas importer.

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
  base**. Ils viennent presque tous d'un `Passif` — objet porté, amélioration possédée,
  classe, option de classe retenue, Voie de la Flamme. Seul le bonus d'Évasion d'une
  armure reste un champ à part : c'est le raccourci que la MJ attend d'une armure.

C'est cette séparation qui rend l'exigence « les modificateurs doivent être dynamiques »
tenable : si les brûlures passent de 3 à 5, le point de 6ᵉ Sens supplémentaire apparaît
sans qu'aucun écran n'ait eu à y penser, et rien ne peut se désynchroniser.

> **Les passifs se composent en données, depuis l'écran Réglages.**
> Un `Passif` porte un **déclenchement** — permanent, permanent au-delà d'un seuil, ou en
> réaction à un changement — et un **effet**. `EditeurPassifs` (`components/`) les saisit,
> `derivedModifiers` compile les permanents en `Modifier`. **Aucune ligne de code ne
> connaît le talisman qu'elle vient de créer.** Quatre tests de rendu suivent ce parcours
> de bout en bout — passif permanent, passif réactif, réaction croisée, et le libellé qui
> retombe sur le nom du porteur — et un cinquième fait de même pour une **classe entière**
> composée depuis l'onglet Création.
>
> ⚠️ **`Passif` et `Modifier` restent deux choses distinctes.** `Passif` est du contenu
> écrit par la MJ ; `Modifier` est la monnaie d'exécution — persistée dans
> `Character.modifiers` (Fardeau, Serment, Marque, Esquive, Diversion), porteuse d'un
> `posePar` et d'une échéance. `compilerPassif` est le pont de l'un vers l'autre, et il
> refuse les opérations qui ne survivent pas à l'agrégation (`set`, `add-x`).
>
> Le libellé affiché retombe sur le **nom du porteur** quand le passif n'en porte pas,
> relu à chaque rendu : renommer un objet renomme son passif, sans rien à recopier.

`domain/effets.ts` en donne une vue unifiée pour l'affichage : chaque effet porte une
**origine** parmi six — `choisi`, `feu-de-camp`, `derive`, `equipement`, `mj`,
`temporaire` — qui détermine *qui a le droit de le changer*. C'est cette taxonomie qui
permet à l'écran de n'offrir un contrôle que là où la règle l'autorise.

Deux effets ne passent pas par des modificateurs et c'est voulu :
- **Overheat** (Dusk Hunter) transforme le *gain* de brûlures — c'est un hook,
  `gainBrulureEffectif` dans `brulures.ts`. Ce n'est **pas** une réaction : une réaction
  s'armerait sur tout mouvement du compteur, or la barre de brûlures sert aussi de
  bloc-notes, et cocher une case pour noter son total en offrirait une gratuite.
- **Les sorts débloqués par une option de classe** — `Sort.requiertPassif` — ne modifient
  aucune valeur, ils donnent accès. Voir `sortsHorsEmplacement`.

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
  state/current              public  mode · combat · campfireId · duelId · sessionId · overlay
  characters/{id}            public  la fiche — tout ce que les joueuses peuvent voir
  adversaries/{id}           public  nom · evasion · evasionPublique · degatsSubis · icone
  catalog/{id}               public  classes, sorts, équipements, améliorations, investissements
  duels/{id}                 public  le duel en cours — la joueuse n'y écrit que `choixJoueuse`
  campfires/{id}             lecture publique, écriture MJ — un camp LANCÉ : phase · brief · offres
  sessions/{id}              lecture publique, écriture MJ — numero · ouverteLe

  secrets/{characterId}      🔒 MJ   cyclesTotal · cyclesConsommes · notesMJ
  secrets/adversaires        🔒 MJ   seuils de Fatigue des adversaires en jeu
  secrets/campfire-brouillon 🔒 MJ   le camp EN PRÉPARATION
  secrets/duel               🔒 MJ   préparation du duel, et le MOTIF du PNJ
  bestiary/{id}              🔒 MJ   modèles de créatures : évasion, seuil
  log/{id}                   🔒 MJ   journal — écriture ouverte, lecture réservée
```

Cinq secrets, cinq raisons :

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
- **Le motif du duel** : la suite d'actions que le PNJ répète. Un duel dont le motif est
  lisible est un duel déjà résolu — c'est toute la tension du jeu qui disparaît. Il reste
  dans `secrets/` **pendant** le duel, et pas seulement avant : lancer un duel, c'est
  publier la moitié que les joueuses ont le droit de voir.

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
| Sorts débloqués par une option de classe | **dérivés du passif**, pas possédés | « donne accès à » ≠ « possède ». `Sort.requiertPassif` nomme l'option ; généralise l'ancien drapeau `illusion`, qui ne décrivait que l'Illusionniste |
| Invocation du Soulshifter | un **jeton** que le tirage consomme et que la **MJ rend** depuis la fiche | « une fois par heure » parle de l'heure **de fiction**, que l'app ne connaît pas : une halte au camp couvre une nuit en trois minutes de table. Un compte à rebours réel se serait trompé dans les deux sens. `passifs.vieTireeA` porte le jeton (`peutTirerUneVie`, `rendreInvocationDeVie`) |
| Maîtrises | **+3 / 0 / −3** | remplace le ±2 de la v0. Les fiches restées à l'ancien profil sont converties à la lecture par `convertirAncienProfil` ; une répartition que la MJ a réglée à la main n'est **pas** touchée |
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
| Objets à effets actifs | un ou **plusieurs** `Actif`, chacun sa table `1d{faces}`, son coût et ses charges | même modèle pour l'Attaque Spéciale d'une arme et pour une potion — une table à une face rend l'effet déterministe. Coût et nombre d'usages sont **indépendants** : l'ancien modèle les confondait, ce qui interdisait un objet à la fois limité en charges et payant à l'usage |
| Charges | par `objetId:actifId`, sur la fiche ; **clé absente = objet au complet** | évite d'initialiser à chaque acquisition — achat, don de la MJ, fiche ancienne. La clé nue de l'ancien format est relue puis effacée, sinon les deux compteurs divergeraient |
| Recharge | **rituel** validé par la MJ, **coût** payé par la joueuse, ou **aucune** | le PDF attache un rituel propre à chaque objet ; c'est la fiction qui décide. Rien ne se recharge au feu de camp |
| Objet épuisé | il **reste en inventaire**, marqué et inutilisable | décision de la MJ, contre la destruction automatique d'avant : un flacon vide se garde, se remplit, se revend. C'est à elle ou à la joueuse de le retirer |
| Passifs de sorts | **non** : seuls équipements, améliorations et classes en portent | un passif permanent se modélise par une amélioration ; évite un troisième régime d'activation (sort connu ? préparé ? lancé ?). Un sort porte des **Actifs**, ce qui suffit à son lancement |
| Plafonds de ressource | **dérivés**, comme le 6ᵉ Sens | une dague qui coûte un Point de Fatigue rend la case dès qu'on la range |
| Passifs réactifs | « quand telle jauge bouge, telle autre varie », **une seule passe** | voir l'encadré ci-dessous |
| Usage d'un objet | depuis la **fiche**, sous l'avatar, donc seulement s'il est **porté** | le PDF limite la joueuse à ses trois emplacements pendant la session |
| Coûts | un `Cout` = des **branches** (« OU »), chacune des **parts** (« ET ») | « 2 Points de Foi OU 10 Lumens » ne pouvait pas s'écrire. Une part peut être fixe, variable (le « X »), ou narrative — que le moteur affiche sans prétendre la prélever |
| Types magiques | **entrées de catalogue**, plus une union fermée | la MJ en crée depuis son écran. Les trois d'origine gardent leurs identifiants (`arcane`, `sang`, `miracle`), si bien que les sorts en base s'y rattachent sans conversion |
| Choix de classe | **données** (`Classe.choix`), chacun avec son **verrou** | Hexcore et voie du Trickster étaient un champ codé par classe. Le verrou porte une règle : l'Hexcore se bascule quand on veut, la voie s'engage au Feu de Camp |
| Lancer un sort | l'app **paie, tire et applique** | le coût et l'effet étant structurés, l'ajustement manuel des compteurs n'avait plus de raison d'être |
| Durée d'un sort | `duree` reste du **texte**, doublée d'une échéance que le moteur sait tenir | l'app n'a **aucune horloge de fiction** : un effet « pendant 1 heure » ne peut pas expirer seul. La joueuse le **dissipe** à la main quand la fiction l'a consommé |
| Emplacements | Grimoire, offres de boutique et investissements proposés sont **dérivés** | un passif peut en accorder un de plus. Ce sont des nombres *proposés*, pas des limites d'acquisition — celle-ci reste portée par `JetonsCamp` |
| Dossiers | un dossier par entrée, **polyvalent** ; « ALL » **jamais stocké** | un dossier de table est thématique — « Poisons » réunit trois sorts et deux bibelots. Il portait d'abord une `cible` qui le limitait à une famille : erreur de lecture, retirée à la lecture par `normaliserEntree`. « ALL », lui, est l'absence de filtre : rien à créer ni à tenir à jour |
| Écran Réglages | une **barre d'onglets** ; un onglet **Création** fabrique, les autres consultent | le bouton « Ajouter » était sous une liste qui s'allonge à chaque session. Créer une classe ou un type magique n'était possible nulle part |
| Rareté | palette nommée, `Equipement.rarete` ; absent = commun | la couleur veut dire quelque chose à table, et suit l'objet partout |
| Entrées `seed` | **supprimables** | le drapeau ne sert plus qu'à les faire revenir à la réinitialisation |
| Cristal épuisé | signalé **par la joueuse**, sur un sort préparé dont le type magique porte `cristal` | elle lance son d6 à table ; seul un sort préparé peut être lancé, donc s'épuiser. Le drapeau était câblé sur l'Arcane : un type magique créé par la MJ aurait perdu la mécanique |
| Inventaire joueuse | chaque onglet montre **tout**, marqué de ce qui est en jeu | comparer un objet porté à un objet en réserve demandait deux onglets |
| Résolution du camp | à **l'ouverture** | voir piège n° 4 |
| Session | ouverte par le lancement d'un camp initial | c'est là que les investissements rendent leurs comptes |
| Cycles | **saisis à la main** par la MJ | ne doivent jamais transiter par l'appareil d'une joueuse |
| Dés | physiques à table | l'app ne tire que le Détachement, les osselets, la personnalité Soulshifter et les risques d'investissement |
| Combat | la joueuse saisit jet et cible, l'app applique | la MJ peut corriger |
| Offres de boutique | tirage assisté que la MJ ajuste, **restreignable à des dossiers** | 3 offres × 5 joueuses = trop de choix manuels. Cocher « Poisons » et « Reliques » prépare une boutique thématique d'un geste ; rien de coché = tout le catalogue. Seul le **tirage** en tient compte — les listes de remplacement restent ouvertes, pour glisser une pièce hors thème |
| Rythme du camp | la MJ pilote la phase | garde la table groupée |
| Écran MJ pendant le camp | **miroir** de l'écran d'une joueuse, actions neutralisées, contrôles d'édition à leur place | un seul rendu à maintenir ; permet de retoucher brief et offres camp lancé |
| Combat rapide | un **quatrième mode de table**, pas un overlay | la MJ le lance comme un Combat ; il ouvre un onglet et se termine explicitement — voir piège n° 11 |
| Action du PNJ | **motif secret** préparé avant le lancement, répété par l'app ; remplacement possible entre deux manches | le doc de playtest veut un motif lisible à la longue, donc conditionnable ; le remplacement en direct resterait invérifiable |
| Conséquences du duel | **aucune sur les fiches** — l'issue est narrative | le doc l'exige : « Do not add yet … character-sheet bonuses » |
| Noms des actions | **français** : Pression · Feinte · Placement · Contre · Garde | cohérent avec le reste de l'app, et lisible en une seconde sur un téléphone |
| Joueuses non-duellistes | **spectatrices** : le plateau sans aucun bouton | le duel est un moment de table ; le rendu en lecture seule est le même composant |
| Chrono | il **verrouille la sélection en cours**, l'action par défaut seulement si rien n'est préparé | un choix irréversible ne doit pas tenir à un doigt qui glisse |

### Les passifs réactifs passent par un point unique

`resoudrePassifs` (`domain/reactions.ts`) compare l'état d'avant à celui d'après et applique
ce qui s'est armé. Elle est appelée depuis **`modifierPersonnage` et nulle part ailleurs** :
c'est le seul endroit qui dispose des deux états. La brancher dans les écrans aurait produit
des réactions qui partent ou non selon qui a bougé la jauge — c'est pourquoi les **huit**
sites qui écrivaient encore par `enregistrerPersonnage` y sont passés : gains de Foi au camp,
achat, investissement, Fardeau, Serment, Diversion, grille pleine.

`enregistrerPersonnage` n'est plus réservé qu'aux écritures **en masse et déjà résolues par
le domaine** — résolution d'un camp, expiration, Détachement. Le camp est le cas limite : il
remet la Foi et la Fatigue de toute la table d'un coup, et y armer les réactions ferait
partir chaque passif de chaque joueuse dans la même seconde. C'est une remise à zéro, pas un
événement.

Trois bornes à ne pas lever :

- **une seule passe, sur le roster** : chaque personnage est armé une fois, par le seul
  changement d'origine. Ce qu'une réaction produit chez une alliée n'en réveille aucune
  autre — sans cette borne, « une brûlure quand une alliée en prend une » ferait le tour de
  la table indéfiniment, et personne ne pourrait suivre la cascade ;
- **le résultat reste borné** par les plafonds dérivés — une réaction ne fait pas déborder
  une jauge, et quand rien ne bouge elle ne raconte rien, et n'écrit rien ;
- **même régime d'activation que les modificateurs** : objet porté, amélioration possédée,
  classe du personnage.

Les réactions **croisées** (`chez: 'un-allie' | 'quiconque'`) écrivent la fiche de l'alliée
en plus de celle de l'actrice, et le journal nomme **celle chez qui l'effet s'est produit**.
L'ordre du roster est trié par identifiant, pour que deux appareils résolvant le même geste
aboutissent au même état.

> ✅ **Un piège de longue date s'est refermé ici.** `effetsActifs` (`domain/effets.ts`)
> partait des *modificateurs* : tout passif n'en produisant pas — une réaction, Overheat,
> Illusionniste — devait y être ajouté **à la main**, et l'oubli ne se voyait nulle part.
> La liste part désormais des **passifs** : tout ce que la MJ compose y figure par
> construction. Ne restent en dur que les trois mécaniques qui ne sont pas des passifs —
> Overheat, les sorts débloqués par une option de classe, et la vie du Soulshifter.

`modifierPersonnage` lit le catalogue dans `catalogueCourant` et le roster dans
`personnagesCourants`, deux caches alimentés par les souscriptions. Tant qu'ils sont vides —
avant la première réponse — aucune réaction ne part, ce qui est le bon comportement : rien
ne doit s'appliquer sur un catalogue ou un roster inconnu.

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
`basculerCaseBrulure` dans `brulures.ts`. Les deux compteurs étant des **préfixes**, effacer
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
2. **Convertir à la lecture** — `normaliserEntree` (voir piège n° 2 bis) ; c'est ainsi que
   tout le contenu écrit sous l'ancien modèle continue de se lire ;
3. **Passer par l'éditeur de catalogue** (Réglages) — c'est la voie prévue pour le
   contenu ;
4. En dernier recours, le bouton « Réinitialiser le catalogue », qui **écrase aussi les
   entrées de la MJ**.

⚠️ Corollaire moins évident : `amorcerSiNecessaire` ne tourne **que pour la MJ**. Entre un
déploiement et sa prochaine connexion, une entrée nouvellement semée n'existe pas encore
pour les joueuses. Tout ce qui la lit doit donc se replier proprement — c'est pourquoi
`libelleMagie` retombe sur les trois noms d'origine puis sur l'identifiant brut, et
pourquoi la Voie de la Flamme est restée **en code** plutôt qu'au catalogue.

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

Sept tests gardent cette régression (`describe('normalisation des fiches lues en base')`) — un par forme héritée.

#### Piège n° 2 bis : le même piège vaut pour le catalogue

Une entrée de catalogue écrite l'an dernier ne connaît pas le modèle d'aujourd'hui, et
l'amorçage ne la réécrira **jamais** (piège n° 1). `normaliserEntree` est son
`normaliserPersonnage` : elle convertit à la lecture les coûts de sorts à l'ancienne forme,
les `modificateurs` et `declencheurs` en `Passif`, la table unique d'un objet en `Actif`,
`magie` en `magieId`, `illusion` en `requiertPassif`.

⚠️ **Elle vit dans `createCatalog`, pas chez l'appelant.** Il existe trois usages du
catalogue — la souscription temps réel, le lancement d'un feu de camp qui relit la
collection, et l'export JSON — et normaliser en amont aurait obligé chacun à y penser.
Un seul chemin, comme `normaliserPersonnage` dans `surPersonnages`.

> **Si vous changez la forme d'une entrée de catalogue, donnez-lui sa conversion dans
> `normaliserEntree`.** Plusieurs fixtures de test restent délibérément à l'ancien format
> pour garder ce chemin sous garde.

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
Huit tests couvrent les cas décrits par la MJ, répartis sur trois blocs — `Esquiver`,
`Faire diversion` et `horloge de combat`.

#### Piège n° 6 : les paliers de la Voie de la Flamme se cumulent

Un drapeau `VOIE_FLAMME_CUMULATIVE` a existé, puis a été remplacé par une liste de seuils
dont on obtient **tous** ceux atteints. Ajouter un palier = ajouter une entrée. Ne
réintroduisez pas d'énumération exclusive.

Les paliers sont aujourd'hui des `Passif` à condition de seuil (`PASSIFS_FLAMME`,
`domain/passifs.ts`), donc exprimés dans le même vocabulaire que le contenu de la MJ. Ils
restent **en code** et non au catalogue, à dessein : le contenu semé n'atteint une table
qu'à la connexion de la MJ (piège n° 1), et les y déplacer priverait les joueuses de la
Voie de la Flamme entre un déploiement et cette connexion.

#### Piège n° 7 : ce qui ne doit jamais entrer dans un document public

- le seuil de Fatigue d'un adversaire (`instancierAdversaire` ne le recopie pas — un test
  le vérifie sur le JSON réellement écrit) ;
- le nombre de cycles (`creerPersonnage` ne le produit même pas) ;
- le brief et les offres d'un camp non lancé ;
- **le motif du PNJ en combat rapide** (`lancerDuel` ne recopie que la moitié publique —
  un test le vérifie sur le JSON réellement écrit).

#### Piège n° 9 : une sélection tentative ne doit pas quitter l'appareil

En duel, la joueuse *prépare* une action avant de la *verrouiller*. Seul le choix
verrouillé est écrit ; la préparation vit en `useState`. L'écrire au premier appui
livrerait ses hésitations à la MJ, qui lit le document — la même raison qui garde le
nombre de cycles hors de son navigateur.

Corollaire : **c'est le téléphone de la duelliste qui verrouille à l'expiration du
chrono**, puisque lui seul connaît la sélection. L'écran MJ n'arbitre qu'en filet, après
un délai de grâce, au cas où l'appareil ne répondrait plus.

#### Piège n° 10 : l'arbitre du duel est l'écran MJ, et il ne doit résoudre qu'une fois

Seul l'écran MJ peut lire le motif, donc seul lui peut résoudre une manche. L'`useEffect`
qui le fait (`useArbitrage`, `PanneauDuel.tsx`) est gardé par une `ref` indexée sur le
nombre de manches jouées : sans elle, un re-rendu survenant entre l'écriture et son écho
résoudrait la manche deux fois. Le chrono de la joueuse est gardé de la même façon, par
une `ref` et une `key` qui remonte le composant à chaque manche.

Conséquence assumée : si la MJ quitte l'onglet pendant une manche, rien ne se résout tant
qu'elle n'y revient pas — et à son retour tout se rattrape d'un coup.

#### Piège n° 11 : `EtatTable.overlay` ne convient pas à un mini-jeu où la joueuse agit

C'était pourtant sa raison d'être annoncée. Deux obstacles, tous deux dans
`firebase/firestore.rules` : les joueuses ne peuvent écrire dans `state/` que le champ
`combat`, donc elles ne pourraient pas y déposer leur choix ; et `state/current` est
**public**, donc y ranger le motif du PNJ le révélerait.

Le duel a donc sa propre collection — publique pour ce qui se voit, `secrets/` pour ce qui
se cache. Un QTE qui demande une action à la joueuse rencontrera exactement les deux mêmes
murs ; `overlay` reste utilisable pour ce qu'on ne fait que *pousser* vers un écran.

### 6.3 Pièges techniques

| Piège | Détail |
|---|---|
| **Deux configs Vite** | `vite.config.ts` et `vitest.config.ts` sont séparés à dessein : vitest 2 embarque Vite 5, le projet utilise Vite 6, et les mélanger fait diverger les types du plugin React. Ne les fusionnez pas. |
| **Firestore refuse un tableau de tableaux** | Et le store local, qui sérialise en JSON, l'accepte : le bug n'apparaîtrait qu'à la première sauvegarde de la MJ, **en production**. C'est pourquoi `Cout` s'écrit `{ branches: [{ parts: [...] }] }` et non un tableau nu à deux niveaux. Une assertion de forme garde le cas dans `firestore.test.ts`, faute d'émulateur. |
| **Les tests forcent le mode local** | `SOUS_TEST` dans `store/index.ts`. Sans cela, la suite dépendrait de la présence d'une config Firebase — elle casserait dès que `src/config.ts` est renseigné, **et bloquerait le déploiement** puisque GitHub Actions lance les tests avant le build. |
| **Polyfill Storage** | `src/test-setup.ts` installe un `localStorage`/`sessionStorage` en mémoire : Node ≥ 22 expose un `localStorage` global inerte, et jsdom ne fournit pas toujours le sien. |
| **`base` de Vite** | `base: '/MaraudeurCompanion/'` — le site est servi sous le nom du dépôt. Les chemins d'assets passent par `import.meta.env.BASE_URL`. |
| **`src/content/icones.ts` est généré** | par `npm run icons`, mais **suivi par git** : le build en dépend. Ne l'éditez pas à la main ; déposez un SVG dans `public/icons/` et relancez le script. |
| **Icônes normalisées** | les SVG de game-icons arrivent en tracé blanc sur carré noir plein. Le script retire le fond et teinte le tracé. Un fichier déposé par la MJ n'est jamais retouché. |
| **Taille du bundle** | ~890 Ko, 237 Ko compressés, dominés par Firebase. Acceptable sur mobile ; un découpage dynamique est possible si le chargement gêne. |

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

Huit choix ont été faits, puis défaits. Les connaître évite de refaire le chemin inverse.

| Sujet | D'abord | Puis | Pourquoi |
|---|---|---|---|
| **Voie de la Flamme** | paliers exclusifs, drapeau `VOIE_FLAMME_CUMULATIVE` | liste de seuils cumulatifs, aujourd'hui des `Passif` à condition (`PASSIFS_FLAMME`) | la MJ les joue cumulatifs ; la liste rend le drapeau inutile et l'ajout d'un palier trivial |
| **Illusions du Trickster** | ajoutées à `possede.sorts` à la création | **dérivées** du passif via `sortsHorsEmplacement` | un correctif à la création n'atteint pas les fiches existantes ; et « donne accès à » ≠ « possède » |
| **Cycles (1d4+2)** | tirés par l'app à la création | **saisis par la MJ** sur son écran | tirés côté joueuse, son navigateur en gardait la trace — la console les révélait |
| **Nature du camp** | deux booléens indépendants, `finDeJournee` et `debutDeSession` | un `type: 'initial' \| 'repos-court'` et une table `PROFILS_CAMP` | les deux booléens pouvaient se contredire (Banque fermée sur un brouillon resté en phase `banque`), et `finDeJournee` valant `false` par défaut verrouillait silencieusement tous les gains de Foi |
| **Jetons de camp** | booléens dans `Session.jetons` | datés, sur `Character.jetonsCamp` | voir piège n° 8 : mauvais document (écriture refusée aux joueuses) et mauvaise forme (rien ne les réinitialisait) |
| **Vocabulaire du contenu** | quatre listes séparées — `Ressource` (réactions), `ModifierTarget` (passifs), `CoutSort`, `CoutUsage` | un seul **Élément Variable**, et une `Cible` = élément + aspect | les quatre décrivaient la même chose sans se connaître. Une réaction ne pouvait pas viser l'Évasion, un coût ne pouvait pas se payer en Marques — non par choix de règle, mais parce que les listes n'avaient jamais été écrites au même endroit |
| **Passifs** | deux tableaux, `modificateurs` et `declencheurs` | un seul type `Passif`, porteur de son **déclenchement** | ils ne différaient que par ce qui les armait, jamais par leur effet. Les réunir permet à une réaction d'accorder un bonus d'Évasion, et à un permanent de n'agir qu'au-delà d'un seuil — deux choses qu'aucun des deux ne savait faire |
| **Objet épuisé** | détruit et déséquipé automatiquement | **conservé**, marqué, retiré à la main | décision de la MJ : un flacon vide se garde, se remplit, se revend |

Le fil commun de ces retours : **préférer le dérivé au stocké**, **ne jamais faire transiter
par un appareil ce qu'il ne doit pas savoir**, **ranger un état là où celui qui l'écrit a
le droit d'écrire**, et **n'écrire un vocabulaire qu'une fois**.

---

## 9. Par où commencer

1. Lisez les trois PDF, `CLAUDE.md`, puis ce document.
2. `npm install && npm run dev`, deux onglets **du même navigateur** (MJ, PIN `1234` ;
   joueuse, code `ENTREMONDE`). Connectez-vous **en MJ d'abord** : le catalogue s'installe
   à ce moment-là.
3. Parcourez `src/domain/rules.test.ts` — 242 tests qui décrivent le système mieux que
   n'importe quelle prose.
4. Demandez à la MJ ce qu'elle veut, et posez-lui vos questions avant de coder.

---

## 10. Le Combat rapide — le duel « Flow »

Règle de référence : `docs/Flow_v0.3_Playtest_Rules.docx`. Un duel 1 contre 1 entre une
joueuse et un PNJ, sans dés, en cinq manches au plus. Chaque manche, les deux choisissent
en secret parmi cinq actions ; on révèle simultanément.

### L'anneau est toute la règle

`ACTIONS_DUEL` (`domain/types.ts`) déclare les cinq actions **dans l'ordre de l'anneau**, et
tout le reste s'en déduit par un décalage d'index (`domain/duel.ts`) :

| | Définition | Sens de jeu |
|---|---|---|
| `bat(a)` | `i+1`, `i+2` | chaque action bat les deux suivantes |
| `flowDe(prec)` | `i+1` | la menace visible, qui vaut 2 points si elle gagne |
| `briseFlow(prec)` | `prec` | rejouer sa propre action coupe le Flow adverse |
| `appatDe(prec)` | `i+3` | abandonner son Flow pour punir ce réflexe |

⚠️ **Ne réintroduisez pas de table de résolution écrite à la main.** Le pentagone affiché
(`components/Pentagone.tsx`) se dessine des mêmes index : une table recopiée finirait par
contredire le dessin. Réordonner `ACTIONS_DUEL` change le jeu ; y insérer une action met
tout à jour d'un coup, écran compris.

De cet alignement naît un **second pierre-feuille-ciseau** que rien n'a codé :
Anti-Flow bat Flow · Appât bat Anti-Flow · Flow bat Appât. Un test le vérifie pour les cinq
états plutôt que de le décrire.

### Ce qui est stocké, et ce qui se dérive

`Duel.historique` porte les manches révélées, **et rien d'autre**. Score, actions
précédentes et bonus de Clash se recalculent par `etatDuel(historique)` : c'est ce qui
permet aux trois écrans — duelliste, spectatrices, MJ — de se rendre depuis la même source
sans risque de divergence.

Barème, en une ligne : `points = flow || bonusClash ? 2 : 1`. Une manche ne vaut **jamais**
plus de 2 — le document plafonne explicitement une victoire Flow qui suit un Clash.

### Qui écrit quoi

```
joueuse   →  duels/{id}.choixJoueuse   (et rien d'autre : hasOnly, dans les règles)
MJ        →  tout le reste, et elle seule arbitre — seule à pouvoir lire le motif
```

Le cycle d'une manche : la MJ **ouvre** la manche (le chrono démarre) → la duelliste
prépare puis verrouille sur son téléphone → l'écran MJ **révèle**. Voir les pièges n° 9
et n° 10 : la sélection tentative reste sur l'appareil, et une manche ne doit être résolue
qu'une fois.

### Le plateau

Un seul composant pour les trois écrans. Le contour du pentagone porte le sens du Flow
(avec ses pointes), les diagonales complètent la relation « bat » : les dix relations du
jeu sont donc **dans le dessin**, ce que le document demande explicitement (apprendre
l'anneau en moins de deux minutes). Toucher une action allume en vert ce qu'elle bat, en
rouge ce qui la bat. Sans `onChoisir`, le plateau est en lecture seule.

Les sommets sont de vrais `<button>` HTML posés par-dessus le SVG — cible tactile, focus
natif, texte à la taille système. Tout est en pourcentage du conteneur, donc la figure
tient à toutes les largeurs sans média-requête.

#### La grammaire des marques

Deux canaux, deux temps — **le trait et le fond disent le passé, les halos disent le
présent**. C'est ce qui permet à un sommet de cumuler plusieurs rôles sans que les marques
ne s'écrasent : un Clash laisse un sommet vert *et* rouge, et une sélection posée sur un
combo garde ses deux halos.

| Ce que ça dit | Marque | Source |
|---|---|---|
| joué au tour d'avant par la joueuse | bordure verte | `etat.precedenteJoueuse` |
| joué au tour d'avant par le PNJ | bordure rouge | `etat.precedenteAdversaire` |
| sélection en cours | halo blanc, au ras | `selection` |
| combo à saisir (Flow) | halo orange, autour | `flowDe(precedenteJoueuse)` |

Les halos passent par deux variables CSS (`--halo-proche`, `--halo-lointain`) plutôt que
par des règles composées : chaque marque n'a qu'une propriété à poser. Sur un Clash — les
deux ont joué le même coup — le trait ne pouvant porter deux couleurs, le vert le garde et
le rouge passe au fond.

⚠️ **Le Flow que menace le PNJ n'est pas marqué, et ce n'est pas un oubli.** Il l'a été un
temps, par un second halo rouge : posé sur un sommet que personne n'avait joué, il se
lisait comme « voilà son coup » et contredisait la bordure rouge à deux sommets de là. Sur
le plateau, le rouge ne dit qu'une chose — **ce que l'adversaire vient de jouer**.

⚠️ Le pentagone reçoit les actions **précédentes**, pas les Flows : il les calcule
lui-même avec `flowDe`. L'anneau reste ainsi la seule source de vérité.

### Le chrono et la frise

Le `Chrono` (`screens/joueuse/OngletDuel.tsx`) est monté sur les trois écrans. Sans
`onExpiration` il se contente de décompter : c'est **toujours** le téléphone de la
duelliste qui verrouille à zéro, jamais celui d'une spectatrice ni celui de la MJ, que
`useArbitrage` couvre déjà en filet. Il masque aussi l'action armée dans ce mode — ce que
la duelliste a préparé ne regarde qu'elle.

La `FriseDuel` (`components/FriseDuel.tsx`) remplace l'ancienne liste de phrases : cinq
cases dans l'ordre — les deux actions face à face, le résultat dessous, les manches à venir
en creux. Le nombre de cases vient de `MANCHES_MAX`. Le récit de `recitManche` n'est pas
perdu : il devient l'infobulle de la case et son texte pour les lecteurs d'écran.

---

## 11. Les Notifications

La MJ sollicite une ou plusieurs joueuses **sans changer le mode de la table**. Combat, Feu
de camp et Combat rapide basculent tout le monde ; une notification arrive sur les seuls
écrans visés, par-dessus l'onglet en cours, et repart dès qu'on y a répondu.

### Le modèle tient en une phrase

**Une notification propose des options ; répondre, c'est payer le coût d'une option et,
éventuellement, en subir l'effet sur sa fiche.** Les trois types d'aujourd'hui s'y ramènent
tous :

| Type | Options | Effet sur la fiche |
|---|---|---|
| 6th Sens | « Écouter » (1 point de 6th Sens) · « Laisse passer » (gratuit) | aucun |
| Choix secret | n options libellées par la MJ, chacune avec son `Cout` | aucun |
| Nouvel équipement | « Prendre » (gratuit) | ajoute l'objet à `possede.equipements` |

Le coût n'a demandé **aucune ligne neuve** : `coutDe(fixe('lumens', 10))` dit « Payer
10 Lumens », et « 2 Foi OU 10 Lumens » était déjà exprimable en branches. La MJ le saisit
avec l'`EditeurCout` des sorts et des objets.

### Le point d'extension est unique

`TYPES` dans `domain/notifications.ts` : un `libelle`, une fonction `options`, et un
`appliquer` facultatif. **Ajouter un type de notification — Quête, Image — c'est ajouter
une entrée à ce registre**, plus un cas au `<Contenu>` du panneau MJ pour la saisie.
L'écran de la joueuse, lui, ne connaît que des options et des coûts : il n'a rien à
apprendre d'un type nouveau.

`choixProposes` aplatit options × branches payables en une liste de boutons. Un coût à
branche unique — le cas courant — donne exactement un bouton par option ; « 2 Foi OU
10 Lumens » en donne deux, et l'écran n'a aucun cas particulier à traiter.

### Ce qui est secret, et ce qui ne l'est pas

⚠️ **Le Choix secret n'est secret que socialement.** Les joueuses partagent un compte
Firebase : un document lisible par l'une l'est par toutes, et un document rangé dans
`secrets/` serait refusé en lecture à sa propre destinataire. Il n'existe donc aucun
endroit où déposer un contenu destiné à une seule joueuse — c'est le pendant du piège n° 7,
vu de l'autre côté.

Conséquence directe, et voulue : **le 6th Sens ne transporte que l'amorce publique**.
« Écouter » consomme le point et prévient la MJ, qui donne l'information de vive voix.
N'ajoutez pas de champ « texte révélé » : il serait lisible depuis la console par toute la
table, et la mécanique perdrait exactement ce qu'elle vend.

### Cycle de vie

La MJ envoie, la joueuse répond, la MJ range — `rangerNotification` **supprime** le
document. Pas de champ `clotureeLe` : le journal porte déjà l'historique, la collection
reste courte, et l'écran de la joueuse n'a rien à filtrer d'autre que sa propre réponse.

Répondre écrit deux documents — la fiche, puis `reponses` sur la notification — et **on paie
d'abord** : si le coût est impayable, `repondre` lève et rien n'est enregistré. Les deux
écritures ne sont pas transactionnelles (§ 6.4) ; l'écran tient un verrou local, comme le
chrono du duel, pour qu'un double appui ne paie pas deux fois.

Une part variable — le « X » — n'a pas de sens ici : la carte ne demande pas de choisir un
montant, et `payerCout` prélèvera son minimum. N'en mettez pas.
