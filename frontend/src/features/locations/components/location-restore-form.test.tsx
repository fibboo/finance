import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { expect, test, vi } from 'vitest';

import type { components } from '@/lib/api-schema';
import { render } from '@/test/render';
import { server } from '@/test/setup';

import { LocationRestoreForm } from './location-restore-form';

const oldMarket = {
  name: 'Old market',
  description: 'Closed in spring',
  user_id: '0b5c1f0e-1d7b-4a52-9f3a-2f1a6f0c8d11',
  id: '1d7b4a52-f0e1-4a52-9f3a-0b5c1f0e8d46',
  status: 'DELETED',
  created_at: '2026-10-01T09:00:00Z',
  updated_at: '2026-10-01T09:00:00Z',
} satisfies components['schemas']['Location'];

test('opens with the name of the location and the reason it was refused', () => {
  // act
  render(
    <LocationRestoreForm
      location={oldMarket}
      relatedQueryKeys={[]}
      onRestored={vi.fn()}
      onBack={vi.fn()}
    />,
  );

  // assert
  expect(screen.getByRole('form', { name: 'Restore location' })).toBeInTheDocument();
  const name = screen.getByRole('textbox', { name: 'Name' });
  expect(name).toHaveValue('Old market');
  expect(name).toHaveAccessibleDescription('An active location already has this name');
});

test('restores the location under the typed name', async () => {
  // arrange
  let restoreBody: unknown = null;
  const onRestored = vi.fn();
  server.use(
    http.post(
      `http://localhost/api/accounting/locations/${oldMarket.id}/restore`,
      async ({ request }) => {
        restoreBody = await request.json();
        return HttpResponse.json({
          ...oldMarket,
          name: 'Old market 2025',
          status: 'ACTIVE',
        } satisfies components['schemas']['Location']);
      },
    ),
  );
  const user = userEvent.setup();
  render(
    <LocationRestoreForm
      location={oldMarket}
      relatedQueryKeys={[]}
      onRestored={onRestored}
      onBack={vi.fn()}
    />,
  );
  const name = screen.getByRole('textbox', { name: 'Name' });
  await user.clear(name);
  await user.type(name, '  Old market 2025 ');

  // act
  await user.click(screen.getByRole('button', { name: 'Restore location' }));

  // assert
  await vi.waitFor(() => {
    expect(onRestored).toHaveBeenCalledOnce();
  });
  expect(restoreBody).toEqual({ name: 'Old market 2025' });
});

test('keeps the window open with the reason under the name when the new name is taken too', async () => {
  // arrange
  const onRestored = vi.fn();
  server.use(
    http.post(`http://localhost/api/accounting/locations/${oldMarket.id}/restore`, () =>
      HttpResponse.json(
        {
          error_code: 'NAME_ALREADY_EXISTS',
          message: 'Name already exists',
        } satisfies components['schemas']['ErrorResponse'],
        { status: 409 },
      ),
    ),
  );
  const user = userEvent.setup();
  render(
    <LocationRestoreForm
      location={oldMarket}
      relatedQueryKeys={[]}
      onRestored={onRestored}
      onBack={vi.fn()}
    />,
  );
  const name = screen.getByRole('textbox', { name: 'Name' });
  await user.clear(name);
  await user.type(name, 'Spar');

  // act
  await user.click(screen.getByRole('button', { name: 'Restore location' }));

  // assert
  await vi.waitFor(() => {
    expect(name).toHaveAccessibleDescription('An active location already has this name');
  });
  expect(onRestored).not.toHaveBeenCalled();
});
