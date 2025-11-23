import { BadRequestException, Body, Controller, Get, Put, UnauthorizedException, UseGuards } from '@nestjs/common';

import { AuthService } from '../auth/auth.service';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

import { UpdateMeDto } from './dto/update-me.dto';
import { UsersService } from './users.service';

@Controller('users')
@UseGuards(AuthGuard)
export class UsersController {
  constructor(private readonly users: UsersService, private readonly auth: AuthService) {}

  @Get('me')
  async me(@CurrentUser() user: { id: string }) {
    const dbUser = await this.users.findById(user.id);
    if (!dbUser) {
      throw new UnauthorizedException('Utilisateur introuvable');
    }

    return {
      id: dbUser.id,
      pseudo: dbUser.pseudo,
      email: dbUser.email,
      twitchUrl: dbUser.twitchUrl ?? null,
      allowPublicFriendRequests: dbUser.allowPublicFriendRequests ?? true,
      colorPalettes: dbUser.colorPalettes ?? [],
      defaultColorPaletteId: dbUser.defaultColorPaletteId ?? 'main'
    };
  }

  @Put('me')
  async updateMe(@Body() dto: UpdateMeDto, @CurrentUser() user: { id: string }) {

    // Si changement de pseudo, vérifier unicité
    if (dto.pseudo) {
      const existing = await this.users.findByPseudo(dto.pseudo);
      if (existing && existing.id !== user.id) {
        throw new BadRequestException('Ce pseudo est déjà utilisé');
      }
    }

  const updated = await this.users.updateById(user.id, dto);
    if (!updated) {
      throw new UnauthorizedException('Utilisateur introuvable');
    }

    return {
      id: updated.id,
      pseudo: updated.pseudo,
      email: updated.email,
      twitchUrl: updated.twitchUrl ?? null,
      allowPublicFriendRequests: updated.allowPublicFriendRequests ?? true,
      colorPalettes: updated.colorPalettes ?? [],
      defaultColorPaletteId: updated.defaultColorPaletteId ?? 'main'
    };
  }
}
