import { redirect } from 'react-router';

import { apiClient, readData } from '@/lib/api-client';
import { ApiError } from '@/lib/api-error';

import { callbackParamsSchema } from '../schemas/callback-params';
import { readRedirectUri, takeSignInRequest } from './pkce';
import { startSession } from './session';

const STATE_MISMATCH_ERROR = 'state_mismatch';
const INVALID_GRANT_ERROR = 'invalid_grant';

function buildSignInErrorUrl(error: string): string {
  const signInErrorUrl = `/sign-in?${new URLSearchParams({ error }).toString()}`;
  return signInErrorUrl;
}

async function exchangeCode({
  code,
  code_verifier,
}: Readonly<{ code: string; code_verifier: string }>): Promise<string | null> {
  try {
    const tokenResponse = readData(
      await apiClient.POST('/user/auth/token', {
        body: {
          grant_type: 'authorization_code',
          code,
          code_verifier,
          redirect_uri: readRedirectUri(),
        },
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      }),
    );
    return tokenResponse.access_token;
  } catch (error) {
    if (error instanceof ApiError) {
      return null;
    }

    throw error;
  }
}

export async function completeSignIn({
  request,
}: Readonly<{ request: Request }>): Promise<Response> {
  const signInRequest = takeSignInRequest();
  const callbackParams = callbackParamsSchema.safeParse(
    Object.fromEntries(new URL(request.url).searchParams),
  );
  if (!callbackParams.success || signInRequest?.state !== callbackParams.data.state) {
    const stateMismatchRedirect = redirect(buildSignInErrorUrl(STATE_MISMATCH_ERROR));
    return stateMismatchRedirect;
  }

  if ('error' in callbackParams.data) {
    const providerErrorRedirect = redirect(buildSignInErrorUrl(callbackParams.data.error));
    return providerErrorRedirect;
  }

  const accessToken = await exchangeCode({
    code: callbackParams.data.code,
    code_verifier: signInRequest.code_verifier,
  });
  if (accessToken === null) {
    const invalidGrantRedirect = redirect(buildSignInErrorUrl(INVALID_GRANT_ERROR));
    return invalidGrantRedirect;
  }

  startSession(accessToken);
  const appRedirect = redirect('/');

  return appRedirect;
}
