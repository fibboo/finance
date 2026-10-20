import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { expect, test } from 'vitest';

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
