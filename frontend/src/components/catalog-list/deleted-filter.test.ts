import { expect, test, vi } from 'vitest';

import { readIsDeletedShown, writeIsDeletedShown } from './deleted-filter';

test('shows deleted entries when neither the URL nor the storage says otherwise', () => {
  // act
  const isDeletedShown = readIsDeletedShown({
    searchParams: new URLSearchParams(),
    page: 'locations',
  });

  // assert
  expect(isDeletedShown).toBe(true);
});

test('takes the stored value of the page when the URL has no deleted param', () => {
  // arrange
  localStorage.setItem('deleted:locations', 'off');

  // act
  const isLocationDeletedShown = readIsDeletedShown({
    searchParams: new URLSearchParams(),
    page: 'locations',
  });
  const isCategoryDeletedShown = readIsDeletedShown({
    searchParams: new URLSearchParams(),
    page: 'categories',
  });

  // assert
  expect(isLocationDeletedShown).toBe(false);
  expect(isCategoryDeletedShown).toBe(true);
});

test('takes the deleted param over the stored value', () => {
  // arrange
  localStorage.setItem('deleted:locations', 'off');

  // act
  const isDeletedShownByOn = readIsDeletedShown({
    searchParams: new URLSearchParams('deleted=on'),
    page: 'locations',
  });
  const isDeletedShownByOff = readIsDeletedShown({
    searchParams: new URLSearchParams('deleted=off'),
    page: 'categories',
  });

  // assert
  expect(isDeletedShownByOn).toBe(true);
  expect(isDeletedShownByOff).toBe(false);
});

test('shows deleted entries when the stored value is not one it knows', () => {
  // arrange
  localStorage.setItem('deleted:locations', 'hidden');

  // act
  const isDeletedShown = readIsDeletedShown({
    searchParams: new URLSearchParams(),
    page: 'locations',
  });

  // assert
  expect(isDeletedShown).toBe(true);
});

test('stores turning Deleted off for the page only and writes off to the URL', () => {
  // act
  const searchParams = writeIsDeletedShown({
    searchParams: new URLSearchParams('search=spar'),
    page: 'locations',
    isDeletedShown: false,
  });

  // assert
  expect(searchParams.toString()).toBe('search=spar&deleted=off');
  expect(localStorage.getItem('deleted:locations')).toBe('off');
  expect(localStorage.getItem('deleted:categories')).toBeNull();
});

test('writes on to the URL when Deleted is turned on over a stored off', () => {
  // arrange
  localStorage.setItem('deleted:locations', 'off');

  // act
  const searchParams = writeIsDeletedShown({
    searchParams: new URLSearchParams(),
    page: 'locations',
    isDeletedShown: true,
  });

  // assert
  expect(searchParams.get('deleted')).toBe('on');
  expect(localStorage.getItem('deleted:locations')).toBe('on');
});

test('drops the deleted param when Deleted is turned on and nothing stored hides deleted entries', () => {
  // act
  const searchParams = writeIsDeletedShown({
    searchParams: new URLSearchParams('deleted=off'),
    page: 'locations',
    isDeletedShown: true,
  });

  // assert
  expect(searchParams.has('deleted')).toBe(false);
});

test('keeps working on the URL alone when the storage throws', () => {
  // arrange
  vi.stubGlobal('localStorage', {
    getItem: () => {
      throw new DOMException('Storage is blocked.', 'SecurityError');
    },
    setItem: () => {
      throw new DOMException('Storage is blocked.', 'SecurityError');
    },
  });

  // act
  const searchParams = writeIsDeletedShown({
    searchParams: new URLSearchParams(),
    page: 'locations',
    isDeletedShown: false,
  });
  const isDeletedShown = readIsDeletedShown({ searchParams, page: 'locations' });

  // assert
  expect(isDeletedShown).toBe(false);
});
