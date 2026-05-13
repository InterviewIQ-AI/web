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
    } else {
      this.logger.log(`Using API Key starting with: ${apiKey.substring(0, 7)}...`);
    }

    // Initializing the GoogleGenerativeAI client
    this.genAI = new GoogleGenerativeAI(apiKey || '');
  }

  /**
   * Helper to generate content with fallback logic.
   * Tries Flash first, then Pro if Flash fails (e.g. 404/Quota).
   */
  private async generateWithFallback(prompt: string, useJson = true): Promise<any> {
    const modelsToTry = ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-pro'];
    let lastError: any = null;

    for (const modelName of modelsToTry) {
      try {
        const model = this.genAI.getGenerativeModel({
          model: modelName,
          generationConfig: useJson ? { responseMimeType: 'application/json' } : {},
        });

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        
        if (useJson) {
          try {
            return JSON.parse(text);
          } catch (e) {
            this.logger.warn(`Failed to parse JSON from ${modelName}, text: ${text}`);
            throw e;
          }
        }
        return text;
      } catch (error: any) {
        lastError = error;
        this.logger.warn(`Model ${modelName} failed: ${error.message}`);
        continue;
      }
    }

    this.logger.error('All models failed to generate content', lastError?.stack);
    throw new InternalServerErrorException(
      `AI generation failed: ${lastError?.message || 'Unknown error'}`,
    );
  }

  async generateQuestionsForRole(jobRole: string): Promise<any> {
    const prompt = `
      You are an expert technical interviewer conducting an interview for the role: "${jobRole}".
      
      A realistic interview flows through these progressive phases:
      1. Introduction & Background
      2. Career Objective & Education
      3. Projects & Past Experience
      4. Deep Technical Knowledge (Core focus)
      5. HR / Managerial Scenarios (MR)
      6. Achievements & Wrap-up

      Generate the very FIRST interview question. It must be an "Introduction" question (e.g., "Please introduce yourself and walk me through your background").
      Return a single JSON object (not an array) with this exact schema:
      {
        "questionText": "string",
        "category": "HR",
        "expectedConcepts": ["string"],
        "difficulty": number (1-5)
      }
    `;
    return this.generateWithFallback(prompt);
  }

  async generateNextQuestion(
    jobRole: string,
    history: Array<{ question: string; answer: string }>,
  ): Promise<any> {
    const historyText = history
      .map((h, i) => `Q${i + 1}: ${h.question}\nA${i + 1}: ${h.answer}`)
      .join('\n\n');

    const prompt = `
      You are an expert interviewer conducting an interview for the role: "${jobRole}".
      
      A realistic interview flows through these progressive phases:
      1. Introduction & Background
      2. Career Objective & Education
      3. Projects & Past Experience
      4. Deep Technical Knowledge (Core focus)
      5. HR / Managerial Scenarios (MR)
      6. Achievements & Wrap-up

      Previous conversation history:
      ${historyText}

      Based on the history, determine the current phase of the interview and generate the NEXT most relevant question.
      Rules:
      - Progress naturally through the phases. Do not jump straight to technical if they haven't discussed their background.
      - Ask MULTIPLE questions per phase if needed, but spend the VAST MAJORITY of the interview on Technical, HR, and MR scenarios.
      - Ensure the interview feels like a real, conversational flow. Build on their previous answers.
      - The category MUST be exactly one of: TECHNICAL | HR | MR

      Return a single JSON object (not an array):
      {
        "questionText": "string",
        "category": "TECHNICAL | HR | MR",
        "expectedConcepts": ["string"],
        "difficulty": number (1-5)
      }
    `;
    return this.generateWithFallback(prompt);
  }

  async generateQuestionsFromResume(
    resumeText: string,
    jobRole: string,
  ): Promise<any> {
    const prompt = `
      You are an expert technical interviewer. Based on the following resume and the target role "${jobRole}",
      generate the very FIRST interview question. 
      It must be an "Introduction" question that asks them to introduce themselves while highlighting a key aspect of their resume.
      Return a single JSON object (not an array):
      {
        "questionText": "string",
        "category": "HR",
        "expectedConcepts": ["string"],
        "difficulty": number (1-5)
      }

      Resume text:
      ${resumeText}
    `;
    return this.generateWithFallback(prompt);
  }

  async evaluateAnswer(
    question: string,
    expectedConcepts: string[],
    answer: string,
  ): Promise<any> {
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
    return this.generateWithFallback(prompt);
  }

  async transcribeAudio(
    audioBuffer: Buffer,
    mimeType: string,
  ): Promise<string> {
    const modelName = 'gemini-2.5-flash';
    try {
      const model = this.genAI.getGenerativeModel({ model: modelName });
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
    } catch (error: any) {
      this.logger.error(`Transcription failed with ${modelName}: ${error.message}`);
      throw new InternalServerErrorException('Audio transcription failed');
    }
  }
}

