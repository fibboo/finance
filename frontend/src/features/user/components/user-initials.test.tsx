import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { expect, test } from 'vitest';

import type { components } from '@/lib/api-schema';
import { render } from '@/test/render';
import { server } from '@/test/setup';

import { UserInitials } from './user-initials';

test('shows the first two letters of the username in capitals', async () => {
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
  render(<UserInitials />);

  // assert
  expect(await screen.findByText('NI')).toBeInTheDocument();
});
