import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'crypto';

import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { UsersService } from '../users/users.service';

import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

interface TokenPayload {
  sub: string;
  username: string;
  exp: number;
}

export interface AuthenticatedUser {
  id: string;
  username: string;
}

export interface AuthResponse {
  token: string;
  user: AuthenticatedUser;
}

@Injectable()
export class AuthService {
  private readonly secret: string;
  private readonly tokenTtlSeconds = 60 * 60 * 24 * 7;

  constructor(private readonly users: UsersService, config: ConfigService) {
    this.secret = config.get<string>('AUTH_SECRET') ?? 'drawsyn-secret';
  }

  async register(dto: RegisterDto): Promise<AuthResponse> {
    const existing = await this.users.findByUsername(dto.username);
    if (existing) {
      throw new BadRequestException('Nom d\'utilisateur déjà utilisé');
    }

    const password = this.hashPassword(dto.password);
    const user = await this.users.create(dto.username, password);
    return this.buildResponse(user.id, user.username);
  }

  async login(dto: LoginDto): Promise<AuthResponse> {
    const user = await this.users.findByUsername(dto.username);
    if (!user || !this.verifyPassword(dto.password, user.password)) {
      throw new UnauthorizedException('Identifiants invalides');
    }

    return this.buildResponse(user.id, user.username);
  }

  async verifyToken(token: string | undefined): Promise<AuthenticatedUser | null> {
    if (!token) return null;

    try {
      const payload = this.decodeToken(token);
      if (payload.exp * 1000 < Date.now()) {
        return null;
      }

      const user = await this.users.findById(payload.sub);
      if (!user) {
        return null;
      }

      return { id: user.id, username: user.username };
    } catch (error) {
      return null;
    }
  }

  private buildResponse(id: string, username: string): AuthResponse {
    const payload: TokenPayload = {
      sub: id,
      username,
      exp: Math.floor(Date.now() / 1000) + this.tokenTtlSeconds
    };

    return {
      token: this.signToken(payload),
      user: { id, username }
    };
  }

  private hashPassword(password: string) {
    const salt = randomBytes(16).toString('hex');
    const derived = scryptSync(password, salt, 64);
    return `${salt}:${derived.toString('hex')}`;
  }

  private verifyPassword(password: string, stored: string) {
    const [salt, hash] = stored.split(':');
    if (!salt || !hash) return false;

    const derived = scryptSync(password, salt, 64);
    const hashBuffer = Buffer.from(hash, 'hex');
    return derived.length === hashBuffer.length && timingSafeEqual(derived, hashBuffer);
  }

  private signToken(payload: TokenPayload) {
    const header = this.base64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const body = this.base64Url(JSON.stringify(payload));
    const signature = this.base64Url(
      createHmac('sha256', this.secret).update(`${header}.${body}`).digest()
    );
    return `${header}.${body}.${signature}`;
  }

  private decodeToken(token: string): TokenPayload {
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid token');
    }

    const [header, body, signature] = parts;
    const expected = this.base64Url(
      createHmac('sha256', this.secret).update(`${header}.${body}`).digest()
    );

    const signatureBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expected);
    if (
      signatureBuffer.length !== expectedBuffer.length ||
      !timingSafeEqual(signatureBuffer, expectedBuffer)
    ) {
      throw new Error('Invalid signature');
    }

    const normalizedBody = body.replace(/-/g, '+').replace(/_/g, '/');
    const paddedBody = normalizedBody.padEnd(normalizedBody.length + ((4 - (normalizedBody.length % 4)) % 4), '=');
    const payloadJson = Buffer.from(paddedBody, 'base64').toString();
    return JSON.parse(payloadJson) as TokenPayload;
  }

  private base64Url(value: string | Buffer) {
    return Buffer.from(value)
      .toString('base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');
  }
}
