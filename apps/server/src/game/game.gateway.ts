import { UsePipes, ValidationPipe } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';

import { AuthService, AuthenticatedUser } from '../auth/auth.service';

import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomSettingsDto } from './dto/update-room-settings.dto';
import { DrawSegmentDto } from './dto/draw-segment.dto';
import { GuessDto } from './dto/guess.dto';
import { JoinRoomDto } from './dto/join-room.dto';
import { GameService } from './game.service';

interface ConnectionState {
  roomId?: string;
  playerId?: string;
  userId: string;
  pseudo: string;
}

@WebSocketGateway({ namespace: '/game', cors: { origin: true, credentials: true } })
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class GameGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly connections = new Map<string, ConnectionState>();

  constructor(private readonly game: GameService, private readonly auth: AuthService) {}

  async handleConnection(client: Socket) {
    console.log('[WebSocket] ========================================');
    console.log('[WebSocket] 🔌 Nouvelle connexion:', client.id);
    console.log('[WebSocket] 📦 handshake.auth:', JSON.stringify(client.handshake.auth));
    console.log('[WebSocket] 📋 headers.authorization:', client.handshake.headers.authorization);
    console.log('[WebSocket] 📋 All headers:', JSON.stringify(client.handshake.headers));
    
    const user = await this.authenticate(client);
    if (!user) {
      console.log('[WebSocket] ❌ Authentification échouée pour', client.id);
      client.emit('auth:error', { message: 'Authentification requise' });
      client.disconnect(true);
      return;
    }

    console.log('[WebSocket] ✅ Connexion réussie pour', user.pseudo, '(', user.id, ')');
    
    // IMPORTANT: Ajouter à connections AVANT d'émettre quoi que ce soit
    // pour que les autres handlers puissent vérifier l'authentification
    this.connections.set(client.id, {
      userId: user.id,
      pseudo: user.pseudo
    });

    client.emit('room:list', this.game.listRooms());
    console.log('[WebSocket] ========================================');
  }

  handleDisconnect(client: Socket) {
    const connection = this.connections.get(client.id);
    console.log('[WebSocket] 🔌 Déconnexion de', client.id, connection ? `(${connection.pseudo})` : '(inconnu)');
    this.removeClientFromRoom(client);
    this.connections.delete(client.id);
  }

  @SubscribeMessage('room:list')
  handleListRooms(@ConnectedSocket() client: Socket) {
    if (!this.connections.has(client.id)) {
      client.emit('auth:error', { message: 'Authentification requise' });
      return;
    }
    client.emit('room:list', this.game.listRooms());
  }

  @SubscribeMessage('room:create')
  handleCreateRoom(@ConnectedSocket() client: Socket, @MessageBody() dto: CreateRoomDto) {
    if (!this.connections.has(client.id)) {
      client.emit('auth:error', { message: 'Authentification requise' });
      return;
    }
    const room = this.game.createRoom(dto);
    client.emit('room:created', room);
    this.broadcastLobby();
  }

  @SubscribeMessage('room:join')
  handleJoinRoom(@ConnectedSocket() client: Socket, @MessageBody() dto: JoinRoomDto) {
    const connection = this.connections.get(client.id);
    if (!connection) {
      client.emit('auth:error', { message: 'Authentification requise' });
      return;
    }
    console.log('[WebSocket] 🚪 Tentative de rejoindre room:', dto.roomId, 'par', connection.pseudo);
    try {
      const { room, player } = this.game.joinRoom({
        roomId: dto.roomId,
        userId: connection.userId,
        pseudo: connection.pseudo
      });
      console.log('[WebSocket] ✅', connection.pseudo, 'a rejoint', room.name, '- Reconnexion:', !player.connected ? 'Oui' : 'Non');
      this.connections.set(client.id, {
        ...connection,
        roomId: room.id,
        playerId: player.id
      });
      client.join(room.id);
      client.join(player.id);
      client.emit('room:joined', { room, playerId: player.id });
      this.emitRoomState(room.id);
      this.broadcastLobby();

      const round = room.round;
      if (round) {
        console.log('[WebSocket] 🎨 Round en cours, dessinateur:', round.drawerId);
        this.server.to(room.id).emit('round:started', {
          drawerId: round.drawerId,
          roundEndsAt: round.roundEndsAt,
          revealed: round.revealed
        });
        this.server.to(round.drawerId).emit('round:word', { word: round.word });
        this.emitRoomState(room.id);
      }
    } catch (error) {
      console.error('[WebSocket] ❌ Erreur lors du join:', (error as Error).message);
      client.emit('room:error', { message: (error as Error).message });
    }
  }

  @SubscribeMessage('room:update')
  handleUpdateRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: UpdateRoomSettingsDto
  ) {
    const connection = this.connections.get(client.id);
    if (!connection || !connection.roomId) {
      client.emit('auth:error', { message: 'Authentification requise' });
      return;
    }
    try {
      const room = this.game.updateRoomSettings(connection.roomId, dto);
      this.emitRoomState(room.id);
      this.broadcastLobby();
    } catch (error) {
      client.emit('room:error', { message: (error as Error).message });
    }
  }

  @SubscribeMessage('game:start')
  handleStartGame(@ConnectedSocket() client: Socket) {
    const connection = this.connections.get(client.id);
    if (!connection || !connection.roomId) {
      client.emit('auth:error', { message: 'Authentification requise' });
      return;
    }
    try {
      const started = this.game.startGame(connection.roomId);
      const room = this.game.listRooms().find((r) => r.id === connection.roomId);
      if (started && room) {
        this.server.to(room.id).emit('round:started', {
          drawerId: started.drawerId,
          roundEndsAt: started.roundEndsAt,
          revealed: started.revealed
        });
        this.server.to(started.drawerId).emit('round:word', { word: started.word });
        this.emitRoomState(room.id);
      }
    } catch (error) {
      client.emit('room:error', { message: (error as Error).message });
    }
  }

  @SubscribeMessage('room:leave')
  handleLeaveRoom(@ConnectedSocket() client: Socket) {
    this.removeClientFromRoom(client);
  }

  @SubscribeMessage('draw:segment')
  handleDraw(@ConnectedSocket() client: Socket, @MessageBody() dto: DrawSegmentDto) {
    const connection = this.connections.get(client.id);
    if (!connection || !connection.playerId || !connection.roomId) return;
    if (!this.game.canDraw(connection.playerId, connection.roomId)) return;

    // Mettre à jour l'activité de la room
    this.game.updateRoomActivity(connection.roomId);

    client.to(connection.roomId).emit('draw:segment', {
      points: dto.points,
      color: dto.color,
      size: dto.size,
      type: dto.type
    });
  }

  @SubscribeMessage('draw:fill')
  handleFill(@ConnectedSocket() client: Socket, @MessageBody() data: { roomId: string; color: string }) {
    const connection = this.connections.get(client.id);
    if (!connection || !connection.playerId || !connection.roomId) return;
    if (!this.game.canDraw(connection.playerId, connection.roomId)) return;

    client.to(connection.roomId).emit('draw:fill', {
      color: data.color
    });
  }

  @SubscribeMessage('guess:submit')
  handleGuess(@ConnectedSocket() client: Socket, @MessageBody() dto: GuessDto) {
    const connection = this.connections.get(client.id);
    if (!connection || !connection.playerId || !connection.roomId) return;

    if (dto.roomId && dto.roomId !== connection.roomId) {
      client.emit('room:error', { message: 'Invalid room' });
      return;
    }

    const result = this.game.submitGuess(connection.playerId, {
      ...dto,
      roomId: connection.roomId
    });
    if (!result.room) return;

    if (result.correct && result.word) {
      this.server.to(connection.roomId).emit('round:ended', {
        winnerId: result.playerId,
        word: result.word,
        room: result.room,
        scores: Object.values(result.room.players)
      });
      this.broadcastLobby();
      this.emitRoomState(connection.roomId);

      const nextRound = this.game.ensureRound(connection.roomId);
      if (nextRound) {
        this.server.to(connection.roomId).emit('round:started', {
          drawerId: nextRound.drawerId,
          roundEndsAt: nextRound.roundEndsAt,
          revealed: nextRound.revealed
        });
        this.server.to(nextRound.drawerId).emit('round:word', { word: nextRound.word });
        this.emitRoomState(connection.roomId);
      }
    } else {
      client.to(connection.roomId).emit('guess:submitted', {
        playerId: connection.playerId,
        text: dto.text
      });
    }
  }

  private removeClientFromRoom(client: Socket) {
    const connection = this.connections.get(client.id);
    if (!connection?.roomId || !connection.playerId) {
      console.log('[WebSocket] removeClientFromRoom: pas de room/player pour', client.id);
      return;
    }

    console.log('[WebSocket] 🚪 Retrait de', connection.pseudo, 'de la room', connection.roomId);

    client.leave(connection.roomId);
    client.leave(connection.playerId);
    const room = this.game.leaveRoom(connection.roomId, connection.playerId);
    this.connections.set(client.id, {
      ...connection,
      roomId: undefined,
      playerId: undefined
    });

    if (room) {
      console.log('[WebSocket] ✅ Room toujours active:', room.name, '- Joueurs:', Object.values(room.players).map(p => `${p.name}(${p.connected ? 'connecté' : 'déconnecté'})`).join(', '));
      this.emitRoomState(room.id);
      if (room.round) {
        this.server.to(room.id).emit('round:started', {
          drawerId: room.round.drawerId,
          roundEndsAt: room.round.roundEndsAt,
          revealed: room.round.revealed
        });
        this.server.to(room.round.drawerId).emit('round:word', { word: room.round.word });
      } else {
        console.log('[WebSocket] ❌ Round annulé car le dessinateur est parti');
        this.server.to(room.id).emit('round:cancelled');
      }
    } else {
      console.log('[WebSocket] ⚠️ Room supprimée (aucun joueur restant):', connection.roomId);
      this.server.emit('room:closed', connection.roomId);
    }

    this.broadcastLobby();
  }

  private broadcastLobby() {
    const rooms = this.game.listRooms();
    this.server.emit('room:list', rooms);
  }

  private emitRoomState(roomId: string) {
    const room = this.game.listRooms().find((entry) => entry.id === roomId);
    if (room) {
      this.server.to(roomId).emit('room:state', room);
    }
  }

  private async authenticate(client: Socket): Promise<AuthenticatedUser | null> {
    const token = this.extractToken(client);
    if (!token) {
      console.log('[WebSocket] Aucun token trouvé pour', client.id);
      return null;
    }
    console.log('[WebSocket] Token reçu:', token.substring(0, 20) + '...');
    const user = await this.auth.verifyToken(token);
    if (!user) {
      console.log('[WebSocket] Token invalide ou expiré');
    }
    return user;
  }

  private extractToken(client: Socket): string | undefined {
    const auth = client.handshake.auth as { token?: string } | undefined;
    if (auth?.token) {
      console.log('[WebSocket] Token extrait de handshake.auth');
      return String(auth.token);
    }

    const header = client.handshake.headers.authorization;
    if (typeof header === 'string' && header.startsWith('Bearer ')) {
      console.log('[WebSocket] Token extrait de Authorization header');
      return header.slice(7);
    }

    console.log('[WebSocket] Aucun token trouvé dans handshake');
    return undefined;
  }
}
