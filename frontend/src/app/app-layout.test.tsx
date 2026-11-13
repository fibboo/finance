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

test.each([
  { action: 'opens', closeWith: null },
  { action: 'returns focus after closing', closeWith: '{Escape}' },
])('$action the new transaction form from the add button', async ({ closeWith }) => {
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
        provider_types: [{ key: 'GOOGLE', label: 'Google' }],
      } satisfies components['schemas']['UserDictionaries']),
    ),
    http.get('http://localhost/api/dictionaries/accounting', () =>
      HttpResponse.json({
        currencies: [],
        account_kinds: [],
        category_types: [],
        transaction_types: [
          { key: 'EXPENSE', label: 'Expense' },
          { key: 'ADJUSTMENT', label: 'Adjustment' },
        ],
        transaction_orders: [],
      } satisfies components['schemas']['AccountingDictionaries']),
    ),
    http.get('http://localhost/api/accounting/currencies', () =>
      HttpResponse.json([] satisfies components['schemas']['DictionaryItem'][]),
    ),
    http.get('http://localhost/api/accounting/accounts', () =>
      HttpResponse.json({
        items: [],
        total: 0,
        page: 1,
        size: 100,
        pages: 0,
      } satisfies components['schemas']['Page_Account_']),
    ),
    http.get('http://localhost/api/accounting/locations', () =>
      HttpResponse.json({
        items: [],
        total: 0,
        page: 1,
        size: 100,
        pages: 0,
      } satisfies components['schemas']['Page_Location_']),
    ),
  );
  const user = userEvent.setup();
  render(<AppLayout />);

  await user.click(screen.getByRole('button', { name: 'Add transaction' }));
  await screen.findByRole('radio', { name: 'Expense' });

  // act
  if (closeWith !== null) {
    await user.keyboard(closeWith);
  }

  // assert
  if (closeWith === null) {
    expect(screen.getByRole('radio', { name: 'Expense' })).toBeChecked();
  } else {
    expect(screen.getByRole('button', { name: 'Add transaction' })).toHaveFocus();
  }
});

test('collapses the menu to icons and shows it again', async () => {
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
        provider_types: [{ key: 'GOOGLE', label: 'Google' }],
      } satisfies components['schemas']['UserDictionaries']),
    ),
  );
  const user = userEvent.setup();
  render(<AppLayout />);
  await user.click(screen.getByRole('button', { name: 'Collapse' }));

  // act
  await user.click(screen.getByRole('button', { name: 'Show the full menu' }));

  // assert
  expect(screen.getByRole('button', { name: 'Collapse' })).toBeInTheDocument();
});

test('keeps the menu collapsed by hand on the next visit', async () => {
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
        provider_types: [{ key: 'GOOGLE', label: 'Google' }],
      } satisfies components['schemas']['UserDictionaries']),
    ),
  );
  const user = userEvent.setup();
  const { unmount } = render(<AppLayout />);
  await user.click(screen.getByRole('button', { name: 'Collapse' }));
  unmount();

  // act
  render(<AppLayout />);

  // assert
  expect(screen.getByRole('button', { name: 'Show the full menu' })).toBeInTheDocument();
});

test.each([
  { innerWidth: 1024, toggleName: 'Show the full menu' },
  { innerWidth: 1600, toggleName: 'Collapse' },
])(
  'shows $toggleName at $innerWidth px on a route that asks for 90rem beside the full menu',
  ({ innerWidth, toggleName }) => {
    // arrange
    vi.stubGlobal('innerWidth', innerWidth);
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
          provider_types: [{ key: 'GOOGLE', label: 'Google' }],
        } satisfies components['schemas']['UserDictionaries']),
      ),
    );

    // act
    render(<AppLayout />, { handle: { fullMenuMinWidth: '90rem' } });

    // assert
    expect(screen.getByRole('button', { name: toggleName })).toBeInTheDocument();
  },
);

test.each([
  { closeWith: 'Collapse' },
  { closeWith: 'Escape' },
  { closeWith: 'a click outside' },
  { closeWith: 'Transactions' },
])('closes the full menu opened over the page on $closeWith', async ({ closeWith }) => {
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
        provider_types: [{ key: 'GOOGLE', label: 'Google' }],
      } satisfies components['schemas']['UserDictionaries']),
    ),
  );
  const user = userEvent.setup();
  render(<AppLayout />, { handle: { fullMenuMinWidth: '90rem' } });
  await user.click(screen.getByRole('button', { name: 'Show the full menu' }));

  // act
  if (closeWith === 'Collapse') {
    await user.click(screen.getByRole('button', { name: 'Collapse' }));
  } else if (closeWith === 'Escape') {
    await user.keyboard('{Escape}');
  } else if (closeWith === 'a click outside') {
    await user.click(screen.getByRole('main'));
  } else {
    await user.click(screen.getByRole('link', { name: 'Transactions' }));
  }

  // assert
  expect(screen.getByRole('button', { name: 'Show the full menu' })).toBeInTheDocument();
});

test('keeps the full menu on a wide screen after it was opened over the page', async () => {
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
        provider_types: [{ key: 'GOOGLE', label: 'Google' }],
      } satisfies components['schemas']['UserDictionaries']),
    ),
  );
  const user = userEvent.setup();
  const { unmount } = render(<AppLayout />, { handle: { fullMenuMinWidth: '90rem' } });
  await user.click(screen.getByRole('button', { name: 'Show the full menu' }));
  unmount();
  vi.stubGlobal('innerWidth', 1600);

  // act
  render(<AppLayout />, { handle: { fullMenuMinWidth: '90rem' } });

  // assert
  expect(screen.getByRole('button', { name: 'Collapse' })).toBeInTheDocument();
});
