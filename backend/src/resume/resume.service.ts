import { Injectable, Logger } from '@nestjs/common';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParseLib = require('pdf-parse');
// pdf-parse exports the function as .default under some module interop settings
const pdfParse: (buf: Buffer) => Promise<{ text: string }> =
  pdfParseLib?.default ?? pdfParseLib;
import { AiService } from '../ai/ai.service';
import { InterviewService } from '../interview/interview.service';

@Injectable()
export class ResumeService {
  private readonly logger = new Logger(ResumeService.name);

  constructor(
    private readonly aiService: AiService,
    private readonly interviewService: InterviewService,
  ) {}

  async processResume(buffer: Buffer, jobRole: string) {
    try {
      const data = await pdfParse(buffer);
      const resumeText = data.text;

      this.logger.log(`Extracted ${resumeText.length} characters from resume.`);

      // Step 1: Generate first question via Gemini
      const firstQuestion = await this.aiService.generateQuestionsFromResume(
        resumeText,
        jobRole,
      );

      // Step 2: Persist interview + first question to DB
      const { interview, question: savedQuestion } =
        await this.interviewService.createInterview(jobRole, firstQuestion);

      this.logger.log(
        `Created interview #${interview.id} with first question #${savedQuestion.id}.`,
      );

      return {
        message: 'Resume processed successfully',
        interviewId: interview.id,
        question: savedQuestion, // single first question for the interview room
      };
    } catch (error) {
      this.logger.error('Failed to process resume', error);
      throw new Error('Failed to process resume file');
    }
  }
}
