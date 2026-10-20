import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { Route, Routes } from 'react-router';
import { expect, test } from 'vitest';

import { createQueryClient } from '@/app/query-client';
import { startSession } from '@/features/auth/api/session';
import { RequireSession } from '@/features/auth/components/require-session';
import { apiClient } from '@/lib/api-client';
import { render } from '@/test/render';
import { server } from '@/test/setup';

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
