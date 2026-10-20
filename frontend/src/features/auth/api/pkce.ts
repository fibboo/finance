import { z } from 'zod';

import { env } from '@/config/env';
import type { components } from '@/lib/api-schema';

type ProviderType = components['schemas']['ProviderType'];

const STATE_KEY = 'finance-sign-in-state';
const CODE_VERIFIER_KEY = 'finance-sign-in-code-verifier';
const RANDOM_BYTE_COUNT = 32;

const signInRequestSchema = z.object({
  state: z.string().min(1),
  code_verifier: z.string().min(1),
});

type SignInRequest = z.infer<typeof signInRequestSchema>;

function encodeBase64Url(bytes: Uint8Array): string {
  const base64Url = btoa(String.fromCharCode(...bytes))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '');
  return base64Url;
}

function createRandomValue(): string {
  const randomValue = encodeBase64Url(crypto.getRandomValues(new Uint8Array(RANDOM_BYTE_COUNT)));
  return randomValue;
}

async function createCodeChallenge(codeVerifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(codeVerifier));
  const codeChallenge = encodeBase64Url(new Uint8Array(digest));
  return codeChallenge;
}

export function readRedirectUri(): string {
  const redirectUri = new URL('/auth/callback', window.location.origin).href;
  return redirectUri;
}

export async function buildAuthorizeUrl(provider: ProviderType): Promise<string> {
  const state = createRandomValue();
  const codeVerifier = createRandomValue();
  const query = new URLSearchParams({
    redirect_uri: readRedirectUri(),
    code_challenge: await createCodeChallenge(codeVerifier),
    code_challenge_method: 'S256',
    state,
  });
  sessionStorage.setItem(STATE_KEY, state);
  sessionStorage.setItem(CODE_VERIFIER_KEY, codeVerifier);

  const authorizeUrl = `${env.VITE_API_BASE_URL}/user/auth/authorize/${provider}?${query.toString()}`;
  return authorizeUrl;
}

export function takeSignInRequest(): SignInRequest | null {
  const signInRequest = signInRequestSchema.safeParse({
    state: sessionStorage.getItem(STATE_KEY),
    code_verifier: sessionStorage.getItem(CODE_VERIFIER_KEY),
  });
  sessionStorage.removeItem(STATE_KEY);
  sessionStorage.removeItem(CODE_VERIFIER_KEY);

  return signInRequest.success ? signInRequest.data : null;
}
