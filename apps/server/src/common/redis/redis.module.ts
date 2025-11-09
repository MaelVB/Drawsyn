import { DynamicModule, Global, Module } from '@nestjs/common';
import Redis from 'ioredis';

export interface RedisModuleOptions {
  url: string;
}

export const REDIS_CLIENT = Symbol('REDIS_CLIENT');

@Global()
@Module({})
export class RedisModule {
  static forRoot(options: RedisModuleOptions): DynamicModule {
    return {
      module: RedisModule,
      providers: [
        {
          provide: REDIS_CLIENT,
          useFactory: () => new Redis(options.url)
        }
      ],
      exports: [REDIS_CLIENT]
    };
  }
}
