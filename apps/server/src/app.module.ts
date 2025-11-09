import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';

import { GameModule } from './game/game.module';
import { RedisModule } from './common/redis/redis.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MongooseModule.forRootAsync({
      useFactory: () => ({
        uri: process.env.MONGODB_URI ?? 'mongodb://localhost:27017/drawsyn'
      })
    }),
    RedisModule.forRoot({
      url: process.env.REDIS_URL ?? 'redis://localhost:6379'
    }),
    GameModule
  ]
})
export class AppModule {}
