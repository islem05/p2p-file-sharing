# 📂 Application de Partage de Fichiers P2P (WebRTC)

Une application web permettant le transfert de fichiers **directement entre navigateurs** (Peer-to-Peer), sans passer par un stockage serveur intermédiaire.  
Le projet utilise **WebRTC** pour le transfert de données et **Socket.io** pour la signalisation.

![Status](https://img.shields.io/badge/Status-Fonctionnel-brightgreen)
![Tech](https://img.shields.io/badge/Tech-WebRTC%20|%20React%20|%20Socket.io-blue)

---

## ✨ Fonctionnalités

- 🔐 **Authentification sécurisée**  
  Inscription et connexion des utilisateurs (stockage en mémoire).

- 🔄 **Transfert P2P réel**  
  Les fichiers ne sont **jamais stockés sur le serveur**.  
  Ils transitent directement de l’ordinateur A à l’ordinateur B.

- 📦 **Support des gros fichiers**  
  Système de découpage en morceaux (*chunking*) permettant l’envoi de fichiers volumineux (vidéos, PDF, etc.) sans crash.

- 🔍 **Recherche instantanée**  
  Moteur de recherche pour trouver les fichiers partagés par les utilisateurs connectés.

- 📊 **Feedback visuel**  
  Barre de progression en temps réel durant le téléchargement.

- 🎨 **Interface moderne**  
  UI responsive en **Tailwind CSS**, entièrement en français.

---

## 🛠️ Stack Technique

### Frontend (Client)
- **React.js** (Vite)
- **Tailwind CSS** (Styles)
- **Socket.io-client** (Communication temps réel)
- **API WebRTC**
  - `RTCPeerConnection`
  - `RTCDataChannel`

### Backend (Serveur de signalisation)
- **Node.js**
- **Express**
- **Socket.io**

> ℹ️ **Note :**  
> Le serveur agit uniquement comme un **annuaire et serveur de signalisation** pour mettre les pairs en relation.  
> **Aucune donnée de fichier n’est stockée côté serveur.**

---

## 🚀 Installation et Lancement

Le projet est divisé en deux parties :
- **Client (Frontend)**
- **Serveur (Backend)**  

Les deux doivent être lancés simultanément.

---

### ✅ Prérequis

- **Node.js** installé sur votre machine

---

### 1️⃣ Démarrer le Serveur (Backend)

Ouvrez un terminal :

```bash
cd server
npm install
node index.js 

```
### 2️⃣ Démarrer le Client (Frontend)

Ouvrez un second terminal :

```bash
cd client   # ou le nom de votre dossier frontend
npm install
npm run dev
```
L’application sera accessible via l’URL locale affichée dans le terminal  
(exemple : `http://localhost:5173`).

---

## 📖 Comment utiliser l’application

### 1️⃣ Ouvrir deux navigateurs
- Utilisez deux navigateurs différents  
  **ou**
- Un onglet normal + un onglet navigation privée  

**Exemple :** Alice et Bob

---

### 2️⃣ S’inscrire
- Créez un compte pour **Alice**
- Créez un compte pour **Bob**

---

### 3️⃣ Se connecter
- Connectez-vous avec les deux comptes

---

### 4️⃣ Partager un fichier (Alice)
- Cliquez sur la zone de gauche pour sélectionner un fichier
- Le fichier apparaît dans la liste des fichiers partagés

---

### 5️⃣ Télécharger un fichier (Bob)
- Recherchez le nom du fichier dans la barre de recherche
- Cliquez sur **« Télécharger (P2P) »**
- Suivez la barre de progression et récupérez le fichier 🎉
