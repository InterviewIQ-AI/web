import { Injectable, Inject, Logger, NotFoundException, InternalServerErrorException, ForbiddenException } from '@nestjs/common';
import { eq, desc, and } from 'drizzle-orm';
import { DRIZZLE } from '../database/database.module';
import { interviews, questions, answers } from '../database/schema';
import { AiService } from '../ai/ai.service';
import { SpacedRepetitionService } from './spaced-repetition.service';

@Injectable()
export class InterviewService {
  private readonly logger = new Logger(InterviewService.name);

  constructor(
    @Inject(DRIZZLE) private db: any,
    private readonly aiService: AiService,
    private readonly spacedRep: SpacedRepetitionService,
  ) {}

  async createInterview(jobRole: string, firstQuestion: any, userId: number) {
    // Count prior sessions for this user+role to compute session number
    const sessionNumber = (await this.spacedRep.getSessionNumber(userId, jobRole)) + 1;

    const [interview] = await this.db
      .insert(interviews)
      .values({ userId, jobRole, status: 'IN_PROGRESS', sessionNumber })
      .returning();

    const [savedQuestion] = await this.db
      .insert(questions)
      .values({
        interviewId: interview.id,
        questionText: firstQuestion.questionText,
        category: firstQuestion.category,
        difficulty: firstQuestion.difficulty ?? 3,
        expectedConcepts: firstQuestion.expectedConcepts ?? [],
      })
      .returning();

    return { interview, question: savedQuestion };
  }

  async addNextQuestion(
    interviewId: number,
    history: Array<{ question: string; answer: string }>,
    userId: number,
  ) {
    const interview = await this.db.query.interviews.findFirst({
      where: eq(interviews.id, interviewId),
    });

    if (!interview) {
      throw new NotFoundException(`Interview ${interviewId} not found`);
    }

    // Fetch spaced-repetition hints for this user+role
    const hints = await this.spacedRep.getPerformanceHints(
      userId,
      interview.jobRole,
      interview.sessionNumber ?? 1,
    );

    const nextQ = await this.aiService.generateNextQuestion(interview.jobRole, history, hints);

    const [savedQuestion] = await this.db
      .insert(questions)
      .values({
        interviewId,
        questionText: nextQ.questionText,
        category: nextQ.category,
        difficulty: nextQ.difficulty ?? 3,
        expectedConcepts: nextQ.expectedConcepts ?? [],
      })
      .returning();

    return { question: savedQuestion };
  }

  async getInterview(interviewId: number, userId?: number) {
    const interview = await this.db.query.interviews.findFirst({
      where: eq(interviews.id, interviewId),
      with: {
        questions: {
          with: { answers: true },
        },
      },
    });

    if (!interview) {
      throw new NotFoundException(`Interview ${interviewId} not found`);
    }

    // Ownership check — if userId is provided, ensure the interview belongs to them
    if (userId !== undefined && interview.userId !== userId) {
      throw new ForbiddenException('You do not have access to this interview');
    }

    return interview;
  }

