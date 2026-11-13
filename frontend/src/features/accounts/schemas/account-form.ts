import { z } from 'zod';

import { MONEY_ACCOUNT_KINDS } from '@/lib/account-kinds';
import { categoryTypeValues } from '@/lib/api-schema';

const NAME_MIN_LENGTH = 3;
export const NAME_MAX_LENGTH = 32;
const DESCRIPTION_MIN_LENGTH = 3;
export const DESCRIPTION_MAX_LENGTH = 256;

export const accountFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(NAME_MIN_LENGTH, `Write at least ${String(NAME_MIN_LENGTH)} characters`)
    .max(NAME_MAX_LENGTH, `Write at most ${String(NAME_MAX_LENGTH)} characters`),
  description: z
    .string()
    .trim()
    .max(DESCRIPTION_MAX_LENGTH, `Write at most ${String(DESCRIPTION_MAX_LENGTH)} characters`)
    .refine((description) => description === '' || description.length >= DESCRIPTION_MIN_LENGTH, {
      error: `Write at least ${String(DESCRIPTION_MIN_LENGTH)} characters`,
    })
    .transform((description) => (description === '' ? null : description)),
});

export const restoreFormSchema = accountFormSchema.pick({ name: true });

export const categoryFormSchema = accountFormSchema.extend({
  category_type: z.enum(categoryTypeValues),
});

export const moneyAccountFormSchema = accountFormSchema.extend({
  kind: z.enum(MONEY_ACCOUNT_KINDS),
  currency: z.string(),
  color: z.string(),
});

export type AccountFormValues = z.input<typeof accountFormSchema>;
export type AccountFormOutput = z.output<typeof accountFormSchema>;
export type RestoreFormValues = z.input<typeof restoreFormSchema>;
export type RestoreFormOutput = z.output<typeof restoreFormSchema>;
export type CategoryFormValues = z.input<typeof categoryFormSchema>;
export type CategoryFormOutput = z.output<typeof categoryFormSchema>;
export type MoneyAccountFormValues = z.input<typeof moneyAccountFormSchema>;
export type MoneyAccountFormOutput = z.output<typeof moneyAccountFormSchema>;
