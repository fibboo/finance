import '@testing-library/jest-dom/vitest';

import { cleanup, configure } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, vi } from 'vitest';

import { dismissErrorNotification } from '@/components/error-notification/error-notification-store';
import { signOut } from '@/features/auth/api/session';

configure({ asyncUtilTimeout: 5000 });

export const server = setupServer();

let lockQueue: Promise<unknown> = Promise.resolve();

beforeAll(() => {
  server.listen({ onUnhandledFrame: 'error' });
  Object.defineProperty(navigator, 'locks', {
    configurable: true,
    value: {
      request: (_name: string, callback: () => Promise<unknown>) => {
        const granted = lockQueue.then(callback);
        lockQueue = granted.then(
          () => undefined,
          () => undefined,
        );

        return granted;
      },
    },
  });
});

afterEach(async () => {
  cleanup();
  server.use(http.post('http://localhost/api/user/auth/revoke', () => HttpResponse.json(null)));
  await signOut();
  server.resetHandlers();
  vi.unstubAllGlobals();
  localStorage.clear();
  dismissErrorNotification();
});

afterAll(() => {
  server.close();
});
