import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type FriendshipStatus = 'pending' | 'accepted';
export type FriendshipType = 'private-email' | 'public';

@Schema({ timestamps: true })
export class Friendship {
  @Prop({ required: true, index: true })
  requesterId!: string; // user qui initie la demande

  @Prop({ required: true, index: true })
  addresseeId!: string; // user cible de la demande

  @Prop({ required: true, enum: ['pending', 'accepted'] })
  status!: FriendshipStatus;

  @Prop({ required: true, enum: ['private-email', 'public'] })
  type!: FriendshipType;
}

export type FriendshipDocument = HydratedDocument<Friendship>;

export const FriendshipSchema = SchemaFactory.createForClass(Friendship);
