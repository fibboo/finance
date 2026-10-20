import { z } from 'zod';

export const callbackParamsSchema = z.union([
  z.object({ state: z.string().min(1), code: z.string().min(1) }),
  z.object({ state: z.string().min(1), error: z.string().min(1) }),
]);
