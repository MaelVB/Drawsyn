import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { AuthModule } from '../auth/auth.module';

import { GameGateway } from './game.gateway';
import { GameService } from './game.service';
import { LobbyService } from './lobby.service';
import { GameSchema, Game } from './schemas/game.schema';
import { GameController } from './game.controller';
import { CleanupService } from './cleanup.service';

@Module({
  imports: [
    AuthModule,
    MongooseModule.forFeature([
      { name: Game.name, schema: GameSchema }
    ])
  ],
  controllers: [GameController],
  providers: [GameGateway, GameService, LobbyService, CleanupService]
})
export class GameModule {}
