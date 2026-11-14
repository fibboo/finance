import { act, renderHook } from '@testing-library/react';
import { expect, test, vi } from 'vitest';

import {
  readIsDeletedShown,
  storeIsDeletedShown,
  useStoredIsDeletedShown,
  writeDeletedEntryLink,
  writeIsDeletedShown,
} from './deleted-filter';

test('takes the stored value when the URL has no deleted param', () => {
  // act
  const isShownByStoredOn = readIsDeletedShown({
    searchParams: new URLSearchParams(),
    isStoredDeletedShown: true,
  });
  const isShownByStoredOff = readIsDeletedShown({
    searchParams: new URLSearchParams(),
    isStoredDeletedShown: false,
  });

  // assert
  expect(isShownByStoredOn).toBe(true);
  expect(isShownByStoredOff).toBe(false);
});

test('takes the deleted param over the stored value', () => {
  // act
  const isShownByOn = readIsDeletedShown({
    searchParams: new URLSearchParams('deleted=on'),
    isStoredDeletedShown: false,
  });
  const isShownByOff = readIsDeletedShown({
    searchParams: new URLSearchParams('deleted=off'),
    isStoredDeletedShown: true,
  });

  // assert
  expect(isShownByOn).toBe(true);
  expect(isShownByOff).toBe(false);
});

test('takes the stored value when the deleted param is not one it knows', () => {
  // act
  const isDeletedShown = readIsDeletedShown({
    searchParams: new URLSearchParams('deleted=hidden'),
    isStoredDeletedShown: false,
  });

  // assert
  expect(isDeletedShown).toBe(false);
});

test('writes off to the URL when Deleted is turned off', () => {
  // act
  const searchParams = writeIsDeletedShown({
    searchParams: new URLSearchParams('search=spar'),
    isDeletedShown: false,
    isStoredDeletedShown: true,
  });

  // assert
  expect(searchParams.toString()).toBe('search=spar&deleted=off');
});

test('writes on to the URL when Deleted is turned on over a stored off', () => {
  // act
  const searchParams = writeIsDeletedShown({
    searchParams: new URLSearchParams('deleted=off'),
    isDeletedShown: true,
    isStoredDeletedShown: false,
  });

  // assert
  expect(searchParams.get('deleted')).toBe('on');
});

test('drops the deleted param when Deleted is turned on over a stored on', () => {
  // act
  const searchParams = writeIsDeletedShown({
    searchParams: new URLSearchParams('deleted=off'),
    isDeletedShown: true,
    isStoredDeletedShown: true,
  });

  // assert
  expect(searchParams.has('deleted')).toBe(false);
});

test('writes on to the URL of a link to a deleted entry only', () => {
  // act
  const deletedEntryParams = writeDeletedEntryLink({
    searchParams: new URLSearchParams('location=1'),
    status: 'DELETED',
  });
  const activeEntryParams = writeDeletedEntryLink({
    searchParams: new URLSearchParams('location=1'),
    status: 'ACTIVE',
  });

  // assert
  expect(deletedEntryParams.toString()).toBe('location=1&deleted=on');
  expect(activeEntryParams.toString()).toBe('location=1');
});

test('reads the stored value of the page only and follows what is stored later', () => {
  // arrange
  localStorage.setItem('deleted:locations', 'off');
  const { result: locations } = renderHook(() => useStoredIsDeletedShown('locations'));
  const { result: categories } = renderHook(() => useStoredIsDeletedShown('categories'));
  expect(locations.current).toBe(false);
  expect(categories.current).toBe(true);

  // act
  act(() => {
    storeIsDeletedShown({ page: 'locations', isDeletedShown: true });
  });

  // assert
  expect(locations.current).toBe(true);
  expect(localStorage.getItem('deleted:locations')).toBe('on');
  expect(localStorage.getItem('deleted:categories')).toBeNull();
});

test('shows deleted entries when the stored value is not one it knows', () => {
  // arrange
  localStorage.setItem('deleted:locations', 'hidden');

  // act
  const { result } = renderHook(() => useStoredIsDeletedShown('locations'));

  // assert
  expect(result.current).toBe(true);
});

test('shows deleted entries and stores nothing when the browser blocks storage', () => {
  // arrange
  vi.stubGlobal('localStorage', {
    getItem: () => {
      throw new DOMException('Storage is blocked.', 'SecurityError');
    },
    setItem: () => {
      throw new DOMException('Storage is blocked.', 'SecurityError');
    },
  });
  const { result } = renderHook(() => useStoredIsDeletedShown('locations'));

  // act
  act(() => {
    storeIsDeletedShown({ page: 'locations', isDeletedShown: false });
  });

  // assert
  expect(result.current).toBe(true);
});
