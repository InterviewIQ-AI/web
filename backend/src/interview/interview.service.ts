import { Injectable, Inject, Logger, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
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

  async createInterview(jobRole: string, generatedQuestions: any[]) {
    // For now use userId = 1 (guest user). Update when auth is added.
    const [interview] = await this.db
      .insert(interviews)
      .values({ userId: 1, jobRole, status: 'IN_PROGRESS' })
      .returning();

    const questionRows = generatedQuestions.map((q) => ({
      interviewId: interview.id,
      questionText: q.questionText,
      category: q.category,
      difficulty: q.difficulty ?? 3,
      expectedConcepts: q.expectedConcepts ?? [],
    }));

    const savedQuestions = await this.db
      .insert(questions)
      .values(questionRows)
      .returning();

    return { interview, questions: savedQuestions };
  }

  async getInterview(interviewId: number) {
    const interview = await this.db.query.interviews.findFirst({
      where: eq(interviews.id, interviewId),
      with: { questions: true },
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
  ) {
    // Get the question to evaluate against
    const question = await this.db.query.questions.findFirst({
      where: eq(questions.id, questionId),
    });

    if (!question) {
      throw new NotFoundException(`Question ${questionId} not found`);
    }

    const expectedConcepts = (question.expectedConcepts as string[]) ?? [];

    // Evaluate with AI
    const evaluation = await this.aiService.evaluateAnswer(
      question.questionText,
      expectedConcepts,
      userAnswer,
    );

    const [answer] = await this.db
      .insert(answers)
      .values({
        questionId,
        userAnswer,
        isVoice,
        timeTakenSeconds,
        score: evaluation.score,
        feedback: evaluation.feedback,
        missingConcepts: evaluation.missingConcepts ?? [],
      })
      .returning();

    return { answer, evaluation };
  }

  async completeInterview(interviewId: number) {
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

    return { interview: updatedInterview, finalScore, feedbackSummary };
  }

  async getAllInterviews() {
    return this.db.query.interviews.findMany({
      orderBy: (interviews: any, { desc }: any) => [desc(interviews.createdAt)],
    });
  }
}
