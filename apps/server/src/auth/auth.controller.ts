import { Body, Controller, Get, Headers, Post, UnauthorizedException } from '@nestjs/common';

import { AuthenticatedUser, AuthResponse, AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  register(@Body() dto: RegisterDto): Promise<AuthResponse> {
    return this.auth.register(dto);
  }

  @Post('login')
  login(@Body() dto: LoginDto): Promise<AuthResponse> {
    return this.auth.login(dto);
  }

  @Get('me')
  async me(@Headers('authorization') authorization?: string): Promise<AuthenticatedUser> {
    const token = authorization?.replace('Bearer ', '');
    const user = await this.auth.verifyToken(token);
    
    if (!user) {
      throw new UnauthorizedException('Token invalide ou expiré');
    }
    
    return user;
  }
}
