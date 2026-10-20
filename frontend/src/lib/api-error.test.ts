import { expect, test } from 'vitest';

import { readApiError } from '@/lib/api-error';

test('reads the status, message and error code of an error response', async () => {
  // arrange
  const response = Response.json(
    { message: 'Base currency is already set', error_code: 'BASE_CURRENCY_ALREADY_SET' },
    { status: 409 },
  );

  // act
  const apiError = await readApiError(response);

  // assert
  expect(apiError).toMatchObject({
    status: 409,
    message: 'Base currency is already set',
    error_code: 'BASE_CURRENCY_ALREADY_SET',
    fieldErrors: [],
  });
});

test('reads the field errors of a validation error', async () => {
  // arrange
  const response = Response.json(
    { detail: [{ loc: ['body', 'base_currency'], msg: 'Field required', type: 'missing' }] },
    { status: 422 },
  );

  // act
  const apiError = await readApiError(response);

  // assert
  expect(apiError).toMatchObject({
    status: 422,
    message: 'The request is not valid.',
    error_code: null,
    fieldErrors: [{ field: 'base_currency', message: 'Field required' }],
  });
});

test('falls back to the status when the body is not an error response', async () => {
  // arrange
  const response = new Response('<html>Bad Gateway</html>', { status: 502 });

  // act
  const apiError = await readApiError(response);

  // assert
  expect(apiError).toMatchObject({
    status: 502,
    message: 'The request failed with status 502.',
    error_code: null,
    fieldErrors: [],
  });
});
