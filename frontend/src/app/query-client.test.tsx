import { MutationObserver } from '@tanstack/react-query';
import { screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { Route, Routes } from 'react-router';
import { afterEach, beforeEach, expect, onTestFinished, test, vi } from 'vitest';

import { createQueryClient } from '@/app/query-client';
import { startSession } from '@/features/auth/api/session';
import { RequireSession } from '@/features/auth/components/require-session';
import { UserSummary } from '@/features/user/components/user-summary';
import { apiClient } from '@/lib/api-client';
import type { components } from '@/lib/api-schema';
import { render } from '@/test/render';
import { server } from '@/test/setup';

let meRequestCount = 0;

beforeEach(() => {
  meRequestCount = 0;
});

afterEach(() => {
  vi.useRealTimers();
  Reflect.deleteProperty(document, 'visibilityState');
});

test('does not retry a client error and shows the error notification', async () => {
  // arrange
  let requestCount = 0;
  server.use(
    http.get('http://localhost/api/user/me', () => {
      requestCount += 1;

      return HttpResponse.json({ message: 'User not found' }, { status: 404 });
    }),
  );
  render(<main />);
  const queryClient = createQueryClient();

  // act
  const result = queryClient.query({
    queryKey: ['user', 'me'],
    queryFn: () => apiClient.GET('/user/me'),
  });

  // assert
  await expect(result).rejects.toThrow('User not found');
  expect(requestCount).toBe(1);
  expect(await screen.findByText('Something went wrong. Please try again.')).toBeInTheDocument();
});

test('shows no error notification when the refresh answers 401 and the session ends', async () => {
  // arrange
  const invalidToken = { message: 'Invalid token', error_code: 'INVALID_TOKEN' };
  server.use(
    http.get('http://localhost/api/user/me', () =>
      HttpResponse.json(invalidToken, { status: 401 }),
    ),
    http.post('http://localhost/api/user/auth/token', () =>
      HttpResponse.json(invalidToken, { status: 401 }),
    ),
  );
  startSession('expired');
  render(
    <Routes>
      <Route path="/sign-in" element={<p>Sign in</p>} />
      <Route element={<RequireSession />}>
        <Route index element={<p>Home</p>} />
      </Route>
    </Routes>,
  );
  const queryClient = createQueryClient();

  // act
  const result = queryClient.query({
    queryKey: ['user', 'me'],
    queryFn: () => apiClient.GET('/user/me'),
  });

  // assert
  await expect(result).rejects.toThrow('Invalid token');
  expect(await screen.findByText('Sign in')).toBeInTheDocument();
  expect(screen.queryByText('Something went wrong. Please try again.')).not.toBeInTheDocument();
});

test('polls the data on screen every 30 seconds while the tab is visible', async () => {
  // arrange
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
  // each request names the user by its number, so the name shows which request is on screen
  server.use(
    http.get('http://localhost/api/user/me', () => {
      meRequestCount += 1;

      return HttpResponse.json({
        id: '0b5c1f0e-1d7b-4a52-9f3a-2f1a6f0c8d11',
        username: `user-${String(meRequestCount)}`,
        avatar: null,
        registration_provider: 'TELEGRAM',
        base_currency: 'EUR',
        external_users: [],
      } satisfies components['schemas']['User']);
    }),
  );
  startSession('access-1');
  render(
    <Routes>
      <Route element={<RequireSession />}>
        <Route index element={<UserSummary providerTypes={[]} />} />
      </Route>
    </Routes>,
  );
  expect(await screen.findByText('user-1')).toBeInTheDocument();

  // act
  await vi.advanceTimersByTimeAsync(30_000);

  // assert
  expect(await screen.findByText('user-2')).toBeInTheDocument();
});

test('does not poll while the tab is hidden and refetches once it is shown again', async () => {
  // arrange
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
  server.use(
    http.get('http://localhost/api/user/me', () => {
      meRequestCount += 1;

      return HttpResponse.json({
        id: '0b5c1f0e-1d7b-4a52-9f3a-2f1a6f0c8d11',
        username: `user-${String(meRequestCount)}`,
        avatar: null,
        registration_provider: 'TELEGRAM',
        base_currency: 'EUR',
        external_users: [],
      } satisfies components['schemas']['User']);
    }),
  );
  startSession('access-1');
  render(
    <Routes>
      <Route element={<RequireSession />}>
        <Route index element={<UserSummary providerTypes={[]} />} />
      </Route>
    </Routes>,
  );
  expect(await screen.findByText('user-1')).toBeInTheDocument();
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
  document.dispatchEvent(new Event('visibilitychange', { bubbles: true }));
  await vi.advanceTimersByTimeAsync(90_000);

  // act
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
  document.dispatchEvent(new Event('visibilitychange', { bubbles: true }));

  // assert
  expect(await screen.findByText('user-2')).toBeInTheDocument();
  expect(meRequestCount).toBe(2);
});

test('tells the other tabs that the data changed after a mutation succeeds', async () => {
  // arrange
  const otherTab = new BroadcastChannel('finance-data-change');
  onTestFinished(() => {
    otherTab.close();
  });
  const receivedMessages: unknown[] = [];
  otherTab.addEventListener('message', (event) => {
    receivedMessages.push(event.data);
  });
  const queryClient = createQueryClient();
  const observer = new MutationObserver(queryClient, {
    mutationFn: () => Promise.resolve('saved'),
  });

  // act
  await observer.mutate();

  // assert
  await expect.poll(() => receivedMessages).toHaveLength(1);
});

test('notifies once while a query keeps failing and again once it failed after a success', async () => {
  // arrange
  const user = userEvent.setup();
  let meResponse = 'failing';
  server.use(
    http.get('http://localhost/api/user/me', () =>
      meResponse === 'failing'
        ? HttpResponse.json({ message: 'User not found' }, { status: 404 })
        : HttpResponse.json({
            id: '0b5c1f0e-1d7b-4a52-9f3a-2f1a6f0c8d11',
            username: 'nikita',
            avatar: null,
            registration_provider: 'TELEGRAM',
            base_currency: 'EUR',
            external_users: [],
          } satisfies components['schemas']['User']),
    ),
  );
  render(<main />);
  const queryClient = createQueryClient();
  const meQuery = {
    queryKey: ['user', 'me'],
    queryFn: () => apiClient.GET('/user/me'),
    staleTime: 0,
  };
  await expect(queryClient.query(meQuery)).rejects.toThrow('User not found');
  await user.click(await screen.findByRole('button', { name: 'Dismiss' }));

  // act
  await expect(queryClient.query(meQuery)).rejects.toThrow('User not found');

  // assert
  expect(screen.queryByText('Something went wrong. Please try again.')).not.toBeInTheDocument();
  // a success ends the failures, so the next failure notifies again
  meResponse = 'ok';
  await queryClient.query(meQuery);
  meResponse = 'failing';
  await expect(queryClient.query(meQuery)).rejects.toThrow('User not found');
  expect(await screen.findByText('Something went wrong. Please try again.')).toBeInTheDocument();
});
