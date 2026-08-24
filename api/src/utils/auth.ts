import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';

import { env } from './env';

export interface AuthUserClaims {
  id: string;
  name: string;
  email: string;
}

export interface RefreshTokenClaims extends AuthUserClaims {
  tokenVersion: number;
}

export function hashUserPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export function checkPassword(password: string, passwordHash: string): Promise<boolean> {
  return bcrypt.compare(password, passwordHash);
}

export function signAccessToken(claims: AuthUserClaims): string {
  return jwt.sign(claims, env.authAccessTokenSecret, {
    expiresIn: env.authAccessTokenTtl,
    algorithm: 'HS256',
  } as jwt.SignOptions);
}

// Access tokens stay short-lived and fully stateless (no DB hit on every request). Refresh
// tokens carry tokenVersion instead, checked once per /refresh call against the user's current
// value in the DB — that's what lets logout/password-change actually revoke a 30-day-lived
// refresh token, at the cost of a stolen access token still working until its own ~15min expiry.
export function signRefreshToken(claims: AuthUserClaims, tokenVersion: number): string {
  return jwt.sign({ ...claims, tokenVersion }, env.authRefreshTokenSecret, {
    expiresIn: env.authRefreshTokenTtl,
    algorithm: 'HS256',
  } as jwt.SignOptions);
}

export function verifyAccessToken(token: string): AuthUserClaims {
  return jwt.verify(token, env.authAccessTokenSecret, { algorithms: ['HS256'] }) as AuthUserClaims;
}

export function verifyRefreshToken(token: string): RefreshTokenClaims {
  return jwt.verify(token, env.authRefreshTokenSecret, { algorithms: ['HS256'] }) as RefreshTokenClaims;
}

export function createEmailOneTimeCode(): string {
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
}

/** context = email for registration codes, userId for password-reset codes */
export function hashEmailOneTimeCode(code: string, context: string): string {
  return crypto
    .createHash('sha256')
    .update(`${code}:${context}:${env.emailCodePepper}`)
    .digest('hex');
}
