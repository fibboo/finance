import { useQuery } from '@tanstack/react-query';

import { SignInPage } from '@/features/auth/components/sign-in-page';
import { dictionaryQueries } from '@/features/dictionaries/api/dictionary-queries';

export function Component() {
  const { data: userDictionaries } = useQuery({
    ...dictionaryQueries.user(),
    throwOnError: true,
  });

  return <SignInPage providerTypes={userDictionaries?.provider_types} />;
}
