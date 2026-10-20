import type { Middleware } from 'openapi-fetch';

import { UNAUTHORIZED_STATUS } from '@/lib/api-error';

import { readAccessToken, refreshSession } from './session';

type SentRequest = Readonly<{
  retryRequest: Request;
  accessToken: string | null;
}>;

const SESSION_PATHS: ReadonlySet<string> = new Set(['/user/auth/token', '/user/auth/revoke']);
const sentRequests = new WeakMap<Request, SentRequest>();

export const authMiddleware: Middleware = {
  onRequest({ request }) {
    const accessToken = readAccessToken();
    if (accessToken !== null) {
      request.headers.set('Authorization', `Bearer ${accessToken}`);
    }

    sentRequests.set(request, { retryRequest: request.clone(), accessToken });

    return request;
  },
  async onResponse({ request, response, schemaPath, options }) {
    const sentRequest = sentRequests.get(request);
    if (
      response.status !== UNAUTHORIZED_STATUS ||
      SESSION_PATHS.has(schemaPath) ||
      sentRequest === undefined
    ) {
      return undefined;
    }

    const refreshedToken = await refreshSession(sentRequest.accessToken);
    if (refreshedToken === null) {
      return undefined;
    }

    sentRequest.retryRequest.headers.set('Authorization', `Bearer ${refreshedToken}`);
    const retriedResponse = await options.fetch(sentRequest.retryRequest);
    return retriedResponse;
  },
};
