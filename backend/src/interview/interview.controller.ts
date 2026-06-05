import {
  Controller, Post, Get, Body, Param, ParseIntPipe,
  BadRequestException, UseGuards,
} from '@nestjs/common';
import { InterviewService } from './interview.service';
import { AiService } from '../ai/ai.service';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/user.decorator';
import type { AuthUser } from '../auth/user.decorator';
import { UsersService } from '../users/users.service';

@Controller('interview')
@UseGuards(AuthGuard)
export class InterviewController {
  constructor(
    private readonly interviewService: InterviewService,
    private readonly aiService: AiService,
    private readonly usersService: UsersService,
  ) {}

  // ─── Helper: resolve authenticated user to DB user id ────────────────────
  private async resolveUserId(authUser: AuthUser): Promise<string> {
    const dbUser = await this.usersService.upsertUser(
      authUser.firebaseUid,
      authUser.email,
      authUser.name,
    );
    return dbUser.id;
  }

  /**
   * POST /interview/start
   * Body: { jobRole: string, roundType?: 'HR'|'MR'|'TR', difficulty?: 'easy'|'medium'|'hard' }
   */
  @Post('start')
  async startInterview(
    @Body('jobRole') jobRole: string,
    @Body('roundType') roundType: 'HR' | 'MR' | 'TR' = 'TR',
    @Body('difficulty') difficulty: 'easy' | 'medium' | 'hard' = 'medium',
    @CurrentUser() authUser: AuthUser,
  ) {
    if (!jobRole) throw new BadRequestException('jobRole is required');

    const userId = await this.resolveUserId(authUser);
    const firstQuestion = await this.aiService.generateQuestionsForRole(jobRole, roundType, difficulty);
    const { interview, question } = await this.interviewService.createInterview(
      jobRole, firstQuestion, userId, roundType, difficulty,
    );

    const totalQuestions = Math.floor(Math.random() * 11) + 10;
    return { interviewId: interview.id, question, totalQuestions, roundType, difficulty };
  }

  /** GET /interview — list only this user's interviews */
  @Get()
  async getAllInterviews(@CurrentUser() authUser: AuthUser) {
    const userId = await this.resolveUserId(authUser);
    return this.interviewService.getAllInterviews(userId);
  }

  /** GET /interview/:id — only accessible by the interview owner */
  @Get(':id')
  async getInterview(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() authUser: AuthUser,
  ) {
    const userId = await this.resolveUserId(authUser);
    return this.interviewService.getInterview(id, userId);
  }

  /**
   * POST /interview/create
   * Called by resume upload flow with a pre-generated first question.
   */
  @Post('create')
  async createInterview(
    @Body('jobRole') jobRole: string,
    @Body('question') firstQuestion: any,
    @Body('roundType') roundType: 'HR' | 'MR' | 'TR' = 'TR',
    @Body('difficulty') difficulty: 'easy' | 'medium' | 'hard' = 'medium',
    @CurrentUser() authUser: AuthUser,
  ) {
    if (!jobRole) throw new BadRequestException('jobRole is required');
    if (!firstQuestion) throw new BadRequestException('question object is required');

    const userId = await this.resolveUserId(authUser);
    const result = await this.interviewService.createInterview(
      jobRole, firstQuestion, userId, roundType, difficulty,
    );
    return { ...result, totalQuestions: Math.floor(Math.random() * 11) + 10, roundType, difficulty };
  }

  /**
   * POST /interview/:id/next-question
   * Body: { history: [{question, answer}][] }
   */
  @Post(':id/next-question')
  async getNextQuestion(
    @Param('id', ParseIntPipe) id: number,
    @Body('history') history: Array<{ question: string; answer: string }>,
    @CurrentUser() authUser: AuthUser,
  ) {
    const userId = await this.resolveUserId(authUser);
    return this.interviewService.addNextQuestion(id, history ?? [], userId);
  }

  /**
   * POST /interview/answer
   * Body: { questionId, userAnswer, isVoice, timeTakenSeconds, history, snapshots }
   */
  @Post('answer')
  async submitAnswer(
    @Body('questionId') questionId: number,
    @Body('userAnswer') userAnswer: string,
    @Body('isVoice') isVoice: boolean,
    @Body('timeTakenSeconds') timeTakenSeconds: number,
    @Body('history') history: Array<{ question: string; answer: string }>,
    @Body('snapshots') snapshots: string[],
    @CurrentUser() authUser: AuthUser,
  ) {
    if (!questionId) throw new BadRequestException('questionId is required');
    if (!userAnswer) throw new BadRequestException('userAnswer is required');

    const userId = await this.resolveUserId(authUser);
    return this.interviewService.submitAnswer(
      questionId, userAnswer, isVoice ?? false,
      timeTakenSeconds ?? 0, userId, history, snapshots,
    );
  }

  /**
   * POST /interview/evaluate
   * Body: { targetRole: string, questionAsked: string, userAnswer: string }
   *
   * InterviewIQ Core Engine — strict, role-aware, seniority-scaled evaluator.
   * Returns: { score, technicalAccuracy, missingKeywords, actionableFeedback }
   */
  @Post('evaluate')
  async evaluateAnswer(
    @Body('targetRole') targetRole: string,
    @Body('questionAsked') questionAsked: string,
    @Body('userAnswer') userAnswer: string,
  ) {
    if (!targetRole) throw new BadRequestException('targetRole is required');
    if (!questionAsked) throw new BadRequestException('questionAsked is required');
    if (!userAnswer) throw new BadRequestException('userAnswer is required');

    return this.aiService.evaluateAnswerV2(targetRole, questionAsked, userAnswer);
  }

  /**
   * POST /interview/:id/complete
   */
  @Post(':id/complete')
  completeInterview(@Param('id', ParseIntPipe) id: number) {
    return this.interviewService.completeInterview(id);
  }
}
