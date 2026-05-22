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

  async createInterview(jobRole: string, firstQuestion: any, userId: string) {
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
    userId: string,
  ) {
    const interview = await this.db.query.interviews.findFirst({
      where: eq(interviews.id, interviewId),
    });

    if (!interview) throw new NotFoundException(`Interview ${interviewId} not found`);

    const hints = await this.spacedRep.getPerformanceHints(
      userId,
      interview.jobRole,
      interview.sessionNumber ?? 1,
    );

    const { question: nextQ } = await this.aiService.generateFollowUpOrNext(interview.jobRole, history, hints);

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

  async getInterview(interviewId: number, userId?: string) {
    const interview = await this.db.query.interviews.findFirst({
      where: eq(interviews.id, interviewId),
      with: {
        questions: {
          with: { answers: true },
        },
      },
    });

    if (!interview) throw new NotFoundException(`Interview ${interviewId} not found`);

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
    userId: string,
    history?: Array<{ question: string; answer: string }>,
    snapshots?: string[],
  ) {
    const question = await this.db.query.questions.findFirst({
      where: eq(questions.id, questionId),
    });

    if (!question) throw new NotFoundException(`Question ${questionId} not found`);

    const interviewId = question.interviewId;
    const interview = await this.db.query.interviews.findFirst({
      where: eq(interviews.id, interviewId),
    });

    const expectedConcepts = (question.expectedConcepts as string[]) ?? [];

    const hints = await this.spacedRep.getPerformanceHints(
      userId,
      interview?.jobRole ?? '',
      interview?.sessionNumber ?? 1,
    );

    // Parallel: evaluate answer + pre-fetch next/follow-up question
    const [evaluation, followUpResult] = await Promise.all([
      this.aiService.evaluateAnswer(question.questionText, expectedConcepts, userAnswer, snapshots),
      history && interview
        ? this.aiService.generateFollowUpOrNext(interview.jobRole, history, hints)
        : Promise.resolve(null),
    ]);

    // Record spaced repetition performance
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
      await this.db
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

      // Save pre-fetched next/follow-up question
      let savedNextQuestion = null;
      let isFollowUp = false;

      if (followUpResult) {
        isFollowUp = followUpResult.type === 'FOLLOWUP';
        try {
          [savedNextQuestion] = await this.db
            .insert(questions)
            .values({
              interviewId,
              questionText: followUpResult.question.questionText,
              category: followUpResult.question.category,
              difficulty: followUpResult.question.difficulty ?? 3,
              expectedConcepts: followUpResult.question.expectedConcepts ?? [],
            })
            .returning();
        } catch (nextQError) {
          this.logger.error(`Failed to save pre-fetched question for interview ${interviewId}:`, nextQError);
        }
      }

      return { evaluation, nextQuestion: savedNextQuestion, isFollowUp };
    } catch (dbError) {
      this.logger.error(`CRITICAL: Failed to save answer for question ${questionId}:`, dbError);
      throw new InternalServerErrorException('Failed to persist interview data. Please check database connectivity.');
    }
  }

  async completeInterview(interviewId: number) {
    const existing = await this.db.query.interviews.findFirst({
      where: eq(interviews.id, interviewId),
    });
    if (!existing) throw new NotFoundException(`Interview ${interviewId} not found`);

    const interviewQuestions = await this.db.query.questions.findMany({
      where: eq(questions.interviewId, interviewId),
      with: { answers: true },
    });

    let totalScore = 0;
    let count = 0;
    const qaForStudyPlan: Array<{ question: string; score: number; missingConcepts: string[] }> = [];

    for (const q of interviewQuestions) {
      for (const a of q.answers || []) {
        if (a.score !== null) {
          totalScore += a.score;
          count++;
          qaForStudyPlan.push({
            question: q.questionText,
            score: a.score,
            missingConcepts: (a.missingConcepts as string[]) ?? [],
          });
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

    // Generate AI study plan in parallel with DB update
    const [updatedInterview, studyPlan] = await Promise.all([
      this.db
        .update(interviews)
        .set({ status: 'COMPLETED', finalScore, feedbackSummary })
        .where(eq(interviews.id, interviewId))
        .returning()
        .then((rows: any[]) => rows[0]),
      this.aiService.generateStudyPlan(existing.jobRole, qaForStudyPlan)
        .catch((e) => {
          this.logger.warn(`Study plan generation failed: ${e.message}`);
          return null;
        }),
    ]);

    if (!updatedInterview) {
      throw new InternalServerErrorException(`Failed to mark interview ${interviewId} as completed`);
    }

    // Save study plan if generated successfully
    if (studyPlan) {
      await this.db
        .update(interviews)
        .set({ studyPlan })
        .where(eq(interviews.id, interviewId))
        .catch((e: any) => this.logger.warn(`Failed to save study plan: ${e.message}`));
    }

    this.logger.log(`Interview #${interviewId} completed. Final score: ${finalScore}/10`);
    return { interview: updatedInterview, finalScore, feedbackSummary, studyPlan };
  }

  async getAllInterviews(userId: string) {
    return this.db.query.interviews.findMany({
      where: eq(interviews.userId, userId),
      orderBy: [desc(interviews.createdAt)],
      with: { questions: true },
    });
  }
}
