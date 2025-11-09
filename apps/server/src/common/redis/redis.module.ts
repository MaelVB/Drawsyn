import { DynamicModule, Global, Logger, Module } from '@nestjs/common';
import Redis from 'ioredis';

export interface RedisModuleOptions {
  url: string;
  optional?: boolean;
}

export const REDIS_CLIENT = Symbol('REDIS_CLIENT');
export const REDIS_AVAILABLE = Symbol('REDIS_AVAILABLE');

export type RedisClient = Redis | null;

const logger = new Logger('RedisModule');

@Global()
@Module({})
export class RedisModule {
  static forRoot(options: RedisModuleOptions): DynamicModule {
    return {
      module: RedisModule,
      providers: [
        {
          provide: REDIS_CLIENT,
          useFactory: async () => {
            const optional = options.optional ?? false;
            const client = new Redis(options.url, {
              lazyConnect: true,
              maxRetriesPerRequest: 0,
              retryStrategy: () => null
            });

            try {
              await client.connect();
              client.on('error', (error) => {
                logger.error(`Redis connection error: ${error.message}`);
              });
              logger.log(`Connected to Redis at ${options.url}`);
              return client;
            } catch (error) {
              if (!optional) {
                throw error;
              }

              logger.warn(`Redis unavailable (${(error as Error).message}), continuing without Redis`);
              client.disconnect();
              return null;
            }
          }
        },
        {
          provide: REDIS_AVAILABLE,
          useFactory: (client: RedisClient) => client !== null,
          inject: [REDIS_CLIENT]
        }
      ],
      exports: [REDIS_CLIENT, REDIS_AVAILABLE]
    };
  }
}
