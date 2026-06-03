import {
  Injectable,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';

type RoundType = 'HR' | 'MR' | 'TR';
type Difficulty = 'easy' | 'medium' | 'hard';

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

  // ─── Round & Difficulty Helpers ────────────────────────────────────────────

  private getRoundProfile(roundType: RoundType): {
    label: string;
    focusAreas: string;
    categoryBias: string;
    avoidList: string;
  } {
    switch (roundType) {
      case 'HR':
        return {
          label: 'HR (Human Resources) Round',
          focusAreas: `
            - Personal background, motivations, and career story
            - Cultural fit, values alignment, and teamwork mindset
            - Situational / behavioural scenarios (conflict, failure, achievement)
            - Communication style, adaptability, and interpersonal skills
            - Why this company, why this role, career goals and aspirations
            - Work-life balance, salary expectations, notice period (contextually)`,
          categoryBias: 'ALL questions must have category: "BEHAVIORAL"',
          avoidList: 'Do NOT ask about technical concepts, algorithms, system design, or any domain-specific knowledge.',
        };
      case 'MR':
        return {
          label: 'Managerial / Leadership Round',
          focusAreas: `
            - Leadership experience, team management, and mentoring
            - Stakeholder communication and cross-team collaboration
            - Project ownership, planning, and delivery under constraints
            - Conflict resolution, decision-making under ambiguity
            - Driving results through others, performance management
            - Strategic thinking, prioritisation, and trade-off analysis
            - Technical credibility — ability to guide technical teams without being hands-on`,
          categoryBias: 'Mostly BEHAVIORAL (70%). TECHNICAL questions (30%) must focus on architecture trade-offs, technical strategy, and decision rationale — NOT implementation.',
          avoidList: 'Do NOT ask about specific algorithms, data structures, or implementation-level code. Focus on how to lead and decide, not how to implement.',
        };
      case 'TR':
      default:
        return {
          label: 'Technical Round',
          focusAreas: `
            - Core technical concepts relevant to the role (e.g. data structures, algorithms, OOP, system design)
            - Problem-solving approach: ask the candidate to EXPLAIN or DESCRIBE solutions verbally
            - Architecture, design patterns, scalability considerations
            - Domain-specific knowledge (databases, APIs, frameworks, cloud, etc.)
            - Debugging mindset: describe how you would identify and solve a problem
            - Trade-offs between different technical approaches
            - Past technical projects and key engineering decisions made`,
          categoryBias: 'Mostly TECHNICAL (75%). BEHAVIORAL (25%) for project-based or experience questions.',
          avoidList: `CRITICAL — This is a VOICE interview. You MUST NEVER ask the candidate to:
            - Write code, write a function, or implement anything
            - Draw a diagram or produce any visual output
            - Fill in syntax or complete a code snippet
            Instead, ask them to EXPLAIN, DESCRIBE, WALK THROUGH, or DISCUSS concepts verbally.
            Examples of CORRECT TR questions:
              ✓ "Explain how a hash map works and when you would use one."
              ✓ "Walk me through how you would design a URL shortener at scale."
              ✓ "Describe the difference between SQL and NoSQL databases."
              ✓ "How would you approach debugging a memory leak in a production service?"
            Examples of WRONG TR questions (never generate these):
              ✗ "Write a function to reverse a linked list."
              ✗ "Code a binary search algorithm."
              ✗ "Implement a queue using two stacks."`,
        };
    }
  }

  private getDifficultyProfile(difficulty: Difficulty): {
    label: string;
    guideline: string;
    difficultyRange: string;
  } {
    switch (difficulty) {
      case 'easy':
        return {
          label: 'Junior / Entry-Level',
          guideline: 'Target a candidate with 0–2 years of experience. Questions should cover foundational concepts, basic terminology, and simple real-world scenarios. Avoid advanced or niche topics.',
          difficultyRange: '1 or 2',
        };
      case 'hard':
        return {
          label: 'Senior / Expert Level',
          guideline: 'Target a candidate with 6+ years of experience. Questions should probe deep expertise, advanced trade-offs, edge cases, and complex system-level thinking. Expect nuanced, multi-faceted answers.',
          difficultyRange: '4 or 5',
        };
      case 'medium':
      default:
        return {
          label: 'Mid-Level',
          guideline: 'Target a candidate with 2–5 years of experience. Questions should balance conceptual understanding with practical application. Expect solid answers with some depth.',
          difficultyRange: '3',
        };
    }
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
      'gemini-2.5-flash',
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

  // ─── Question Generation ───────────────────────────────────────────────────

  async generateQuestionsForRole(
    jobRole: string,
    roundType: RoundType = 'TR',
    difficulty: Difficulty = 'medium',
  ): Promise<any> {
    const round = this.getRoundProfile(roundType);
    const diff = this.getDifficultyProfile(difficulty);

    const prompt = `
      You are a highly experienced interviewer conducting the OPENING question of a structured interview.

      ═══ INTERVIEW CONTEXT ═══
      Role Applied For : "${jobRole}"
      Round Type       : ${round.label}
      Difficulty Level : ${diff.label}

      ═══ ROUND FOCUS AREAS ═══
      ${round.focusAreas}

      ═══ DIFFICULTY GUIDELINE ═══
      ${diff.guideline}
      The "difficulty" field in your output MUST be ${diff.difficultyRange}.

      ═══ CATEGORY RULE ═══
      ${round.categoryBias}
      The "category" field MUST be EXACTLY one of: "TECHNICAL" or "BEHAVIORAL".
      Do NOT use "HR", "MR", "TR", "SYSTEM_DESIGN", or any other value — this will cause a fatal DB constraint violation.

      ═══ RESTRICTIONS ═══
      ${round.avoidList}

      ═══ OPENING QUESTION RULES ═══
      The FIRST question of ANY interview MUST be an introduction/ice-breaker question.
      It should warmly invite the candidate to introduce themselves and set the stage.
      Examples:
        - "Please introduce yourself and walk me through your background."
        - "Tell me about yourself and what brought you to apply for this role."
      Keep it under 20 words. Friendly and open-ended.

      ═══ OUTPUT FORMAT ═══
      Return ONLY a raw JSON object. No markdown, no code fences, no explanation.
      {
        "questionText": "string — the opening interview question",
        "category": "BEHAVIORAL",
        "expectedConcepts": ["string — what a strong answer should cover"],
        "difficulty": <integer matching the difficulty range above>
      }
    `;
    return this.generateWithFallback(prompt);
  }

  async generateNextQuestion(
    jobRole: string,
    history: Array<{ question: string; answer: string }>,
    hints?: { suppressedConcepts: string[]; drillConcepts: string[] },
    roundType: RoundType = 'TR',
    difficulty: Difficulty = 'medium',
  ): Promise<any> {
    const round = this.getRoundProfile(roundType);
    const diff = this.getDifficultyProfile(difficulty);

    const historyText = history
      .map((h, i) => `Q${i + 1}: ${h.question}\nA${i + 1}: ${h.answer}`)
      .join('\n\n');

    const suppressionBlock = hints?.suppressedConcepts?.length
      ? `SUPPRESSED TOPICS (candidate has demonstrated strong knowledge here — avoid repeating these): ${hints.suppressedConcepts.join(', ')}`
      : '';

    const drillBlock = hints?.drillConcepts?.length
      ? `DRILL TOPICS (candidate struggled with these — generate a question that revisits one of them from a slightly different angle): ${hints.drillConcepts.join(', ')}`
      : '';

    const phaseGuidance = this.getPhaseGuidance(roundType, history.length);

    const prompt = `
      You are a highly experienced interviewer conducting a structured, progressive interview.

      ═══ INTERVIEW CONTEXT ═══
      Role Applied For : "${jobRole}"
      Round Type       : ${round.label}
      Difficulty Level : ${diff.label}
      Questions Asked  : ${history.length}

      ═══ ROUND FOCUS AREAS ═══
      ${round.focusAreas}

      ═══ DIFFICULTY GUIDELINE ═══
      ${diff.guideline}
      The "difficulty" field in your output MUST be ${diff.difficultyRange}.

      ═══ CATEGORY RULE ═══
      ${round.categoryBias}
      The "category" field MUST be EXACTLY one of: "TECHNICAL" or "BEHAVIORAL".
      Do NOT use "HR", "MR", "TR", or any other value.

      ═══ RESTRICTIONS ═══
      ${round.avoidList}

      ═══ INTERVIEW PHASE GUIDANCE ═══
      ${phaseGuidance}

      ═══ CONVERSATION HISTORY ═══
      ${historyText || 'No history yet — this is the first question.'}

      ${suppressionBlock}
      ${drillBlock}

      ═══ QUESTION GENERATION RULES ═══
      1. Study the conversation history carefully. Do NOT repeat a topic already covered well.
      2. Build on the candidate's previous answers — reference what they said to make the flow conversational.
      3. Progress naturally through interview phases. Do not jump to advanced topics before basics are established.
      4. If the candidate gave a weak or vague answer, probe deeper on that topic before moving on.
      5. If history length > 5, questions can be longer and more nuanced/situational.
      6. Each question should feel like it comes from a real human interviewer — natural, purposeful, and contextual.
      7. Respect suppressed and drill lists above.

      ═══ OUTPUT FORMAT ═══
      Return ONLY a raw JSON object. No markdown, no code fences, no explanation.
      {
        "questionText": "string — the next interview question",
        "category": "TECHNICAL" | "BEHAVIORAL",
        "expectedConcepts": ["string — key points a strong answer should cover"],
        "difficulty": <integer matching the difficulty range above>
      }
    `;
    return this.generateWithFallback(prompt);
  }

  private getPhaseGuidance(roundType: RoundType, historyLength: number): string {
    if (roundType === 'HR') {
      if (historyLength <= 1) return 'Phase: Introduction. Ask about background and motivation.';
      if (historyLength <= 3) return 'Phase: Career Story. Explore past roles, achievements, transitions.';
      if (historyLength <= 6) return 'Phase: Behavioural Scenarios. Use STAR-based situational questions (conflict, failure, success).';
      return 'Phase: Cultural Fit & Closing. Explore values, team preferences, and future goals.';
    }
    if (roundType === 'MR') {
      if (historyLength <= 1) return 'Phase: Introduction. Ask about their leadership background and team context.';
      if (historyLength <= 3) return 'Phase: Leadership Experience. Explore team management, mentoring, and cross-team work.';
      if (historyLength <= 6) return 'Phase: Situational Leadership. Complex scenarios involving conflict, ambiguity, and strategic decisions.';
      return 'Phase: Strategic & Closing. Explore vision, long-term thinking, and lessons learned as a leader.';
    }
    // TR
    if (historyLength <= 1) return 'Phase: Introduction. Ask about their technical background, key projects, and primary tech stack.';
    if (historyLength <= 3) return 'Phase: Core Concepts. Probe foundational knowledge relevant to the role. Ask them to explain core concepts verbally.';
    if (historyLength <= 6) return 'Phase: Deep Technical. Advanced conceptual questions — architecture decisions, trade-offs, design thinking. No coding.';
    return 'Phase: Applied Experience. Project-based questions — real challenges they solved and how they approached them.';
  }

  /**
   * Detects uncertainty in the last answer. If detected, returns a follow-up probe
   * on the same topic. Otherwise returns the regular next adaptive question.
   */
  async generateFollowUpOrNext(
    jobRole: string,
    history: Array<{ question: string; answer: string }>,
    hints?: { suppressedConcepts: string[]; drillConcepts: string[] },
    roundType: RoundType = 'TR',
    difficulty: Difficulty = 'medium',
  ): Promise<{ type: 'FOLLOWUP' | 'NEXT'; question: any }> {
    if (!history.length) {
      const question = await this.generateNextQuestion(jobRole, history, hints, roundType, difficulty);
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
      const round = this.getRoundProfile(roundType);
      const diff = this.getDifficultyProfile(difficulty);

      const prompt = `
        You are an expert interviewer for the role: "${jobRole}".

        ═══ INTERVIEW CONTEXT ═══
        Round Type       : ${round.label}
        Difficulty Level : ${diff.label}

        ═══ SITUATION ═══
        The candidate showed uncertainty on the following question:
        Question : ${lastEntry.question}
        Answer   : "${lastEntry.answer}"

        ═══ YOUR TASK ═══
        Generate a SHORT, SUPPORTIVE follow-up probe that:
        - Gently helps the candidate think through what they DO know
        - Breaks the concept into a simpler sub-question they might be able to answer
        - Stays within the SAME topic/concept — do NOT introduce a new topic
        - Is encouraging in tone — e.g. "Let's approach it differently..." or "How about this angle..."

        ═══ RESTRICTIONS ═══
        ${round.avoidList}
        Keep the question under 25 words.

        ═══ CATEGORY RULE ═══
        ${round.categoryBias}
        The "category" field MUST be EXACTLY "TECHNICAL" or "BEHAVIORAL".

        ═══ OUTPUT FORMAT ═══
        Return ONLY raw JSON. No markdown, no fences.
        {
          "questionText": "string",
          "category": "TECHNICAL" | "BEHAVIORAL",
          "expectedConcepts": ["string"],
          "difficulty": <integer ${diff.difficultyRange}>
        }
      `;
      const question = await this.generateWithFallback(prompt);
      return { type: 'FOLLOWUP', question };
    }

    const question = await this.generateNextQuestion(jobRole, history, hints, roundType, difficulty);
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
    roundType: RoundType = 'TR',
    difficulty: Difficulty = 'medium',
    jobDescription?: string,
  ): Promise<any> {
    const round = this.getRoundProfile(roundType);
    const diff = this.getDifficultyProfile(difficulty);
    const jdSection = jobDescription
      ? `Target Job Description:\n${jobDescription}\n`
      : '';

    const prompt = `
      You are a highly experienced interviewer. You have been given a candidate's resume and are preparing the OPENING question of a structured interview.

      ═══ INTERVIEW CONTEXT ═══
      Role Applied For : "${jobRole}"
      Round Type       : ${round.label}
      Difficulty Level : ${diff.label}
      ${jdSection}

      ═══ CANDIDATE RESUME ═══
      ${resumeText.slice(0, 3500)}

      ═══ YOUR TASK ═══
      Generate the VERY FIRST question — an introduction/ice-breaker that:
      - Asks the candidate to introduce themselves
      - References a specific aspect of their resume that is relevant to the role
      - Sets a warm, professional tone for the interview
      - Is under 25 words

      ═══ ROUND FOCUS ═══
      ${round.focusAreas}

      ═══ RESTRICTIONS ═══
      ${round.avoidList}

      ═══ CATEGORY RULE ═══
      ${round.categoryBias}
      The "category" field MUST be EXACTLY "TECHNICAL" or "BEHAVIORAL".
      Do NOT use "HR", "MR", "TR", or any other value.

      ═══ OUTPUT FORMAT ═══
      Return ONLY raw JSON. No markdown, no fences.
      {
        "questionText": "string",
        "category": "BEHAVIORAL",
        "expectedConcepts": ["string"],
        "difficulty": <integer ${diff.difficultyRange}>
      }
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
      You are an expert interview evaluator. Your job is to fairly and thoroughly assess the candidate's answer.

      ═══ QUESTION ═══
      ${question}

      ═══ EXPECTED KEY CONCEPTS ═══
      ${expectedConcepts.join(', ')}

      ═══ CANDIDATE'S ANSWER ═══
      ${answer}

      ═══ EVALUATION CRITERIA ═══
      Score the answer on a scale of 0–10 based on:
      - Accuracy and correctness of the information provided (40%)
      - Coverage of expected key concepts (30%)
      - Clarity of communication and structure (20%)
      - Depth and quality of insight shown (10%)

      Scoring guide:
      9-10 : Exceptional — covers all concepts with depth, clear and insightful
       7-8 : Strong — covers most concepts, clear and accurate
       5-6 : Adequate — covers some concepts, may have gaps or minor inaccuracies
       3-4 : Weak — misses key concepts or has significant inaccuracies
       0-2 : Poor — off-topic, blank, or fundamentally wrong

      ═══ BEHAVIOURAL EVALUATION ═══
      Webcam snapshots of the candidate during this answer are attached (if any).
      Evaluate: Eye Contact quality, Posture, and Confidence based on visual cues.

      ═══ CRITICAL OUTPUT RULES ═══
      - Return RAW JSON only. Do NOT wrap in markdown code blocks (no triple backticks).
      - The response MUST start with '{' and end with '}' — no leading or trailing text.
      - "feedback" MUST be bounded to a MAXIMUM of 2 sentences. Be specific and constructive.
      - "idealAnswer" MUST be a concise model answer of 2–4 sentences covering all key expected concepts.
      - "eyeContact" MUST start with exactly one of: "Excellent", "Good", or "Poor" — followed by " - " and one justification sentence.
      - If no snapshots are provided, set behavioural fields to neutral defaults.

      Return this exact JSON schema:
      {
        "score": <integer from 0 to 10>,
        "feedback": "Max 2 sentences evaluating content clarity and accuracy.",
        "idealAnswer": "2-4 sentence model answer covering all key expected concepts.",
        "missingConcepts": ["concept that was expected but not mentioned"],
        "behavioralFeedback": {
          "eyeContact": "Excellent | Good | Poor - one sentence justification.",
          "posture": "Concise physical orientation description.",
          "confidence": "Expression and delivery assessment.",
          "overall": "One summary sentence of overall presence."
        }
      }
    `;

    if (snapshots && snapshots.length > 0) {
      try {
        const model = this.genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
        const imageParts = snapshots.map(s => ({
          inlineData: {
            data: s.split(',')[1],
            mimeType: s.split(',')[0].split(':')[1].split(';')[0],
          },
        }));
        const result = await model.generateContent([prompt, ...imageParts]);
        const response = await result.response;
        const parsed = this.tryParseJson(response.text());
        if (parsed) return parsed;
        this.logger.warn('Multimodal parse failed, falling back to text-only evaluation');
      } catch (e: any) {
        this.logger.warn(`Multimodal evaluation failed: ${e.message}. Falling back to text-only.`);
      }
    }

    try {
      return await this.generateWithFallback(prompt);
    } catch (e: any) {
      // Return a safe default evaluation rather than crashing the interview
      this.logger.error(`evaluateAnswer completely failed: ${e.message}. Returning default evaluation.`);
      return {
        score: 5,
        feedback: 'Evaluation service is temporarily unavailable. Your answer has been saved.',
        idealAnswer: 'Not available at this time.',
        missingConcepts: [],
        behavioralFeedback: {
          eyeContact: 'Good - could not evaluate from snapshots.',
          posture: 'Unable to assess.',
          confidence: 'Unable to assess.',
          overall: 'Evaluation service was unavailable for this answer.',
        },
      };
    }
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
