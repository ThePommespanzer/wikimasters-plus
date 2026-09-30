# Fiche Chrome Web Store (textes à copier-coller)

## Onglet « Fiche Play Store » (Store listing)

**Nom de l'élément** (vient du manifest) :
```
WikiMasters+
```

**Résumé** (132 caractères max, vient du manifest) :
```
Extension non officielle pour WikiMasters : révélé animé, stats de tirages, tags rapides, outils de carte et cache.
```

**Description** :
```
WikiMasters+ rend l'ouverture de paquets sur wiki-masters.com plus spectaculaire et plus pratique.

✦ OUVERTURE DES PAQUETS
• Nouvelle interface d'ouverture : fond animé, paquet flottant, jauges de paquets et temps avant la réserve pleine.
• Effets de révélé carte par carte, sans spoiler : montée en tension puis explosion pour les Légendaires et Ultra Rares, silhouette qui se charge pour les Super Rares, reflet arc-en-ciel pour les shiny.
• Étiquette « Nouvelle » quand tu obtiens une carte pour la première fois.
• Récap du paquet une fois toutes les cartes vues.
• Touche Espace : ouvre un paquet puis passe à la carte suivante (un appui = une action).

✦ TAGS EN UN CLIC
• Une barre de tags s'affiche à côté de la carte pendant le révélé.
• Un clic ou les touches 1 à 9 pour poser ou retirer un tag, sans ouvrir la carte.
• Création d'un nouveau tag directement depuis la barre.

✦ TES VRAIES STATISTIQUES
• Bilan du jour et meilleure carte.
• Taux de drop réels par rareté et nombre de cartes ouvertes.
• Séries sans Légendaire, Ultra Rare, Super Rare ou shiny.
• Historique détaillé et export CSV.

✦ OUTILS SUR LES CARTES
• Liens Wikipédia et Letterboxd (films, acteurs, réalisateurs).
• Plein écran net avec inclinaison 3D, copie de la carte en image.
• Image sous licence libre (Wikipédia, Wikidata, Commons) pour les cartes qui n'en ont pas, avec le crédit de l'auteur.
• Cartes visibles directement sur la page des échanges.
• Vue compacte sur Collection et Toutes les cartes.

✦ CONFORT
• Compteur de paquets dans le titre de l'onglet et sur l'icône.
• Notification quand ta réserve est pleine, rappel du pack PRO quotidien.
• Cache local : ta collection, tes tags et tes amis s'affichent instantanément, avec un bouton « Tout mettre en cache » pour la collection. Jamais pour les échanges, le marché ou les paquets.

Chaque fonctionnalité se désactive dans les réglages.

RESPECT DU JEU
L'extension n'automatise pas l'ouverture des paquets et ne contourne aucune protection du site. Chaque action vient de toi.

CONFIDENTIALITÉ
Tout reste dans ton navigateur : aucune donnée n'est envoyée au développeur ni à un service tiers.

Extension non officielle, ni affiliée ni approuvée par WikiMasters.
Code source : https://github.com/ThePommespanzer/wikimasters-plus
```

**Catégorie** : Divertissement
**Langue** : Français

**Icône de la fiche (128 x 128)** : `extension/icons/128.png`

**Captures d'écran (1280 x 800)**, dans cet ordre :
1. `store/images/capture-1-ouverture.png`
2. `store/images/capture-2-revele.png`
3. `store/images/capture-3-tags.png`
4. `store/images/capture-4-stats.png`
5. `store/images/capture-5-cartes.png`

**Petite tuile promotionnelle (440 x 280)** : `store/images/tuile-promo-440x280.png`
**Tuile marquee (1400 x 560)**, facultative : `store/images/banniere-1400x560.png`

**Site web officiel** : `https://github.com/ThePommespanzer/wikimasters-plus`
**URL d'assistance** : `https://github.com/ThePommespanzer/wikimasters-plus/issues`

---

## Onglet « Pratiques de confidentialité » (Privacy practices)

**Description de l'objectif unique** :
```
Améliorer l'expérience de jeu sur wiki-masters.com : animations d'ouverture de paquets, statistiques de tirages, pose rapide de tags, outils sur les cartes et chargement plus rapide des pages.
```

**Justification de la permission `storage`** :
```
Enregistrer localement l'historique des paquets ouverts (pour les statistiques), l'estimation du nombre de paquets disponibles et les réglages de l'utilisateur.
```

**Justification de la permission `alarms`** :
```
Mettre à jour chaque minute le nombre de paquets estimé sur l'icône et programmer la notification de réserve pleine et le rappel du pack PRO quotidien.
```

**Justification de la permission `notifications`** :
```
Prévenir l'utilisateur quand sa réserve de paquets est pleine et lui rappeler de réclamer son pack PRO quotidien. Les deux se désactivent dans les réglages.
```

**Justification des autorisations d'hôte (wiki-masters.com)** :
```
L'extension ne fonctionne que sur wiki-masters.com : elle y affiche ses animations, son panneau de statistiques, sa barre de tags, ses boutons sur les cartes et son cache local. Elle n'accède à aucun autre site.
```

**Utilisez-vous du code distant ?** : **Non**
```
Tout le code est inclus dans le paquet de l'extension, y compris la bibliothèque html-to-image (MIT). Aucun script n'est chargé depuis l'extérieur.
```

**Utilisation des données** (cases à cocher) :
- Coche **« Contenu du site Web »** : l'extension lit les cartes affichées sur wiki-masters.com pour les statistiques et les outils. Ces données restent dans le navigateur.
- Ne coche rien d'autre (pas d'informations personnelles, d'authentification, de localisation, d'historique de navigation, etc.).
- Coche les trois certifications :
  - Je ne vends ni ne transfère les données des utilisateurs à des tiers, en dehors des cas d'utilisation approuvés.
  - Je n'utilise ni ne transfère les données des utilisateurs à des fins sans rapport avec l'objectif unique de mon élément.
  - Je n'utilise ni ne transfère les données des utilisateurs pour déterminer leur solvabilité ou à des fins de prêt.

**URL des règles de confidentialité** :
```
https://github.com/ThePommespanzer/wikimasters-plus/blob/main/PRIVACY.md
```

---

## Onglet « Distribution »

- **Visibilité** : Public (ou « Non répertorié » pour tester d'abord avec quelques amis via le lien).
- **Régions** : toutes les régions.
