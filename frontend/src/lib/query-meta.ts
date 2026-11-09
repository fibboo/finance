const NOT_FOUND_EXPECTED_KEY = 'isNotFoundExpected';

export const NOT_FOUND_EXPECTED_META = { [NOT_FOUND_EXPECTED_KEY]: true } as const;

export function isNotFoundExpected(meta: Readonly<Record<string, unknown>> | undefined): boolean {
  const isExpected = meta?.[NOT_FOUND_EXPECTED_KEY] === true;
  return isExpected;
}

export function isThrownWithoutData(
  _error: unknown,
  query: Readonly<{ state: Readonly<{ data: unknown }> }>,
): boolean {
  const isThrown = query.state.data === undefined;
  return isThrown;
}
