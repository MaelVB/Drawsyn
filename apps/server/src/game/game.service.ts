import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import type { Server } from 'socket.io';

import { CreateRoomDto } from './dto/create-room.dto';
import { GuessDto } from './dto/guess.dto';
import { UpdateRoomSettingsDto } from './dto/update-room-settings.dto';
import { LobbyService } from './lobby.service';
import { PlayerState, RoomState, ItemId, PlayerItem, DrawingRecord } from './types/game-state';
import { Game } from './schemas/game.schema';
import * as fs from 'fs';
import * as path from 'path';
import { listItems, ITEMS } from './items/items.registry';
import { randomUUID } from 'crypto';

interface JoinContext {
  roomId: string;
  userId: string;
  pseudo: string;
}

export interface JoinRoomResult {
  room: RoomState;
  player: PlayerState;
}

@Injectable()
export class GameService {
  private readonly logger = new Logger(GameService.name);
  private readonly words = ['anticonstitutionnellement', 'bibliothèque', 'arc-en-ciel'];
  private server?: Server; // Attaché par le gateway pour pouvoir émettre des events
  private readonly timers = new Map<string, NodeJS.Timeout>();
  private readonly drawingBuffs = new Map<string, number>();
  private readonly chatBlocks = new Map<string, number>();

  constructor(private readonly lobby: LobbyService, @InjectModel(Game.name) private readonly gameModel: Model<Game>) {}

  listRooms(): RoomState[] {
    // Ne renvoyer que les rooms publiques
    return this.lobby.listRooms().filter((r) => !r.isPrivate);
  }

  createRoom(dto: CreateRoomDto, hostId: string): RoomState {
    // Déterminer la capacité au plus tôt si les équipes sont fournies
    let computedMax = dto.maxPlayers;
    if (dto.teamCount && dto.teamSize) {
      computedMax = dto.teamCount * dto.teamSize;
    }
    const fallbackMax = computedMax ?? 24; // valeur par défaut large
    return this.lobby.createRoom({
      name: dto.name,
      maxPlayers: fallbackMax,
      roundDuration: dto.roundDuration,
      totalRounds: dto.totalRounds,
      hostId,
      teamCount: dto.teamCount,
      teamSize: dto.teamSize,
      isPrivate: dto.isPrivate ?? false
    });
  }

  updateRoomSettings(roomId: string, playerId: string, dto: UpdateRoomSettingsDto): RoomState {
    const room = this.lobby.getRoom(roomId);
    if (!room) {
      this.logger.warn(`updateRoomSettings: Room ${roomId} not found`);
      throw new Error('Room not found');
    }
    if (room.hostId !== playerId) {
      this.logger.warn(`updateRoomSettings: Player ${playerId} is not the host of room ${roomId}`);
      throw new Error('Seul l\'hôte peut modifier les paramètres de la room');
    }
    if (room.status !== 'lobby') {
      this.logger.warn(`updateRoomSettings: Cannot update settings while game running (${room.status})`);
      throw new Error('Impossible de modifier les paramètres pendant une manche');
    }

    // Appliquer uniquement si présents
    if (typeof dto.maxPlayers === 'number') {
      room.maxPlayers = dto.maxPlayers;
    }
    if (typeof dto.roundDuration === 'number') {
      // Autoriser 0 (illimité) ou une valeur comprise entre 30 et 240
      if (dto.roundDuration !== 0 && (dto.roundDuration < 30 || dto.roundDuration > 240)) {
        throw new Error('Durée de manche invalide');
      }
      room.roundDuration = dto.roundDuration;
    }
    if (typeof dto.totalRounds === 'number') {
      room.totalRounds = dto.totalRounds;
    }
    // Équipes
    if (typeof dto.teamCount === 'number') {
      room.teamCount = dto.teamCount;
    }
    if (typeof dto.teamSize === 'number') {
      room.teamSize = dto.teamSize;
    }
    // Validation simple: si les équipes sont activées, il faut au moins 2 équipes
    if (room.teamCount != null && room.teamCount < 2) {
      throw new Error('Au moins 2 équipes sont requises');
    }
    if (room.teamCount != null && room.teamSize != null) {
      const capacity = room.teamCount * room.teamSize;
      if (capacity < 2) {
        throw new Error('Configuration des équipes invalide');
      }
      // Recalculer automatiquement la capacité d'accueil maximale
      room.maxPlayers = capacity;
    }
    // Items gratuits
    if (typeof dto.itemsFree === 'boolean') {
      room.itemsFree = dto.itemsFree;
    }
    room.lastActivityAt = Date.now();
    this.lobby.upsertRoom(room);
    return room;
  }

  joinRoom(context: JoinContext): JoinRoomResult {
    const room = this.lobby.getRoom(context.roomId);
    if (!room) {
      this.logger.error(`joinRoom: Room ${context.roomId} not found`);
      throw new Error('Room not found');
    }

    const existing = room.players[context.userId];
    const connectedPlayers = Object.values(room.players).filter(p => p.connected && p.id !== context.userId);
    
    if (existing) {
      this.logger.log(`Player ${context.pseudo} reconnecting to room ${room.name} (score: ${existing.score})`);
    } else {
      this.logger.log(`New player ${context.pseudo} joining room ${room.name}`);
    }
    
    if (!existing && connectedPlayers.length >= room.maxPlayers) {
      this.logger.warn(`Room ${room.name} is full (${connectedPlayers.length}/${room.maxPlayers})`);
      throw new Error('Room is full');
    }
    
    const player: PlayerState = existing
      ? {
          ...existing,
          name: context.pseudo,
          connected: true,
          inventory: existing.inventory ?? []
        }
      : {
          id: context.userId,
          name: context.pseudo,
          score: 0,
          isDrawing: false,
          connected: true,
          joinOrder: Object.values(room.players).length, // ordre actuel avant insertion
          inventory: []
        };

    room.players[player.id] = player;

    // Maintenir l'ordre déterministe des dessinateurs
    if (!room.drawerOrder) room.drawerOrder = [];
    if (!room.drawerOrder.includes(player.id)) {
      room.drawerOrder.push(player.id);
    }
    room.lastActivityAt = Date.now();
    this.lobby.upsertRoom(room);

    this.logger.log(`Room ${room.name} now has ${Object.values(room.players).filter(p => p.connected).length} connected players`);

    return { room, player };
  }

  // ===================== Items API =====================
  getAvailableItems() {
    return listItems();
  }

