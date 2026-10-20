import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { expect, test } from 'vitest';

import { createQueryClient } from '@/app/query-client';
import { apiClient } from '@/lib/api-client';
import { render } from '@/test/render';
import { server } from '@/test/setup';

test('does not retry a client error and shows the error notification', async () => {
  // arrange
  let requestCount = 0;
  server.use(
    http.get('http://localhost/api/user/me', () => {
      requestCount += 1;

      return HttpResponse.json({ message: 'User not found' }, { status: 404 });
    }),
  );
  render(<main />);
  const queryClient = createQueryClient();

  // act
  const result = queryClient.query({
    queryKey: ['user', 'me'],
    queryFn: () => apiClient.GET('/user/me'),
  });

  // assert
  await expect(result).rejects.toThrow('User not found');
  expect(requestCount).toBe(1);
  expect(await screen.findByText('Something went wrong. Please try again.')).toBeInTheDocument();
});
