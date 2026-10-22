import { screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { Route, Routes } from 'react-router';
import { expect, test } from 'vitest';

import { startSession } from '@/features/auth/api/session';
import { RequireSession } from '@/features/auth/components/require-session';
import type { components } from '@/lib/api-schema';
import { render } from '@/test/render';
import { server } from '@/test/setup';

import { Component as Onboarding } from './onboarding';

test('offers the currencies of the accounting dictionary', async () => {
  // arrange
  server.use(
    http.get('http://localhost/api/dictionaries/accounting', () =>
      HttpResponse.json({
        currencies: [
          { key: 'EUR', label: 'Euro' },
          { key: 'USD', label: 'US Dollar' },
        ],
        account_kinds: [],
        category_types: [],
      } satisfies components['schemas']['AccountingDictionaries']),
    ),
  );

  // act
  render(<Onboarding />);

  // assert
  expect(
    await screen.findByRole('heading', { name: 'Pick your base currency' }),
  ).toBeInTheDocument();
  expect(screen.getByRole('radio', { name: 'EUR Euro' })).toBeInTheDocument();
  expect(screen.getByRole('radio', { name: 'USD US Dollar' })).toBeInTheDocument();
});

test('signs out and leaves for sign-in', async () => {
  // arrange
  const user = userEvent.setup();
  server.use(
    http.get('http://localhost/api/dictionaries/accounting', () =>
      HttpResponse.json({
        currencies: [{ key: 'EUR', label: 'Euro' }],
        account_kinds: [],
        category_types: [],
      } satisfies components['schemas']['AccountingDictionaries']),
    ),
    http.post('http://localhost/api/user/auth/revoke', () => HttpResponse.json(null)),
  );
  startSession('access-1');
  render(
    <Routes>
      <Route path="/sign-in" element={<h1>Sign in</h1>} />
      <Route element={<RequireSession />}>
        <Route index element={<Onboarding />} />
      </Route>
    </Routes>,
  );

  // act
  await user.click(await screen.findByRole('button', { name: 'Sign out' }));

  // assert
  expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
});
