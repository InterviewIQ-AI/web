import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface AuthUser {
  firebaseUid: string;
  email: string;
  name: string;
}

/**
 * Param decorator that extracts the authenticated user attached by AuthGuard.
 * Usage: @CurrentUser() user: AuthUser
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => {
    const request = ctx.switchToHttp().getRequest();
    return request.user as AuthUser;
  },
);
