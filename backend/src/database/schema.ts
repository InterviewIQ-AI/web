import {
  pgTable,
  serial,
  text,
  timestamp,
  integer,
  jsonb,
  boolean,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  email: text('email').unique().notNull(),
  name: text('name'),
  skills: jsonb('skills').default([]),
  createdAt: timestamp('created_at').defaultNow(),
});

export const interviews = pgTable('interviews', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull(),
  jobRole: text('job_role').notNull(),
  status: text('status').default('PENDING'), // PENDING, IN_PROGRESS, COMPLETED
  finalScore: integer('final_score'),
  feedbackSummary: text('feedback_summary'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const questions = pgTable('questions', {
  id: serial('id').primaryKey(),
  interviewId: integer('interview_id').notNull(),
  questionText: text('question_text').notNull(),
  category: text('category').notNull(), // TECHNICAL, BEHAVIORAL, SYSTEM_DESIGN
  difficulty: integer('difficulty').default(3), // 1 to 5
  expectedConcepts: jsonb('expected_concepts').default([]),
  createdAt: timestamp('created_at').defaultNow(),
});

export const answers = pgTable('answers', {
  id: serial('id').primaryKey(),
  questionId: integer('question_id').notNull(),
  userAnswer: text('user_answer').notNull(),
  confidenceLevel: integer('confidence_level'),
  timeTakenSeconds: integer('time_taken_seconds'),
  isVoice: boolean('is_voice').default(false),
  score: integer('score'),
  feedback: text('feedback'),
  missingConcepts: jsonb('missing_concepts').default([]),
  createdAt: timestamp('created_at').defaultNow(),
});

// ─── Relations ────────────────────────────────────────────────────────────────
export const interviewsRelations = relations(interviews, ({ many }) => ({
  questions: many(questions),
}));

export const questionsRelations = relations(questions, ({ one, many }) => ({
  interview: one(interviews, {
    fields: [questions.interviewId],
    references: [interviews.id],
  }),
  answers: many(answers),
}));

export const answersRelations = relations(answers, ({ one }) => ({
  question: one(questions, {
    fields: [answers.questionId],
    references: [questions.id],
  }),
}));
