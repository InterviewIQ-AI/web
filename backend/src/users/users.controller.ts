import { Controller, Get, Patch, Body, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/user.decorator';
import type { AuthUser } from '../auth/user.decorator';

@Controller('users')
@UseGuards(AuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /**
   * GET /users/me
   * Returns the full DB profile of the authenticated user.
   * Creates the user row if this is the first ever request.
   */
  @Get('me')
  async getMe(@CurrentUser() authUser: AuthUser) {
    // Ensure user row exists (idempotent upsert)
    await this.usersService.upsertUser(authUser.firebaseUid, authUser.email, authUser.name);
    return this.usersService.getMe(authUser.firebaseUid);
  }

  /**
   * PATCH /users/profile
   * Updates extended profile fields and marks profileCompleted = true.
   */
  @Patch('profile')
  async updateProfile(
    @CurrentUser() authUser: AuthUser,
    @Body() body: {
      name?: string;
      phone?: string;
      currentRole?: string;
      yearsOfExperience?: number;
      targetRole?: string;
      education?: string;
      linkedinUrl?: string;
      skills?: string[];
    },
  ) {
    // Ensure user row exists first
    await this.usersService.upsertUser(authUser.firebaseUid, authUser.email, authUser.name);
    return this.usersService.updateProfile(authUser.firebaseUid, body);
  }
}
