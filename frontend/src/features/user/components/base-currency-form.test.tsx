import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { expect, test, vi } from 'vitest';

import type { components } from '@/lib/api-schema';
import { render } from '@/test/render';
import { server } from '@/test/setup';

import { BaseCurrencyForm } from './base-currency-form';
import { UserInitials } from './user-initials';

const currencies = [
  { key: 'EUR', label: 'Euro' },
  { key: 'GEL', label: 'Georgian Lari' },
  { key: 'USD', label: 'US Dollar' },
];

test.each([
  { search: 'lari', shown: 'GEL Georgian Lari' },
  { search: ' usd ', shown: 'USD US Dollar' },
])('filters the currencies by "$search"', async ({ search, shown }) => {
  // arrange
  server.use(
    http.get('http://localhost/api/user/me', () =>
      HttpResponse.json({
        id: '0b5c1f0e-1d7b-4a52-9f3a-2f1a6f0c8d11',
        username: 'nikita',
        avatar: null,
        registration_provider: 'GOOGLE',
        base_currency: null,
        external_users: [],
      } satisfies components['schemas']['User']),
    ),
  );
  const user = userEvent.setup();
  render(<BaseCurrencyForm currencies={currencies} copy={null} />);

  // act
  await user.type(await screen.findByRole('searchbox', { name: 'Search currency' }), search);

  // assert
  expect(screen.getAllByRole('radio')).toHaveLength(1);
  expect(screen.getByRole('radio', { name: shown })).toBeInTheDocument();
});

test('says when no currency matches the search', async () => {
  // arrange
  server.use(
    http.get('http://localhost/api/user/me', () =>
      HttpResponse.json({
        id: '0b5c1f0e-1d7b-4a52-9f3a-2f1a6f0c8d11',
        username: 'nikita',
        avatar: null,
        registration_provider: 'GOOGLE',
        base_currency: null,
        external_users: [],
      } satisfies components['schemas']['User']),
    ),
  );
  const user = userEvent.setup();
  render(<BaseCurrencyForm currencies={currencies} copy={null} />);

  // act
  await user.type(await screen.findByRole('searchbox', { name: 'Search currency' }), 'yen');

  // assert
  expect(screen.queryAllByRole('radio')).toHaveLength(0);
  expect(screen.getByText('No currency matches the search.')).toBeInTheDocument();
});

test('keeps the given username and sets the picked currency', async () => {
  // arrange
  const requestPaths: string[] = [];
  const requestBodies: unknown[] = [];
  let userRequestCount = 0;
  server.use(
    http.put('http://localhost/api/user/me/base_currency', async ({ request }) => {
      requestPaths.push(new URL(request.url).pathname);
      requestBodies.push(await request.json());
      return HttpResponse.json({
        id: '0b5c1f0e-1d7b-4a52-9f3a-2f1a6f0c8d11',
        username: 'Nikita Ionov',
        avatar: null,
        registration_provider: 'GOOGLE',
        base_currency: 'GEL',
        external_users: [],
      } satisfies components['schemas']['User']);
    }),
    http.put('http://localhost/api/user/me/username', ({ request }) => {
      requestPaths.push(new URL(request.url).pathname);
      return HttpResponse.json(null, { status: 500 });
    }),
    http.get('http://localhost/api/user/me', () => {
      userRequestCount += 1;
      return HttpResponse.json({
        id: '0b5c1f0e-1d7b-4a52-9f3a-2f1a6f0c8d11',
        username: 'Nikita Ionov',
        avatar: null,
        registration_provider: 'GOOGLE',
        base_currency: userRequestCount > 1 ? 'GEL' : null,
        external_users: [],
      } satisfies components['schemas']['User']);
    }),
  );
  const user = userEvent.setup();
  render(
    <>
      <UserInitials />
      <BaseCurrencyForm currencies={currencies} copy={null} />
    </>,
  );
  await user.click(await screen.findByRole('radio', { name: 'GEL Georgian Lari' }));

  // act
  await user.click(screen.getByRole('button', { name: 'Start with GEL' }));

  // assert
  await vi.waitFor(() => {
    expect(userRequestCount).toBe(2);
  });
  expect(requestPaths).toEqual(['/api/user/me/base_currency']);
  expect(requestBodies).toEqual([{ base_currency: 'GEL' }]);
});

