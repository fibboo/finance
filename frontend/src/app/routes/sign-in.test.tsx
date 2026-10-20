import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { expect, test } from 'vitest';

import { Component } from '@/app/routes/sign-in';
import type { components } from '@/lib/api-schema';
import { render } from '@/test/render';
import { server } from '@/test/setup';

test('offers a sign-in button for each provider the user dictionary serves', async () => {
  // arrange
  server.use(
    http.get('http://localhost/api/dictionaries/user', () =>
      HttpResponse.json({
        provider_types: [
          { key: 'TELEGRAM', label: 'Telegram Messenger' },
          { key: 'GOOGLE', label: 'Google Account' },
        ],
      } satisfies components['schemas']['UserDictionaries']),
    ),
  );

  // act
  render(<Component />);

  // assert
  expect(
    await screen.findByRole('button', { name: 'Continue with Telegram Messenger' }),
  ).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Continue with Google Account' })).toBeInTheDocument();
});