  purchaseItem(roomId: string, playerId: string, itemId: ItemId) {
    const room = this.lobby.getRoom(roomId);
    if (!room) throw new Error('Room not found');
    const player = room.players[playerId];
    if (!player) throw new Error('Player not found');
    const def = ITEMS[itemId];
    if (!def) throw new Error('Item inconnu');
    if (room.status === 'ended') throw new Error('La partie est terminée');
    const free = room.itemsFree === true;
    if (!free && player.score < def.cost) throw new Error('Score insuffisant');
    
    // Limite d'inventaire côté serveur: ne pas autoriser plus de 7 items
    const MAX_ITEMS = 7;
    if (!player.inventory) player.inventory = [];
    if (player.inventory.length >= MAX_ITEMS) {
      throw new Error(`Inventaire plein (max ${MAX_ITEMS})`);
    }

    if (!free) {
      player.score -= def.cost;
    }
    const item: PlayerItem = {
      instanceId: randomUUID(),
      itemId,
      acquiredAt: Date.now(),
      consumed: false
    };
    if (!player.inventory) player.inventory = [];
    player.inventory.push(item);
    room.lastActivityAt = Date.now();
    this.lobby.upsertRoom(room);

    // Notifier uniquement le joueur pour l'achat + mettre à jour la room
    this.emitToPlayer(playerId, 'shop:purchased', { item, score: player.score });
    this.emitToRoom(room.id, 'room:state', {
      ...room,
      connectedPlayers: Object.values(room.players).filter(p => p.connected).length,
      totalPlayers: Object.keys(room.players).length
    });
  }

  private consumePlayerItem(room: RoomState, playerId: string, item: PlayerItem) {
    const player = room.players[playerId];
    if (!player) throw new Error('Player not found');
    if (!player.inventory) player.inventory = [];
    const idx = player.inventory.findIndex((it) => it.instanceId === item.instanceId && !it.consumed);
    if (idx === -1) throw new Error('Item non disponible');
    player.inventory[idx].consumed = true;
    player.inventory.splice(idx, 1);
  }

  useItem(roomId: string, playerId: string, instanceId: string, params?: any) {
    const room = this.lobby.getRoom(roomId);
    if (!room) throw new Error('Room not found');
    const player = room.players[playerId];
    if (!player) throw new Error('Player not found');
    if (!player.inventory) player.inventory = [];
    let idx = player.inventory.findIndex(it => it.instanceId === instanceId && !it.consumed);
    let item: PlayerItem | undefined = idx !== -1 ? player.inventory[idx] : undefined;
    // Autoriser l'utilisation si l'instance a été pré-consommée pour Improvisation
    if (!item && room.pendingImprovisationInstanceId === instanceId) {
      // reconstruire minimalement pour router
      item = { instanceId, itemId: 'improvisation', acquiredAt: Date.now(), consumed: true };
    }
    if (!item) throw new Error('Item non disponible');
    const def = ITEMS[item.itemId];
    if (!def) throw new Error('Item inconnu');

    // Router selon l'item
    switch (item.itemId) {
      case 'improvisation':
        this.applyImprovisation(room, playerId, item, params);
        break;
      case 'party_time':
        this.applyPartyTime(room, playerId, item, params);
        break;
      case 'crt':
        this.applyCrt(room, playerId, item, params);
        break;
      case 'early_bird':
        this.applyEarlyBird(room, playerId, item);
        break;
      case 'paralysis':
        this.applyParalysis(room, playerId, item, params);
        break;
      case 'unsolicited_help':
        this.applyUnsolicitedHelp(room, playerId, item);
        break;
      case 'ad_break':
        this.applyAdBreak(room, playerId, item, params);
        break;
      case 'spy':
        this.applySpy(room, playerId, item, params);
        break;
      default:
        throw new Error('Item non pris en charge');
    }
  }

  private applyImprovisation(room: RoomState, playerId: string, item: PlayerItem, params?: { word?: string }) {
    // Doit être utilisé pendant la phase de choix par le dessinateur
    if (room.status !== 'choosing' || !room.drawerOrder || room.currentDrawerIndex == null) {
      throw new Error("L'Improvisation ne peut être utilisée qu'au moment du choix du mot");
    }
    const drawerId = room.drawerOrder[room.currentDrawerIndex];
    if (drawerId !== playerId) {
      throw new Error('Seul le dessinateur peut utiliser cet item');
    }
    const word = (params?.word ?? '').trim();
    if (!word || word.length < 2 || word.length > 20) {
      throw new Error('Mot invalide (2-20 lettres)');
    }

    // Marquer l'item comme consommé et le retirer visiblement de l'inventaire
    const player = room.players[playerId];
    if (!player.inventory) player.inventory = [];
    const invIdx = player.inventory.findIndex((it) => it.instanceId === item.instanceId);
    if (invIdx !== -1) {
      player.inventory[invIdx].consumed = true;
      player.inventory.splice(invIdx, 1);
    }
    // Si l'instance avait été pré-consommée, nettoyer le flag
    if (room.pendingImprovisationInstanceId === item.instanceId) {
      room.pendingImprovisationInstanceId = undefined;
    }

    // Calculer le score total : 100 × nombre de joueurs connectés
    const connectedPlayersCount = Object.values(room.players).filter(p => p.connected).length;
    const totalScore = connectedPlayersCount * 100;

    // Créer le round avec le mot choisi manuellement
    const round = {
      word,
      revealed: word.replace(/./g, '_'),
      drawerId,
      startedAt: Date.now(),
      // Si roundDuration === 0 => mode illimité => ne pas définir roundEndsAt
      roundEndsAt: room.roundDuration > 0 ? Date.now() + room.roundDuration * 1000 : undefined,
      guessedPlayerIds: [],
      revealedIndices: [],
      totalScore,
      turnIndex: (room.turnCounter = (room.turnCounter ?? 0) + 1)
    };
    room.round = round;
    room.status = 'running';
    room.pendingWordChoices = undefined;
    room.lastActivityAt = Date.now();
    this.lobby.upsertRoom(room);

    // Démarrer la manche (seulement si une durée est définie)
    if (room.round?.roundEndsAt) {
      this.startTimer(room.id);
    }
    // Informer l'utilisation de l'item (sans dévoiler le mot)
    this.emitToRoom(room.id, 'item:used', { itemId: 'improvisation', playerId });
    // Notifier le début de manche
    this.emitToRoom(room.id, 'round:started', {
      drawerId: round.drawerId,
      roundEndsAt: round.roundEndsAt,
      revealed: round.revealed,
      currentRound: room.currentRound,
      totalRounds: room.totalRounds
    });
    // Envoyer le mot en privé au dessinateur
    this.emitToPlayer(round.drawerId, 'round:word', { word: round.word });
  }

  private applyPartyTime(room: RoomState, playerId: string, item: PlayerItem, params?: { targetId?: string }) {
    const targetId = params?.targetId;
    if (!targetId) throw new Error('Aucun joueur ciblé');
    if (targetId === playerId) throw new Error('Cible invalide');
    const target = room.players[targetId];
    if (!target) throw new Error('Joueur cible introuvable');
    if (!target.connected) throw new Error('Le joueur ciblé est déconnecté');

    this.consumePlayerItem(room, playerId, item);

    room.lastActivityAt = Date.now();
    this.lobby.upsertRoom(room);

    this.emitToRoom(room.id, 'room:state', {
      ...room,
      connectedPlayers: Object.values(room.players).filter(p => p.connected).length,
      totalPlayers: Object.keys(room.players).length
    });

    this.emitToRoom(room.id, 'item:used', { itemId: 'party_time', playerId, targetId });
    this.emitToPlayer(targetId, 'effect:party-time', {
      durationMs: 10000,
      fromPlayerId: playerId
    });
  }