  async submitAnswer(
    questionId: number,
    userAnswer: string,
    isVoice: boolean,
    timeTakenSeconds: number,
    userId: number,
    history?: Array<{ question: string; answer: string }>,
    snapshots?: string[],
  ) {
    const question = await this.db.query.questions.findFirst({
      where: eq(questions.id, questionId),
    });

    if (!question) {
      throw new NotFoundException(`Question ${questionId} not found`);
    }

    const interviewId = question.interviewId;
    const interview = await this.db.query.interviews.findFirst({
      where: eq(interviews.id, interviewId),
    });

    const expectedConcepts = (question.expectedConcepts as string[]) ?? [];

    // Fetch spaced-repetition hints for the pre-fetched next question
    const hints = await this.spacedRep.getPerformanceHints(
      userId,
      interview?.jobRole ?? '',
      interview?.sessionNumber ?? 1,
    );

    // Parallel: evaluate answer + pre-fetch next question (with spaced rep hints)
    const [evaluation, nextQ] = await Promise.all([
      this.aiService.evaluateAnswer(question.questionText, expectedConcepts, userAnswer, snapshots),
      history && interview
        ? this.aiService.generateNextQuestion(interview.jobRole, history, hints)
        : Promise.resolve(null),
    ]);

    // Record spaced repetition performance for this answer
    if (evaluation?.score !== undefined) {
      await this.spacedRep.recordPerformance(
        userId,
        interview?.jobRole ?? '',
        interview?.sessionNumber ?? 1,
        expectedConcepts,
        evaluation.score,
      ).catch((e) => this.logger.warn(`Spaced rep record failed: ${e.message}`));
    }

    // Save answer to DB
    try {
      const [answer] = await this.db
        .insert(answers)
        .values({
          questionId: Number(questionId),
          userAnswer,
          isVoice,
          timeTakenSeconds: Math.round(Number(timeTakenSeconds ?? 0)),
          score: Math.round(Number(evaluation?.score ?? 0)),
          feedback: evaluation?.feedback ?? 'Evaluation unavailable.',
          idealAnswer: evaluation?.idealAnswer ?? null,
          missingConcepts: evaluation?.missingConcepts ?? [],
          behavioralFeedback: evaluation?.behavioralFeedback ?? null,
        })
        .returning();

      // Save pre-fetched next question
      let savedNextQuestion = null;
      if (nextQ) {
        try {
          [savedNextQuestion] = await this.db
            .insert(questions)
            .values({
              interviewId,
              questionText: nextQ.questionText,
              category: nextQ.category,
              difficulty: nextQ.difficulty ?? 3,
              expectedConcepts: nextQ.expectedConcepts ?? [],
            })
            .returning();
        } catch (nextQError) {
          this.logger.error(`Failed to save pre-fetched question for interview ${interviewId}:`, nextQError);
        }
      }

      return { answer, evaluation, nextQuestion: savedNextQuestion };
    } catch (dbError) {
      this.logger.error(`CRITICAL: Failed to save answer for question ${questionId}:`, dbError);
      throw new InternalServerErrorException('Failed to persist interview data. Please check database connectivity.');
    }
  }

  async completeInterview(interviewId: number) {
    const existing = await this.db.query.interviews.findFirst({
      where: eq(interviews.id, interviewId),
    });
    if (!existing) {
      throw new NotFoundException(`Interview ${interviewId} not found`);
    }

    const interviewQuestions = await this.db.query.questions.findMany({
      where: eq(questions.interviewId, interviewId),
      with: { answers: true },
    });

    let totalScore = 0;
    let count = 0;

    for (const q of interviewQuestions) {
      for (const a of q.answers || []) {
        if (a.score !== null) {
          totalScore += a.score;
          count++;
        }
      }
    }

    const finalScore = count > 0 ? Math.round(totalScore / count) : 0;

    const feedbackSummary =
      finalScore >= 8
        ? 'Excellent performance! Strong across all areas.'
        : finalScore >= 6
          ? 'Good performance with room for improvement in some areas.'
          : finalScore >= 4
            ? 'Average performance. Focus on strengthening core concepts.'
            : 'Needs significant improvement. Review fundamentals.';

    const [updatedInterview] = await this.db
      .update(interviews)
      .set({ status: 'COMPLETED', finalScore, feedbackSummary })
      .where(eq(interviews.id, interviewId))
      .returning();

    if (!updatedInterview) {
      throw new InternalServerErrorException(`Failed to mark interview ${interviewId} as completed`);
    }

    this.logger.log(`Interview #${interviewId} completed. Final score: ${finalScore}/10`);

    return { interview: updatedInterview, finalScore, feedbackSummary };
  }

  async getAllInterviews(userId: number) {
    return this.db.query.interviews.findMany({
      where: eq(interviews.userId, userId),
      orderBy: [desc(interviews.createdAt)],
      with: { questions: true },
    });
  }
}
