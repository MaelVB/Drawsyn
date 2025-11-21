import { Controller, Get, Param, NotFoundException, UnauthorizedException, Req } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Game } from './schemas/game.schema';
import { AuthService } from '../auth/auth.service';
import * as fs from 'fs';
import * as path from 'path';

@Controller('games')
export class GameController {
  private readonly drawingsDir = process.env.DRAWINGS_DIR || path.join(process.cwd(), 'data', 'drawings');
  constructor(@InjectModel(Game.name) private readonly gameModel: Model<Game>, private readonly auth: AuthService) {}

  @Get(':gameId')
  async getGame(@Param('gameId') gameId: string, @Req() req: any) {
    const authHeader: string | undefined = req.headers['authorization'];
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
    const user = await this.auth.verifyToken(token);
    if (!user) throw new UnauthorizedException('Authentification requise');

    const game = await this.gameModel.findOne({ gameId }).lean();
    if (!game) throw new NotFoundException('Game not found');

    const isParticipant = game.players.some(p => p.playerId === user.id);
    if (!isParticipant) throw new UnauthorizedException('Accès réservé aux participants');

    // Transformer drawings en incluant imageData base64 (Data URL) pour réaffichage direct.
    const drawings = (game.drawings || []).map(d => {
      let imageData: string | undefined;
      try {
        const fullPath = path.isAbsolute(d.filePath) ? d.filePath : path.join(process.cwd(), d.filePath);
        if (fs.existsSync(fullPath)) {
          const buffer = fs.readFileSync(fullPath);
          const base64 = buffer.toString('base64');
          imageData = `data:image/png;base64,${base64}`;
        }
      } catch { /* ignore */ }
      return {
        turnIndex: d.turnIndex,
        drawerId: d.drawerId,
        word: d.word,
        filePath: d.filePath,
        imageData
      };
    });

    return {
      gameId: game.gameId,
      roomId: game.roomId,
      status: game.status,
      totalRounds: game.totalRounds,
      currentRound: game.currentRound,
      players: game.players,
      drawings,
      messages: game.messages,
      endedAt: game['endedAt'] ?? null,
      expiresAt: game['expiresAt'] ?? null
    };
  }
}
