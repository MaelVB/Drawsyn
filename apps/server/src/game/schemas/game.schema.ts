import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type GameDocument = HydratedDocument<Game>;

@Schema({ _id: false })
export class GamePlayerScore {
  @Prop({ required: true })
  playerId!: string;
  @Prop({ required: true })
  pseudo!: string;
  @Prop({ required: true })
  score!: number;
}

@Schema({ _id: false })
export class GameDrawing {
  @Prop({ required: true }) turnIndex!: number;
  @Prop({ required: true }) drawerId!: string;
  @Prop({ required: true }) word!: string;
  @Prop({ required: true }) filePath!: string; // chemin fichier PNG sur disque
}

@Schema({ _id: false })
export class GameMessage {
  @Prop({ required: true }) at!: number; // timestamp
  @Prop({ required: true }) type!: 'guess' | 'correct' | 'system';
  @Prop() playerId?: string;
  @Prop({ required: true }) text!: string;
}

@Schema({ timestamps: true })
export class Game {
  @Prop({ required: true, index: true })
  gameId!: string; // identifiant unique de la game (ex: roomId + timestamp)

  @Prop({ required: true })
  roomId!: string; // room source

  @Prop({ required: true })
  status!: 'running' | 'ended';

  @Prop({ required: true })
  totalRounds!: number;

  @Prop({ required: true })
  currentRound!: number;

  @Prop({ type: [GamePlayerScore], default: [] })
  players!: GamePlayerScore[];

  @Prop({ type: [GameDrawing], default: [] })
  drawings!: GameDrawing[];

  @Prop({ type: [GameMessage], default: [] })
  messages!: GameMessage[];
}

export const GamePlayerScoreSchema = SchemaFactory.createForClass(GamePlayerScore);
export const GameDrawingSchema = SchemaFactory.createForClass(GameDrawing);
export const GameMessageSchema = SchemaFactory.createForClass(GameMessage);
export const GameSchema = SchemaFactory.createForClass(Game);
// TTL index: suppression automatique du document après 7 jours
GameSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 7 });