  private applyCrt(room: RoomState, playerId: string, item: PlayerItem, params?: { targetId?: string }) {
    const targetId = params?.targetId;
    if (!targetId) throw new Error('Aucun joueur ciblé');
    if (targetId === playerId) throw new Error('Cible invalide');
    const target = room.players[targetId];
    if (!target) throw new Error('Joueur cible introuvable');
    if (!target.connected) throw new Error('Le joueur ciblé est déconnecté');

    this.consumePlayerItem(room, playerId, item);

    room.lastActivityAt = Date.now();
    this.lobby.upsertRoom(room);

    this.emitToRoom(room.id, 'room:state', {
      ...room,
      connectedPlayers: Object.values(room.players).filter(p => p.connected).length,
      totalPlayers: Object.keys(room.players).length
    });

    this.emitToRoom(room.id, 'item:used', { itemId: 'crt', playerId, targetId });
    this.emitToPlayer(targetId, 'effect:crt', {
      durationMs: 15000,
      fromPlayerId: playerId
    });
  }

  private applyEarlyBird(room: RoomState, playerId: string, item: PlayerItem) {
    if (!room.round) throw new Error('Aucune manche en cours');
    this.consumePlayerItem(room, playerId, item);

    const word = room.round.word;
    const revealedIndices = [...(room.round.revealedIndices ?? [])];
    const hiddenIndices = Array.from({ length: word.length }, (_, i) => i).filter((idx) => !revealedIndices.includes(idx));
    if (hiddenIndices.length > 0) {
      const randomIndex = hiddenIndices[Math.floor(Math.random() * hiddenIndices.length)];
      revealedIndices.push(randomIndex);
    }
    const revealed = this.buildRevealedString(word, revealedIndices);

    room.lastActivityAt = Date.now();
    this.lobby.upsertRoom(room);

    this.emitToRoom(room.id, 'room:state', {
      ...room,
      connectedPlayers: Object.values(room.players).filter(p => p.connected).length,
      totalPlayers: Object.keys(room.players).length
    });

    this.emitToRoom(room.id, 'item:used', { itemId: 'early_bird', playerId });
    this.emitToPlayer(playerId, 'effect:early-bird', { revealed });
  }

  private applyParalysis(room: RoomState, playerId: string, item: PlayerItem, params?: { targetId?: string }) {
    const targetId = params?.targetId;
    if (!targetId) throw new Error('Aucun joueur ciblé');
    if (targetId === playerId) throw new Error('Cible invalide');
    const target = room.players[targetId];
    if (!target) throw new Error('Joueur cible introuvable');
    if (!target.connected) throw new Error('Le joueur ciblé est déconnecté');

    this.consumePlayerItem(room, playerId, item);
    const key = `${room.id}:${targetId}`;
    const durationMs = 10000;
    this.chatBlocks.set(key, Date.now() + durationMs);

    room.lastActivityAt = Date.now();
    this.lobby.upsertRoom(room);
    this.emitToRoom(room.id, 'room:state', {
      ...room,
      connectedPlayers: Object.values(room.players).filter(p => p.connected).length,
      totalPlayers: Object.keys(room.players).length
    });

    this.emitToRoom(room.id, 'item:used', { itemId: 'paralysis', playerId, targetId });
    this.emitToPlayer(targetId, 'effect:paralysis', { durationMs, fromPlayerId: playerId });
  }

  private applyUnsolicitedHelp(room: RoomState, playerId: string, item: PlayerItem) {
    if (!room.round) throw new Error('Aucune manche en cours');
    if (room.round.drawerId === playerId) throw new Error('Le dessinateur ne peut pas utiliser cet item');

    this.consumePlayerItem(room, playerId, item);
    const durationMs = 15000;
    const key = `${room.id}:${playerId}`;
    this.drawingBuffs.set(key, Date.now() + durationMs);

    room.lastActivityAt = Date.now();
    this.lobby.upsertRoom(room);
    this.emitToRoom(room.id, 'room:state', {
      ...room,
      connectedPlayers: Object.values(room.players).filter(p => p.connected).length,
      totalPlayers: Object.keys(room.players).length
    });

    this.emitToRoom(room.id, 'item:used', { itemId: 'unsolicited_help', playerId });
    this.emitToPlayer(playerId, 'effect:unsolicited-help', { durationMs });
  }

  private applyAdBreak(room: RoomState, playerId: string, item: PlayerItem, params?: { targetId?: string }) {
    const targetId = params?.targetId;
    if (!targetId) throw new Error('Aucun joueur ciblé');
    if (targetId === playerId) throw new Error('Cible invalide');
    const target = room.players[targetId];
    if (!target) throw new Error('Joueur cible introuvable');
    if (!target.connected) throw new Error('Le joueur ciblé est déconnecté');

    this.consumePlayerItem(room, playerId, item);
    const durationMs = 10000;

    room.lastActivityAt = Date.now();
    this.lobby.upsertRoom(room);
    this.emitToRoom(room.id, 'room:state', {
      ...room,
      connectedPlayers: Object.values(room.players).filter(p => p.connected).length,
      totalPlayers: Object.keys(room.players).length
    });

    this.emitToRoom(room.id, 'item:used', { itemId: 'ad_break', playerId, targetId });
    this.emitToPlayer(targetId, 'effect:ad-break', { durationMs, twitchUrl: target.twitchUrl ?? null, fromPlayerId: playerId });
  }

  private applySpy(room: RoomState, playerId: string, item: PlayerItem, params?: { targetId?: string }) {
    const targetId = params?.targetId;
    if (!targetId) throw new Error('Aucun joueur ciblé');
    if (targetId === playerId) throw new Error('Cible invalide');
    const target = room.players[targetId];
    if (!target) throw new Error('Joueur cible introuvable');
    if (!target.teamId) throw new Error('Ce joueur ne fait partie d\'aucune équipe');

    const sameTeamPlayers = Object.values(room.players)
      .filter((p) => p.teamId === target.teamId)
      .map((p) => p.id);

    this.consumePlayerItem(room, playerId, item);
    room.lastActivityAt = Date.now();
    this.lobby.upsertRoom(room);
    this.emitToRoom(room.id, 'room:state', {
      ...room,
      connectedPlayers: Object.values(room.players).filter(p => p.connected).length,
      totalPlayers: Object.keys(room.players).length
    });

    this.emitToRoom(room.id, 'item:used', { itemId: 'spy', playerId, targetId });
    this.emitToPlayer(playerId, 'teams:revealed', { playerIds: sameTeamPlayers });
  }

