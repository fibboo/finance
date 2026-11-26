import type { components } from '@/lib/api-schema';
import { formatMoney } from '@/lib/format-money';

import { readAccountCurrency } from '../schemas/transaction-form';

type Account = components['schemas']['Account'];

export function readMoneyAccountNote(account: Readonly<Account>): string {
  const note = formatMoney({
    amount: Number(account.balance),
    currency: readAccountCurrency(account),
  });
  return note;
}
