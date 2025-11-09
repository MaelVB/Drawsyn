# Drawsyn

Monorepo pour un prototype de jeu de dessin en temps réel façon Skribbl.io, construit avec NestJS, Next.js, Mantine et MongoDB.

## Structure

- `apps/server` — API NestJS + passerelle WebSocket (Socket.IO) gérant les salons, manches et dessins.
- `apps/web` — Frontend Next.js (App Router) utilisant Mantine pour l'UI, Zustand pour l'état client et Socket.IO pour le temps réel.

## Démarrage rapide

```bash
# Installer les dépendances (npm 9+)
npm install

# Lancer les deux apps (Next.js + NestJS) en parallèle
npm run dev
```

Par défaut, le serveur écoute sur `http://localhost:3333` et le client web sur `http://localhost:3000`.

## Variables d'environnement

### Backend (`apps/server`)

- `PORT` — port HTTP du serveur Nest (3333 par défaut).
- `CLIENT_ORIGIN` — liste d'origines autorisées (CSV) pour CORS.
- `MONGODB_URI` — URI MongoDB (optionnel pour ce squelette, par défaut `mongodb://localhost:27017/drawsyn`).
- `REDIS_URL` — URI Redis (optionnel, par défaut `redis://localhost:6379`).

### Frontend (`apps/web`)

- `NEXT_PUBLIC_GAME_SERVER` — URL du namespace Socket.IO (par défaut `http://localhost:3333/game`).

## Fonctionnalités incluses

- Création/liste de salles publiques avec état partagé (NestJS + Socket.IO + Zustand).
- Gestion des joueurs, du tour de dessin et des manches côté serveur (Round robin du dessinateur, attribution de points).
- Canvas HTML5 simple avec envoi de segments delta en temps réel.
- Chat de manche et interface Mantine responsive.
- Architecture extensible : Redis branché en provider global, Mongoose prêt pour la persistance longue durée.

Ce squelette sert de base ; libre à vous d'ajouter persistance complète, anti-triche, modération, mini-jeux, etc.