  initiateImprovisation(roomId: string, playerId: string, instanceId: string) {
    const room = this.lobby.getRoom(roomId);
    if (!room) throw new Error('Room not found');
    const player = room.players[playerId];
    if (!player) throw new Error('Player not found');
    if (room.status !== 'choosing' || !room.drawerOrder || room.currentDrawerIndex == null) {
      throw new Error("Improvisation utilisable uniquement pendant la sélection du mot");
    }
    const drawerId = room.drawerOrder[room.currentDrawerIndex];
    if (drawerId !== playerId) throw new Error('Seul le dessinateur peut initier Improvisation');
    if (!player.inventory) player.inventory = [];
    const idx = player.inventory.findIndex(it => it.instanceId === instanceId && it.itemId === 'improvisation' && !it.consumed);
    if (idx === -1) throw new Error('Item non disponible');

    // Consommer immédiatement et retirer de l'inventaire
    player.inventory[idx].consumed = true;
    player.inventory.splice(idx, 1);
    room.pendingImprovisationInstanceId = instanceId;
    room.lastActivityAt = Date.now();
    this.lobby.upsertRoom(room);
    // Rafraîchir l'état de room
    this.emitToRoom(room.id, 'room:state', {
      ...room,
      connectedPlayers: Object.values(room.players).filter(p => p.connected).length,
      totalPlayers: Object.keys(room.players).length
    });
  }

  leaveRoom(roomId: string, playerId: string): RoomState | undefined {
    const room = this.lobby.getRoom(roomId);
    if (!room) {
      this.logger.warn(`leaveRoom: Room ${roomId} not found`);
      return undefined;
    }

    const player = room.players[playerId];
    if (!player) {
      this.logger.warn(`leaveRoom: Player ${playerId} not found in room ${roomId}`);
      return room;
    }

    this.logger.log(`Player ${player.name} (${playerId}) leaving room ${room.name} (${roomId})`);

    // Marquer le joueur comme déconnecté au lieu de le supprimer
    player.connected = false;
    room.lastActivityAt = Date.now();

    const connectedPlayers = Object.values(room.players).filter(p => p.connected);
    this.logger.log(`Joueurs restants connectés: ${connectedPlayers.length}/${Object.keys(room.players).length}`);

    // Si l'hôte quitte, transférer le rôle au joueur suivant
    if (room.hostId === playerId && connectedPlayers.length > 0) {
      const newHost = connectedPlayers[0];
      room.hostId = newHost.id;
      this.logger.log(`Host ${player.name} left, transferring to ${newHost.name} (${newHost.id})`);
    }

    // Si le dessinateur se déconnecte pendant un round, passer au tour suivant
    if (room.round?.drawerId === playerId && room.status === 'running') {
      this.logger.warn(`Drawer ${player.name} left room ${room.name}, skipping to next turn`);
      this.endTurn(room.id, 'drawer-disconnected');
    }
    // Si on est en phase de choix et que le dessinateur se déconnecte, passer au suivant
    if (room.status === 'choosing' && room.drawerOrder && room.currentDrawerIndex != null) {
      const currentDrawerId = room.drawerOrder[room.currentDrawerIndex];
      if (currentDrawerId === playerId) {
        this.logger.warn(`Drawer ${player.name} left during choosing in room ${room.name}, moving to next`);
        // Avancer au prochain joueur connecté
        let nextIndex = (room.currentDrawerIndex + 1) % room.drawerOrder.length;
        let safety = 0;
        while (!room.players[room.drawerOrder[nextIndex]]?.connected && safety < room.drawerOrder.length) {
          nextIndex = (nextIndex + 1) % room.drawerOrder.length;
          safety++;
        }
        if (safety < room.drawerOrder.length) {
          room.currentDrawerIndex = nextIndex;
          room.pendingWordChoices = undefined;
          this.lobby.upsertRoom(room);
          this.startTurn(room);
        } else {
          // Personne de connecté
          room.status = 'lobby';
          room.pendingWordChoices = undefined;
          this.lobby.upsertRoom(room);
        }
      }
    }

    // Si plus aucun joueur connecté, arrêter le timer et retourner au lobby
    if (connectedPlayers.length === 0) {
      this.clearTimer(room.id);
      if (room.status === 'running') {
        room.status = 'lobby';
        room.round = undefined;
      }
    }

    this.lobby.upsertRoom(room);
    return room;
  }

  canDraw(playerId: string, roomId: string): boolean {
    const room = this.lobby.getRoom(roomId);
    if (!room?.round) return false;

    if (room.round.drawerId === playerId) return true;

    const key = `${room.id}:${playerId}`;
    const expiresAt = this.drawingBuffs.get(key);
    if (expiresAt && expiresAt > Date.now()) {
      return true;
    }
    if (expiresAt && expiresAt <= Date.now()) {
      this.drawingBuffs.delete(key);
    }
    return false;
  }

  updateRoomActivity(roomId: string): void {
    const room = this.lobby.getRoom(roomId);
    if (room) {
      room.lastActivityAt = Date.now();
      this.lobby.upsertRoom(room);
    }
  }

  submitGuess(playerId: string, dto: GuessDto) {
    const room = this.lobby.getRoom(dto.roomId);
    if (!room || !room.round) {
      return { correct: false, room: undefined };
    }
    const blockKey = `${room.id}:${playerId}`;
    const blockedUntil = this.chatBlocks.get(blockKey);
    if (blockedUntil && blockedUntil > Date.now()) {
      return { correct: false, room };
    }
    if (blockedUntil && blockedUntil <= Date.now()) {
      this.chatBlocks.delete(blockKey);
    }
    room.lastActivityAt = Date.now();
    const normalized = dto.text.trim().toLowerCase();
    const expected = room.round.word.toLowerCase();

    if (normalized === expected && room.round.drawerId !== playerId) {
      // Vérifier si le joueur n'a pas déjà trouvé
      if (room.round.guessedPlayerIds.includes(playerId)) {
        return { correct: false, room };
      }

      // Ajouter le joueur à la liste des joueurs qui ont trouvé
      room.round.guessedPlayerIds.push(playerId);
      
      // Calculer le score en fonction de l'ordre de découverte
      const position = room.round.guessedPlayerIds.length; // 1er, 2ème, 3ème, etc.
      const totalScore = room.round.totalScore ?? 0;
      let scorePercentage = 0;
      
      switch (position) {
        case 1: scorePercentage = 0.50; break; // 50%
        case 2: scorePercentage = 0.30; break; // 30%
        case 3: scorePercentage = 0.20; break; // 20%
        case 4: scorePercentage = 0.10; break; // 10%
        default: scorePercentage = 0.05; break; // 5% pour le 5ème et suivants
      }
      
      const earnedPoints = Math.round(totalScore * scorePercentage);
      const player = room.players[playerId];
      if (player) {
        player.score += earnedPoints;
      }
      
      // Réduire le timer de 5% du temps restant (arrondi supérieur)
      if (room.round.roundEndsAt != null) {
        const remainingMs = room.round.roundEndsAt - Date.now();
        if (remainingMs > 0) {
          const reductionMs = Math.ceil(remainingMs * 0.05);
          room.round.roundEndsAt -= reductionMs;
          this.logger.log(`Timer reduced by ${reductionMs}ms (5% of ${remainingMs}ms remaining)`);
        }
      }
      
      this.lobby.upsertRoom(room);

      // Vérifier si tout le monde (hors dessinateur) a trouvé
      const connectedPlayers = Object.values(room.players).filter(p => p.connected && p.id !== room.round!.drawerId);
      const allGuessed = room.round.guessedPlayerIds.length >= connectedPlayers.length;
      if (allGuessed) {
        this.endTurn(room.id, 'all-guessed');
      } else {
        // Notifier la bonne réponse avec les détails
        this.emitToRoom(room.id, 'guess:correct', { 
          playerId, 
          word: room.round.word,
          position,
          earnedPoints,
          newTimer: room.round.roundEndsAt
        });
      }
      return { correct: true, room, playerId };
    }

    return { correct: false, room };
  }

