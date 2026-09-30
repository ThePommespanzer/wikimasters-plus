# WikiMasters+

Extension **non officielle** pour Chrome et Firefox qui améliore l'expérience sur [wiki-masters.com](https://www.wiki-masters.com) : révélé des cartes animé, statistiques de tirages, pose de tags en un clic, outils sur les cartes et chargement plus rapide des pages.

> WikiMasters+ n'est ni affiliée ni approuvée par WikiMasters. Elle n'automatise pas l'ouverture des paquets et ne contourne aucune protection du site.

![Aperçu](store/images/capture-1-ouverture.png)

## Fonctionnalités

### Ouverture des paquets
- Nouvelle interface d'ouverture : fond animé, paquet flottant, compteur de paquets avec jauges et temps avant la réserve pleine.
- Effets de révélé **carte par carte**, sans spoiler : chaque rareté a sa mise en scène (silhouette qui se charge pour les Super Rares, montée en tension puis explosion pour les Ultra Rares et Légendaires, reflet arc-en-ciel pour les shiny).
- Étiquette « NOUVELLE » quand tu tires une carte que tu n'avais pas.
- Récap du paquet une fois toutes les cartes vues.
- Raccourci **Espace** : ouvrir un paquet, puis passer à la carte suivante (un appui = une action).
- **Révélé rapide** activable sur la page d'ouverture : animations éclair pour les cartes communes, grosse mise en scène gardée pour SR, UR, L et shiny.

### Tags
- Barre de tags à côté de la carte pendant le révélé : un clic (ou les touches **1 à 9**) pose ou retire un tag, sans ouvrir la carte.
- Création d'un nouveau tag directement depuis la barre.

### Statistiques
- Panneau sur la page des paquets : bilan du jour, taux de drop réels par rareté, cartes ouvertes, séries sans L / UR / SR / shiny, derniers paquets.
- Popup avec l'historique détaillé et un export CSV.

### Outils sur les cartes
- Boutons **Wikipédia** et **Letterboxd** (films, acteurs, réalisateurs, via Wikidata).
- **Plein écran** : rendu net de la carte, inclinaison 3D.
- **Copie** de la carte en image dans le presse-papier.
- Image **sous licence libre** (Wikipédia, Wikidata, Commons) pour les cartes qui n'en ont pas, avec le crédit de l'auteur.
- Cartes visibles directement sur la page des **échanges**, avec un **comparateur** (raretés, ATK/DEF, wikibidous, valeur marché estimée d'après les ventes récentes, alerte « dernière copie »).
- **Défilement continu** (interrupteur sur la Collection) : les pages suivantes s'ajoutent toutes seules en bas quand tu scrolles, plus besoin de cliquer sur « Suivant ». Les filtres, le tri et la recherche du site restent utilisables.
- **Prix par rareté** : tu choisis une rareté (par exemple Légendaire), l'extension calcule le prix médian des ventes récentes de chacune de tes cartes et l'affiche sur ta Collection.
- **Mes doublons** : tes cartes en double au visuel du site, valeur estimée, et fiche détaillée au clic (carte en grand, prix du marché, tes exemplaires, défausse d'un exemplaire avec confirmation), et bouton « Défausser les doublons » qui garde toujours un exemplaire et ne touche jamais aux shiny ni aux favoris.
- **Liste de souhaits** mise en avant sur le marché et dans les échanges.
- **Vue compacte** sur Collection et Toutes les cartes.

### Confort
- Compteur de paquets dans le titre de l'onglet et sur l'icône de l'extension.
- Notification quand la réserve de paquets est pleine, rappel du pack PRO quotidien.
- **Cache local** des données lentes (collection, tags, cartes, amis, profils) : affichage instantané puis mise à jour automatique. Analyse complète de la collection en une ou deux requêtes (quelques secondes), pages voisines préchargées pendant la navigation, et bouton **« Tout mettre en cache »** sur la Collection. Jamais pour les échanges, le marché ou les paquets, et vidé à chaque modification.

Chaque fonctionnalité se règle dans l'onglet **WikiMasters+** ajouté au menu du site (ou dans le popup de l'extension). On y choisit aussi l'ordre des tags de la barre du révélé.

## Installation

| Navigateur | Version minimale | Installation |
|---|---|---|
| Chrome, Edge, Brave, Opera | Chrome 116 | Chrome Web Store *(lien à ajouter après publication)* |
| Firefox (ordinateur et Android) | Firefox 128 | addons.mozilla.org *(lien à ajouter après publication)* |

### Installation manuelle depuis les Releases

Chaque [release](../../releases) contient deux fichiers :
- `wikimasters-plus-X.Y.Z.zip` pour Chrome et les navigateurs Chromium ;
- `wikimasters-plus-firefox-X.Y.Z.zip` pour Firefox.

**Chrome / Edge / Brave**
1. Dézippe `wikimasters-plus-X.Y.Z.zip`.
2. Ouvre `chrome://extensions` et active le **Mode développeur**.
3. Clique sur **Charger l'extension non empaquetée** et choisis le dossier dézippé.

**Firefox** (installation temporaire, jusqu'à la fermeture du navigateur)
1. Ouvre `about:debugging` puis **Ce Firefox**.
2. Clique sur **Charger un module complémentaire temporaire** et choisis `wikimasters-plus-firefox-X.Y.Z.zip`.
3. Si rien n'apparaît sur le site : `about:addons` → WikiMasters+ → **Permissions** → autorise wiki-masters.com.

Pour une installation permanente sur Firefox, passe par addons.mozilla.org.

### Depuis le code source

Clone le dépôt, puis :
- **Chrome** : charge le dossier `extension/` comme extension non empaquetée.
- **Firefox** : lance `./scripts/package-firefox.sh` et charge `dist/firefox/manifest.json` dans `about:debugging`.

## Confidentialité

Tout reste dans ton navigateur. L'extension n'envoie aucune donnée à son auteur ni à un serveur tiers. Détails dans [PRIVACY.md](PRIVACY.md).

## Développement

```
extension/        code de l'extension (Manifest V3, sans étape de build)
firefox/          manifest Firefox (même code)
  manifest.json
  background.js   service worker : alarmes, notifications, badge, historique
  inject.js       observation des réponses d'ouverture + cache local (contexte de la page)
  content.js      effets de révélé, compteur, raccourcis
  stage.js        interface d'ouverture et de révélé
  panel.js        panneau de statistiques sur la page
  tags.js         barre de tags pendant le révélé
  cards.js        outils sur les cartes, images libres, échanges, vue compacte
  popup.*         popup (stats, historique, réglages)
  lib/            html-to-image (MIT)
store/            textes et visuels du Chrome Web Store
scripts/          outils (création du zip)
```

Créer les zips :

```bash
./scripts/package.sh          # Chrome Web Store
./scripts/package-firefox.sh  # Firefox (addons.mozilla.org)
```

## Crédits

- Rendu des cartes en image : [html-to-image](https://github.com/bubkoo/html-to-image) (licence MIT).
- Images et données : Wikipédia, Wikidata et Wikimedia Commons, sous leurs licences respectives (crédits affichés sur chaque image).

## Licence

[MIT](LICENSE)
