import { screen } from '@testing-library/react';
import { Route, Routes } from 'react-router';
import { expect, test } from 'vitest';

import { render } from '@/test/render';

import { startSession } from '../api/session';
import { RequireSession } from './require-session';

const routes = (
  <Routes>
    <Route path="/sign-in" element={<h1>Sign in</h1>} />
    <Route element={<RequireSession />}>
      <Route index element={<h1>Home</h1>} />
    </Route>
  </Routes>
);

test('shows the protected screen with a session', () => {
  // arrange
  startSession('access-1');

  // act
  render(routes);

  // assert
  expect(screen.getByRole('heading', { name: 'Home' })).toBeInTheDocument();
});

test('redirects to sign-in without a session', async () => {
  // act
  render(routes);

  // assert
  expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
});

test('redirects to sign-in when another tab signs out', async () => {
  // arrange
  startSession('access-1');
  render(routes);
  const otherTab = new BroadcastChannel('finance-session');

  // act
  otherTab.postMessage({ type: 'signed-out' });

  // assert
  expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
  otherTab.close();
});
