import { z } from 'zod';

const NAME_MIN_LENGTH = 3;
export const NAME_MAX_LENGTH = 32;
const DESCRIPTION_MIN_LENGTH = 3;
export const DESCRIPTION_MAX_LENGTH = 256;

export const locationFormSchema = z.object({
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
});

export const locationRestoreFormSchema = locationFormSchema.pick({ name: true });

export type LocationFormValues = z.input<typeof locationFormSchema>;
export type LocationFormOutput = z.output<typeof locationFormSchema>;
export type LocationRestoreFormValues = z.input<typeof locationRestoreFormSchema>;
export type LocationRestoreFormOutput = z.output<typeof locationRestoreFormSchema>;
