import { screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { expect, test } from 'vitest';

import type { components } from '@/lib/api-schema';
import { render } from '@/test/render';
import { server } from '@/test/setup';

import { LinkedProviders } from './linked-providers';

const providerTypes: components['schemas']['DictionaryItem'][] = [
  { key: 'TELEGRAM', label: 'Telegram' },
  { key: 'GOOGLE', label: 'Google' },
];

const telegramUser: components['schemas']['ExternalUser'] = {
  id: '6a7f3e0c-1f2b-4d4f-9a1c-0e5f8b2c7d10',
  user_id: '0b5c1f0e-1d7b-4a52-9f3a-2f1a6f0c8d11',
  provider: 'TELEGRAM',
  external_id: '1001',
  username: 'nikita',
};

const googleUser: components['schemas']['ExternalUser'] = {
  id: '9c2e4b1a-3d5f-4e6a-8b7c-1d2e3f4a5b6c',
  user_id: '0b5c1f0e-1d7b-4a52-9f3a-2f1a6f0c8d11',
  provider: 'GOOGLE',
  external_id: '2002',
  username: 'nikita@example.com',
};

test('keeps the only linked provider from being unlinked', async () => {
  // arrange
  server.use(
    http.get('http://localhost/api/user/me', () =>
      HttpResponse.json({
        id: '0b5c1f0e-1d7b-4a52-9f3a-2f1a6f0c8d11',
        username: 'nikita',
        avatar: null,
        registration_provider: 'TELEGRAM',
        base_currency: 'EUR',
        external_users: [telegramUser],
      } satisfies components['schemas']['User']),
    ),
  );

  // act
  render(<LinkedProviders providerTypes={providerTypes} startLink={() => Promise.resolve('')} />);

  // assert
  expect(await screen.findByRole('button', { name: 'Unlink Telegram' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Link Google' })).toBeEnabled();
  expect(screen.getByText('Not linked')).toBeInTheDocument();
  expect(
    screen.getByText('Link another method before you unlink the only one.'),
  ).toBeInTheDocument();
});

test('unlinks a provider at once and shows it as not linked', async () => {
  // arrange
  let externalUsers = [telegramUser, googleUser];
  let unlinkedProvider = '';
  server.use(
    http.get('http://localhost/api/user/me', () =>
      HttpResponse.json({
        id: '0b5c1f0e-1d7b-4a52-9f3a-2f1a6f0c8d11',
        username: 'nikita',
        avatar: null,
        registration_provider: 'TELEGRAM',
        base_currency: 'EUR',
        external_users: externalUsers,
      } satisfies components['schemas']['User']),
    ),
    http.delete('http://localhost/api/user/auth/link/:provider', ({ params }) => {
      unlinkedProvider = String(params['provider']);
      externalUsers = [telegramUser];
      return HttpResponse.json(null);
    }),
  );
  const user = userEvent.setup();
  render(<LinkedProviders providerTypes={providerTypes} startLink={() => Promise.resolve('')} />);

  // act
  await user.click(await screen.findByRole('button', { name: 'Unlink Google' }));

  // assert
  expect(await screen.findByRole('button', { name: 'Link Google' })).toBeInTheDocument();
  expect(unlinkedProvider).toBe('GOOGLE');
});
