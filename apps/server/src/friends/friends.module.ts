import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';
import { GameModule } from '../game/game.module';
import { Friendship, FriendshipSchema } from './schemas/friendship.schema';
import { FriendsController } from './friends.controller';
import { FriendsService } from './friends.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Friendship.name, schema: FriendshipSchema }]),
    forwardRef(() => AuthModule),
    UsersModule,
    GameModule
  ],
  controllers: [FriendsController],
  providers: [FriendsService],
  exports: [FriendsService]
})
export class FriendsModule {}
