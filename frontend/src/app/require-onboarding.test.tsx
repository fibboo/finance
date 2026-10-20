import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { Link, Route, Routes } from 'react-router';
import { expect, test } from 'vitest';

import type { components } from '@/lib/api-schema';
import { render } from '@/test/render';
import { server } from '@/test/setup';

import { RequireOnboarding } from './require-onboarding';

const routes = (
  <Routes>
    <Route element={<RequireOnboarding />}>
      <Route path="/onboarding" element={<h1>Onboarding</h1>} />
      <Route
        index
        element={
          <>
            <h1>Home</h1>
            <Link to="/onboarding">Open onboarding</Link>
          </>
        }
      />
    </Route>
  </Routes>
);

test('sends a user without a base currency to onboarding', async () => {
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

  // act
  render(routes);

  // assert
  expect(await screen.findByRole('heading', { name: 'Onboarding' })).toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: 'Home' })).not.toBeInTheDocument();
});

test('shows the screen to a user with a base currency', async () => {
  // arrange
  server.use(
    http.get('http://localhost/api/user/me', () =>
      HttpResponse.json({
        id: '0b5c1f0e-1d7b-4a52-9f3a-2f1a6f0c8d11',
        username: 'nikita',
        avatar: null,
        registration_provider: 'GOOGLE',
        base_currency: 'USD',
        external_users: [],
      } satisfies components['schemas']['User']),
    ),
  );

  // act
  render(routes);

  // assert
  expect(await screen.findByRole('heading', { name: 'Home' })).toBeInTheDocument();
});

test('sends a user with a base currency away from onboarding', async () => {
  // arrange
  server.use(
    http.get('http://localhost/api/user/me', () =>
      HttpResponse.json({
        id: '0b5c1f0e-1d7b-4a52-9f3a-2f1a6f0c8d11',
        username: 'nikita',
        avatar: null,
        registration_provider: 'GOOGLE',
        base_currency: 'USD',
        external_users: [],
      } satisfies components['schemas']['User']),
    ),
  );
  const user = userEvent.setup();
  render(routes);

  // act
  await user.click(await screen.findByRole('link', { name: 'Open onboarding' }));

  // assert
  expect(await screen.findByRole('heading', { name: 'Home' })).toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: 'Onboarding' })).not.toBeInTheDocument();
});
