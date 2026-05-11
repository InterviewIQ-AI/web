import { Injectable, Logger } from '@nestjs/common';
const pdfParse = require('pdf-parse');
import { AiService } from '../ai/ai.service';

@Injectable()
export class ResumeService {
  private readonly logger = new Logger(ResumeService.name);

  constructor(private readonly aiService: AiService) {}

  async processResume(buffer: Buffer, jobRole: string) {
    try {
      const data = await pdfParse(buffer);
      const resumeText = data.text;
      
      this.logger.log(`Extracted ${resumeText.length} characters from resume.`);

      const generatedQuestions = await this.aiService.generateQuestionsFromResume(resumeText, jobRole);
      
      return {
        message: 'Resume processed successfully',
        questions: generatedQuestions,
      };
    } catch (error) {
      this.logger.error('Failed to process resume', error);
      throw new Error('Failed to process resume file');
    }
  }
}
