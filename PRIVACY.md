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
- un cache temporaire des réponses lentes du site (collection, tags, cartes, amis, profils), pour afficher les pages plus vite. Il expire au bout de 30 minutes (12 heures pour la collection, les tags et les cartes), est vidé à chaque modification et peut être vidé ou désactivé depuis les réglages ;
- ta liste de tags, pour afficher la barre de tags instantanément ;
- la liste de tes cartes (titre, rareté, stats, date d'obtention) et leurs images, pour « Mes doublons » et le calcul des prix par rareté ;
- les prix estimés de tes cartes (ventes récentes publiques du marché), gardés 7 jours ;
- des informations publiques sur les cartes (identifiant Wikidata, image libre et son crédit, lien Letterboxd), gardées 7 jours ;
- ton choix de vue compacte.

Tu peux tout effacer en désinstallant l'extension, avec le bouton « Réinitialiser les stats » et « Vider le cache » du popup, ou en effaçant les données du site dans Chrome.

## Communications réseau

L'extension ne contacte que :
- **wiki-masters.com** et son service de données, uniquement avec ta session existante, déjà ouverte dans l'onglet. En plus de tes actions (poser un tag, analyser ta collection), elle fait quelques lectures discrètes pour fluidifier la navigation : les pages voisines de ta collection sont préchargées une par une, et l'analyse des doublons lit la liste de tes cartes. Les jetons de session du site ne sont ni enregistrés ni transmis ailleurs : ils restent en mémoire le temps de l'onglet. La seule action qu'elle peut faire en ton nom est la défausse d'exemplaires en double, et uniquement quand tu la demandes et la confirmes toi-même (une carte, ou tous tes doublons d'un coup, une défausse par seconde, arrêtable à tout moment). Elle garde toujours un exemplaire de chaque carte et ne défausse jamais tes shiny ni tes favoris. Elle n'ouvre jamais de paquets et ne fait jamais d'échange ni d'enchère ;
- **Wikipédia, Wikidata et Wikimedia Commons**, pour récupérer des informations publiques sur les cartes (images libres, crédits, identifiants Letterboxd). Seul le titre de l'article est transmis.

Les liens Wikipédia et Letterboxd ne s'ouvrent que si tu cliques dessus.

## Permissions demandées

- `storage` : enregistrer tes statistiques et réglages localement.
- `alarms` : mettre à jour le badge et programmer les rappels.
- `notifications` : t'avertir quand tes paquets sont pleins et rappeler le pack PRO quotidien.
- Accès à `wiki-masters.com` : afficher les fonctionnalités sur les pages du site.

## Contact

Pour toute question : ouvre une *issue* sur le dépôt GitHub du projet.
