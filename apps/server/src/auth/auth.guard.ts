import { CanActivate, ExecutionContext, Injectable, UnauthorizedException, Inject, forwardRef } from '@nestjs/common';

import { AuthService } from './auth.service';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    @Inject(forwardRef(() => AuthService))
    private readonly auth: AuthService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const authorization: string | undefined = req.headers?.authorization;
    const token = authorization?.replace('Bearer ', '');

    const user = await this.auth.verifyToken(token);
    if (!user) {
      throw new UnauthorizedException('Token invalide ou expiré');
    }

    (req as any).user = user;
    return true;
  }
}
