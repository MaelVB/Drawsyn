import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';

import { AuthModule } from './auth/auth.module';
import { RedisModule } from './common/redis/redis.module';
import { GameModule } from './game/game.module';
import { FriendsModule } from './friends/friends.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MongooseModule.forRootAsync({
      useFactory: () => ({
        uri: process.env.MONGODB_URI ?? 'mongodb://localhost:27017/drawsyn'
      })
    }),
    RedisModule.forRoot({
      url: process.env.REDIS_URL ?? 'redis://localhost:6379',
      optional: process.env.NODE_ENV !== 'production'
    }),
    AuthModule,
    GameModule,
    UsersModule,
    FriendsModule
  ]
})
export class AppModule {}
