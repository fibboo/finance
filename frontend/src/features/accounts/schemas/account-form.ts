import { z } from 'zod';

import { categoryTypeValues } from '@/lib/api-schema';

import { MONEY_ACCOUNT_KINDS } from '../api/account-queries';

const NAME_MIN_LENGTH = 3;
export const NAME_MAX_LENGTH = 64;
const DESCRIPTION_MIN_LENGTH = 3;
export const DESCRIPTION_MAX_LENGTH = 4096;

export const accountFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(NAME_MIN_LENGTH, `Write at least ${String(NAME_MIN_LENGTH)} characters`)
    .max(NAME_MAX_LENGTH, `Write at most ${String(NAME_MAX_LENGTH)} characters`),
  description: z
    .string()
    .trim()
    .refine((description) => description === '' || description.length >= DESCRIPTION_MIN_LENGTH, {
      error: `Write at least ${String(DESCRIPTION_MIN_LENGTH)} characters`,
    })
    .transform((description) => (description === '' ? null : description)),
  color: z.string(),
});

export const categoryFormSchema = accountFormSchema.extend({
  category_type: z.enum(categoryTypeValues),
});

export const moneyAccountFormSchema = accountFormSchema.extend({
  kind: z.enum(MONEY_ACCOUNT_KINDS),
  currency: z.string(),
});

export type AccountFormValues = z.input<typeof accountFormSchema>;
export type AccountFormOutput = z.output<typeof accountFormSchema>;
export type CategoryFormValues = z.input<typeof categoryFormSchema>;
export type CategoryFormOutput = z.output<typeof categoryFormSchema>;
export type MoneyAccountFormValues = z.input<typeof moneyAccountFormSchema>;
export type MoneyAccountFormOutput = z.output<typeof moneyAccountFormSchema>;
