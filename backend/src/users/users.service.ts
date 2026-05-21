import { Injectable, Inject, Logger } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DRIZZLE } from '../database/database.module';
import { users, interviews, questionPerformance } from '../database/schema';

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
  async upsertUser(id: string, email: string, name: string): Promise<{ id: string }> {
    // 1. Check if user exists by id
    const existingById = await this.db.query.users.findFirst({
      where: eq(users.id, id),
    });

    if (existingById) {
      // User exists with the correct Firebase UID. Update their email and name if needed.
      const [updated] = await this.db
        .update(users)
        .set({ email, name })
        .where(eq(users.id, id))
        .returning({ id: users.id });
      return updated;
    }

    // 2. Check if user exists by email (with some other id, e.g. old serial ID '1')
    const existingByEmail = await this.db.query.users.findFirst({
      where: eq(users.email, email),
    });

    if (existingByEmail) {
      const oldId = existingByEmail.id;
      
      const [updated] = await this.db
        .update(users)
        .set({ id, name })
        .where(eq(users.id, oldId))
        .returning({ id: users.id });

      // Update references in other tables
      await this.db
        .update(interviews)
        .set({ userId: id })
        .where(eq(interviews.userId, oldId));

      await this.db
        .update(questionPerformance)
        .set({ userId: id })
        .where(eq(questionPerformance.userId, oldId));

      return updated;
    }

    // 3. User does not exist at all, create a new one.
    const [row] = await this.db
      .insert(users)
      .values({ id, email, name })
      .returning({ id: users.id });

    return row;
  }

  /** Returns the full user profile row. */
  async getMe(id: string) {
    return this.db.query.users.findFirst({
      where: eq(users.id, id),
    });
  }

  /** Updates profile fields and marks profileCompleted = true. */
  async updateProfile(id: string, dto: ProfileUpdateDto) {
    const [updated] = await this.db
      .update(users)
      .set({
        ...dto,
        profileCompleted: true,
      })
      .where(eq(users.id, id))
      .returning();

    this.logger.log(`Profile completed for firebase uid: ${id}`);
    return updated;
  }

  async getUserByFirebaseUid(id: string): Promise<{ id: string } | null> {
    const user = await this.db.query.users.findFirst({
      where: eq(users.id, id),
    });
    return user ?? null;
  }
}
