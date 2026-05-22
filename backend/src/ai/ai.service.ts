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
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');

    if (!apiKey || apiKey === 'your_gemini_api_key_here') {
      this.logger.error('GEMINI_API_KEY is missing! The AI features will fail.');
    } else {
      this.logger.log(`Using API Key starting with: ${apiKey.substring(0, 7)}...`);
    }

    this.genAI = new GoogleGenerativeAI(apiKey || '');
  }

  /** Maps raw API/SDK errors to concise, user-friendly messages. */
  private getFriendlyErrorMessage(error: any): string {
    const msg: string = error?.message || '';

    if (msg.includes('429') || msg.toLowerCase().includes('quota') || msg.toLowerCase().includes('too many requests')) {
      return 'Rate limit exceeded. You have used up your free AI quota. Please wait a few minutes and try again, or check your Gemini API billing plan.';
    }
    if (msg.includes('403') || msg.toLowerCase().includes('permission') || msg.toLowerCase().includes('forbidden')) {
      return 'Access denied. Your API key does not have permission to use this model. Please check your Gemini API key and plan.';
    }
    if (msg.includes('401') || msg.toLowerCase().includes('unauthorized') || msg.toLowerCase().includes('api key')) {
      return 'Invalid API key. Please verify your Gemini API key is correct and active.';
    }
    if (msg.includes('404') || msg.toLowerCase().includes('not found') || msg.toLowerCase().includes('model')) {
      return 'AI model not found or unavailable. The requested model may not be supported on your plan.';
    }
    if (msg.includes('500') || msg.toLowerCase().includes('internal')) {
      return 'The AI service encountered an internal error. Please try again in a moment.';
    }
    if (msg.toLowerCase().includes('network') || msg.toLowerCase().includes('fetch') || msg.toLowerCase().includes('econnrefused') || msg.toLowerCase().includes('timeout')) {
      return 'Network error. Could not reach the AI service. Please check your internet connection and try again.';
    }
    if (msg.toLowerCase().includes('json') || msg.toLowerCase().includes('parse') || msg.toLowerCase().includes('syntax')) {
      return 'AI returned an unexpected response format. Please try again — if the problem persists, the prompt may need adjustment.';
    }
    if (msg.toLowerCase().includes('safety') || msg.toLowerCase().includes('blocked') || msg.toLowerCase().includes('harm')) {
      return 'The AI blocked this request due to content safety policies. Please revise your input and try again.';
    }
    if (msg.toLowerCase().includes('context') || msg.toLowerCase().includes('token') || msg.toLowerCase().includes('too long')) {
      return 'Your input is too long for the AI to process. Please shorten your resume or description and try again.';
    }
    return 'An unexpected AI error occurred. Please try again. If the issue persists, contact support.';
  }

  /**
   * Tries to parse text as JSON using three strategies:
   * 1. Raw parse  2. Strip markdown fences  3. Regex extract {...}
   */
  private tryParseJson(text: string): any {
    // Strategy 1: direct parse
    try { return JSON.parse(text); } catch {}

    // Strategy 2: strip markdown fences
    const stripped = text
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();
    try { return JSON.parse(stripped); } catch {}

    // Strategy 3: extract first {...} block
    const jsonMatch = stripped.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try { return JSON.parse(jsonMatch[0]); } catch {}
    }

    return null; // all strategies failed
  }

  /**
   * Generate content with model fallback + JSON parse retry.
   * On JSON parse failure for a model, tries the next model instead of crashing.
   */
  private async generateWithFallback(prompt: string, useJson = true): Promise<any> {
    const modelsToTry = [
      'gemini-2.0-flash',
      'gemini-flash-latest',
      'gemini-2.5-flash',
      'gemini-2.5-pro',
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
        const rawText = response.text();

        if (useJson) {
          const parsed = this.tryParseJson(rawText);
          if (parsed !== null) return parsed;

          this.logger.warn(
            `All JSON parse strategies failed for ${modelName}. ` +
            `Raw snippet: ${rawText.slice(0, 200)}`,
          );
          lastError = new Error(`JSON parse failed for model ${modelName}`);
          continue; // try next model
        }

        return rawText;
      } catch (error: any) {
        lastError = error;
        this.logger.warn(`Model ${modelName} failed: ${error.message}`);

        if (error.message?.includes('429')) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        continue;
      }
    }

    this.logger.error('All models failed to generate content', lastError?.stack);
    throw new InternalServerErrorException(this.getFriendlyErrorMessage(lastError));
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

  /**
   * Detects uncertainty in the last answer. If detected, returns a follow-up probe
   * on the same topic. Otherwise returns the regular next adaptive question.
   */
  async generateFollowUpOrNext(
    jobRole: string,
    history: Array<{ question: string; answer: string }>,
    hints?: { suppressedConcepts: string[]; drillConcepts: string[] },
  ): Promise<{ type: 'FOLLOWUP' | 'NEXT'; question: any }> {
    if (!history.length) {
      const question = await this.generateNextQuestion(jobRole, history, hints);
      return { type: 'NEXT', question };
    }

    const lastEntry = history[history.length - 1];
    const lastAnswer = lastEntry.answer.toLowerCase();

    const uncertaintyPhrases = [
      "i'm not sure", "i am not sure", "not sure", "i don't know", "i do not know",
      "not familiar", "never heard", "can't recall", "cannot recall", "don't recall",
      "unsure", "i forget", "i'm confused", "no idea", "not confident",
      "hard to say", "couldn't explain", "not certain", "i'm lost",
    ];

    const hasUncertainty = uncertaintyPhrases.some(phrase => lastAnswer.includes(phrase));

    if (hasUncertainty) {
      const prompt = `
        You are an expert interviewer for the role: "${jobRole}".

        The candidate answered the following question with uncertainty:
        Question: ${lastEntry.question}
        Candidate's answer: "${lastEntry.answer}"

        Generate a SHORT, SUPPORTIVE follow-up probe question that:
        - Helps the candidate think through what they DO know about the concept
        - Breaks the concept into a simpler sub-part they might be able to answer
        - Is NOT a new topic — stays within the same concept area
        CRITICAL RULES:
        - The "category" field MUST be exactly one of: "TECHNICAL" or "BEHAVIORAL".
        - Keep the question under 20 words.
        - Return RAW JSON only. No markdown fences.

        Return a single JSON object:
        {
          "questionText": "string",
          "category": "TECHNICAL" | "BEHAVIORAL",
          "expectedConcepts": ["string"],
          "difficulty": <integer 1-5>
        }
      `;
      const question = await this.generateWithFallback(prompt);
      return { type: 'FOLLOWUP', question };
    }

    const question = await this.generateNextQuestion(jobRole, history, hints);
    return { type: 'NEXT', question };
  }

  /**
   * Generates a personalised 7-day study plan after an interview session.
   */
  async generateStudyPlan(
    jobRole: string,
    questionsWithAnswers: Array<{ question: string; score: number; missingConcepts: string[] }>,
  ): Promise<any> {
    const avgScore = questionsWithAnswers.length
      ? questionsWithAnswers.reduce((s, q) => s + q.score, 0) / questionsWithAnswers.length
      : 0;
    const allMissing = [...new Set(questionsWithAnswers.flatMap(q => q.missingConcepts))];

    const sessionSummary = questionsWithAnswers
      .map((q, i) =>
        `Q${i + 1}: ${q.question}\nScore: ${q.score}/10\nMissing: ${q.missingConcepts.join(', ') || 'none'}`,
      )
      .join('\n---\n');

    const prompt = `
      You are a senior career coach. A candidate just completed an interview for "${jobRole}" with an average score of ${avgScore.toFixed(1)}/10.

      Session breakdown:
      ${sessionSummary}

      Key gaps identified: ${allMissing.join(', ') || 'none'}

      Generate a personalised 7-day study plan. Be specific and actionable.
      Return RAW JSON only. No markdown fences. No trailing text.

      {
        "summary": "2-sentence honest assessment of their performance and main gaps",
        "focusAreas": ["top 3-4 concept areas to focus on, ordered by priority"],
        "dailyPlan": [
          { "day": 1, "task": "specific, actionable study task" },
          { "day": 2, "task": "..." },
          { "day": 3, "task": "..." },
          { "day": 4, "task": "..." },
          { "day": 5, "task": "..." },
          { "day": 6, "task": "..." },
          { "day": 7, "task": "mock interview or practice session" }
        ],
        "resources": ["3-5 specific topics or resources to study"]
      }
    `;
    return this.generateWithFallback(prompt);
  }

  /**
   * Extracts key professional information from raw resume text.
   * Returns structured highlights for display on the Profile page.
   */
  async summarizeResume(resumeText: string): Promise<any> {
    const prompt = `
      Analyse the following resume and extract key professional information.
      Be concise and factual. Return RAW JSON only. No markdown fences.

      {
        "summary": "2-3 sentence professional summary",
        "topSkills": ["up to 8 key technical or professional skills"],
        "experience": "total experience estimate, e.g. '3-5 years in backend development'",
        "highlights": ["up to 5 key career highlights or achievements"]
      }

      Resume:
      ${resumeText.slice(0, 4000)}
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
    snapshots?: string[],
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
      const model = this.genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

      const imageParts = snapshots.map(s => ({
        inlineData: {
          data: s.split(',')[1],
          mimeType: s.split(',')[0].split(':')[1].split(';')[0],
        },
      }));

      const result = await model.generateContent([prompt, ...imageParts]);
      const response = await result.response;
      const rawText = response.text();
      const parsed = this.tryParseJson(rawText);
      if (parsed) return parsed;

      this.logger.warn('Multimodal parse failed, falling back to text-only evaluation');
      return this.generateWithFallback(prompt);
    }

    return this.generateWithFallback(prompt);
  }

  async transcribeAudio(audioBuffer: Buffer, mimeType: string): Promise<string> {
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
        { text: 'Transcribe the following audio exactly as spoken. Return only the text.' },
      ]);

      const response = await result.response;
      return response.text();
    } catch (error: any) {
      this.logger.error(`Transcription failed with ${modelName}: ${error.message}`);
      throw new InternalServerErrorException(this.getFriendlyErrorMessage(error));
    }
  }
}
