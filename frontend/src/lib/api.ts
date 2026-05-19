import { getIdToken } from '../context/AuthContext';

/**
 * Authenticated fetch wrapper.
 * Automatically attaches the Firebase ID token as a Bearer token header.
 * Usage: apiFetch('/api/interview') — identical signature to fetch().
 */
export async function apiFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
): Promise<Response> {
  const token = await getIdToken();

  const headers = new Headers(init.headers ?? {});
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  return fetch(input, { ...init, headers });
}
