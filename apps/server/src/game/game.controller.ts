import { Controller, Get, Param, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Game } from './schemas/game.schema';

@Controller('games')
export class GameController {
  constructor(@InjectModel(Game.name) private readonly gameModel: Model<Game>) {}

  @Get(':gameId')
  async getGame(@Param('gameId') gameId: string) {
    const game = await this.gameModel.findOne({ gameId }).lean();
    if (!game) throw new NotFoundException('Game not found');
    // Ne pas renvoyer les messages trop longs éventuellement; pour l'instant tout
    return {
      gameId: game.gameId,
      roomId: game.roomId,
      status: game.status,
      totalRounds: game.totalRounds,
      currentRound: game.currentRound,
      players: game.players,
      drawings: game.drawings, // filePath + meta
      messages: game.messages
    };
  }
}