test('sets a changed username before the base currency', async () => {
  // arrange
  const requests: unknown[] = [];
  server.use(
    http.put('http://localhost/api/user/me/username', async ({ request }) => {
      requests.push({ username: await request.json() });
      return HttpResponse.json({
        id: '0b5c1f0e-1d7b-4a52-9f3a-2f1a6f0c8d11',
        username: 'fibbo',
        avatar: null,
        registration_provider: 'GOOGLE',
        base_currency: null,
        external_users: [],
      } satisfies components['schemas']['User']);
    }),
    http.put('http://localhost/api/user/me/base_currency', async ({ request }) => {
      requests.push({ base_currency: await request.json() });
      return HttpResponse.json({
        id: '0b5c1f0e-1d7b-4a52-9f3a-2f1a6f0c8d11',
        username: 'fibbo',
        avatar: null,
        registration_provider: 'GOOGLE',
        base_currency: 'EUR',
        external_users: [],
      } satisfies components['schemas']['User']);
    }),
    http.get('http://localhost/api/user/me', () =>
      HttpResponse.json({
        id: '0b5c1f0e-1d7b-4a52-9f3a-2f1a6f0c8d11',
        username: requests.length > 0 ? 'fibbo' : 'nikita',
        avatar: null,
        registration_provider: 'GOOGLE',
        base_currency: requests.length > 1 ? 'EUR' : null,
        external_users: [],
      } satisfies components['schemas']['User']),
    ),
  );
  const user = userEvent.setup();
  render(<BaseCurrencyForm currencies={currencies} copy={null} />);
  const username = await screen.findByRole('textbox', { name: 'Username' });
  await user.clear(username);
  await user.type(username, ' fibbo ');
  await user.click(screen.getByRole('radio', { name: 'EUR Euro' }));

  // act
  await user.click(screen.getByRole('button', { name: 'Start with EUR' }));

  // assert
  await vi.waitFor(() => {
    expect(requests).toEqual([
      { username: { username: 'fibbo' } },
      { base_currency: { base_currency: 'EUR' } },
    ]);
  });
});

test('stops at a taken username without setting the base currency', async () => {
  // arrange
  let baseCurrencyRequestCount = 0;
  server.use(
    http.get('http://localhost/api/user/me', () =>
      HttpResponse.json({
        id: '0b5c1f0e-1d7b-4a52-9f3a-2f1a6f0c8d11',
        username: 'nikita',
        avatar: null,
        registration_provider: 'GOOGLE',
        base_currency: null,
        external_users: [],
      } satisfies components['schemas']['User']),
    ),
    http.put('http://localhost/api/user/me/username', () =>
      HttpResponse.json(
        {
          message: 'Username is already taken',
          error_code: 'USERNAME_ALREADY_TAKEN',
        } satisfies components['schemas']['ErrorResponse'],
        { status: 409 },
      ),
    ),
    http.put('http://localhost/api/user/me/base_currency', () => {
      baseCurrencyRequestCount += 1;
      return HttpResponse.json(null, { status: 500 });
    }),
  );
  const user = userEvent.setup();
  render(<BaseCurrencyForm currencies={currencies} copy={null} />);
  const username = await screen.findByRole('textbox', { name: 'Username' });
  await user.clear(username);
  await user.type(username, 'anna');
  await user.click(screen.getByRole('radio', { name: 'EUR Euro' }));

  // act
  await user.click(screen.getByRole('button', { name: 'Start with EUR' }));

  // assert
  expect(await screen.findByText('Username is already taken')).toBeInTheDocument();
  expect(screen.getByRole('textbox', { name: 'Username' })).toHaveAttribute('aria-invalid', 'true');
  expect(baseCurrencyRequestCount).toBe(0);
  expect(screen.queryByText('Something went wrong. Please try again.')).not.toBeInTheDocument();
});

