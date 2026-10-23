import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { expect, test, vi } from 'vitest';

import type { components } from '@/lib/api-schema';
import { render } from '@/test/render';
import { server } from '@/test/setup';

import { UsernameForm } from './username-form';

test('sets the trimmed username', async () => {
  // arrange
  const requestBodies: unknown[] = [];
  server.use(
    http.put('http://localhost/api/user/me/username', async ({ request }) => {
      requestBodies.push(await request.json());
      return HttpResponse.json({
        id: '0b5c1f0e-1d7b-4a52-9f3a-2f1a6f0c8d11',
        username: 'fibbo',
        avatar: null,
        registration_provider: 'TELEGRAM',
        base_currency: 'EUR',
        external_users: [],
      } satisfies components['schemas']['User']);
    }),
  );
  const user = userEvent.setup();
  render(<UsernameForm username="nikita" onClose={() => undefined} />);
  const username = screen.getByRole('textbox', { name: 'Username' });
  await user.clear(username);
  await user.type(username, ' fibbo ');

  // act
  await user.click(screen.getByRole('button', { name: 'Save' }));

  // assert
  await vi.waitFor(() => {
    expect(requestBodies).toEqual([{ username: 'fibbo' }]);
  });
});

test('shows a taken username at the field without a notification', async () => {
  // arrange
  server.use(
    http.put('http://localhost/api/user/me/username', () =>
      HttpResponse.json(
        {
          message: 'Username is already taken',
          error_code: 'USERNAME_ALREADY_TAKEN',
        } satisfies components['schemas']['ErrorResponse'],
        { status: 409 },
      ),
    ),
  );
  const user = userEvent.setup();
  render(<UsernameForm username="nikita" onClose={() => undefined} />);
  const username = screen.getByRole('textbox', { name: 'Username' });
  await user.clear(username);
  await user.type(username, 'anna');

  // act
  await user.click(screen.getByRole('button', { name: 'Save' }));

  // assert
  expect(await screen.findByText('Username is already taken')).toBeInTheDocument();
  expect(screen.getByRole('textbox', { name: 'Username' })).toHaveAttribute('aria-invalid', 'true');
  expect(screen.queryByText('Something went wrong. Please try again.')).not.toBeInTheDocument();
});

test.each(['ni', 'ni kita', 'nikita!', 'a'.repeat(33)])(
  'refuses "%s" before sending anything',
  async (newUsername) => {
    // arrange
    let requestCount = 0;
    server.use(
      http.put('http://localhost/api/user/me/username', () => {
        requestCount += 1;
        return HttpResponse.json(null, { status: 500 });
      }),
    );
    const user = userEvent.setup();
    render(<UsernameForm username="nikita" onClose={() => undefined} />);
    const username = screen.getByRole('textbox', { name: 'Username' });
    await user.clear(username);
    await user.type(username, newUsername);

    // act
    await user.click(screen.getByRole('button', { name: 'Save' }));

    // assert
    expect(
      await screen.findByText('Use 3–32 letters, digits, dots, underscores or hyphens.'),
    ).toBeInTheDocument();
    expect(requestCount).toBe(0);
  },
);
