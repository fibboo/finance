import { screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { Navigate, Route, Routes } from 'react-router';
import { expect, test, vi } from 'vitest';

import { render } from '@/test/render';

import { startSession } from '../api/session';
import { SignInPage } from './sign-in-page';

test.each([
  { buttonName: 'Continue with Telegram', provider: 'TELEGRAM' },
  { buttonName: 'Continue with Google', provider: 'GOOGLE' },
])('sends the visitor to the $provider authorization', async ({ buttonName, provider }) => {
  // arrange
  const assign = vi.fn<(url: string) => void>();
  vi.stubGlobal('location', { origin: 'http://localhost:5173', assign });
  const user = userEvent.setup();
  render(<SignInPage />);

  // act
  await user.click(screen.getByRole('button', { name: buttonName }));

  // assert
  await vi.waitFor(() => {
    expect(assign).toHaveBeenCalledOnce();
  });
  const authorizeUrl = new URL(assign.mock.calls[0]?.[0] ?? '', 'http://localhost:5173');
  expect(authorizeUrl.pathname).toBe(`/api/user/auth/authorize/${provider}`);
  expect(authorizeUrl.searchParams.get('redirect_uri')).toBe('http://localhost:5173/auth/callback');
  expect(authorizeUrl.searchParams.get('code_challenge_method')).toBe('S256');
  expect(authorizeUrl.searchParams.get('code_challenge')).toMatch(/^[A-Za-z0-9_-]{43}$/);
  expect(authorizeUrl.searchParams.get('state')).toMatch(/^[A-Za-z0-9_-]{43}$/);
});

test('shows a message when the sign-in failed', async () => {
  // act
  render(
    <Routes>
      <Route index element={<Navigate to="/sign-in?error=access_denied" />} />
      <Route path="/sign-in" element={<SignInPage />} />
    </Routes>,
  );

  // assert
  expect(await screen.findByText('Sign-in did not finish. Please try again.')).toBeInTheDocument();
});

test('sends a signed-in visitor into the app', async () => {
  // arrange
  startSession('access-1');

  // act
  render(
    <Routes>
      <Route index element={<h1>Home</h1>} />
      <Route path="/sign-in" element={<SignInPage />} />
      <Route path="*" element={<Navigate to="/sign-in" />} />
    </Routes>,
  );

  // assert
  expect(await screen.findByRole('heading', { name: 'Home' })).toBeInTheDocument();
});
