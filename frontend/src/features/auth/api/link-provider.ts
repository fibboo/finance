import { z } from 'zod';

import { apiClient, readData } from '@/lib/api-client';
import { ApiError } from '@/lib/api-error';
import { type components, providerTypeValues } from '@/lib/api-schema';

import { callbackParamsSchema } from '../schemas/callback-params';
import { createCodeChallenge, createRandomValue, readRedirectUri } from './pkce';

type ProviderType = components['schemas']['ProviderType'];

type LinkOutcome =
  | Readonly<{ status: 'failed' }>
  | Readonly<{ status: 'cancelled' }>
  | Readonly<{
      status: 'completed';
      provider: ProviderType;
      link_result: components['schemas']['LinkResult'];
    }>;

const LINK_REQUEST_KEY = 'finance-link-request';
const LINK_CALLBACK_PATH = '/auth/link-callback';
const CANCELLED_ERROR = 'access_denied';

const linkRequestSchema = z.object({
  provider: z.enum(providerTypeValues),
  state: z.string().min(1),
  code_verifier: z.string().min(1),
});

function readLinkRequest(): z.infer<typeof linkRequestSchema> | null {
  const storedRequest = sessionStorage.getItem(LINK_REQUEST_KEY);
  const linkRequest = linkRequestSchema.safeParse(
    storedRequest === null ? null : JSON.parse(storedRequest),
  );

  return linkRequest.success ? linkRequest.data : null;
}

export async function startLink(provider: ProviderType): Promise<string> {
  const state = createRandomValue();
  const codeVerifier = createRandomValue();
  sessionStorage.setItem(
    LINK_REQUEST_KEY,
    JSON.stringify({ provider, state, code_verifier: codeVerifier }),
  );
  const authorizationUrlResponse = readData(
    await apiClient.POST('/user/auth/link/{provider}', {
      params: {
        path: { provider },
        query: {
          redirect_uri: readRedirectUri(LINK_CALLBACK_PATH),
          code_challenge: await createCodeChallenge(codeVerifier),
          code_challenge_method: 'S256',
          state,
        },
      },
    }),
  );

  return authorizationUrlResponse.authorization_url;
}

export async function completeLink({
  request,
}: Readonly<{ request: Request }>): Promise<LinkOutcome> {
  const linkRequest = readLinkRequest();
  sessionStorage.removeItem(LINK_REQUEST_KEY);
  const callbackParams = callbackParamsSchema.safeParse(
    Object.fromEntries(new URL(request.url).searchParams),
  );
  if (!callbackParams.success || linkRequest?.state !== callbackParams.data.state) {
    return { status: 'failed' };
  }

  if ('error' in callbackParams.data) {
    const providerOutcome: LinkOutcome = {
      status: callbackParams.data.error === CANCELLED_ERROR ? 'cancelled' : 'failed',
    };
    return providerOutcome;
  }

  try {
    const linkResult = readData(
      await apiClient.POST('/user/auth/link/{provider}/complete', {
        params: { path: { provider: linkRequest.provider } },
        body: {
          code: callbackParams.data.code,
          code_verifier: linkRequest.code_verifier,
          redirect_uri: readRedirectUri(LINK_CALLBACK_PATH),
        },
      }),
    );
    const completedLink: LinkOutcome = {
      status: 'completed',
      provider: linkRequest.provider,
      link_result: linkResult,
    };
    return completedLink;
  } catch (error) {
    if (error instanceof ApiError) {
      return { status: 'failed' };
    }

    throw error;
  }
}