  private startTurn(room: RoomState) {
    // Assurer données de séquence
    if (!room.drawerOrder) {
      room.drawerOrder = Object.values(room.players)
        .sort((a, b) => (a.joinOrder ?? 0) - (b.joinOrder ?? 0))
        .map(p => p.id);
    }
    if (room.currentDrawerIndex == null || room.currentDrawerIndex < 0) {
      // La partie commence par le premier à avoir rejoint
      room.currentDrawerIndex = 0;
    }
    const drawerId = room.drawerOrder[room.currentDrawerIndex];
    const drawer = room.players[drawerId];
    if (!drawer || !drawer.connected) {
      // Chercher prochain dessinateur connecté
      const nextIdx = room.drawerOrder.findIndex(id => room.players[id]?.connected);
      if (nextIdx === -1) return; // personne
      room.currentDrawerIndex = nextIdx;
    }
    const finalDrawerId = room.drawerOrder[room.currentDrawerIndex];
  Object.values(room.players).forEach(p => p.isDrawing = false);
  if (room.players[finalDrawerId]) room.players[finalDrawerId].isDrawing = true;
    
    // Phase de choix du mot
    room.status = 'choosing';
    // Proposer 3 mots aléatoires distincts
    const options = this.pickRandomWords(3);
    room.pendingWordChoices = options;
    room.round = undefined; // Pas encore de round démarré
    room.lastActivityAt = Date.now();
    this.lobby.upsertRoom(room);
    // Informer toute la room du passage en phase de choix pour déclencher l'affichage de la modale côté clients
    this.emitToRoom(room.id, 'room:state', {
      ...room,
      connectedPlayers: Object.values(room.players).filter(p => p.connected).length,
      totalPlayers: Object.keys(room.players).length
    });
    // Notifier uniquement le dessinateur pour choisir un mot
    this.emitToPlayer(finalDrawerId, 'round:choose', { options });
  }

  private pickRandomWords(count: number): string[] {
    const pool = [...this.words];
    const result: string[] = [];
    while (result.length < count && pool.length > 0) {
      const idx = Math.floor(Math.random() * pool.length);
      result.push(pool.splice(idx, 1)[0]);
    }
    // Si le pool est trop petit, autoriser des doublons (fallback)
    while (result.length < count && this.words.length > 0) {
      result.push(this.words[Math.floor(Math.random() * this.words.length)]);
    }
    return result;
  }

  chooseWord(roomId: string, playerId: string, chosen: string) {
    const room = this.lobby.getRoom(roomId);
    if (!room) throw new Error('Room not found');
    // Valider que le joueur est le dessinateur actuel
    if (room.currentDrawerIndex == null || !room.drawerOrder) throw new Error('No drawer');
    const drawerId = room.drawerOrder[room.currentDrawerIndex];
    if (drawerId !== playerId) {
      this.logger.warn(`chooseWord: Player ${playerId} tried to choose word for drawer ${drawerId}`);
      throw new Error('Seul le dessinateur peut choisir le mot');
    }
    // Valider le choix
    const options = room.pendingWordChoices ?? [];
    if (!options.includes(chosen)) {
      this.logger.warn(`chooseWord: Invalid choice '${chosen}' not in options [${options.join(', ')}]`);
      throw new Error('Choix invalide');
    }

    // Calculer le score total : 100 × nombre de joueurs connectés
    const connectedPlayersCount = Object.values(room.players).filter(p => p.connected).length;
    const totalScore = connectedPlayersCount * 100;

    // Créer le round
    const word = chosen;
    const round = {
      word,
      revealed: word.replace(/./g, '_'),
      drawerId,
      startedAt: Date.now(),
      roundEndsAt: room.roundDuration > 0 ? Date.now() + room.roundDuration * 1000 : undefined,
      guessedPlayerIds: [],
      revealedIndices: [],
      totalScore,
      turnIndex: (room.turnCounter = (room.turnCounter ?? 0) + 1)
    };
    room.round = round;
    room.status = 'running';
    room.pendingWordChoices = undefined;
    room.lastActivityAt = Date.now();
    this.lobby.upsertRoom(room);

    // Lancer timer de round uniquement si la durée est définie (non-illimitée)
    if (room.round?.roundEndsAt) {
      this.startTimer(room.id);
    }
    // Notifier tout le monde que la manche démarre (sans dévoiler le mot)
    this.emitToRoom(room.id, 'round:started', {
      drawerId: round.drawerId,
      roundEndsAt: round.roundEndsAt,
      revealed: round.revealed,
      currentRound: room.currentRound,
      totalRounds: room.totalRounds
    });
    // Envoyer le mot en privé au dessinateur
    this.emitToPlayer(round.drawerId, 'round:word', { word: round.word });
    // Mise à jour des scores persistés (aucun changement de score ici mais synchro présence)
    this.updateGamePlayers(room);
  }

  private startTimer(roomId: string) {
    this.clearTimer(roomId);
    const room = this.lobby.getRoom(roomId);
    // Ne pas démarrer de timer si la manche n'a pas de roundEndsAt (mode illimité)
    if (!room || !room.round || room.round.roundEndsAt == null) return;
    const interval = setInterval(() => this.handleTimerTick(roomId), 1000);
    this.timers.set(roomId, interval);
  }

  private clearTimer(roomId: string) {
    const t = this.timers.get(roomId);
    if (t) clearInterval(t);
    this.timers.delete(roomId);
  }

