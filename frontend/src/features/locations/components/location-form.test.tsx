import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { expect, test, vi } from 'vitest';

import type { components } from '@/lib/api-schema';
import { render } from '@/test/render';
import { server } from '@/test/setup';

import { LocationForm } from './location-form';

const carrefour = {
  name: 'Carrefour',
  description: 'abc',
  user_id: '0b5c1f0e-1d7b-4a52-9f3a-2f1a6f0c8d11',
  id: '2b4f9e0f-1a2b-4e6a-8c7d-5a1d9c3e3c41',
  status: 'ACTIVE',
  created_at: '2026-10-01T09:00:00Z',
  updated_at: '2026-10-01T09:00:00Z',
} satisfies components['schemas']['Location'];

test('opens with the name in focus', () => {
  // act
  render(
    <LocationForm
      mode={{ kind: 'create', name: 'Carrefour', onCreated: vi.fn() }}
      onBack={vi.fn()}
    />,
  );

  // assert
  expect(screen.getByRole('textbox', { name: 'Name' })).toHaveFocus();
});

test.each([
  { length: 32, createdCount: 1, error: '' },
  { length: 33, createdCount: 0, error: 'Write at most 32 characters' },
])(
  'creates the location only with a name of 32 characters or fewer: $length',
  async ({ length, createdCount, error }) => {
    // arrange
    let requestCount = 0;
    server.use(
      http.post('http://localhost/api/accounting/locations', () => {
        requestCount += 1;
        return HttpResponse.json(carrefour satisfies components['schemas']['Location'], {
          status: 201,
        });
      }),
    );
    const onCreated = vi.fn();
    const user = userEvent.setup();
    render(
      <LocationForm
        mode={{ kind: 'create', name: 'a'.repeat(length), onCreated: onCreated }}
        onBack={vi.fn()}
      />,
    );

    // act
    await user.click(screen.getByRole('button', { name: 'Create location' }));

    // assert
    await vi.waitFor(() => {
      expect(onCreated).toHaveBeenCalledTimes(createdCount);
      expect(screen.getByRole('textbox', { name: 'Name' })).toHaveAccessibleDescription(error);
    });
    expect(requestCount).toBe(createdCount);
  },
);

test('shows a taken name at the Name field', async () => {
  // arrange
  server.use(
    http.post('http://localhost/api/accounting/locations', () =>
      HttpResponse.json(
        {
          message: 'Name already exists',
          error_code: 'NAME_ALREADY_EXISTS',
        } satisfies components['schemas']['ErrorResponse'],
        { status: 409 },
      ),
    ),
  );
  const user = userEvent.setup();
  render(
    <LocationForm
      mode={{ kind: 'create', name: 'Central market', onCreated: vi.fn() }}
      onBack={vi.fn()}
    />,
  );

  // act
  await user.click(screen.getByRole('button', { name: 'Create location' }));

  // assert
  expect(await screen.findByRole('textbox', { name: 'Name' })).toHaveAccessibleDescription(
    'Name already exists',
  );
});

test.each([
  { description: 'ab', createdCount: 0, error: 'Write at least 3 characters' },
  { description: 'abc', createdCount: 1, error: '' },
])(
  'creates the location only with a description of 3 characters or more: “$description”',
  async ({ description, createdCount, error }) => {
    // arrange
    let requestCount = 0;
    server.use(
      http.post('http://localhost/api/accounting/locations', () => {
        requestCount += 1;
        return HttpResponse.json(carrefour satisfies components['schemas']['Location'], {
          status: 201,
        });
      }),
    );
    const onCreated = vi.fn();
    const user = userEvent.setup();
    render(
      <LocationForm
        mode={{ kind: 'create', name: 'Carrefour', onCreated: onCreated }}
        onBack={vi.fn()}
      />,
    );
    await user.type(screen.getByRole('textbox', { name: /^Description/ }), description);

    // act
    await user.click(screen.getByRole('button', { name: 'Create location' }));

    // assert
    await vi.waitFor(() => {
      expect(onCreated).toHaveBeenCalledTimes(createdCount);
      expect(screen.getByRole('textbox', { name: /^Description/ })).toHaveAccessibleDescription(
        error,
      );
    });
    expect(requestCount).toBe(createdCount);
  },
);

test('opens Edit location with the saved values and saves the changes', async () => {
  // arrange
  let updatedBody: unknown;
  server.use(
    http.put(`http://localhost/api/accounting/locations/${carrefour.id}`, async ({ request }) => {
      updatedBody = await request.json();
      return HttpResponse.json({
        ...carrefour,
        description: 'East Point mall',
      } satisfies components['schemas']['Location']);
    }),
  );
  const onSaved = vi.fn();
  const user = userEvent.setup();
  render(
    <LocationForm
      mode={{ kind: 'edit', location: carrefour, relatedQueryKeys: [], onSaved }}
      onBack={vi.fn()}
    />,
  );
  const description = screen.getByRole('textbox', { name: /^Description/ });
  expect(screen.getByRole('textbox', { name: 'Name' })).toHaveValue('Carrefour');
  expect(description).toHaveValue('abc');
  await user.clear(description);
  await user.type(description, 'East Point mall');

  // act
  await user.click(screen.getByRole('button', { name: 'Save changes' }));

  // assert
  await vi.waitFor(() => {
    expect(onSaved).toHaveBeenCalledTimes(1);
  });
  expect(updatedBody).toEqual({ name: 'Carrefour', description: 'East Point mall' });
});
