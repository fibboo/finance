import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { expect, test } from 'vitest';

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
