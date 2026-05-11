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

      // Step 1: Generate questions via Gemini
      const generatedQuestions = await this.aiService.generateQuestionsFromResume(
        resumeText,
        jobRole,
      );

      // Step 2: Persist interview + questions to DB
      const { interview, questions: savedQuestions } =
        await this.interviewService.createInterview(jobRole, generatedQuestions);

      this.logger.log(
        `Created interview #${interview.id} with ${savedQuestions.length} questions.`,
      );

      return {
        message: 'Resume processed successfully',
        interviewId: interview.id,
        questions: savedQuestions, // include DB ids so frontend can submit answers
      };
    } catch (error) {
      this.logger.error('Failed to process resume', error);
      throw new Error('Failed to process resume file');
    }
  }
}
