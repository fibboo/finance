import { focusManager, MutationObserver, QueryObserver } from '@tanstack/react-query';
import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { Route, Routes } from 'react-router';
import { afterEach, expect, test, vi } from 'vitest';

import { createQueryClient } from '@/app/query-client';
import { startSession } from '@/features/auth/api/session';
import { RequireSession } from '@/features/auth/components/require-session';
import { apiClient } from '@/lib/api-client';
import { render } from '@/test/render';
import { server } from '@/test/setup';

afterEach(() => {
  vi.useRealTimers();
  focusManager.setFocused(undefined);
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

test('polls a query every 30 seconds while the tab is visible', async () => {
  // arrange
  vi.useFakeTimers();
  let fetchCount = 0;
  const queryClient = createQueryClient();
  const observer = new QueryObserver(queryClient, {
    queryKey: ['user', 'me'],
    queryFn: () => {
      fetchCount += 1;
      return fetchCount;
    },
  });
  const unsubscribe = observer.subscribe(() => undefined);
  await vi.advanceTimersByTimeAsync(0);

  // act
  await vi.advanceTimersByTimeAsync(30_000);

  // assert
  expect(fetchCount).toBe(2);
  unsubscribe();
});

test('does not poll while the tab is hidden', async () => {
  // arrange
  vi.useFakeTimers();
  let fetchCount = 0;
  const queryClient = createQueryClient();
  const observer = new QueryObserver(queryClient, {
    queryKey: ['user', 'me'],
    queryFn: () => {
      fetchCount += 1;
      return fetchCount;
    },
  });
  const unsubscribe = observer.subscribe(() => undefined);
  await vi.advanceTimersByTimeAsync(0);
  focusManager.setFocused(false);

  // act
  await vi.advanceTimersByTimeAsync(90_000);

  // assert
  expect(fetchCount).toBe(1);
  unsubscribe();
});

test('refetches fresh data when the tab is shown again', async () => {
  // arrange
  let fetchCount = 0;
  const queryClient = createQueryClient();
  queryClient.mount();
  const observer = new QueryObserver(queryClient, {
    queryKey: ['user', 'me'],
    queryFn: () => {
      fetchCount += 1;
      return fetchCount;
    },
  });
  const unsubscribe = observer.subscribe(() => undefined);
  await expect.poll(() => observer.getCurrentResult().data).toBe(1);
  focusManager.setFocused(false);

  // act
  focusManager.setFocused(true);

  // assert
  await expect.poll(() => observer.getCurrentResult().data).toBe(2);
  unsubscribe();
  queryClient.unmount();
});

test('tells the other tabs that the data changed after a mutation succeeds', async () => {
  // arrange
  const otherTab = new BroadcastChannel('finance-data-change');
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
  otherTab.close();
});
