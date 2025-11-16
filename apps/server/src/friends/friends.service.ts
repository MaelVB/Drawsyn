import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { UsersService } from '../users/users.service';
import { LobbyService } from '../game/lobby.service';
import { Friendship, FriendshipDocument, FriendshipStatus, FriendshipType } from './schemas/friendship.schema';

@Injectable()
export class FriendsService {
  constructor(
    @InjectModel(Friendship.name) private readonly model: Model<FriendshipDocument>,
    private readonly users: UsersService,
    private readonly lobby: LobbyService
  ) {}

  async listFriends(userId: string) {
    const friendships = await this.model
      .find({
        $or: [
          { requesterId: userId },
          { addresseeId: userId }
        ],
        status: 'accepted'
      })
      .lean();

    const otherIds = friendships.map((f) => (f.requesterId === userId ? f.addresseeId : f.requesterId));
    const uniqueIds = Array.from(new Set(otherIds));
    const users = await Promise.all(uniqueIds.map((id) => this.users.findById(id)));

    const userMap = new Map(users.filter(Boolean).map((u) => [u!.id, u!]));

    // Récupérer l'ensemble des rooms pour déterminer la présence
    const rooms = this.lobby.listRooms();

    return friendships.map((f) => {
      const otherId = f.requesterId === userId ? f.addresseeId : f.requesterId;
      const other = userMap.get(otherId);
      // Chercher si l'utilisateur est présent dans une room
      const roomEntry = rooms.find((r) => Object.prototype.hasOwnProperty.call(r.players, otherId));
      let presence: { status: 'disconnected' | 'lobby' | 'running'; roomId?: string; roomName?: string } | undefined = undefined;
      if (roomEntry) {
        const player = roomEntry.players[otherId];
        if (player && player.connected) {
          presence = {
            status: roomEntry.status === 'running' ? 'running' : 'lobby',
            roomId: roomEntry.id,
            roomName: roomEntry.name
          };
        } else {
          presence = { status: 'disconnected' };
        }
      } else {
        presence = { status: 'disconnected' };
      }
      return {
        userId: otherId,
        pseudo: other?.pseudo ?? 'Inconnu',
        email: other?.email ?? '',
        status: f.status as FriendshipStatus,
        type: f.type as FriendshipType
        ,
        presence
      };
    });
  }

  async listRelations(userId: string) {
    // Renvoie aussi les "pending" pour gérer la liste complète côté front
    const relations = await this.model
      .find({
        $or: [
          { requesterId: userId },
          { addresseeId: userId }
        ]
      })
      .lean();

    const otherIds = relations.map((f) => (f.requesterId === userId ? f.addresseeId : f.requesterId));
    const uniqueIds = Array.from(new Set(otherIds));
    const users = await Promise.all(uniqueIds.map((id) => this.users.findById(id)));
    const userMap = new Map(users.filter(Boolean).map((u) => [u!.id, u!]));

    return relations.map((f) => {
      const isRequester = f.requesterId === userId;
      const otherId = isRequester ? f.addresseeId : f.requesterId;
      const other = userMap.get(otherId);

      // Déterminer présence via LobbyService
      const rooms = this.lobby.listRooms();
      const roomEntry = rooms.find((r) => Object.prototype.hasOwnProperty.call(r.players, otherId));
      let presence: { status: 'disconnected' | 'lobby' | 'running'; roomId?: string; roomName?: string } | undefined = undefined;
      if (roomEntry) {
        const player = roomEntry.players[otherId];
        if (player && player.connected) {
          presence = {
            status: roomEntry.status === 'running' ? 'running' : 'lobby',
            roomId: roomEntry.id,
            roomName: roomEntry.name
          };
        } else {
          presence = { status: 'disconnected' };
        }
      } else {
        presence = { status: 'disconnected' };
      }

      return {
        userId: otherId,
        pseudo: other?.pseudo ?? 'Inconnu',
        email: other?.email ?? '',
        status: f.status as FriendshipStatus,
        type: f.type as FriendshipType,
        direction: isRequester ? 'outgoing' : 'incoming',
        presence
      };
    });
  }

