import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI } from '@google/genai';

@Injectable()
export class AiService {
  private ai: GoogleGenAI;
  private readonly logger = new Logger(AiService.name);

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    if (!apiKey || apiKey === 'your_gemini_api_key_here') {
      this.logger.warn('GEMINI_API_KEY is not configured properly.');
    }
    this.ai = new GoogleGenAI({ apiKey: apiKey || '' });
  }

  async generateQuestionsFromResume(resumeText: string, jobRole: string): Promise<any> {
    const prompt = `
      You are an expert technical interviewer. Based on the following resume text and the target job role "${jobRole}", 
      generate 5 highly relevant interview questions. 
      The questions should be a mix of technical concepts, problem-solving, and project deep-dives based on what is in the resume.
      Return the result as a JSON array of objects with the following schema:
      [{
        "questionText": "The question",
        "category": "TECHNICAL | SYSTEM_DESIGN | BEHAVIORAL",
        "expectedConcepts": ["concept1", "concept2"],
        "difficulty": 3
      }]
      
      Resume text:
      ${resumeText}
    `;

    try {
      const response = await this.ai.models.generateContent({
        model: 'gemini-2.5-pro',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
        },
      });

      return JSON.parse(response.text || '[]');
    } catch (error) {
      this.logger.error('Failed to generate questions', error);
      throw error;
    }
  }

  async evaluateAnswer(question: string, expectedConcepts: string[], answer: string): Promise<any> {
    const prompt = `
      You are an expert interviewer evaluating a candidate's answer.
      Question: ${question}
      Expected Concepts: ${expectedConcepts.join(', ')}
      Candidate's Answer: ${answer}

      Evaluate the answer based on correctness, depth of explanation, logical flow, and missing concepts.
      Return the result as JSON with the following schema:
      {
        "score": 8, // out of 10
        "feedback": "Detailed feedback string",
        "missingConcepts": ["any missed concepts"],
        "idealAnswerComparison": "How it compares to the ideal answer"
      }
    `;

    try {
      const response = await this.ai.models.generateContent({
        model: 'gemini-2.5-pro',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
        },
      });

      return JSON.parse(response.text || '{}');
    } catch (error) {
      this.logger.error('Failed to evaluate answer', error);
      throw error;
    }
  }

  async transcribeAudio(audioBuffer: Buffer, mimeType: string): Promise<string> {
    try {
      const response = await this.ai.models.generateContent({
        model: 'gemini-1.5-flash',
        contents: [
          {
            role: 'user',
            parts: [
              { text: 'Transcribe the following audio exactly as spoken. Return only the transcription, nothing else.' },
              {
                inlineData: {
                  data: audioBuffer.toString('base64'),
                  mimeType: mimeType,
                },
              },
            ],
          },
        ],
      });

      return response.text || '';
    } catch (error) {
      this.logger.error('Failed to transcribe audio', error);
      throw error;
    }
  }
}
