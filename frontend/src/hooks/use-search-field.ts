import { useState } from 'react';
import { NavigationType, useLocation, useNavigationType } from 'react-router';
import { z } from 'zod';

const typedSearchStateSchema = z.object({ isSearchTyped: z.literal(true) });

export const TYPED_SEARCH_STATE = {
  isSearchTyped: true,
} satisfies z.infer<typeof typedSearchStateSchema>;

export function useSearchField(search: string): Readonly<{
  fieldKey: number;
  isFocusedOnMount: boolean;
  focusAfterClear: () => void;
}> {
  const location = useLocation();
  const navigationType = useNavigationType();
  const [searchField, setSearchField] = useState({
    locationKey: location.key,
    search,
    version: 0,
    isFocusedOnMount: false,
  });
  const [isClearPending, setIsClearPending] = useState(false);
  if (location.key !== searchField.locationKey) {
    const isTyped =
      navigationType !== NavigationType.Pop &&
      typedSearchStateSchema.safeParse(location.state).success;
    const isFieldReset = !isTyped && search !== searchField.search;
    setSearchField({
      locationKey: location.key,
      search,
      version: isFieldReset ? searchField.version + 1 : searchField.version,
      isFocusedOnMount: isFieldReset && isClearPending,
    });
    if (isFieldReset) {
      setIsClearPending(false);
    }
  }

  const field = {
    fieldKey: searchField.version,
    isFocusedOnMount: searchField.isFocusedOnMount,
    focusAfterClear: () => {
      setIsClearPending(true);
    },
  };
  return field;
}
