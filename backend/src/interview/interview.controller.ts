import {
  Controller, Post, Get, Body, Param, ParseIntPipe, BadRequestException,
} from '@nestjs/common';
import { InterviewService } from './interview.service';
import { AiService } from '../ai/ai.service';

@Controller('interview')
export class InterviewController {
  constructor(
    private readonly interviewService: InterviewService,
    private readonly aiService: AiService,
  ) {}

  /**
   * POST /interview/start
   * Body: { jobRole: string }
   * Generates questions with AI (no resume needed) and saves interview + questions to DB.
   */
  @Post('start')
  async startInterview(@Body('jobRole') jobRole: string) {
    if (!jobRole) throw new BadRequestException('jobRole is required');

    const firstQuestion = await this.aiService.generateQuestionsForRole(jobRole);
    const { interview, question } =
      await this.interviewService.createInterview(jobRole, firstQuestion);

    const totalQuestions = Math.floor(Math.random() * 11) + 10; // 10 to 20

    return {
      interviewId: interview.id,
      question,
      totalQuestions,
    };
  }

  /** GET /interview — list all interviews */
  @Get()
  getAllInterviews() {
    return this.interviewService.getAllInterviews();
  }

  /** GET /interview/:id — get a single interview with its questions */
  @Get(':id')
  getInterview(@Param('id', ParseIntPipe) id: number) {
    return this.interviewService.getInterview(id);
  }

  /**
   * POST /interview/create
   * Body: { jobRole: string, questions: QuestionDto[] }
   * Called after resume is processed — saves the interview + questions to DB.
   */
  @Post('create')
  async createInterview(
    @Body('jobRole') jobRole: string,
    @Body('question') firstQuestion: any,
  ) {
    if (!jobRole) throw new BadRequestException('jobRole is required');
    if (!firstQuestion) throw new BadRequestException('question object is required');
    
    const result = await this.interviewService.createInterview(jobRole, firstQuestion);
    
    return {
      ...result,
      totalQuestions: Math.floor(Math.random() * 11) + 10,
    };
  }

  /**
   * POST /interview/:id/next-question
   * Body: { history: [{question, answer}][] }
   * Generates the next adaptive question based on the conversation so far.
   */
  @Post(':id/next-question')
  getNextQuestion(
    @Param('id', ParseIntPipe) id: number,
    @Body('history') history: Array<{ question: string; answer: string }>,
  ) {
    return this.interviewService.addNextQuestion(id, history ?? []);
  }

  /**
   * POST /interview/answer
   * Body: { questionId, userAnswer, isVoice, timeTakenSeconds }
   * Evaluates the answer using Gemini and saves it.
   */
  @Post('answer')
  submitAnswer(
    @Body('questionId') questionId: number,
    @Body('userAnswer') userAnswer: string,
    @Body('isVoice') isVoice: boolean,
    @Body('timeTakenSeconds') timeTakenSeconds: number,
  ) {
    if (!questionId) throw new BadRequestException('questionId is required');
    if (!userAnswer) throw new BadRequestException('userAnswer is required');
    return this.interviewService.submitAnswer(
      questionId,
      userAnswer,
      isVoice ?? false,
      timeTakenSeconds ?? 0,
    );
  }

  /**
   * POST /interview/:id/complete
   * Calculates final score and marks interview as COMPLETED.
   */
  @Post(':id/complete')
  completeInterview(@Param('id', ParseIntPipe) id: number) {
    return this.interviewService.completeInterview(id);
  }
}
