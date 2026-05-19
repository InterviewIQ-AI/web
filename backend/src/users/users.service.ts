import { Injectable, Inject, Logger } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DRIZZLE } from '../database/database.module';
import { users } from '../database/schema';

export interface ProfileUpdateDto {
  name?: string;
  phone?: string;
  currentRole?: string;
  yearsOfExperience?: number;
  targetRole?: string;
  education?: string;
  linkedinUrl?: string;
  skills?: string[];
}

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(@Inject(DRIZZLE) private db: any) {}

  /**
   * Upserts a user by firebaseUid using an atomic INSERT … ON CONFLICT DO UPDATE.
   * Called on every authenticated request — idempotent.
   */
  async upsertUser(firebaseUid: string, email: string, name: string): Promise<{ id: number }> {
    const [row] = await this.db
      .insert(users)
      .values({ firebaseUid, email, name })
      .onConflictDoUpdate({
        target: users.firebaseUid,
        set: { email, name },
      })
      .returning({ id: users.id });

    return row;
  }

  /** Returns the full user profile row. */
  async getMe(firebaseUid: string) {
    return this.db.query.users.findFirst({
      where: eq(users.firebaseUid, firebaseUid),
    });
  }

  /** Updates profile fields and marks profileCompleted = true. */
  async updateProfile(firebaseUid: string, dto: ProfileUpdateDto) {
    const [updated] = await this.db
      .update(users)
      .set({
        ...dto,
        profileCompleted: true,
      })
      .where(eq(users.firebaseUid, firebaseUid))
      .returning();

    this.logger.log(`Profile completed for firebase uid: ${firebaseUid}`);
    return updated;
  }

  async getUserByFirebaseUid(firebaseUid: string): Promise<{ id: number } | null> {
    const user = await this.db.query.users.findFirst({
      where: eq(users.firebaseUid, firebaseUid),
    });
    return user ?? null;
  }
}
