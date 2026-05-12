import {
  Injectable,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';

@Injectable()
export class AiService {
  private genAI: GoogleGenerativeAI;
  private readonly logger = new Logger(AiService.name);

  constructor(private configService: ConfigService) {
    // Providing the <string> generic ensures the API key is not treated as 'any'
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');

    if (!apiKey || apiKey === 'your_gemini_api_key_here') {
      this.logger.error(
        'GEMINI_API_KEY is missing! The AI features will fail.',
      );
    }

    // Initializing the GoogleGenerativeAI client
    this.genAI = new GoogleGenerativeAI(apiKey || '');
  }

  async generateQuestionsForRole(jobRole: string): Promise<any> {
    const model = this.genAI.getGenerativeModel({
      model: 'gemini-flash-latest',
      generationConfig: { responseMimeType: 'application/json' },
    });

    const prompt = `
      You are an expert technical interviewer. Generate the FIRST interview question
      for a candidate applying for the role: "${jobRole}".
      Make it a strong opening question covering a core technical or behavioral topic.
      Return a single JSON object (not an array) with this exact schema:
      {
        "questionText": "string",
        "category": "TECHNICAL | SYSTEM_DESIGN | BEHAVIORAL",
        "expectedConcepts": ["string"],
        "difficulty": number (1-5)
      }
    `;

    try {
      const result = await model.generateContent(prompt);
      const response = await result.response;
      return JSON.parse(response.text());
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error('Failed to generate first question for role', err.stack);
      throw new InternalServerErrorException('AI Question generation failed');
    }
  }

  async generateNextQuestion(
    jobRole: string,
    history: Array<{ question: string; answer: string }>,
  ): Promise<any> {
    const model = this.genAI.getGenerativeModel({
      model: 'gemini-flash-latest',
      generationConfig: { responseMimeType: 'application/json' },
    });

    const historyText = history
      .map((h, i) => `Q${i + 1}: ${h.question}\nA${i + 1}: ${h.answer}`)
      .join('\n\n');

    const prompt = `
      You are an expert technical interviewer conducting an interview for the role: "${jobRole}".

      Previous questions and answers:
      ${historyText}

      Based on the candidate's responses, generate the NEXT most relevant interview question.
      - Build on gaps or interesting points from previous answers
      - Cover a different aspect than already asked
      - Vary between TECHNICAL, SYSTEM_DESIGN, and BEHAVIORAL categories

      Return a single JSON object (not an array):
      {
        "questionText": "string",
        "category": "TECHNICAL | SYSTEM_DESIGN | BEHAVIORAL",
        "expectedConcepts": ["string"],
        "difficulty": number (1-5)
      }
    `;

    try {
      const result = await model.generateContent(prompt);
      const response = await result.response;
      return JSON.parse(response.text());
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error('Failed to generate next question', err.stack);
      throw new InternalServerErrorException('AI next question generation failed');
    }
  }

  async generateQuestionsFromResume(
    resumeText: string,
    jobRole: string,
  ): Promise<any> {
    // Using gemini-2.5-flash for complex reasoning tasks
    const model = this.genAI.getGenerativeModel({
      model: 'gemini-flash-latest',
      generationConfig: { responseMimeType: 'application/json' },
    });

    const prompt = `
      You are an expert technical interviewer. Based on the following resume and the target role "${jobRole}",
      generate the FIRST interview question. Make it a strong opener that dives into a key skill from the resume.
      Return a single JSON object (not an array):
      {
        "questionText": "string",
        "category": "TECHNICAL | SYSTEM_DESIGN | BEHAVIORAL",
        "expectedConcepts": ["string"],
        "difficulty": number (1-5)
      }

      Resume text:
      ${resumeText}
    `;

    try {
      const result = await model.generateContent(prompt);
      const response = await result.response;
      return JSON.parse(response.text());
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error('Failed to generate first question from resume', err.stack);
      throw new InternalServerErrorException('AI Question generation failed');
    }
  }

  async evaluateAnswer(
    question: string,
    expectedConcepts: string[],
    answer: string,
  ): Promise<any> {
    const model = this.genAI.getGenerativeModel({
      model: 'gemini-flash-latest',
      generationConfig: { responseMimeType: 'application/json' },
    });

    const prompt = `
      You are an expert interviewer evaluating a candidate's answer.
      Question: ${question}
      Expected Concepts: ${expectedConcepts.join(', ')}
      Candidate's Answer: ${answer}

      Evaluate based on correctness, depth, and logic.
      Return JSON schema:
      {
        "score": number (0-10),
        "feedback": "string",
        "missingConcepts": ["string"],
        "idealAnswerComparison": "string"
      }
    `;

    try {
      const result = await model.generateContent(prompt);
      const response = await result.response;
      return JSON.parse(response.text());
    } catch (error: unknown) {
      // Type guarding unknown error to satisfy ESLint
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error('Failed to evaluate answer', err.stack);
      throw new InternalServerErrorException('AI evaluation failed');
    }
  }

  async transcribeAudio(
    audioBuffer: Buffer,
    mimeType: string,
  ): Promise<string> {
    // Using gemini-2.5-flash-lite for faster, cost-effective transcription
    const model = this.genAI.getGenerativeModel({
      model: 'gemini-flash-latest',
    });

    try {
      const result = await model.generateContent([
        {
          inlineData: {
            data: audioBuffer.toString('base64'),
            mimeType: mimeType,
          },
        },
        {
          text: 'Transcribe the following audio exactly as spoken. Return only the text.',
        },
      ]);

      const response = await result.response;
      return response.text();
    } catch (error: unknown) {
      // Safe access to .stack property
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error('Failed to transcribe audio', err.stack);
      throw new InternalServerErrorException('Audio transcription failed');
    }
  }
}
