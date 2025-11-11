import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'crypto';

import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { UsersService } from '../users/users.service';

import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

interface TokenPayload {
  sub: string;
  pseudo: string;
  email: string;
  exp: number;
}

export interface AuthenticatedUser {
  id: string;
  pseudo: string;
  email: string;
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
    const existingPseudo = await this.users.findByPseudo(dto.pseudo);
    if (existingPseudo) {
      throw new BadRequestException('Ce pseudo est déjà utilisé');
    }

    const existingEmail = await this.users.findByEmail(dto.email);
    if (existingEmail) {
      throw new BadRequestException('Cette adresse email est déjà utilisée');
    }

    const password = this.hashPassword(dto.password);
    const user = await this.users.create(dto.pseudo, dto.email, password);
    return this.buildResponse(user.id, user.pseudo, user.email);
  }

  async login(dto: LoginDto): Promise<AuthResponse> {
    // Essayer de trouver l'utilisateur par email ou pseudo
    let user = await this.users.findByEmail(dto.identifier);
    if (!user) {
      user = await this.users.findByPseudo(dto.identifier);
    }

    if (!user || !this.verifyPassword(dto.password, user.password)) {
      throw new UnauthorizedException('Identifiants invalides');
    }

    // Vérifier que l'utilisateur a les nouveaux champs requis
    if (!user.pseudo || !user.email) {
      throw new UnauthorizedException('Compte obsolète. Veuillez créer un nouveau compte.');
    }

    return this.buildResponse(user.id, user.pseudo, user.email);
  }

  async verifyToken(token: string | undefined): Promise<AuthenticatedUser | null> {
    if (!token) {
      console.log('[Auth] Aucun token fourni');
      return null;
    }

    try {
      const payload = this.decodeToken(token);
      if (payload.exp * 1000 < Date.now()) {
        console.log('[Auth] Token expiré');
        return null;
      }

      const user = await this.users.findById(payload.sub);
      if (!user) {
        console.log('[Auth] Utilisateur non trouvé:', payload.sub);
        return null;
      }

      // Vérifier que l'utilisateur a les nouveaux champs requis
      if (!user.pseudo || !user.email) {
        console.log('[Auth] Utilisateur avec ancien format détecté (pas de pseudo ou email)');
        return null;
      }

      console.log('[Auth] Token valide pour', user.pseudo);
      return { id: user.id, pseudo: user.pseudo, email: user.email };
    } catch (error) {
      console.log('[Auth] Erreur lors de la vérification du token:', (error as Error).message);
      return null;
    }
  }

  private buildResponse(id: string, pseudo: string, email: string): AuthResponse {
    const payload: TokenPayload = {
      sub: id,
      pseudo,
      email,
      exp: Math.floor(Date.now() / 1000) + this.tokenTtlSeconds
    };

    return {
      token: this.signToken(payload),
      user: { id, pseudo, email }
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
