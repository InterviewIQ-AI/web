import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { verifyIdToken } from './firebase-admin';

@Injectable()
export class AuthGuard implements CanActivate {
  private readonly logger = new Logger(AuthGuard.name);

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader: string | undefined = request.headers['authorization'];

    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or malformed Authorization header');
    }

    const token = authHeader.slice(7).trim();

    try {
      const decoded = await verifyIdToken(token);
      // Attach decoded token payload so controllers can access it via @CurrentUser()
      request.user = {
        firebaseUid: decoded.uid,
        email: decoded.email ?? '',
        name: decoded.name ?? decoded.email ?? 'Anonymous',
      };
      return true;
    } catch (err: any) {
      this.logger.warn(`Token verification failed: ${err.message}`);
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
