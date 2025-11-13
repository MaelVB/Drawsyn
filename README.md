# Drawsyn

Monorepo pour un prototype de jeu de dessin en temps réel façon Skribbl.io, construit avec NestJS, Next.js, Mantine et MongoDB.

## Structure

- `apps/server` — API NestJS + passerelle WebSocket (Socket.IO) gérant les salons, manches et dessins.
- `apps/web` — Frontend Next.js (App Router) utilisant Mantine pour l'UI, Zustand pour l'état client et Socket.IO pour le temps
réel.

## Démarrage rapide

```bash
# Installer les dépendances (pnpm 8+)
pnpm install

# Lancer les deux apps (Next.js + NestJS) en parallèle
pnpm run start
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

## Système d'items (boutique + inventaire)

Un premier système d'items factorisé a été ajouté côté serveur et client.

- Définition des items côté serveur: `apps/server/src/game/items/items.registry.ts` (catalogue).
- Les joueurs achètent via la boutique (modal en bas) ; le coût est déduit de leur score.
- Les items achetés apparaissent dans la barre d'inventaire (7 derniers visibles).
- Premier item disponible: "Improvisation" (100 points) qui permet au dessinateur de saisir manuellement le mot pendant la phase de choix.

Événements Socket côté client:
- `items:list` (req/réponse): obtenir le catalogue d'items disponible.
- `shop:buy` (req): acheter un item `{ itemId }`.
- `shop:purchased` (evt privé): confirmation d'achat avec l'item et le score restant.
- `item:use` (req): utiliser un item par instance `{ instanceId, params }`.

Flux Improvisation:
1. Le dessinateur ouvre la boutique, achète Improvisation (100 pts).
2. Dans la barre d'inventaire, il clique l'item et saisit le mot.
3. Le serveur démarre immédiatement la manche avec ce mot, notifie `round:started` à tous et `round:word` au dessinateur.