  private handleTimerTick(roomId: string) {
    const room = this.lobby.getRoom(roomId);
    if (!room || !room.round) return;
    if (room.round.roundEndsAt == null) return; // mode illimité -> aucun tick attendu
    const remainingMs = room.round.roundEndsAt - Date.now();
    const remaining = Math.max(0, Math.ceil(remainingMs / 1000));
    
    // Dévoiler progressivement les lettres
    const updatedRevealed = this.updateRevealedLetters(room);
    if (updatedRevealed) {
      room.round.revealed = updatedRevealed;
      this.lobby.upsertRoom(room);
    }
    
    this.emitToRoom(room.id, 'timer:tick', { remaining, revealed: room.round.revealed });
    if (remaining <= 0) {
      this.endTurn(roomId, 'timeout');
    }
  }

  /**
   * Calcule et révèle progressivement les lettres du mot
   * Règle : 30% du mot révélé quand le timer atteint 0s
   * Commence par la 4ème lettre, puis +4 à chaque fois (en sautant les lettres déjà révélées)
   */
  private updateRevealedLetters(room: RoomState): string | null {
    if (!room.round || !room.round.revealedIndices) return null;
    // Si la manche est en mode illimité (pas de roundEndsAt), ne pas dévoiler automatiquement
    if (room.round.roundEndsAt == null) return null;
    
    const word = room.round.word;
    const wordLength = word.length;
      // Maximum strict de 30% du mot (arrondi inférieur)
      const targetRevealCount = Math.floor(wordLength * 0.3); // 30% max
    
    // Si on a déjà révélé 30% ou plus, ne rien faire
    if (room.round.revealedIndices.length >= targetRevealCount) {
      return null;
    }
    
    // Utiliser la durée effective du round (prend en compte toute réduction de timer en cours de manche)
    const effectiveTotalSeconds = Math.max(
      1,
      Math.ceil((room.round.roundEndsAt - room.round.startedAt) / 1000)
    );
    const elapsedMs = Date.now() - room.round.startedAt;
    // Borner l'écoulé entre 0 et la durée effective
    const elapsedSeconds = Math.max(0, Math.min(effectiveTotalSeconds, Math.floor(elapsedMs / 1000)));
    
    // Calculer combien de lettres devraient être révélées à ce moment
    // On révèle linéairement pour atteindre 50% à la fin
    // Progression plus fluide: utiliser ceil pour commencer à révéler tôt,
    // tout en respectant le plafond (min avec targetRevealCount)
    const expectedRevealCount = Math.min(
      targetRevealCount,
      Math.ceil((elapsedSeconds / effectiveTotalSeconds) * targetRevealCount)
    );
    
    // Si on a déjà révélé assez de lettres pour le moment, ne rien faire
    if (room.round.revealedIndices.length >= expectedRevealCount) {
      return null;
    }
    
    // Révéler les lettres manquantes
    let needToReveal = expectedRevealCount - room.round.revealedIndices.length;
    while (needToReveal > 0) {
      const nextIndex = this.getNextLetterToReveal(word, room.round.revealedIndices);
      if (nextIndex === -1) break; // Plus de lettres à révéler
      
      room.round.revealedIndices.push(nextIndex);
      needToReveal--;
    }
    
    // Construire la chaîne revealed
    return this.buildRevealedString(word, room.round.revealedIndices);
  }

  /**
   * Calcule le prochain indice de lettre à révéler selon les règles :
   * - Première lettre : indice 3 (4ème lettre)
   * - Ensuite : +4 à partir de la dernière lettre révélée
   * - Si on tombe sur une lettre déjà révélée, prendre la suivante
   */
  private getNextLetterToReveal(word: string, revealedIndices: number[]): number {
    const wordLength = word.length;
    
    // Si aucune lettre révélée, commencer par la 4ème (indice 3)
    if (revealedIndices.length === 0) {
      // Vérifier que le mot a au moins 4 lettres
      return wordLength > 3 ? 3 : 0;
    }
    
    // Trouver la dernière lettre révélée
    const lastRevealed = Math.max(...revealedIndices);
    
    // Calculer la position suivante (+4)
    let nextIndex = lastRevealed + 4;
    
    // Boucler si on dépasse la fin du mot
    if (nextIndex >= wordLength) {
      nextIndex = nextIndex % wordLength;
    }
    
    // Si la lettre est déjà révélée, prendre la suivante non révélée
    let attempts = 0;
    while (revealedIndices.includes(nextIndex) && attempts < wordLength) {
      nextIndex = (nextIndex + 1) % wordLength;
      attempts++;
    }
    
    // Si toutes les lettres sont révélées ou on a fait le tour complet
    if (attempts >= wordLength || revealedIndices.includes(nextIndex)) {
      return -1;
    }
    
    return nextIndex;
  }

  /**
   * Construit la chaîne revealed avec les lettres révélées et des underscores
   */
  private buildRevealedString(word: string, revealedIndices: number[]): string {
    return word
      .split('')
      .map((char, index) => (revealedIndices.includes(index) ? char : '_'))
      .join('');
  }

