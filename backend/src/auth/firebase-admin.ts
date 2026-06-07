import * as admin from 'firebase-admin';
import { Logger } from '@nestjs/common';

const logger = new Logger('FirebaseAdmin');

let app: admin.app.App | undefined;

/**
 * Normalises the Firebase private key from .env.
 * Handles all common formats:
 *   - Literal \n strings (dotenv stores them this way)
 *   - Already-expanded newlines
 *   - Surrounding double-quotes added by some editors
 */
function normalisePrivateKey(raw: string): string {
  // Strip surrounding quotes if present (e.g. FIREBASE_PRIVATE_KEY="...")
  let key = raw.trim();
  if ((key.startsWith('"') && key.endsWith('"')) ||
      (key.startsWith("'") && key.endsWith("'"))) {
    key = key.slice(1, -1);
  }
  // Replace literal \n with actual newlines
  key = key.replace(/\\n/g, '\n');
  return key;
}

/**
 * Lazily initializes the Firebase Admin SDK using individual env vars.
 * Required env vars: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY
 */
export function getFirebaseAdmin(): admin.app.App {
  if (app) return app;

  const projectId   = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const rawKey      = process.env.FIREBASE_PRIVATE_KEY ?? '';
  const privateKey  = normalisePrivateKey(rawKey);

  if (!projectId || !clientEmail || !privateKey) {
    const missing = [
      !projectId   && 'FIREBASE_PROJECT_ID',
      !clientEmail && 'FIREBASE_CLIENT_EMAIL',
      !privateKey  && 'FIREBASE_PRIVATE_KEY',
    ].filter(Boolean).join(', ');
    throw new Error(`Firebase Admin SDK missing env vars: ${missing}`);
  }

  // Early validation — catch bad keys before they produce cryptic OpenSSL errors
  if (!privateKey.includes('BEGIN PRIVATE KEY')) {
    logger.error(
      'FIREBASE_PRIVATE_KEY does not look like a valid PEM key. ' +
      `Starts with: "${privateKey.slice(0, 40)}". ` +
      'Please paste the full key from the Firebase service-account JSON.',
    );
    throw new Error('Invalid FIREBASE_PRIVATE_KEY format');
  }

  try {
    // Validate the key can be parsed before handing to firebase-admin
    const crypto = require('crypto');
    crypto.createPrivateKey(privateKey);
  } catch (e: any) {
    logger.error(
      `FIREBASE_PRIVATE_KEY failed to parse: ${e.message}. ` +
      'Go to Firebase Console → Project Settings → Service Accounts → ' +
      'Generate new private key, and update FIREBASE_PRIVATE_KEY in .env.',
    );
    throw new Error(`FIREBASE_PRIVATE_KEY is corrupt: ${e.message}`);
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
