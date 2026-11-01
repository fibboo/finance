import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { expect, test, vi } from 'vitest';

import { AppLayout } from '@/app/app-layout';
import type { components } from '@/lib/api-schema';
import { render } from '@/test/render';
import { server } from '@/test/setup';

test('names the sign-in provider with the label the user dictionary serves', async () => {
  // arrange
  server.use(
    http.get('http://localhost/api/user/me', () =>
      HttpResponse.json({
        id: '0b5c1f0e-1d7b-4a52-9f3a-2f1a6f0c8d11',
        username: 'nikita',
        avatar: null,
        registration_provider: 'GOOGLE',
        base_currency: 'EUR',
        external_users: [],
      } satisfies components['schemas']['User']),
    ),
    http.get('http://localhost/api/dictionaries/user', () =>
      HttpResponse.json({
        provider_types: [
          { key: 'TELEGRAM', label: 'Telegram' },
          { key: 'GOOGLE', label: 'Google' },
        ],
      } satisfies components['schemas']['UserDictionaries']),
    ),
  );
  const user = userEvent.setup();
  render(<AppLayout />);

  // act
  await user.click(await screen.findByRole('button', { name: 'Account menu' }));

  // assert
  expect(await screen.findByText('Signed in with Google')).toBeInTheDocument();
});

test('sends the user to the provider to link it', async () => {
  // arrange
  const assign = vi.fn<(url: string) => void>();
  vi.stubGlobal('location', { origin: 'http://localhost:5173', assign });
  let redirectUri: string | null = null;
  server.use(
    http.get('http://localhost/api/user/me', () =>
      HttpResponse.json({
        id: '0b5c1f0e-1d7b-4a52-9f3a-2f1a6f0c8d11',
        username: 'nikita',
        avatar: null,
        registration_provider: 'TELEGRAM',
        base_currency: 'EUR',
        external_users: [
          {
            id: '6a7f3e0c-1f2b-4d4f-9a1c-0e5f8b2c7d10',
            user_id: '0b5c1f0e-1d7b-4a52-9f3a-2f1a6f0c8d11',
            provider: 'TELEGRAM',
            external_id: '1001',
            username: 'nikita',
          },
        ],
      } satisfies components['schemas']['User']),
    ),
    http.get('http://localhost/api/dictionaries/user', () =>
      HttpResponse.json({
        provider_types: [
          { key: 'TELEGRAM', label: 'Telegram' },
          { key: 'GOOGLE', label: 'Google' },
        ],
      } satisfies components['schemas']['UserDictionaries']),
    ),
    http.post('http://localhost/api/user/auth/link/GOOGLE', ({ request }) => {
      redirectUri = new URL(request.url).searchParams.get('redirect_uri');
      return HttpResponse.json({ authorization_url: 'https://accounts.google.test/authorize' });
    }),
  );
  const user = userEvent.setup();
  render(<AppLayout />);
  await user.click(await screen.findByRole('button', { name: 'Account menu' }));

  // act
  await user.click(await screen.findByRole('button', { name: 'Link Google' }));

  // assert
  await vi.waitFor(() => {
    expect(assign).toHaveBeenCalledWith('https://accounts.google.test/authorize');
  });
  expect(redirectUri).toBe('http://localhost:5173/auth/link-callback');
});
