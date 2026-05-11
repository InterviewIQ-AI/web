import {
  Controller, Post, Get, Body, Param, ParseIntPipe, BadRequestException,
} from '@nestjs/common';
import { InterviewService } from './interview.service';

@Controller('interview')
export class InterviewController {
  constructor(private readonly interviewService: InterviewService) {}

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
  createInterview(
    @Body('jobRole') jobRole: string,
    @Body('questions') generatedQuestions: any[],
  ) {
    if (!jobRole) throw new BadRequestException('jobRole is required');
    if (!generatedQuestions?.length)
      throw new BadRequestException('questions array is required');
    return this.interviewService.createInterview(jobRole, generatedQuestions);
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
