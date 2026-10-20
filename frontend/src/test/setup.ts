import '@testing-library/jest-dom/vitest';

import { cleanup, configure } from '@testing-library/react';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, beforeEach, vi } from 'vitest';

import { dismissErrorNotification } from '@/components/error-notification/error-notification-store';

configure({ asyncUtilTimeout: 5000 });

export const server = setupServer();

beforeAll(() => {
  server.listen({ onUnhandledFrame: 'error' });
});

beforeEach(() => {
  vi.stubGlobal('matchMedia', (media: string) =>
    Object.assign(new EventTarget(), { media, matches: false }),
  );
});

afterEach(() => {
  cleanup();
  server.resetHandlers();
  localStorage.clear();
  dismissErrorNotification();
  vi.unstubAllGlobals();
});

afterAll(() => {
  server.close();
});
