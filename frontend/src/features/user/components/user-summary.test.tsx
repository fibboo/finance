import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { expect, test } from 'vitest';

import type { components } from '@/lib/api-schema';
import { render } from '@/test/render';
import { server } from '@/test/setup';

import { UserSummary } from './user-summary';

test('shows the initials, the name and the sign-in provider', async () => {
  // arrange
  server.use(
    http.get('http://localhost/api/user/me', () =>
      HttpResponse.json({
        id: '0b5c1f0e-1d7b-4a52-9f3a-2f1a6f0c8d11',
        username: 'nikita',
        avatar: null,
        registration_provider: 'TELEGRAM',
        base_currency: 'EUR',
        external_users: [],
      } satisfies components['schemas']['User']),
    ),
  );

  // act
  render(<UserSummary providerTypes={[{ key: 'TELEGRAM', label: 'Telegram' }]} />);

  // assert
  expect(await screen.findByText('nikita')).toBeInTheDocument();
  expect(screen.getByText('Signed in with Telegram')).toBeInTheDocument();
  expect(await screen.findByText('NI')).toBeInTheDocument();
});

test('opens the username form with the current name in focus', async () => {
  // arrange
  server.use(
    http.get('http://localhost/api/user/me', () =>
      HttpResponse.json({
        id: '0b5c1f0e-1d7b-4a52-9f3a-2f1a6f0c8d11',
        username: 'nikita',
        avatar: null,
        registration_provider: 'TELEGRAM',
        base_currency: 'EUR',
        external_users: [],
      } satisfies components['schemas']['User']),
    ),
  );
  const user = userEvent.setup();
  render(<UserSummary providerTypes={[{ key: 'TELEGRAM', label: 'Telegram' }]} />);

  // act
  await user.click(await screen.findByRole('button', { name: 'Change username' }));

  // assert
  expect(screen.getByRole('textbox', { name: 'Username' })).toHaveValue('nikita');
  expect(screen.getByRole('textbox', { name: 'Username' })).toHaveFocus();
  expect(
    screen.getByText('3–32 letters, digits, dots, underscores or hyphens.'),
  ).toBeInTheDocument();
});

test('shows the new name and returns focus after saving', async () => {
  // arrange
  let username = 'nikita';
  server.use(
    http.get('http://localhost/api/user/me', () =>
      HttpResponse.json({
        id: '0b5c1f0e-1d7b-4a52-9f3a-2f1a6f0c8d11',
        username,
        avatar: null,
        registration_provider: 'TELEGRAM',
        base_currency: 'EUR',
        external_users: [],
      } satisfies components['schemas']['User']),
    ),
    http.put('http://localhost/api/user/me/username', () => {
      username = 'fibbo';
      return HttpResponse.json({
        id: '0b5c1f0e-1d7b-4a52-9f3a-2f1a6f0c8d11',
        username,
        avatar: null,
        registration_provider: 'TELEGRAM',
        base_currency: 'EUR',
        external_users: [],
      } satisfies components['schemas']['User']);
    }),
  );
  const user = userEvent.setup();
  render(<UserSummary providerTypes={[{ key: 'TELEGRAM', label: 'Telegram' }]} />);
  await user.click(await screen.findByRole('button', { name: 'Change username' }));
  await user.clear(screen.getByRole('textbox', { name: 'Username' }));
  await user.type(screen.getByRole('textbox', { name: 'Username' }), 'fibbo');

  // act
  await user.click(screen.getByRole('button', { name: 'Save' }));

  // assert
  expect(await screen.findByText('fibbo')).toBeInTheDocument();
  expect(screen.queryByRole('textbox', { name: 'Username' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Change username' })).toHaveFocus();
});

test('keeps the name and returns focus on cancel', async () => {
  // arrange
  server.use(
    http.get('http://localhost/api/user/me', () =>
      HttpResponse.json({
        id: '0b5c1f0e-1d7b-4a52-9f3a-2f1a6f0c8d11',
        username: 'nikita',
        avatar: null,
        registration_provider: 'TELEGRAM',
        base_currency: 'EUR',
        external_users: [],
      } satisfies components['schemas']['User']),
    ),
  );
  const user = userEvent.setup();
  render(<UserSummary providerTypes={[{ key: 'TELEGRAM', label: 'Telegram' }]} />);
  await user.click(await screen.findByRole('button', { name: 'Change username' }));
  await user.type(screen.getByRole('textbox', { name: 'Username' }), '-new');

  // act
  await user.click(screen.getByRole('button', { name: 'Cancel' }));

  // assert
  expect(screen.getByText('nikita')).toBeInTheDocument();
  expect(screen.queryByRole('textbox', { name: 'Username' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Change username' })).toHaveFocus();
});
