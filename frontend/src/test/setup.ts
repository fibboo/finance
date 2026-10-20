import '@testing-library/jest-dom/vitest';

import { cleanup, configure } from '@testing-library/react';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, vi } from 'vitest';

import { dismissErrorNotification } from '@/components/error-notification/error-notification-store';

configure({ asyncUtilTimeout: 5000 });

export const server = setupServer();

beforeAll(() => {
  server.listen({ onUnhandledFrame: 'error' });
});

afterEach(() => {
  cleanup();
  server.resetHandlers();
  vi.unstubAllGlobals();
  localStorage.clear();
  dismissErrorNotification();
});

afterAll(() => {
  server.close();
});
