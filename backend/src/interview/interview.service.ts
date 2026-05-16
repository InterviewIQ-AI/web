import { Injectable, Inject, Logger, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { eq, desc } from 'drizzle-orm';
import { DRIZZLE } from '../database/database.module';
import { interviews, questions, answers } from '../database/schema';
import { AiService } from '../ai/ai.service';

@Injectable()
export class InterviewService {
  private readonly logger = new Logger(InterviewService.name);

  constructor(
    @Inject(DRIZZLE) private db: any,
    private readonly aiService: AiService,
  ) {}

  async createInterview(jobRole: string, firstQuestion: any) {
    // For now use userId = 1 (guest user). Update when auth is added.
    const [interview] = await this.db
      .insert(interviews)
      .values({ userId: 1, jobRole, status: 'IN_PROGRESS' })
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
  ) {
    const interview = await this.db.query.interviews.findFirst({
      where: eq(interviews.id, interviewId),
    });

    if (!interview) {
      throw new NotFoundException(`Interview ${interviewId} not found`);
    }

    const nextQ = await this.aiService.generateNextQuestion(
      interview.jobRole,
      history,
    );

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

  async getInterview(interviewId: number) {
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

    return interview;
  }

  async submitAnswer(
    questionId: number,
    userAnswer: string,
    isVoice: boolean,
    timeTakenSeconds: number,
    history?: Array<{ question: string; answer: string }>,
    snapshots?: string[], // New field
  ) {
    // Get the question to evaluate against
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

    // Parallel processing: Evaluation + Next Question
    const [evaluation, nextQ] = await Promise.all([
      this.aiService.evaluateAnswer(
        question.questionText,
        expectedConcepts,
        userAnswer,
        snapshots,
      ),
      history && interview 
        ? this.aiService.generateNextQuestion(interview.jobRole, history)
        : Promise.resolve(null)
    ]);

    // Save answer with safety guards
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
          missingConcepts: evaluation?.missingConcepts ?? [],
          behavioralFeedback: evaluation?.behavioralFeedback ?? null,
        })
        .returning();

      // If we generated a next question, save it
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
    // Guard: make sure the interview actually exists before touching it
    const existing = await this.db.query.interviews.findFirst({
      where: eq(interviews.id, interviewId),
    });
    if (!existing) {
      throw new NotFoundException(`Interview ${interviewId} not found`);
    }

    // Calculate final score from all answers
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
      throw new InternalServerErrorException(
        `Failed to mark interview ${interviewId} as completed`,
      );
    }

    this.logger.log(
      `Interview #${interviewId} completed. Final score: ${finalScore}/10`,
    );

    return { interview: updatedInterview, finalScore, feedbackSummary };
  }

  async getAllInterviews() {
    return this.db.query.interviews.findMany({
      orderBy: [desc(interviews.createdAt)],
      with: {
        questions: true,
      }
    });
  }
}