  private endTurn(roomId: string, reason: string) {
    const room = this.lobby.getRoom(roomId);
    if (!room || !room.round) return;
    this.clearTimer(roomId);
    room.round.endReason = reason;
    const finishedRound = room.round;
    // Nettoyer état du dessinateur
    const drawer = room.players[finishedRound.drawerId];
    if (drawer) drawer.isDrawing = false;

    // Préparer soumission du dessin
    room.pendingDrawing = {
      turnIndex: finishedRound['turnIndex'] ?? (room.turnCounter ?? 0),
      drawerId: finishedRound.drawerId,
      word: finishedRound.word,
      endedAt: Date.now()
    };

    // Emit fin (inclure turnIndex)
    this.emitToRoom(room.id, 'round:ended', {
      word: finishedRound.word,
      drawerId: finishedRound.drawerId,
      guessedPlayerIds: finishedRound.guessedPlayerIds,
      reason,
      currentRound: room.currentRound,
      totalRounds: room.totalRounds,
      scores: Object.values(room.players),
      turnIndex: room.pendingDrawing.turnIndex
    });
    this.emitPrimaryNotification(room.id, { message: 'Manche terminée' });
    // Persist scores + message système
    this.updateGamePlayers(room);
    this.appendGameMessage(room, { type: 'system', text: `Fin manche mot="${finishedRound.word}" raison=${reason}` });

    // Vérifier s'il reste des joueurs connectés
    const connectedPlayers = Object.values(room.players).filter(p => p.connected);
    if (connectedPlayers.length === 0) {
      this.logger.warn(`No connected players left in room ${room.name}, returning to lobby`);
      room.status = 'lobby';
      room.round = undefined;
      this.lobby.upsertRoom(room);
      return;
    }

    // Avancer index en sautant les déconnectés
    if (room.drawerOrder && room.currentDrawerIndex != null) {
      const order = room.drawerOrder;
      let nextIndex = (room.currentDrawerIndex + 1) % order.length;
      let safety = 0;
      while (!room.players[order[nextIndex]]?.connected && safety < order.length) {
        nextIndex = (nextIndex + 1) % order.length;
        safety++;
      }
      
      // Si on a parcouru tout le tableau sans trouver de joueur connecté
      if (safety >= order.length && !room.players[order[nextIndex]]?.connected) {
        this.logger.warn(`No connected drawer found in room ${room.name}, returning to lobby`);
        room.status = 'lobby';
        room.round = undefined;
        this.lobby.upsertRoom(room);
        return;
      }
      
      const completedCycle = nextIndex === 0; // Retour au début => round complet
      room.currentDrawerIndex = nextIndex;
      if (completedCycle) {
        room.currentRound = (room.currentRound ?? 0) + 1;
        if (room.currentRound! > (room.totalRounds ?? 1)) {
          // Fin du jeu
            room.status = 'ended';
            room.round = undefined;
            this.lobby.upsertRoom(room);
            this.emitToRoom(room.id, 'game:ended', {
              totalRounds: room.totalRounds,
              scores: Object.values(room.players),
              drawings: room.drawings ?? [],
              gameId: (room as any).gameId
            });
            this.finalizeGame(room);
            return;
        } else {
          this.emitToRoom(room.id, 'game:next-round', {
            currentRound: room.currentRound,
            totalRounds: room.totalRounds
          });
        }
      }
    }

    // Démarrer prochain tour si jeu pas terminé
    if (room.status !== 'ended') {
      // Passer immédiatement la room en phase de choix pour informer les joueurs (modale côté clients)
      room.round = undefined; // effacer ancien round
      room.status = 'choosing';
      this.lobby.upsertRoom(room);
      // Émettre l'état de room tout de suite (réduit la latence d'affichage des modales)
      this.emitToRoom(room.id, 'room:state', {
        ...room,
        connectedPlayers: Object.values(room.players).filter(p => p.connected).length,
        totalPlayers: Object.keys(room.players).length
      });
      // Démarrer le tour suivant après une très courte pause pour laisser le temps au dessinateur d'envoyer son dessin
      setTimeout(() => {
        const r = this.lobby.getRoom(roomId);
        if (!r || r.status === 'ended') return;
        this.startTurn(r);
      }, 500);
    }
  }

  private cancelCurrentTurn(room: RoomState, reason: string) {
    this.clearTimer(room.id);
    if (room.round) {
      room.round.endReason = reason;
      this.emitToRoom(room.id, 'round:cancelled', { reason });
    }
    room.round = undefined;
    room.status = 'lobby';
    this.lobby.upsertRoom(room);
  }

  startGame(roomId: string, playerId: string) {
    const room = this.lobby.getRoom(roomId);
    if (!room) throw new Error('Room not found');
    if (room.hostId !== playerId) {
      this.logger.warn(`startGame: Player ${playerId} is not the host of room ${roomId}`);
      throw new Error('Seul l\'hôte peut lancer la partie');
    }
    if (room.status !== 'lobby') {
      return room.round; // Déjà en cours
    }
    // Si le mode équipe est activé, assigner les joueurs aux équipes aléatoirement
    if (room.teamCount && room.teamCount >= 2) {
      const connected = Object.values(room.players).filter(p => p.connected);
      const teamIds = Array.from({ length: room.teamCount }, (_, i) => `team-${i + 1}`);
      const capacity = room.teamSize ? room.teamCount * room.teamSize : undefined;

      if (capacity != null && connected.length > capacity) {
        this.logger.warn(`startGame: Not enough team slots (${capacity}) for ${connected.length} connected players`);
        throw new Error('Pas assez de places en équipe pour tous les joueurs connectés');
      }
      if (connected.length < teamIds.length) {
        this.logger.warn(`startGame: Not enough players (${connected.length}) to have at least one per team (${teamIds.length})`);
        throw new Error('Pas assez de joueurs pour avoir au moins un joueur par équipe');
      }

      // Shuffle les joueurs connectés
      const shuffled = [...connected].sort(() => Math.random() - 0.5);
      // Nettoyer anciennes affectations
      Object.values(room.players).forEach(p => { p.teamId = undefined; });
      const counts = Object.fromEntries(teamIds.map(id => [id, 0] as const)) as Record<string, number>;

      // 1) Garantir au moins un joueur par équipe
      for (let i = 0; i < teamIds.length; i++) {
        const player = shuffled[i];
        const teamId = teamIds[i];
        player.teamId = teamId;
        counts[teamId]++;
      }

      // 2) Répartir le reste des joueurs équitablement en respectant la taille max
      for (let i = teamIds.length; i < shuffled.length; i++) {
        const player = shuffled[i];
        // Choisir l'équipe la moins remplie qui n'est pas pleine
        const candidate = teamIds
          .filter(tid => room.teamSize == null || counts[tid] < room.teamSize)
          .reduce((best, tid) => (best == null || counts[tid] < counts[best] ? tid : best), undefined as string | undefined);

        if (!candidate) {
          // Toutes les équipes sont pleines selon teamSize (ne devrait pas arriver car on a vérifié capacity)
          const fallback = teamIds.reduce((a, b) => (counts[a] <= counts[b] ? a : b));
          player.teamId = fallback;
          counts[fallback]++;
        } else {
          player.teamId = candidate;
          counts[candidate]++;
        }
      }

      this.logger.log(`Teams assigned: ${teamIds.map(id => `${id}=${counts[id]}`).join(', ')}`);
    } else {
      // Pas de mode équipes: nettoyer d'éventuelles anciennes affectations
      Object.values(room.players).forEach(p => { p.teamId = undefined; });
    }

    // Initialiser round global
    room.currentRound = 1;
    room.currentDrawerIndex = -1; // pour démarrer sur dernier joueur
    room.turnCounter = 0;
    room.drawings = [];
    room.pendingDrawing = undefined;
    this.lobby.upsertRoom(room);
    // Créer en base la game (async fire & forget)
    const gameId = `${room.id}_${Date.now()}`;
    (room as any).gameId = gameId;
    this.gameModel.create({
      gameId,
      roomId: room.id,
      status: 'running',
      totalRounds: room.totalRounds ?? 1,
      currentRound: room.currentRound ?? 1,
      players: Object.values(room.players).map(p => ({ playerId: p.id, pseudo: p.name, score: p.score })),
      drawings: [],
      messages: [],
      // expire dans 24h tant que la partie est en cours
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
    }).then(() => this.logger.log(`Game persisted: ${gameId}`)).catch(e => this.logger.warn(`Persist game failed: ${(e as Error).message}`));
    // Informer clients
    this.emitToRoom(room.id, 'game:info', { gameId });
    this.startTurn(room);
    return room.round;
  }

  attachServer(server: Server) {
    if (!this.server) {
      this.server = server;
      this.logger.log('Server attached to GameService for event emission');
    }
  }

