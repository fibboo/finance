import { http, HttpResponse } from 'msw';
import { expect, test } from 'vitest';

import { apiClient, readData } from '@/lib/api-client';
import { ApiError } from '@/lib/api-error';
import { server } from '@/test/setup';

test('returns the data of a successful response', async () => {
  // arrange
  server.use(
    http.get('http://localhost/api/dictionaries/accounting', () =>
      HttpResponse.json({ currencies: [], category_types: [] }),
    ),
  );

  // act
  const dictionaries = readData(await apiClient.GET('/dictionaries/accounting'));

  // assert
  expect(dictionaries).toEqual({ currencies: [], category_types: [] });
});

test('throws an ApiError for an error response', async () => {
  // arrange
  server.use(
    http.get('http://localhost/api/user/me', () =>
      HttpResponse.json({ message: 'Invalid token', error_code: 'INVALID_TOKEN' }, { status: 401 }),
    ),
  );

  // act
  const result = apiClient.GET('/user/me');

  // assert
  await expect(result).rejects.toBeInstanceOf(ApiError);
  await expect(result).rejects.toMatchObject({ status: 401, error_code: 'INVALID_TOKEN' });
});
