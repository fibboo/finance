import { z } from 'zod';

import { USERNAME_ERROR, usernameSchema } from './username-form';

export function createBaseCurrencyFormSchema({
  givenUsername,
}: Readonly<{ givenUsername: string }>) {
  const baseCurrencyFormSchema = z.object({
    username: z
      .string()
      .trim()
      .refine(
        (username) => username === givenUsername || usernameSchema.safeParse(username).success,
        USERNAME_ERROR,
      ),
    base_currency: z.string().min(1, 'Pick your base currency.'),
  });
  return baseCurrencyFormSchema;
}
