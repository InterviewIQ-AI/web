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

  async generateQuestionsFromResume(
    resumeText: string,
    jobRole: string,
  ): Promise<any> {
    // Using gemini-1.5-pro for complex reasoning tasks
    const model = this.genAI.getGenerativeModel({
      model: 'gemini-1.5-pro',
      generationConfig: { responseMimeType: 'application/json' },
    });

    const prompt = `
      You are an expert technical interviewer. Based on the following resume text and the target job role "${jobRole}", 
      generate 5 highly relevant interview questions. 
      The questions should be a mix of technical concepts, problem-solving, and project deep-dives based on the resume.
      Return the result as a valid JSON array of objects following this exact schema:
      [{
        "questionText": "string",
        "category": "TECHNICAL | SYSTEM_DESIGN | BEHAVIORAL",
        "expectedConcepts": ["string"],
        "difficulty": number (1-5)
      }]
      
      Resume text:
      ${resumeText}
    `;

    try {
      const result = await model.generateContent(prompt);
      const response = await result.response;
      return JSON.parse(response.text());
    } catch (error: unknown) {
      // Normalizing 'unknown' error to 'Error' for safe property access
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error('Failed to generate questions', err.stack);
      throw new InternalServerErrorException('AI Question generation failed');
    }
  }

  async evaluateAnswer(
    question: string,
    expectedConcepts: string[],
    answer: string,
  ): Promise<any> {
    const model = this.genAI.getGenerativeModel({
      model: 'gemini-1.5-pro',
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
    // Using gemini-1.5-flash for faster transcription
    const model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

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
