import { z } from 'zod';

import { apiClient, readData } from '@/lib/api-client';
import { ApiError, UNAUTHORIZED_STATUS } from '@/lib/api-error';

const SESSION_CHANNEL_NAME = 'finance-session';
const REFRESH_LOCK_NAME = 'finance-session-refresh';
const REFRESH_TIMEOUT_MS = 10_000;

const sessionMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('signed-in'), access_token: z.string().min(1) }),
  z.object({ type: z.literal('signed-out') }),
]);

type SessionMessage = z.infer<typeof sessionMessageSchema>;

const listeners = new Set<() => void>();
const sessionChannel = new BroadcastChannel(SESSION_CHANNEL_NAME);
let accessToken: string | null = null;
let pendingRefresh: Promise<string | null> | null = null;

function setAccessToken(token: string | null): void {
  accessToken = token;
  listeners.forEach((listener) => {
    listener();
  });
}

function buildSessionMessage(token: string | null): SessionMessage {
  const message: SessionMessage =
    token === null ? { type: 'signed-out' } : { type: 'signed-in', access_token: token };
  return message;
}

async function requestRefreshedToken(): Promise<string | null> {
  try {
    const tokenResponse = readData(
      await apiClient.POST('/user/auth/token', {
        body: { grant_type: 'refresh_token' },
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        signal: AbortSignal.timeout(REFRESH_TIMEOUT_MS),
      }),
    );
    return tokenResponse.access_token;
  } catch (error) {
    if (error instanceof ApiError && error.status === UNAUTHORIZED_STATUS) {
      return null;
    }

    throw error;
  }
}

sessionChannel.addEventListener('message', (event) => {
  const message = sessionMessageSchema.safeParse(event.data);
  if (message.success) {
    setAccessToken(message.data.type === 'signed-in' ? message.data.access_token : null);
  }
});

export function readAccessToken(): string | null {
  return accessToken;
}

export function readIsSignedIn(): boolean {
  return accessToken !== null;
}

export function subscribeToSession(listener: () => void): () => void {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

export function startSession(token: string): void {
  setAccessToken(token);
  sessionChannel.postMessage(buildSessionMessage(token));
}

export function refreshSession(staleToken: string | null): Promise<string | null> {
  if (accessToken !== staleToken) {
    return Promise.resolve(accessToken);
  }

  pendingRefresh ??= navigator.locks
    .request(REFRESH_LOCK_NAME, async () => {
      if (accessToken !== staleToken) {
        return accessToken;
      }

      const refreshedToken = await requestRefreshedToken();
      setAccessToken(refreshedToken);
      sessionChannel.postMessage(buildSessionMessage(refreshedToken));

      return refreshedToken;
    })
    .finally(() => {
      pendingRefresh = null;
    });

  return pendingRefresh;
}

export async function restoreSession(): Promise<void> {
  if (accessToken === null) {
    await refreshSession(null);
  }
}

export async function signOut(): Promise<void> {
  await apiClient.POST('/user/auth/revoke');
  setAccessToken(null);
  sessionChannel.postMessage(buildSessionMessage(null));
}
