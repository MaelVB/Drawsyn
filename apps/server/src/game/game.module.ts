import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';

import { GameGateway } from './game.gateway';
import { GameService } from './game.service';
import { LobbyService } from './lobby.service';

@Module({
  imports: [AuthModule],
  providers: [GameGateway, GameService, LobbyService]
})
export class GameModule {}
