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
import { DrawSegmentDto } from './dto/draw-segment.dto';
import { GuessDto } from './dto/guess.dto';
import { JoinRoomDto } from './dto/join-room.dto';
import { GameService } from './game.service';

interface ConnectionState {
  roomId?: string;
  playerId?: string;
  userId: string;
  username: string;
}

@WebSocketGateway({ namespace: '/game', cors: { origin: true, credentials: true } })
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class GameGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly connections = new Map<string, ConnectionState>();

  constructor(private readonly game: GameService, private readonly auth: AuthService) {}

  async handleConnection(client: Socket) {
    const user = await this.authenticate(client);
    if (!user) {
      client.emit('auth:error', { message: 'Authentification requise' });
      client.disconnect(true);
      return;
    }

    this.connections.set(client.id, {
      userId: user.id,
      username: user.username
    });

    client.emit('room:list', this.game.listRooms());
  }

  handleDisconnect(client: Socket) {
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
    try {
      const { room, player } = this.game.joinRoom({
        roomId: dto.roomId,
        userId: connection.userId,
        username: connection.username
      });
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

      const round = this.game.ensureRound(room.id);
      if (round) {
        this.server.to(room.id).emit('round:started', {
          drawerId: round.drawerId,
          roundEndsAt: round.roundEndsAt,
          revealed: round.revealed
        });
        this.server.to(round.drawerId).emit('round:word', { word: round.word });
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

    client.to(connection.roomId).emit('draw:segment', dto.points);
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
    if (!connection?.roomId || !connection.playerId) return;

    client.leave(connection.roomId);
    client.leave(connection.playerId);
    const room = this.game.leaveRoom(connection.roomId, connection.playerId);
    this.connections.set(client.id, {
      ...connection,
      roomId: undefined,
      playerId: undefined
    });

    if (room) {
      this.emitRoomState(room.id);
      if (room.round) {
        this.server.to(room.id).emit('round:started', {
          drawerId: room.round.drawerId,
          roundEndsAt: room.round.roundEndsAt,
          revealed: room.round.revealed
        });
        this.server.to(room.round.drawerId).emit('round:word', { word: room.round.word });
      } else {
        this.server.to(room.id).emit('round:cancelled');
      }
    } else {
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
    return this.auth.verifyToken(token);
  }

  private extractToken(client: Socket): string | undefined {
    const auth = client.handshake.auth as { token?: string } | undefined;
    if (auth?.token) {
      return String(auth.token);
    }

    const header = client.handshake.headers.authorization;
    if (typeof header === 'string' && header.startsWith('Bearer ')) {
      return header.slice(7);
    }

    return undefined;
  }
}
