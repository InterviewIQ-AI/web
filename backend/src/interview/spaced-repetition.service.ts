import { Injectable, Inject, Logger } from '@nestjs/common';
import { eq, and, gt } from 'drizzle-orm';
import { DRIZZLE } from '../database/database.module';
import { questionPerformance, interviews } from '../database/schema';

// ─── Thresholds ───────────────────────────────────────────────────────────────
const SUPPRESS_THRESHOLD = 7;   // score >= this → suppress for SUPPRESS_SESSIONS
const DRILL_THRESHOLD    = 5;   // score <  this → re-emphasis needed
const SUPPRESS_SESSIONS  = 3;   // sessions to skip a mastered concept
// (Scores 5–6 are neutral: concept stays in the normal adaptive pool.)

@Injectable()
export class SpacedRepetitionService {
  private readonly logger = new Logger(SpacedRepetitionService.name);

  constructor(@Inject(DRIZZLE) private db: any) {}

  /**
   * Returns the current session number for a user+role pair.
   * (Counts all interviews ever started for that role by this user.)
   */
  async getSessionNumber(userId: number, jobRole: string): Promise<number> {
    const rows = await this.db.query.interviews.findMany({
      where: and(
        eq(interviews.userId, userId),
        eq(interviews.jobRole, jobRole),
      ),
    });
    return rows.length; // 1-indexed after the first session is created
  }

  /**
   * After an answer is submitted, update the performance table for each
   * expected concept of the answered question.
   */
  async recordPerformance(
    userId: number,
    jobRole: string,
    currentSession: number,
    concepts: string[],
    score: number,
  ): Promise<void> {
    for (const concept of concepts) {
      const existing = await this.db.query.questionPerformance.findFirst({
        where: and(
          eq(questionPerformance.userId, userId),
          eq(questionPerformance.jobRole, jobRole),
          eq(questionPerformance.conceptTag, concept),
        ),
      });

      let suppressUntilSession = 0;
      let timesAnswered = 1;

      if (existing) {
        timesAnswered = (existing.timesAnswered ?? 0) + 1;
      }

      if (score >= SUPPRESS_THRESHOLD) {
        // Mastered — suppress this concept for the next N sessions
        suppressUntilSession = currentSession + SUPPRESS_SESSIONS;
      }
      // score < DRILL_THRESHOLD → suppressUntilSession stays 0 (always eligible)
      // score 5–6 → suppressUntilSession stays 0 (neutral, normal flow)

      if (existing) {
        await this.db
          .update(questionPerformance)
          .set({ lastScore: score, timesAnswered, suppressUntilSession, updatedAt: new Date() })
          .where(
            and(
              eq(questionPerformance.userId, userId),
              eq(questionPerformance.jobRole, jobRole),
              eq(questionPerformance.conceptTag, concept),
            ),
          );
      } else {
        await this.db.insert(questionPerformance).values({
          userId,
          jobRole,
          conceptTag: concept,
          lastScore: score,
          timesAnswered,
          suppressUntilSession,
        });
      }
    }
  }

  /**
   * Returns a structured performance hint for the AI prompt:
   * - suppressedConcepts: concepts the user has mastered; AI should avoid these for now
   * - drillConcepts: concepts the user struggles with; AI should emphasise these
   */
  async getPerformanceHints(
    userId: number,
    jobRole: string,
    currentSession: number,
  ): Promise<{ suppressedConcepts: string[]; drillConcepts: string[] }> {
    const records = await this.db.query.questionPerformance.findMany({
      where: and(
        eq(questionPerformance.userId, userId),
        eq(questionPerformance.jobRole, jobRole),
      ),
    });

    const suppressedConcepts: string[] = [];
    const drillConcepts: string[] = [];

    for (const r of records) {
      if (r.suppressUntilSession > currentSession) {
        suppressedConcepts.push(r.conceptTag);
      } else if (r.lastScore < DRILL_THRESHOLD) {
        drillConcepts.push(r.conceptTag);
      }
    }

    this.logger.debug(
      `User ${userId} | Role: ${jobRole} | Session: ${currentSession} | ` +
      `Suppressed: [${suppressedConcepts.join(', ')}] | Drill: [${drillConcepts.join(', ')}]`,
    );

    return { suppressedConcepts, drillConcepts };
  }
}
