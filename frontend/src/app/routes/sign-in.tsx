import { useQuery } from '@tanstack/react-query';

import { queryClient } from '@/app/query-client';
import { SignInPage } from '@/features/auth/components/sign-in-page';
import { dictionaryQueries } from '@/features/dictionaries/api/dictionary-queries';

export async function loader(): Promise<null> {
  await queryClient.query(dictionaryQueries.user());
  return null;
}

export function Component() {
  const { data: userDictionaries } = useQuery(dictionaryQueries.user());
  if (userDictionaries === undefined) {
    return null;
  }

  return <SignInPage providerTypes={userDictionaries.provider_types} />;
}
