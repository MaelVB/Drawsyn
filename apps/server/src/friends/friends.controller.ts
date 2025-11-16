import { BadRequestException, Body, Controller, Get, Post, UseGuards, Delete, Param } from '@nestjs/common';
import { IsEmail, IsString } from 'class-validator';

import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { FriendsService } from './friends.service';

class ConnectByEmailDto {
  @IsEmail()
  email!: string;
}

class SendPublicRequestDto {
  @IsString()
  targetUserId!: string;
}

class ConfirmPublicRequestDto {
  @IsString()
  requesterUserId!: string;
}

@Controller('friends')
@UseGuards(AuthGuard)
export class FriendsController {
  constructor(private readonly friends: FriendsService) {}

  @Get()
  async list(@CurrentUser() user: { id: string }) {
    return this.friends.listRelations(user.id);
  }

  @Post('connect-by-email')
  async connectByEmail(@Body() dto: ConnectByEmailDto, @CurrentUser() user: { id: string }) {
    try {
      return await this.friends.connectByEmail(user.id, dto.email);
    } catch (e) {
      throw new BadRequestException((e as Error).message);
    }
  }

  @Post('send-public')
  async sendPublic(@Body() dto: SendPublicRequestDto, @CurrentUser() user: { id: string }) {
    try {
      return await this.friends.sendPublicRequest(user.id, dto.targetUserId);
    } catch (e) {
      throw new BadRequestException((e as Error).message);
    }
  }

  @Post('confirm-public')
  async confirmPublic(@Body() dto: ConfirmPublicRequestDto, @CurrentUser() user: { id: string }) {
    try {
      return await this.friends.confirmPublicRequest(user.id, dto.requesterUserId);
    } catch (e) {
      throw new BadRequestException((e as Error).message);
    }
  }

  @Delete(':otherUserId')
  async remove(@Param('otherUserId') otherUserId: string, @CurrentUser() user: { id: string }) {
    try {
      return await this.friends.removeRelation(user.id, otherUserId);
    } catch (e) {
      throw new BadRequestException((e as Error).message);
    }
  }
}
