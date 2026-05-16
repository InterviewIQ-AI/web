import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
// pdf-parse v1 exports a single async function — require() is needed because
// the package has no proper ESM export map.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse: (buf: Buffer) => Promise<{ text: string }> = require('pdf-parse');
import { AiService } from '../ai/ai.service';
import { InterviewService } from '../interview/interview.service';

@Injectable()
export class ResumeService {
  private readonly logger = new Logger(ResumeService.name);

  constructor(
    private readonly aiService: AiService,
    private readonly interviewService: InterviewService,
  ) {}

  async processResume(buffer: Buffer, jobRole: string, jobDescription?: string) {
    // ── Step 1: Extract text from PDF ────────────────────────────────────────
    let resumeText: string;
    try {
      const data = await pdfParse(buffer);
      resumeText = data.text?.trim() ?? '';
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`PDF parsing failed: ${msg}`);
      throw new InternalServerErrorException(
        'Could not read the uploaded PDF. The file may be corrupted or encrypted.',
      );
    }

    if (!resumeText || resumeText.length < 50) {
      // Catches scanned/image-only PDFs that produce no extractable text
      this.logger.warn('Extracted resume text is too short — possible scanned PDF');
      throw new InternalServerErrorException(
        'Could not extract text from the PDF. ' +
          'Make sure it is a text-based PDF (not a scanned image).',
      );
    }

    this.logger.log(`Extracted ${resumeText.length} characters from resume.`);

    // ── Step 2: Generate first question via Gemini ────────────────────────────
    const firstQuestion = await this.aiService.generateQuestionsFromResume(
      resumeText,
      jobRole,
      jobDescription,
    );

    // ── Step 3: Persist interview + first question to DB ──────────────────────
    const { interview, question: savedQuestion } =
      await this.interviewService.createInterview(jobRole, firstQuestion);

    this.logger.log(
      `Created interview #${interview.id} with first question #${savedQuestion.id}.`,
    );

    return {
      message: 'Resume processed successfully',
      interviewId: interview.id,
      question: savedQuestion, // single first question for the interview room
      totalQuestions: Math.floor(Math.random() * 11) + 10,
    };
  }
}
