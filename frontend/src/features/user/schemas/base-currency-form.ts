import { z } from 'zod';

export const baseCurrencyFormSchema = z.object({
  base_currency: z.string().min(1, 'Pick your base currency.'),
});
