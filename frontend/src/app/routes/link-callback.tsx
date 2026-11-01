import { useSuspenseQuery } from '@tanstack/react-query';
import { redirect, useLoaderData } from 'react-router';

import { queryClient } from '@/app/query-client';
import { showErrorNotification } from '@/components/error-notification/error-notification-store';
import { Page } from '@/components/page/page';
import { completeLink } from '@/features/auth/api/link-provider';
import { dictionaryQueries } from '@/features/dictionaries/api/dictionary-queries';
import { userQueries } from '@/features/user/api/user-queries';
import { MergeOffer } from '@/features/user/components/merge-offer';
import { MergeRefusal } from '@/features/user/components/merge-refusal';

export async function loader({ request }: Readonly<{ request: Request }>) {
  await queryClient.query(dictionaryQueries.user());
  const linkOutcome = await completeLink({ request });
  if (linkOutcome.status !== 'completed') {
    if (linkOutcome.status === 'failed') {
      showErrorNotification();
    }

    const unlinkedRedirect = redirect('/');
    return unlinkedRedirect;
  }

  const mergeOffer = linkOutcome.link_result.merge_offer;
  if (mergeOffer === null) {
    await queryClient.invalidateQueries({ queryKey: userQueries.me().queryKey });
    const linkedRedirect = redirect('/');
    return linkedRedirect;
  }

  const mergeData = { provider: linkOutcome.provider, merge_offer: mergeOffer };
  return mergeData;
}

export function Component() {
  const { provider, merge_offer } = useLoaderData<typeof loader>();
  const { data: userDictionaries } = useSuspenseQuery(dictionaryQueries.user());
  const isMergeRefused = merge_offer.is_base_currency_mismatch || merge_offer.is_provider_conflict;

  return (
    <Page title="Merge accounts">
      {isMergeRefused ? (
        <MergeRefusal
          provider={provider}
          providerTypes={userDictionaries.provider_types}
          mergeOffer={merge_offer}
        />
      ) : (
        <MergeOffer
          provider={provider}
          providerTypes={userDictionaries.provider_types}
          mergeOffer={merge_offer}
        />
      )}
    </Page>
  );
}