  private async ensureUsersExist(aId: string, bId: string) {
    const [a, b] = await Promise.all([this.users.findById(aId), this.users.findById(bId)]);
    if (!a || !b) {
      throw new BadRequestException('Utilisateur introuvable');
    }
    if (a.id === b.id) {
      throw new BadRequestException('Impossible de se connecter avec soi-même');
    }
    return { a, b };
  }

  async findRelationBetween(aId: string, bId: string) {
    return this.model
      .findOne({
        $or: [
          { requesterId: aId, addresseeId: bId },
          { requesterId: bId, addresseeId: aId }
        ]
      })
      .exec();
  }

  async connectByEmail(requesterId: string, otherEmail: string) {
    const requester = await this.users.findById(requesterId);
    if (!requester) {
      throw new BadRequestException('Utilisateur introuvable');
    }

    const addressee = await this.users.findByEmail(otherEmail);
    if (!addressee) {
      throw new BadRequestException('Aucun utilisateur avec cet email');
    }

    const { a: aUser, b: bUser } = await this.ensureUsersExist(requester.id, addressee.id);
    const existing = await this.findRelationBetween(aUser.id, bUser.id);

    if (existing && existing.status === 'accepted') {
      return { status: 'accepted', already: true } as const;
    }

    if (existing && existing.status === 'pending') {
      // Si une demande existe déjà (peu importe le sens), la connexion par email la confirme
      existing.status = 'accepted';
      await existing.save();
      return { status: 'accepted', already: false } as const;
    }

    // Sinon, on crée une nouvelle relation pending de type "private-email"
    const created = new this.model({
      requesterId: requester.id,
      addresseeId: addressee.id,
      status: 'pending',
      type: 'private-email'
    });
    await created.save();

    return { status: 'pending', already: false } as const;
  }

  async sendPublicRequest(requesterId: string, addresseeId: string) {
    const { a: requester, b: addressee } = await this.ensureUsersExist(requesterId, addresseeId);

    if (!addressee.allowPublicFriendRequests) {
      throw new BadRequestException("Cet utilisateur n'accepte pas les demandes publiques");
    }

    const existing = await this.findRelationBetween(requester.id, addressee.id);

    if (existing && existing.status === 'accepted') {
      return { status: 'accepted', already: true } as const;
    }

    if (existing && existing.status === 'pending') {
      // Demande déjà en attente (dans un sens ou dans l'autre)
      return { status: 'pending', already: true } as const;
    }

    const created = new this.model({
      requesterId: requester.id,
      addresseeId: addressee.id,
      status: 'pending',
      type: 'public'
    });
    await created.save();

    return { status: 'pending', already: false } as const;
  }

  async confirmPublicRequest(addresseeId: string, requesterId: string) {
    const { a: aUser, b: bUser } = await this.ensureUsersExist(addresseeId, requesterId);

    if (!aUser.allowPublicFriendRequests) {
      throw new BadRequestException("Vous n'acceptez pas les demandes publiques");
    }

    const relation = await this.model.findOne({
      requesterId: bUser.id,
      addresseeId: aUser.id,
      status: 'pending',
      type: 'public'
    });

    if (!relation) {
      throw new BadRequestException('Aucune demande publique en attente pour cet utilisateur');
    }

    relation.status = 'accepted';
    await relation.save();

    return { status: 'accepted' } as const;
  }

  async removeRelation(userId: string, otherId: string) {
    const relation = await this.findRelationBetween(userId, otherId);
    if (!relation) {
      throw new BadRequestException('Relation introuvable');
    }

    // Vérifier que l'utilisateur est bien impliqué dans la relation (par sécurité supplémentaire)
    if (relation.requesterId !== userId && relation.addresseeId !== userId) {
      throw new BadRequestException('Accès non autorisé à cette relation');
    }

    await relation.deleteOne();
    return { removed: true } as const;
  }
}
