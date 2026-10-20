import { screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { Route, Routes } from 'react-router';
import { expect, test, vi } from 'vitest';

import { render } from '@/test/render';
import { server } from '@/test/setup';

import { startSession } from '../api/session';
import { RequireSession } from './require-session';
import { SignOutButton } from './sign-out-button';

test('signs out in every tab and leaves for sign-in', async () => {
  // arrange
  const user = userEvent.setup();
  let revokeCount = 0;
  const otherTabMessages: unknown[] = [];
  const otherTab = new BroadcastChannel('finance-session');
  otherTab.addEventListener('message', (event) => {
    otherTabMessages.push(event.data);
  });
  server.use(
    http.post('http://localhost/api/user/auth/revoke', () => {
      revokeCount += 1;

      return HttpResponse.json(null);
    }),
  );
  startSession('access-1');
  render(
    <Routes>
      <Route path="/sign-in" element={<h1>Sign in</h1>} />
      <Route element={<RequireSession />}>
        <Route index element={<SignOutButton />} />
      </Route>
    </Routes>,
  );

  // act
  await user.click(screen.getByRole('button', { name: 'Sign out' }));

  // assert
  expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
  expect(revokeCount).toBe(1);
  await vi.waitFor(() => {
    expect(otherTabMessages).toContainEqual({ type: 'signed-out' });
  });
  otherTab.close();
});
