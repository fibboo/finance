import type { components } from '@/lib/api-schema';

type AccountKind = components['schemas']['AccountKind'];

export const MONEY_ACCOUNT_KINDS = ['ASSET', 'LIABILITY'] as const satisfies readonly AccountKind[];
