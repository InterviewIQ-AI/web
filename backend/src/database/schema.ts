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
  id: text('id').primaryKey(),
  email: text('email').unique().notNull(),
  name: text('name'),
  // ─── Profile completion fields ───────────────────────────────────────────
  phone: text('phone'),
  currentRole: text('current_role'),
  yearsOfExperience: integer('years_of_experience'),
  targetRole: text('target_role'),
  education: text('education'),
  linkedinUrl: text('linkedin_url'),
  skills: jsonb('skills').default([]),
  resumeText: text('resume_text'),
  resumeSummary: text('resume_summary'), // JSON string from AI extraction
  profileCompleted: boolean('profile_completed').default(false),
  createdAt: timestamp('created_at').defaultNow(),
});

export const interviews = pgTable('interviews', {
  id: serial('id').primaryKey(),
  userId: text('user_id').notNull(),
  jobRole: text('job_role').notNull(),
  status: text('status').default('PENDING'), // PENDING, IN_PROGRESS, COMPLETED
  sessionNumber: integer('session_number').default(1), // per user+role, used for spaced repetition
  roundType: text('round_type').default('TR'),         // HR | MR | TR
  difficulty: text('difficulty').default('medium'),    // easy | medium | hard
  finalScore: integer('final_score'),
  feedbackSummary: text('feedback_summary'),
  studyPlan: jsonb('study_plan'), // AI-generated 7-day study plan
  createdAt: timestamp('created_at').defaultNow(),
});

export const questions = pgTable('questions', {
  id: serial('id').primaryKey(),
  interviewId: integer('interview_id').notNull(),
  questionText: text('question_text').notNull(),
  category: text('category').notNull(), // ENUM: 'TECHNICAL' | 'BEHAVIORAL'
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
  idealAnswer: text('ideal_answer'),
  missingConcepts: jsonb('missing_concepts').default([]),
  behavioralFeedback: jsonb('behavioral_feedback'),
  createdAt: timestamp('created_at').defaultNow(),
});

// ─── Spaced Repetition ────────────────────────────────────────────────────────
// Per-user, per-concept performance for adaptive suppression / drill scheduling.
export const questionPerformance = pgTable('question_performance', {
  id: serial('id').primaryKey(),
  userId: text('user_id').notNull(),
  jobRole: text('job_role').notNull(),
  conceptTag: text('concept_tag').notNull(),
  lastScore: integer('last_score').notNull(),
  timesAnswered: integer('times_answered').default(1),
  // Session number at which this concept becomes eligible again (0 = always eligible).
  suppressUntilSession: integer('suppress_until_session').default(0),
  updatedAt: timestamp('updated_at').defaultNow(),
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