  private emitToRoom(roomId: string, event: string, payload: unknown) {
    if (this.server) {
      this.server.to(roomId).emit(event, payload);
    }
  }

  private emitPrimaryNotification(
    roomId: string,
    payload: { message: string; variant?: 'info' | 'success' | 'warning' | 'danger'; durationMs?: number }
  ) {
    this.emitToRoom(roomId, 'notification:primary', {
      id: randomUUID(),
      timestamp: Date.now(),
      ...payload
    });
  }

  private emitToPlayer(playerId: string, event: string, payload: unknown) {
    if (this.server) {
      this.server.to(playerId).emit(event, payload);
    }
  }

  // ===================== Dessins =====================
  submitDrawing(roomId: string, playerId: string, payload: { imageData: string; word: string; turnIndex: number }) {
    this.logger.log(`📸 submitDrawing called - room: ${roomId}, player: ${playerId}, turnIndex: ${payload.turnIndex}`);
    const room = this.lobby.getRoom(roomId);
    if (!room) {
      this.logger.warn('submitDrawing - Room not found');
      throw new Error('Room not found');
    }
    if (!room.pendingDrawing) {
      this.logger.warn('submitDrawing - No pending drawing');
      throw new Error('Aucun dessin en attente');
    }
    this.logger.log(`Pending drawing: drawerId=${room.pendingDrawing.drawerId}, turnIndex=${room.pendingDrawing.turnIndex}, word=${room.pendingDrawing.word}`);
    if (room.pendingDrawing.drawerId !== playerId) {
      this.logger.warn(`submitDrawing - Wrong drawer: expected ${room.pendingDrawing.drawerId}, got ${playerId}`);
      throw new Error('Seul le dessinateur peut soumettre le dessin');
    }
    if (room.pendingDrawing.turnIndex !== payload.turnIndex) {
      this.logger.warn(`submitDrawing - Wrong turnIndex: expected ${room.pendingDrawing.turnIndex}, got ${payload.turnIndex}`);
      throw new Error('turnIndex invalide');
    }
    if (room.pendingDrawing.word !== payload.word) {
      this.logger.warn(`submitDrawing - Wrong word: expected ${room.pendingDrawing.word}, got ${payload.word}`);
      throw new Error('Mot invalide');
    }
    if (!payload.imageData.startsWith('data:image/')) {
      this.logger.warn('submitDrawing - Invalid image format');
      throw new Error('Format image invalide');
    }

    if (!room.drawings) room.drawings = [];
    const exists = room.drawings.find(d => d.turnIndex === payload.turnIndex);
    if (exists) return exists;
    const record: DrawingRecord = {
      turnIndex: payload.turnIndex,
      drawerId: playerId,
      word: payload.word,
      imageData: payload.imageData,
      savedAt: Date.now()
    };
    // Écriture sur disque (best effort, non bloquant pour l'utilisateur)
    try {
      const drawingsDir = process.env.DRAWINGS_DIR || path.join(process.cwd(), 'data', 'drawings');
      if (!fs.existsSync(drawingsDir)) {
        fs.mkdirSync(drawingsDir, { recursive: true });
      }
      // Sanitize éléments pour le nom du fichier
      const safeRoom = room.id.replace(/[^a-zA-Z0-9_-]/g, '_');
      const safeDrawer = playerId.replace(/[^a-zA-Z0-9_-]/g, '_');
      const ts = record.savedAt;
      const filename = `${safeRoom}_turn${record.turnIndex}_${safeDrawer}_${ts}.png`;
      const filePath = path.join(drawingsDir, filename);
      const base64 = payload.imageData.split(',')[1];
      const buffer = Buffer.from(base64, 'base64');
      fs.writeFileSync(filePath, buffer);
      // Stocker chemin relatif pour usage futur
      record.filePath = path.relative(process.cwd(), filePath);
    } catch (err) {
      this.logger.warn(`Échec sauvegarde fichier dessin: ${(err as Error).message}`);
    }
    room.drawings.push(record);
  // Persistance dessin sans base64
  this.appendGameDrawing(room, record);
    room.pendingDrawing = undefined;
    room.lastActivityAt = Date.now();
    this.lobby.upsertRoom(room);
    // Mise à jour room state (inclut drawings)
    this.emitToRoom(room.id, 'room:state', {
      ...room,
      connectedPlayers: Object.values(room.players).filter(p => p.connected).length,
      totalPlayers: Object.keys(room.players).length
    });
    return record;
  }

  // ===================== Persistence Helpers =====================
  private async updateGamePlayers(room: RoomState) {
    const gameId = (room as any).gameId;
    if (!gameId) return;
    try {
      await this.gameModel.updateOne({ gameId }, {
        $set: {
          currentRound: room.currentRound ?? 1,
          players: Object.values(room.players).map(p => ({ playerId: p.id, pseudo: p.name, score: p.score }))
        }
      }).exec();
    } catch (e) {
      this.logger.warn(`updateGamePlayers failed: ${(e as Error).message}`);
    }
  }

  private async appendGameDrawing(room: RoomState, record: DrawingRecord) {
    const gameId = (room as any).gameId;
    if (!gameId || !record.filePath) return;
    try {
      await this.gameModel.updateOne({ gameId }, {
        $push: {
          drawings: {
            turnIndex: record.turnIndex,
            drawerId: record.drawerId,
            word: record.word,
            filePath: record.filePath
          }
        }
      }).exec();
    } catch (e) {
      this.logger.warn(`appendGameDrawing failed: ${(e as Error).message}`);
    }
  }

  logMessage(roomId: string, playerId: string | undefined, type: 'guess' | 'correct' | 'system', text: string) {
    const room = this.lobby.getRoom(roomId);
    if (!room) return;
    this.appendGameMessage(room, { type, text, playerId });
  }

  private async appendGameMessage(room: RoomState, msg: { type: 'guess' | 'correct' | 'system'; text: string; playerId?: string }) {
    const gameId = (room as any).gameId;
    if (!gameId) return;
    try {
      await this.gameModel.updateOne({ gameId }, {
        $push: {
          messages: {
            at: Date.now(),
            type: msg.type,
            playerId: msg.playerId,
            text: msg.text
          }
        }
      }).exec();
    } catch (e) {
      this.logger.warn(`appendGameMessage failed: ${(e as Error).message}`);
    }
  }

  private async finalizeGame(room: RoomState) {
    const gameId = (room as any).gameId;
    if (!gameId) return;
    try {
      const endedAt = new Date();
      const newExpiry = new Date(endedAt.getTime() + 7 * 24 * 60 * 60 * 1000); // +7 jours
      await this.gameModel.updateOne({ gameId }, { $set: { status: 'ended', endedAt, expiresAt: newExpiry } }).exec();
      this.logger.log(`Game finalized: ${gameId}`);
    } catch (e) {
      this.logger.warn(`finalizeGame failed: ${(e as Error).message}`);
    }
  }
}