test('asks for a valid username before sending anything', async () => {
  // arrange
  server.use(
    http.get('http://localhost/api/user/me', () =>
      HttpResponse.json({
        id: '0b5c1f0e-1d7b-4a52-9f3a-2f1a6f0c8d11',
        username: 'nikita',
        avatar: null,
        registration_provider: 'GOOGLE',
        base_currency: null,
        external_users: [],
      } satisfies components['schemas']['User']),
    ),
  );
  const user = userEvent.setup();
  render(<BaseCurrencyForm currencies={currencies} copy={null} />);
  const username = await screen.findByRole('textbox', { name: 'Username' });
  await user.clear(username);
  await user.type(username, 'ni kita');
  await user.click(screen.getByRole('radio', { name: 'EUR Euro' }));

  // act
  await user.click(screen.getByRole('button', { name: 'Start with EUR' }));

  // assert
  expect(
    await screen.findByText('Use 3–32 letters, digits, dots, underscores or hyphens.'),
  ).toBeInTheDocument();
});

test('asks for a currency before sending anything', async () => {
  // arrange
  server.use(
    http.get('http://localhost/api/user/me', () =>
      HttpResponse.json({
        id: '0b5c1f0e-1d7b-4a52-9f3a-2f1a6f0c8d11',
        username: 'nikita',
        avatar: null,
        registration_provider: 'GOOGLE',
        base_currency: null,
        external_users: [],
      } satisfies components['schemas']['User']),
    ),
  );
  const user = userEvent.setup();
  render(<BaseCurrencyForm currencies={currencies} copy={null} />);

  // act
  await user.click(await screen.findByRole('button', { name: 'Start' }));

  // assert
  expect(await screen.findByText('Pick your base currency.')).toBeInTheDocument();
});

test('shows the field error the backend returns', async () => {
  // arrange
  server.use(
    http.get('http://localhost/api/user/me', () =>
      HttpResponse.json({
        id: '0b5c1f0e-1d7b-4a52-9f3a-2f1a6f0c8d11',
        username: 'nikita',
        avatar: null,
        registration_provider: 'GOOGLE',
        base_currency: null,
        external_users: [],
      } satisfies components['schemas']['User']),
    ),
    http.put('http://localhost/api/user/me/base_currency', () =>
      HttpResponse.json(
        {
          detail: [
            {
              loc: ['body', 'base_currency'],
              msg: "String should match pattern '^[A-Z]{3}$'",
              type: 'string_pattern_mismatch',
            },
          ],
        },
        { status: 422 },
      ),
    ),
  );
  const user = userEvent.setup();
  render(<BaseCurrencyForm currencies={currencies} copy={null} />);
  await user.click(await screen.findByRole('radio', { name: 'EUR Euro' }));

  // act
  await user.click(screen.getByRole('button', { name: 'Start with EUR' }));

  // assert
  expect(await screen.findByText("String should match pattern '^[A-Z]{3}$'")).toBeInTheDocument();
  expect(screen.queryByText('Something went wrong. Please try again.')).not.toBeInTheDocument();
});

test('shows a field error the form has no field for', async () => {
  // arrange
  server.use(
    http.get('http://localhost/api/user/me', () =>
      HttpResponse.json({
        id: '0b5c1f0e-1d7b-4a52-9f3a-2f1a6f0c8d11',
        username: 'nikita',
        avatar: null,
        registration_provider: 'GOOGLE',
        base_currency: null,
        external_users: [],
      } satisfies components['schemas']['User']),
    ),
    http.put('http://localhost/api/user/me/base_currency', () =>
      HttpResponse.json(
        { detail: [{ loc: ['body'], msg: 'Field required', type: 'missing' }] },
        { status: 422 },
      ),
    ),
  );
  const user = userEvent.setup();
  render(<BaseCurrencyForm currencies={currencies} copy={null} />);
  await user.click(await screen.findByRole('radio', { name: 'EUR Euro' }));

  // act
  await user.click(screen.getByRole('button', { name: 'Start with EUR' }));

  // assert
  expect(await screen.findByText('Field required')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Start with EUR' })).toBeEnabled();
});
