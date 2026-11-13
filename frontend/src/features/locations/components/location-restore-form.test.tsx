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

test('opens with the name of the location and the reason an active location holds it', async () => {
  // arrange
  let lookupQuery = new URLSearchParams();
  server.use(
    http.get('http://localhost/api/accounting/locations', ({ request }) => {
      lookupQuery = new URL(request.url).searchParams;
      return HttpResponse.json({
        items: [{ ...oldMarket, id: '4a521d7b-f0e1-4a52-9f3a-0b5c1f0e8d47', status: 'ACTIVE' }],
        total: 1,
        page: 1,
        size: 100,
        pages: 1,
      } satisfies components['schemas']['Page_Location_']);
    }),
  );

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
  await vi.waitFor(() => {
    expect(name).toHaveAccessibleDescription('An active location already has this name');
  });
  expect(screen.getByRole('button', { name: 'Restore location' })).toBeDisabled();
  expect(lookupQuery.getAll('statuses')).toEqual(['ACTIVE']);
  expect(lookupQuery.get('search_term')).toBe('Old market');
});

test('drops the reason and allows the restore once a free name is typed', async () => {
  // arrange
  server.use(
    http.get('http://localhost/api/accounting/locations', ({ request }) => {
      const searchTerm = new URL(request.url).searchParams.get('search_term');
      const items =
        searchTerm === 'Old market'
          ? [
              {
                ...oldMarket,
                id: '4a521d7b-f0e1-4a52-9f3a-0b5c1f0e8d47',
                status: 'ACTIVE' as const,
              },
            ]
          : [];
      return HttpResponse.json({
        items,
        total: items.length,
        page: 1,
        size: 100,
        pages: 1,
      } satisfies components['schemas']['Page_Location_']);
    }),
  );
  const user = userEvent.setup();
  render(
    <LocationRestoreForm
      location={oldMarket}
      relatedQueryKeys={[]}
      onRestored={vi.fn()}
      onBack={vi.fn()}
    />,
  );
  const name = screen.getByRole('textbox', { name: 'Name' });
  await vi.waitFor(() => {
    expect(name).toHaveAccessibleDescription('An active location already has this name');
  });

  // act
  await user.type(name, ' 2025');

  // assert
  await vi.waitFor(() => {
    expect(screen.getByRole('button', { name: 'Restore location' })).toBeEnabled();
  });
  expect(name).not.toHaveAccessibleDescription();
});

test('restores the location under the typed name', async () => {
  // arrange
  let restoreBody: unknown = null;
  const onRestored = vi.fn();
  server.use(
    http.get('http://localhost/api/accounting/locations', () =>
      HttpResponse.json({
        items: [],
        total: 0,
        page: 1,
        size: 100,
        pages: 1,
      } satisfies components['schemas']['Page_Location_']),
    ),
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
  await vi.waitFor(() => {
    expect(screen.getByRole('button', { name: 'Restore location' })).toBeEnabled();
  });

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
    http.get('http://localhost/api/accounting/locations', () =>
      HttpResponse.json({
        items: [],
        total: 0,
        page: 1,
        size: 100,
        pages: 1,
      } satisfies components['schemas']['Page_Location_']),
    ),
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
  await vi.waitFor(() => {
    expect(screen.getByRole('button', { name: 'Restore location' })).toBeEnabled();
  });

  // act
  await user.click(screen.getByRole('button', { name: 'Restore location' }));

  // assert
  await vi.waitFor(() => {
    expect(name).toHaveAccessibleDescription('An active location already has this name');
  });
  expect(onRestored).not.toHaveBeenCalled();
});
