import createClient, { type Middleware } from 'openapi-fetch';

import { env } from '@/config/env';
import { readApiError } from '@/lib/api-error';
import type { paths } from '@/lib/api-schema';

const errorMiddleware: Middleware = {
  async onResponse({ response }) {
    if (!response.ok) {
      throw await readApiError(response);
    }

    return undefined;
  },
};

export const apiClient = createClient<paths>({
  baseUrl: env.VITE_API_BASE_URL,
  fetch: (request) => globalThis.fetch(request),
});

apiClient.use(errorMiddleware);

export function readData<Data>({
  data,
  response,
}: Readonly<{ data?: Data; response: Response }>): Data {
  if (data === undefined) {
    throw new Error(`${response.url} answered without a body.`);
  }

  return data;
}
