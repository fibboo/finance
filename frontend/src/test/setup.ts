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

const ROOT_FONT_SIZE = 16;

function matchMinWidth(query: string): MediaQueryList {
  const minWidthRem = /min-width: (\d+(?:\.\d+)?)rem/.exec(query)?.[1];
  const mediaQueryList = {
    matches: minWidthRem !== undefined && window.innerWidth >= Number(minWidthRem) * ROOT_FONT_SIZE,
    media: query,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  };
  return mediaQueryList;
}

const previouslyFocusedElements = new WeakMap<HTMLDialogElement, Element | null>();

function cancelOpenDialog(event: KeyboardEvent) {
  const dialog = document.querySelector('dialog[open]');
  if (event.key === 'Escape' && !event.defaultPrevented && dialog !== null) {
    dialog.dispatchEvent(new Event('cancel', { cancelable: true }));
  }
}

beforeAll(() => {
  Object.defineProperties(HTMLDialogElement.prototype, {
    showModal: {
      configurable: true,
      value(this: HTMLDialogElement) {
        previouslyFocusedElements.set(this, document.activeElement);
        this.setAttribute('open', '');
      },
    },
    close: {
      configurable: true,
      value(this: HTMLDialogElement) {
        if (this.hasAttribute('open')) {
          this.removeAttribute('open');
          const previouslyFocusedElement = previouslyFocusedElements.get(this);
          if (previouslyFocusedElement instanceof HTMLElement) {
            previouslyFocusedElement.focus();
          }
          this.dispatchEvent(new Event('close'));
        }
      },
    },
  });
  document.addEventListener('keydown', cancelOpenDialog);
});

beforeEach(() => {
  vi.stubGlobal('IntersectionObserver', IntersectionObserverStub);
  vi.stubGlobal('matchMedia', matchMinWidth);
  Object.defineProperty(Element.prototype, 'scrollIntoView', {
    configurable: true,
    writable: true,
    value: () => undefined,
  });
  Object.defineProperty(Element.prototype, 'scrollBy', {
    configurable: true,
    writable: true,
    value: () => undefined,
  });
  Object.defineProperty(Element.prototype, 'scrollTo', {
    configurable: true,
    writable: true,
    value: () => undefined,
  });
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
