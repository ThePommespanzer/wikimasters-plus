# Guide de publication

Ce guide explique comment mettre le projet sur GitHub puis publier l'extension sur le Chrome Web Store.
Le compte GitHub utilisé dans les liens est `ThePommespanzer`.

---

## Partie 1 : GitHub

### 1. Créer le dépôt
1. Va sur https://github.com/new
2. **Repository name** : `wikimasters-plus`
3. **Description** : `Extension Chrome non officielle pour WikiMasters : révélé animé, stats, tags rapides, outils de carte.`
4. **Public**. Ne coche pas « Add a README » (il existe déjà).
5. Clique sur **Create repository**.

### 2. Envoyer le code

**Option A : en ligne de commande** (dans le dossier dézippé `wikimasters-plus-repo`) :
```bash
git init
git add .
git commit -m "WikiMasters+ 1.8.0"
git branch -M main
git remote add origin https://github.com/ThePommespanzer/wikimasters-plus.git
git push -u origin main
```

**Option B : sans ligne de commande**
Sur la page du dépôt vide, clique sur **uploading an existing file**, glisse tout le contenu du dossier `wikimasters-plus-repo` (pas le dossier lui-même), puis **Commit changes**.

### 3. Compléter la page du dépôt
- Dans **About** (roue dentée à droite) : ajoute la description et les *topics* `chrome-extension`, `wikimasters`, `manifest-v3`.
- Après la publication sur le store, ajoute le lien du store dans **Website** et dans le `README.md`.

### 4. Créer une release
1. Crée le zip Chrome : `./scripts/package.sh` (ou zippe le **contenu** du dossier `extension/`).
2. Sur GitHub : **Releases** → **Draft a new release**.
3. **Tag** : `v1.8.0` · **Titre** : `WikiMasters+ 1.8.0`.
4. Colle le contenu de `CHANGELOG.md` pour la version.
5. Lance aussi `./scripts/package-firefox.sh`, puis joins **les deux zips** : `dist/wikimasters-plus-X.Y.Z.zip` (Chrome) et `dist/wikimasters-plus-firefox-X.Y.Z.zip` (Firefox). Clique sur **Publish release**.
   Les zips ne se mettent pas dans le code du dépôt (le dossier `dist/` est ignoré), uniquement dans les releases.

---

## Partie 2 : Chrome Web Store

### 1. Créer le compte développeur (une seule fois)
1. Va sur https://chrome.google.com/webstore/devconsole
2. Connecte-toi avec le compte Google qui publiera l'extension (la validation en deux étapes doit être activée).
3. Accepte le contrat et paie les **frais d'inscription uniques de 5 $**.
4. Dans **Compte** : renseigne l'adresse e-mail de contact et vérifie-la.
5. Statut de **marchand** (obligation européenne) : pour un projet perso gratuit, déclare-toi **non-marchand**.

### 2. Envoyer l'extension
1. Dans la console, clique sur **Nouvel élément**.
2. Envoie le zip `dist/wikimasters-plus-X.Y.Z.zip`.
   Le zip doit contenir `manifest.json` **à la racine** (pas dans un sous-dossier).

### 3. Remplir les onglets
Tous les textes sont prêts dans `store/fiche-chrome-web-store.md` :
- **Fiche Play Store** : description, catégorie, langue, icône, captures d'écran, tuiles promo.
- **Pratiques de confidentialité** : objectif unique, justification de chaque permission, code distant (Non), données, URL des règles de confidentialité.
- **Distribution** : Public, toutes les régions.

### 4. Soumettre
1. Clique sur **Envoyer pour examen**.
2. L'examen prend en général de quelques jours à une ou deux semaines. Les autorisations d'hôte déclenchent parfois un examen plus poussé.
3. Tu reçois un e-mail à l'acceptation. Tu peux choisir une publication automatique ou manuelle après validation.

### 5. Publier une mise à jour
1. Augmente `version` dans `extension/manifest.json` (ex. `1.8.1`) et complète `CHANGELOG.md`.
2. `./scripts/package.sh`
3. Console du store → ton élément → **Package** → **Importer un nouveau package** → **Envoyer pour examen**.
4. Crée la release GitHub correspondante.

---

## Points à surveiller pour l'examen

- **Nom et marque** : la fiche indique clairement « Extension non officielle ». Si Google ou WikiMasters demande un autre nom, une option sûre est « WM+ pour WikiMasters ».
- **Icône** : l'icône de l'extension est originale (carte et étoile) et ne reprend pas le logo du site. Garde-la comme ça.
- **Captures d'écran** : elles viennent d'une maquette neutre avec des illustrations originales, pas du vrai site. Tu peux les remplacer par de vraies captures de ton écran si tu préfères.
- **Pas d'automatisation** : l'extension ne fait aucune ouverture de paquet automatique. Ne jamais en ajouter, c'est contraire aux règles du site et au store.
- **Confidentialité** : si tu ajoutes un jour une fonctionnalité qui envoie des données hors du navigateur, mets à jour `PRIVACY.md` et l'onglet « Pratiques de confidentialité ».

---

## Partie 3 : Firefox (addons.mozilla.org)

Le code est le même que pour Chrome. Seul le manifest change : il est dans `firefox/manifest.json` (script de fond déclaré en `background.scripts`, identifiant `wikimasters-plus@pommespanzer`, Firefox 128 minimum, déclaration « aucune donnée collectée »).

### Tester en local
1. `./scripts/package-firefox.sh` crée le dossier `dist/firefox` et le zip `dist/wikimasters-plus-firefox-X.Y.Z.zip`.
2. Dans Firefox : `about:debugging` → **Ce Firefox** → **Charger un module complémentaire temporaire** → choisis `dist/firefox/manifest.json` (ou directement le zip).
3. Firefox demande l'accès à wiki-masters.com : si ce n'est pas le cas, va dans `about:addons` → WikiMasters+ → **Permissions** et active l'accès au site.
4. Le module reste chargé jusqu'à la fermeture de Firefox.

### Publier
1. Crée un compte sur https://addons.mozilla.org/developers/ (gratuit).
2. **Soumettre un nouveau module** → **Sur ce site** (listé publiquement).
3. Envoie `dist/wikimasters-plus-firefox-X.Y.Z.zip`.
4. Quand AMO demande le **code source** : le code n'est ni minifié ni généré (la seule bibliothèque, `lib/html-to-image.js`, est la version officielle publiée sur npm, version 1.11.13). Réponds « Non ».
5. Reprends les textes de `store/fiche-chrome-web-store.md` (résumé, description, catégorie « Jeux » ou « Divertissement »), les captures d'écran et le lien vers `PRIVACY.md`.
6. Licence : MIT.

### À savoir
- L'outil de vérification de Mozilla (`npx web-ext lint -s dist/firefox`) ne remonte **aucune erreur**, seulement des avertissements `innerHTML`. Toutes les valeurs insérées sont échappées, tu peux le préciser dans les notes pour les examinateurs.
- Pour une mise à jour : augmente `version` dans **les deux** manifests (`extension/manifest.json` et `firefox/manifest.json`), puis relance les deux scripts.
