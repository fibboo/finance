import '@testing-library/jest-dom/vitest';

import { cleanup, configure } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, beforeEach, vi } from 'vitest';

import { dismissErrorNotification } from '@/components/error-notification/error-notification-store';
import { signOut } from '@/features/auth/api/session';

configure({ asyncUtilTimeout: 5000 });

export const server = setupServer();

let lockQueue: Promise<unknown> = Promise.resolve();

class IntersectionObserverStub implements IntersectionObserver {
  readonly root = null;
  readonly rootMargin = '0px';
  readonly scrollMargin = '0px';
  readonly thresholds = [0];
  readonly #callback: IntersectionObserverCallback;
  #isConnected = true;

  constructor(callback: IntersectionObserverCallback) {
    this.#callback = callback;
  }

  observe(target: Element): void {
    queueMicrotask(() => {
      if (this.#isConnected) {
        const bounds = target.getBoundingClientRect();
        this.#callback(
          [
            {
              target,
              isIntersecting: true,
              intersectionRatio: 1,
              boundingClientRect: bounds,
              intersectionRect: bounds,
              rootBounds: null,
              time: performance.now(),
            },
          ],
          this,
        );
      }
    });
  }

  unobserve(): void {
    this.#isConnected = false;
  }

  disconnect(): void {
    this.#isConnected = false;
  }

  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
}

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

beforeEach(() => {
  vi.stubGlobal('IntersectionObserver', IntersectionObserverStub);
});

afterEach(async () => {
  cleanup();
  server.use(http.post('http://localhost/api/user/auth/revoke', () => HttpResponse.json(null)));
  await signOut();
  server.resetHandlers();
  vi.unstubAllGlobals();
  localStorage.clear();
  sessionStorage.clear();
  dismissErrorNotification();
});

afterAll(() => {
  server.close();
});
