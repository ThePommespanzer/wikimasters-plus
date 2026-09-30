# Politique de confidentialité de WikiMasters+

*Dernière mise à jour : 30 septembre 2026*

WikiMasters+ est une extension Chrome non officielle pour le site wiki-masters.com. Cette page explique quelles données elle utilise et ce qu'elle en fait.

## En résumé

- L'extension **ne collecte rien pour son auteur** : aucune donnée n'est envoyée au développeur ni à un service d'analyse, de publicité ou de suivi.
- Tout ce qu'elle enregistre reste **dans ton navigateur**.
- Aucune donnée n'est vendue ni transmise à des tiers.

## Données enregistrées localement

Dans le stockage de l'extension (`chrome.storage.local`) :
- l'historique des paquets que tu ouvres (date, cartes obtenues, rareté, shiny, nombre d'exemplaires), pour calculer tes statistiques ;
- une estimation de ton nombre de paquets et de leur régénération, pour le badge, le titre de l'onglet et les notifications ;
- tes réglages.

Dans le stockage du site wiki-masters.com, dans ton navigateur (IndexedDB et localStorage) :
- un cache temporaire des réponses lentes du site (collection, tags, cartes, amis, profils), pour afficher les pages plus vite. Il expire au bout de 30 minutes, est vidé à chaque modification et peut être vidé ou désactivé depuis les réglages ;
- ta liste de tags, pour afficher la barre de tags instantanément ;
- des informations publiques sur les cartes (identifiant Wikidata, image libre et son crédit, lien Letterboxd), gardées 7 jours ;
- ton choix de vue compacte.

Tu peux tout effacer en désinstallant l'extension, avec le bouton « Réinitialiser les stats » et « Vider le cache » du popup, ou en effaçant les données du site dans Chrome.

## Communications réseau

L'extension ne contacte que :
- **wiki-masters.com** et son service de données, uniquement avec ta session existante et seulement quand tu agis toi-même (par exemple poser un tag). Elle ne fait aucune requête automatique d'ouverture de paquets ;
- **Wikipédia, Wikidata et Wikimedia Commons**, pour récupérer des informations publiques sur les cartes (images libres, crédits, identifiants Letterboxd). Seul le titre de l'article est transmis.

Les liens Wikipédia et Letterboxd ne s'ouvrent que si tu cliques dessus.

## Permissions demandées

- `storage` : enregistrer tes statistiques et réglages localement.
- `alarms` : mettre à jour le badge et programmer les rappels.
- `notifications` : t'avertir quand tes paquets sont pleins et rappeler le pack PRO quotidien.
- Accès à `wiki-masters.com` : afficher les fonctionnalités sur les pages du site.

## Contact

Pour toute question : ouvre une *issue* sur le dépôt GitHub du projet.
