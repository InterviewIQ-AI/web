import * as admin from 'firebase-admin';
import { Logger } from '@nestjs/common';

const logger = new Logger('FirebaseAdmin');

let app: admin.app.App | undefined;

/**
 * Lazily initializes the Firebase Admin SDK using individual env vars.
 * Required env vars: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY
 */
export function getFirebaseAdmin(): admin.app.App {
  if (app) return app;

  const projectId   = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey  = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!projectId || !clientEmail || !privateKey) {
    const missing = [
      !projectId   && 'FIREBASE_PROJECT_ID',
      !clientEmail && 'FIREBASE_CLIENT_EMAIL',
      !privateKey  && 'FIREBASE_PRIVATE_KEY',
    ].filter(Boolean).join(', ');
    throw new Error(`Firebase Admin SDK missing env vars: ${missing}`);
  }

  app = admin.initializeApp({
    credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
  });

  logger.log(`Firebase Admin initialized for project: ${projectId}`);
  return app;
}

/**
 * Verifies a Firebase ID token and returns the decoded payload.
 * Throws if the token is invalid or expired.
 */
export async function verifyIdToken(token: string): Promise<admin.auth.DecodedIdToken> {
  const firebaseApp = getFirebaseAdmin();
  return firebaseApp.auth().verifyIdToken(token);
}
