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
    // Using the advanced models available to this key (Gemini 2.5 and Gemini 3)
    const modelsToTry = [
      'gemini-2.0-flash', 
      'gemini-flash-latest', 
      'gemini-2.5-flash', 
      'gemini-2.5-pro'
    ];
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

        // If it's a quota error, wait a tiny bit before trying the next model
        if (error.message?.includes('429')) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
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
      1. Introduction & Background (BEHAVIORAL)
      2. Career Objectives & Education (BEHAVIORAL)
      3. Projects & Past Experience (BEHAVIORAL or TECHNICAL)
      4. Deep Technical Knowledge — core focus (TECHNICAL)
      5. Situational & Managerial Scenarios (BEHAVIORAL)
      6. Achievements & Wrap-up (BEHAVIORAL)

      Generate the very FIRST interview question. It MUST be an introduction question
      (e.g., "Please introduce yourself and walk me through your background.").
      CRITICAL RULES:
      - Keep the question STRICTLY under 15 words.
      - The "category" field MUST be exactly one of the two string literals: "TECHNICAL" or "BEHAVIORAL".
      - Do NOT use "HR", "MR", "SYSTEM_DESIGN", or any other value — this will cause a fatal DB constraint violation.
      - Return RAW JSON only. Do NOT wrap in markdown code blocks.

      Return a single JSON object (not an array) with this exact schema:
      {
        "questionText": "string",
        "category": "BEHAVIORAL",
        "expectedConcepts": ["string"],
        "difficulty": number (1-5)
      }
    `;
    return this.generateWithFallback(prompt);
  }

  async generateNextQuestion(
    jobRole: string,
    history: Array<{ question: string; answer: string }>,
    hints?: { suppressedConcepts: string[]; drillConcepts: string[] },
  ): Promise<any> {
    const historyText = history
      .map((h, i) => `Q${i + 1}: ${h.question}\nA${i + 1}: ${h.answer}`)
      .join('\n\n');

    const suppressionBlock = hints?.suppressedConcepts?.length
      ? `SUPPRESSED CONCEPTS (candidate has mastered these — do NOT ask about them again for now): ${hints.suppressedConcepts.join(', ')}`
      : '';

    const drillBlock = hints?.drillConcepts?.length
      ? `DRILL CONCEPTS (candidate struggled with these — prioritise questions that revisit them): ${hints.drillConcepts.join(', ')}`
      : '';

    const prompt = `
      You are an expert interviewer conducting an interview for the role: "${jobRole}".

      A realistic interview flows through these progressive phases:
      1. Introduction & Background (BEHAVIORAL)
      2. Career Objectives & Education (BEHAVIORAL)
      3. Projects & Past Experience (BEHAVIORAL or TECHNICAL)
      4. Deep Technical Knowledge — core focus (TECHNICAL)
      5. Situational & Managerial Scenarios (BEHAVIORAL)
      6. Achievements & Wrap-up (BEHAVIORAL)

      Previous conversation history:
      ${historyText}

      ${suppressionBlock}
      ${drillBlock}

      Based on the history, determine the current phase and generate the NEXT most relevant question.
      CRITICAL RULES:
      - Progress naturally through phases. Do not jump to technical before background is established.
      - Spend the majority of the interview on phases 4 and 5.
      - Build on the candidate's previous answers for a conversational flow.
      - Respect the SUPPRESSED and DRILL concept lists above when choosing the question topic.
      - The "category" field MUST be EXACTLY one of these two string literals: "TECHNICAL" or "BEHAVIORAL".
      - Do NOT use "HR", "MR", "SYSTEM_DESIGN", or any variant — this will cause a fatal DB constraint violation.
      - PROGRESSIVE LENGTH: If history length <= 3, keep the question STRICTLY under 15 words. Otherwise, use detailed situational syntax.
      - Return RAW JSON only. Do NOT wrap in markdown code blocks.

      Return a single JSON object (not an array):
      {
        "questionText": "string",
        "category": "TECHNICAL" | "BEHAVIORAL",
        "expectedConcepts": ["string"],
        "difficulty": <integer from 1 to 5>
      }
    `;
    return this.generateWithFallback(prompt);
  }

  async generateQuestionsFromResume(
    resumeText: string,
    jobRole: string,
    jobDescription?: string,
  ): Promise<any> {
    const jdSection = jobDescription 
      ? `Target Job Description:\n${jobDescription}\n`
      : '';

    const prompt = `
      You are an expert technical interviewer. Based on the following resume and the target role "${jobRole}",
      ${jdSection}
      generate the very FIRST interview question.
      It must be an introduction question that asks the candidate to introduce themselves
      while highlighting a key aspect of their resume relevant to the role (and job description if provided).
      CRITICAL RULES:
      - Keep the question STRICTLY under 15 words.
      - The "category" field MUST be exactly one of the two string literals: "TECHNICAL" or "BEHAVIORAL".
      - Do NOT use "HR", "MR", "SYSTEM_DESIGN", or any other value — this will cause a fatal DB constraint violation.
      - Return RAW JSON only. Do NOT wrap in markdown code blocks.

      Return a single JSON object (not an array):
      {
        "questionText": "string",
        "category": "BEHAVIORAL",
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
    snapshots?: string[], // Base64 data URLs
  ): Promise<any> {
    const prompt = `
      You are an expert interviewer evaluating a candidate's answer.

      [CONTENT EVALUATION]
      Question: ${question}
      Candidate's Answer: ${answer}
      Expected Concepts: ${expectedConcepts.join(', ')}

      [BEHAVIORAL EVALUATION]
      Attached are webcam snapshots of the candidate taken during this answer.
      Evaluate their Eye Contact, Posture, and Confidence/Expressions based on the images.

      [CRITICAL OUTPUT RULES]
      - Return RAW JSON only. Do NOT wrap in markdown code blocks (no triple backticks).
      - The response MUST start with '{' and end with '}' — no leading or trailing text.
      - "feedback" MUST be bounded to a MAXIMUM of 2 sentences.
      - "eyeContact" MUST start with exactly one of: "Excellent", "Good", or "Poor" — followed by " - " and one justification sentence.
      - "idealAnswer" MUST be a concise model answer of 2–4 sentences covering the key expected concepts.

      Return this exact JSON schema:
      {
        "score": <integer from 0 to 10>,
        "feedback": "Max 2 sentences evaluating content clarity.",
        "idealAnswer": "2-4 sentence model answer covering all key expected concepts.",
        "missingConcepts": ["string"],
        "behavioralFeedback": {
          "eyeContact": "Excellent | Good | Poor - one sentence justification.",
          "posture": "Concise physical orientation description.",
          "confidence": "Expression assessment string.",
          "overall": "One summary sentence."
        }
      }
    `;

    if (snapshots && snapshots.length > 0) {
      // Multimodal request
      // Multimodal request using a more stable model with higher quota
      const model = this.genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

      const imageParts = snapshots.map(s => {
        const base64Data = s.split(',')[1];
        const mimeType = s.split(',')[0].split(':')[1].split(';')[0];
        return {
          inlineData: {
            data: base64Data,
            mimeType: mimeType
          }
        };
      });

      const result = await model.generateContent([prompt, ...imageParts]);
      const response = await result.response;
      let text = response.text().replace(/```json/g, '').replace(/```/g, '').trim();
      try {
        return JSON.parse(text);
      } catch (e) {
        this.logger.error('Failed to parse multimodal AI response', e);
        // Fallback to basic text evaluation if multimodal fails
        return this.generateWithFallback(prompt);
      }
    }

    return this.generateWithFallback(prompt);
  }

  async transcribeAudio(
    audioBuffer: Buffer,
    mimeType: string,
  ): Promise<string> {
    const modelName = 'gemini-2.5-flash'; // Using 2.5-flash for state-of-the-art transcription
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

