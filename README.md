# TaskFlow 🗂️
**Votre gestionnaire de tâches et de notes personnel – Trello + Notion + Google Agenda**

---

## 📋 Table des matières

1. [C'est quoi TaskFlow ?](#cest-quoi-taskflow-)
2. [Ce que vous pouvez faire](#ce-que-vous-pouvez-faire)
3. [Fichiers de l'application](#fichiers-de-lapplication)
4. [Mise en ligne – Guide complet](#mise-en-ligne--guide-complet)
   - [Prérequis](#prérequis)
   - [Étape 1 – Préparer la base de données MySQL](#étape-1--préparer-la-base-de-données-mysql)
   - [Étape 2 – Configurer le fichier PHP](#étape-2--configurer-le-fichier-php)
   - [Étape 3 – Envoyer les fichiers sur le serveur](#étape-3--envoyer-les-fichiers-sur-le-serveur)
   - [Étape 4 – Configurer Google Agenda (optionnel)](#étape-4--configurer-google-agenda-optionnel)
   - [Étape 5 – Vérification finale](#étape-5--vérification-finale)
5. [Mode d'emploi de l'application](#mode-demploi-de-lapplication)
6. [Accessibilité (RGAA / WCAG)](#accessibilité-rgaa--wcag)
7. [Dépannage fréquent](#dépannage-fréquent)
8. [Questions fréquentes](#questions-fréquentes)

---

## C'est quoi TaskFlow ?

TaskFlow est une **application web tout-en-un** que vous hébergez vous-même sur votre serveur.
Elle combine trois outils populaires dans une seule interface :

| Outil d'inspiration | Ce que TaskFlow reprend |
|---|---|
| **Trello** | Tableau Kanban avec colonnes, glisser-déposer |
| **Notion** | Éditeur de notes libre, hiérarchie de pages |
| **Google Agenda** | Vue calendrier + sync de vos événements Google |

Vos données sont sauvegardées **sur votre propre serveur** (MySQL) et localement dans votre navigateur.
Vous n'avez besoin d'aucun abonnement, d'aucun service tiers payant.

---

## Ce que vous pouvez faire

### 🏠 Tableau de bord
- Vue d'ensemble de vos statistiques (tâches actives, notes, échéances, projets)
- Accès rapide aux tâches et notes récentes

### 📋 Tableau Kanban
- Colonnes personnalisables (À faire, En cours, Terminé, etc.)
- Glisser-déposer les tâches entre colonnes
- Ajouter des étiquettes, une priorité, une date d'échéance
- Filtrer par projet

### ✅ Liste de tâches
- Vue liste avec filtres (Aujourd'hui, Cette semaine, En retard, Terminées)
- Cocher/décocher une tâche
- Regroupement par projet

### 📝 Notes (éditeur)
- Créer autant de notes que vous voulez
- Titre + corps de texte libre (supporte le Markdown basique)
- Étiquettes sur les notes
- Compteur de mots
- Sauvegarde rapide avec **Ctrl+S**

### 📅 Agenda
- Calendrier mensuel
- Affiche vos tâches avec une date d'échéance
- Affiche vos événements **Google Agenda** si vous le connectez

### ⚙️ Paramètres
- Modifier votre profil (nom, e-mail, rôle)
- Connecter/déconnecter Google Agenda
- Changer le thème (clair / sombre)
- Changer la couleur d'accent
- Régler la taille du texte
- Gérer les projets
- Exporter / Importer les données en JSON

---

## Fichiers de l'application

```
taskflow/
├── index.html          ← L'application complète (HTML + CSS + JS)
├── database.sql        ← Script de création de la base MySQL
├── api/
│   └── sync.php        ← API PHP de sauvegarde/chargement
└── README.md           ← Ce fichier
```

---

## Mise en ligne – Guide complet

> 💡 **Vous débutez ?** Lisez chaque étape dans l'ordre. Pas de panique, c'est plus simple que ça en a l'air !

---

### Prérequis

Avant de commencer, vérifiez que votre hébergeur propose :

- ✅ **PHP 8.0 ou supérieur** (la plupart des hébergeurs mutualisés : o2switch, OVH, Infomaniak, Hostinger…)
- ✅ **MySQL 5.7 ou supérieur** (ou MariaDB 10.3+)
- ✅ Un accès **FTP** ou un gestionnaire de fichiers en ligne (cPanel, Plesk…)
- ✅ **phpMyAdmin** ou accès ligne de commande MySQL (généralement fourni)

---

### Étape 1 – Préparer la base de données MySQL

#### 1a. Ouvrez phpMyAdmin
La plupart des hébergeurs donnent accès à phpMyAdmin depuis leur panneau d'administration.
- Sur **cPanel** : cherchez l'icône phpMyAdmin
- Sur **Plesk** : Bases de données → phpMyAdmin
- Sur **o2switch / OVH** : Hébergement → Bases de données → phpMyAdmin

#### 1b. Créez la base de données
Dans phpMyAdmin, cliquez sur **"Nouveau"** (dans le panneau gauche).
- Nom de la base : `taskflow`
- Interclassement : `utf8mb4_unicode_ci`
- Cliquez **Créer**

#### 1c. Créez l'utilisateur MySQL
Allez dans l'onglet **"Comptes utilisateurs"** → **"Ajouter un compte utilisateur"** :
- Nom d'utilisateur : `taskflow_user`
- Hôte : `localhost`
- Mot de passe : choisissez un mot de passe fort (ex: `T@skFl0w#2025!`)
- ✅ Cochez **"Accorder tous les privilèges"** sur la base `taskflow`
- Cliquez **Exécuter**

> ⚠️ **Notez bien** le nom d'utilisateur et le mot de passe, vous en aurez besoin à l'étape suivante.

#### 1d. Importez le script SQL
- Dans phpMyAdmin, cliquez sur la base `taskflow` (panneau gauche)
- Onglet **Importer**
- Cliquez **"Choisir un fichier"** → sélectionnez `database.sql`
- Cliquez **Exécuter**
- Vous devriez voir : `1 table créée avec succès`

---

### Étape 2 – Configurer le fichier PHP

Ouvrez le fichier `api/sync.php` avec un éditeur de texte (Notepad++, VS Code, ou même le Bloc-notes).

Trouvez ces lignes en haut du fichier et modifiez-les :

```php
define('DB_HOST', 'localhost');       // Ne pas changer en général
define('DB_NAME', 'taskflow');        // Le nom de votre base
define('DB_USER', 'taskflow_user');   // Votre utilisateur MySQL
define('DB_PASS', 'MOT_DE_PASSE');    // Votre mot de passe MySQL
```

Changez aussi la clé secrète (pour la sécurité) :
```php
define('SECRET_KEY', 'CHANGEZ_CETTE_CLE_SECRETE_32_CHARS');
// Remplacez par n'importe quelle chaîne de 32 caractères aléatoires
// Ex: 'aZ9!kQ2#mP5@nR8$vT1%wX4&yU7*oS3'
```

Changez le domaine autorisé :
```php
$allowed_origins = [
    'https://votre-domaine.com',  // Remplacez par VOTRE domaine réel
```

Sauvegardez le fichier.

---

### Étape 3 – Envoyer les fichiers sur le serveur

#### Option A – Via FTP (recommandé pour débutants)

1. **Téléchargez FileZilla** (gratuit) : https://filezilla-project.org/
2. **Connectez-vous** avec vos identifiants FTP (fournis par votre hébergeur)
3. **Naviguez** dans le dossier `public_html` (ou `www`, ou `htdocs` selon l'hébergeur)
4. **Créez un dossier** `taskflow` (ou déposez directement à la racine si c'est votre site principal)
5. **Déposez tous les fichiers** dans ce dossier :
   - `index.html`
   - `database.sql` (optionnel, pas nécessaire sur le serveur)
   - le dossier `api/` avec `sync.php` à l'intérieur

La structure sur le serveur devrait ressembler à :
```
public_html/
└── taskflow/
    ├── index.html
    └── api/
        └── sync.php
```

#### Option B – Via le gestionnaire de fichiers cPanel

1. Connectez-vous à votre **cPanel**
2. Cliquez sur **"Gestionnaire de fichiers"**
3. Naviguez vers `public_html`
4. Cliquez **"Nouveau dossier"** → nommez-le `taskflow`
5. Entrez dans ce dossier
6. Cliquez **"Télécharger"** et uploadez `index.html`
7. Créez un sous-dossier `api`
8. Entrez dans `api` et uploadez `sync.php`

#### Vérification
Ouvrez votre navigateur et tapez :
`https://votre-domaine.com/taskflow/`

Vous devriez voir l'application TaskFlow se charger ! 🎉

---

### Étape 4 – Configurer Google Agenda (optionnel)

> Vous pouvez ignorer cette étape si vous n'avez pas besoin de la synchronisation Google.

#### 4a. Créer un projet Google Cloud

1. Allez sur https://console.cloud.google.com/
2. Connectez-vous avec votre compte Google
3. Cliquez **"Nouveau projet"**
4. Nommez-le `TaskFlow` → cliquez **Créer**

#### 4b. Activer l'API Google Calendar

1. Dans le menu gauche : **"API et services"** → **"Bibliothèque"**
2. Recherchez **"Google Calendar API"**
3. Cliquez dessus → **"Activer"**

#### 4c. Créer les identifiants OAuth 2.0

1. **"API et services"** → **"Identifiants"**
2. Cliquez **"+ Créer des identifiants"** → **"ID client OAuth"**
3. Type d'application : **"Application Web"**
4. Nom : `TaskFlow`
5. **"Origines JavaScript autorisées"** : ajoutez `https://votre-domaine.com`
6. Cliquez **Créer**
7. **Copiez le "Client ID"** (format: `XXXXXX.apps.googleusercontent.com`)

#### 4d. Créer une clé API

1. **"+ Créer des identifiants"** → **"Clé API"**
2. **Copiez la clé** (format: `AIzaSy...`)
3. Cliquez **"Restreindre la clé"** → sélectionnez **"API Google Calendar"** → Sauvegarder

#### 4e. Configurer dans TaskFlow

1. Ouvrez votre TaskFlow
2. Allez dans **Paramètres** → **Google Agenda**
3. Collez votre **Client ID** et votre **Clé API**
4. L'ID du calendrier : laissez `primary` pour votre calendrier principal
5. Cliquez **"Connecter Google Agenda"**
6. Autorisez l'accès dans la popup Google qui apparaît

---

### Étape 5 – Vérification finale

Checklist pour s'assurer que tout fonctionne :

- [ ] L'application s'ouvre sur `https://votre-domaine.com/taskflow/`
- [ ] Vous pouvez créer une tâche (bouton "Nouveau" en haut à droite)
- [ ] La tâche apparaît dans le tableau Kanban
- [ ] Vous pouvez créer une note et la sauvegarder avec Ctrl+S
- [ ] Le thème sombre fonctionne (icône soleil/lune en haut)
- [ ] En rechargeant la page, vos données sont toujours là (sauvegarde locale)
- [ ] (Optionnel) Google Agenda est connecté et les événements apparaissent dans l'agenda

---

## Mode d'emploi de l'application

### Créer une tâche
1. Cliquez le bouton vert **"Nouveau"** en haut à droite
2. Remplissez le titre (obligatoire)
3. Ajoutez une description, une date d'échéance, une priorité
4. Choisissez un projet (si vous en avez créé)
5. Ajoutez des étiquettes séparées par des virgules
6. Cliquez **"Créer la tâche"**

### Déplacer une tâche (Kanban)
- Allez dans **"Tableau Kanban"**
- **Cliquez et glissez** une carte vers une autre colonne
- Relâchez pour la déposer

### Créer une note
1. Allez dans **"Notes"**
2. Cliquez le **"+"** en haut de la liste des notes
3. Tapez un titre et votre contenu
4. Appuyez **Ctrl+S** (ou cliquez l'icône disquette) pour sauvegarder

### Gérer les projets
1. Allez dans **Paramètres** → **Projets**
2. Tapez le nom du projet → **Créer**
3. Vos projets apparaissent dans le menu latéral

### Changer le thème
- Cliquez l'icône ☀️/🌙 dans la barre du haut
- Ou allez dans **Paramètres** → **Apparence**

### Exporter / sauvegarder vos données
1. Allez dans **Paramètres** → **Données**
2. Cliquez **"Exporter JSON"**
3. Un fichier `taskflow-export.json` est téléchargé
4. Gardez-le comme sauvegarde !

---

## Accessibilité (RGAA / WCAG)

TaskFlow est conçu pour être accessible à tous :

| Critère | Implémentation |
|---|---|
| **Navigation clavier** | Tous les éléments interactifs sont accessibles au clavier (Tab, Entrée, Espace, Échap) |
| **Lien d'évitement** | "Aller au contenu principal" visible au focus (premier Tab) |
| **Contrastes** | Ratios conformes WCAG AA (4.5:1 minimum) |
| **ARIA** | Labels, rôles et états ARIA sur tous les composants dynamiques |
| **Annonces live** | Les changements dynamiques sont annoncés via `aria-live` |
| **Réduction de mouvement** | Les animations sont désactivées si `prefers-reduced-motion` est activé |
| **Contraste élevé** | Ajustements automatiques avec `prefers-contrast: high` |
| **Structure Hn** | Hiérarchie de titres cohérente (H1 → H2 → H3) |
| **Formulaires** | Tous les champs ont des labels explicites |
| **Modales** | Focus piégé, fermeture par Échap, `aria-modal` |
| **Tableaux** | `role="grid"`, `role="gridcell"`, `columnheader` sur le calendrier |

---

## Dépannage fréquent

### "Erreur : Connexion base de données impossible"
→ Vérifiez les valeurs `DB_HOST`, `DB_NAME`, `DB_USER`, `DB_PASS` dans `api/sync.php`
→ Vérifiez que l'utilisateur MySQL a les droits sur la base

### "Les données ne persistent pas entre sessions"
→ C'est peut-être normal : les sessions PHP expirent. Vos données sont dans localStorage.
→ Pour une persistance longue durée, assurez-vous que `api/sync.php` est accessible.

### "Google Agenda ne se connecte pas"
→ Vérifiez que votre domaine est dans les origines autorisées de la console Google Cloud
→ Vérifiez que l'API Google Calendar est bien activée
→ Essayez en navigation privée (extensions peuvent bloquer les popups)

### "Les fichiers uploadés via FTP ont des erreurs 404"
→ Vérifiez que vous avez uploadé dans le bon dossier (`public_html` ou `www`)
→ Vérifiez que les noms de fichiers sont en minuscules (Linux est sensible à la casse)

### "L'application ne charge pas sur mobile"
→ Effacez le cache du navigateur mobile
→ Vérifiez que l'URL est correcte (https://)

---

## Questions fréquentes

**Puis-je utiliser TaskFlow hors ligne ?**
Oui ! L'application fonctionne complètement en local grâce au `localStorage` du navigateur. La synchronisation avec le serveur est un bonus.

**Mes données sont-elles sécurisées ?**
Vos données sont sur VOTRE serveur. Personne d'autre n'y a accès. Nous recommandons d'utiliser HTTPS (SSL/TLS), généralement gratuit avec Let's Encrypt.

**Puis-je avoir plusieurs utilisateurs ?**
Dans la version actuelle, chaque navigateur a sa propre session. Pour un usage multi-utilisateurs avec comptes séparés, une évolution serait nécessaire.

**Puis-je modifier l'application ?**
Absolument ! Tout le code est dans `index.html` (HTML/CSS/JS) et `api/sync.php` (PHP). Modifiez librement.

**Comment mettre à jour TaskFlow ?**
Remplacez simplement `index.html` par la nouvelle version. Vos données en base MySQL sont préservées.

---

*TaskFlow – Fait avec ❤️ pour simplifier votre organisation*
