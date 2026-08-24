import type { Response } from 'express';

import { env } from './env';

const ACCESS_COOKIE_NAME = 'access_token';
const REFRESH_COOKIE_NAME = 'refresh_token';

function parseTtlToMs(ttl: string): number {
  const match = /^(\d+)([smhd])$/.exec(ttl.trim());
  if (!match) return 15 * 60 * 1000;

  const value = Number(match[1]);
  const unit = match[2] as 's' | 'm' | 'h' | 'd';
  const unitMs: Record<'s' | 'm' | 'h' | 'd', number> = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
  return value * unitMs[unit];
}

function baseCookieOptions() {
  // 'none' is required for the cookie to survive a cross-site fetch (e.g. a Vercel-hosted
  // frontend calling this API on a different domain) — but browsers reject SameSite=None
  // without Secure, so this only flips once authCookieSecure (HTTPS) is also on. Local dev
  // (http, same-site localhost ports) keeps 'lax', which already works there.
  const sameSite: 'lax' | 'none' = env.authCookieSecure ? 'none' : 'lax';

  return {
    httpOnly: true,
    sameSite,
    secure: env.authCookieSecure,
    path: '/',
  };
}

export function setAuthCookies(res: Response, tokens: { accessToken: string; refreshToken?: string }): void {
  res.cookie(ACCESS_COOKIE_NAME, tokens.accessToken, {
    ...baseCookieOptions(),
    maxAge: parseTtlToMs(env.authAccessTokenTtl),
  });

  if (tokens.refreshToken) {
    res.cookie(REFRESH_COOKIE_NAME, tokens.refreshToken, {
      ...baseCookieOptions(),
      maxAge: parseTtlToMs(env.authRefreshTokenTtl),
    });
  }
}

export function clearAuthCookies(res: Response): void {
  res.clearCookie(ACCESS_COOKIE_NAME, baseCookieOptions());
  res.clearCookie(REFRESH_COOKIE_NAME, baseCookieOptions());
}

export function getAccessTokenCookieName(): string {
  return ACCESS_COOKIE_NAME;
}

export function getRefreshTokenCookieName(): string {
  return REFRESH_COOKIE_NAME;
}
