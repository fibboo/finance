import { screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { Link, Route, Routes } from 'react-router';
import { afterEach, beforeEach, expect, test } from 'vitest';

import { refreshSession, startSession } from '@/features/auth/api/session';
import { RequireSession } from '@/features/auth/components/require-session';
import { UserSummary } from '@/features/user/components/user-summary';
import type { components } from '@/lib/api-schema';
import { render } from '@/test/render';
import { server } from '@/test/setup';

let otherTab = new BroadcastChannel('finance-session');

beforeEach(() => {
  otherTab = new BroadcastChannel('finance-session');
  // each access token belongs to another user, so the name shows whose data is on screen
  server.use(
    http.get('http://localhost/api/user/me', ({ request }) =>
      HttpResponse.json({
        id: '0b5c1f0e-1d7b-4a52-9f3a-2f1a6f0c8d11',
        username: request.headers.get('Authorization') === 'Bearer access-1' ? 'nikita' : 'anna',
        avatar: null,
        registration_provider: 'TELEGRAM',
        base_currency: 'EUR',
        external_users: [],
      } satisfies components['schemas']['User']),
    ),
  );
});

afterEach(() => {
  otherTab.close();
});

test('shows no data of the previous user after the refresh answers 401', async () => {
  // arrange
  const user = userEvent.setup();
  server.use(
    http.post('http://localhost/api/user/auth/token', () =>
      HttpResponse.json({ message: 'Invalid token', error_code: 'INVALID_TOKEN' }, { status: 401 }),
    ),
  );
  startSession('access-1');
  render(
    <Routes>
      <Route path="/sign-in" element={<Link to="/">Continue</Link>} />
      <Route element={<RequireSession />}>
        <Route index element={<UserSummary providerTypes={[]} />} />
      </Route>
    </Routes>,
  );
  expect(await screen.findByText('nikita')).toBeInTheDocument();

  // act
  await refreshSession('access-1');
  const continueLink = await screen.findByRole('link', { name: 'Continue' });
  startSession('access-2');
  await user.click(continueLink);

  // assert
  expect(await screen.findByText('anna')).toBeInTheDocument();
  expect(screen.queryByText('nikita')).not.toBeInTheDocument();
});

test('shows no data of the previous user after another tab signs out', async () => {
  // arrange
  const user = userEvent.setup();
  startSession('access-1');
  render(
    <Routes>
      <Route path="/sign-in" element={<Link to="/">Continue</Link>} />
      <Route element={<RequireSession />}>
        <Route index element={<UserSummary providerTypes={[]} />} />
      </Route>
    </Routes>,
  );
  expect(await screen.findByText('nikita')).toBeInTheDocument();

  // act
  otherTab.postMessage({ type: 'signed-out' });
  const continueLink = await screen.findByRole('link', { name: 'Continue' });
  startSession('access-2');
  await user.click(continueLink);

  // assert
  expect(await screen.findByText('anna')).toBeInTheDocument();
  expect(screen.queryByText('nikita')).not.toBeInTheDocument();
});

test('shows no data of the previous user after another tab signs in as another user', async () => {
  // arrange
  startSession('access-1');
  render(
    <Routes>
      <Route element={<RequireSession />}>
        <Route index element={<UserSummary providerTypes={[]} />} />
      </Route>
    </Routes>,
  );
  expect(await screen.findByText('nikita')).toBeInTheDocument();

  // act
  otherTab.postMessage({ type: 'signed-in', access_token: 'access-2' });

  // assert
  expect(await screen.findByText('anna')).toBeInTheDocument();
  expect(screen.queryByText('nikita')).not.toBeInTheDocument();
});
