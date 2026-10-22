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
  const user = userEvent.setup();
  render(<BaseCurrencyForm currencies={currencies} note={null} />);

  // act
  await user.type(screen.getByRole('searchbox', { name: 'Search currency' }), search);

  // assert
  expect(screen.getAllByRole('radio')).toHaveLength(1);
  expect(screen.getByRole('radio', { name: shown })).toBeInTheDocument();
});

test('says when no currency matches the search', async () => {
  // arrange
  const user = userEvent.setup();
  render(<BaseCurrencyForm currencies={currencies} note={null} />);

  // act
  await user.type(screen.getByRole('searchbox', { name: 'Search currency' }), 'yen');

  // assert
  expect(screen.queryAllByRole('radio')).toHaveLength(0);
  expect(screen.getByText('No currency matches the search.')).toBeInTheDocument();
});

test('sets the picked currency and reloads the user', async () => {
  // arrange
  const requestBodies: unknown[] = [];
  let userRequestCount = 0;
  server.use(
    http.put('http://localhost/api/user/me/base_currency', async ({ request }) => {
      requestBodies.push(await request.json());
      return HttpResponse.json({
        id: '0b5c1f0e-1d7b-4a52-9f3a-2f1a6f0c8d11',
        username: 'nikita',
        avatar: null,
        registration_provider: 'GOOGLE',
        base_currency: 'GEL',
        external_users: [],
      } satisfies components['schemas']['User']);
    }),
    http.get('http://localhost/api/user/me', () => {
      userRequestCount += 1;
      return HttpResponse.json({
        id: '0b5c1f0e-1d7b-4a52-9f3a-2f1a6f0c8d11',
        username: 'nikita',
        avatar: null,
        registration_provider: 'GOOGLE',
        base_currency: 'GEL',
        external_users: [],
      } satisfies components['schemas']['User']);
    }),
  );
  const user = userEvent.setup();
  render(
    <>
      <UserInitials />
      <BaseCurrencyForm currencies={currencies} note={null} />
    </>,
  );
  await screen.findByText('NI');
  await user.click(screen.getByRole('radio', { name: 'GEL Georgian Lari' }));

  // act
  await user.click(screen.getByRole('button', { name: 'Start with GEL' }));

  // assert
  await vi.waitFor(() => {
    expect(userRequestCount).toBe(2);
  });
  expect(requestBodies).toEqual([{ base_currency: 'GEL' }]);
});

test('asks for a currency before sending anything', async () => {
  // arrange
  const user = userEvent.setup();
  render(<BaseCurrencyForm currencies={currencies} note={null} />);

  // act
  await user.click(screen.getByRole('button', { name: 'Start' }));

  // assert
  expect(await screen.findByText('Pick your base currency.')).toBeInTheDocument();
});

test('shows the field error the backend returns', async () => {
  // arrange
  server.use(
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
  render(<BaseCurrencyForm currencies={currencies} note={null} />);
  await user.click(screen.getByRole('radio', { name: 'EUR Euro' }));

  // act
  await user.click(screen.getByRole('button', { name: 'Start with EUR' }));

  // assert
  expect(await screen.findByText("String should match pattern '^[A-Z]{3}$'")).toBeInTheDocument();
  expect(screen.queryByText('Something went wrong. Please try again.')).not.toBeInTheDocument();
});

test('shows a field error the form has no field for', async () => {
  // arrange
  server.use(
    http.put('http://localhost/api/user/me/base_currency', () =>
      HttpResponse.json(
        { detail: [{ loc: ['body'], msg: 'Field required', type: 'missing' }] },
        { status: 422 },
      ),
    ),
  );
  const user = userEvent.setup();
  render(<BaseCurrencyForm currencies={currencies} note={null} />);
  await user.click(screen.getByRole('radio', { name: 'EUR Euro' }));

  // act
  await user.click(screen.getByRole('button', { name: 'Start with EUR' }));

  // assert
  expect(await screen.findByText('Field required')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Start with EUR' })).toBeEnabled();
});
