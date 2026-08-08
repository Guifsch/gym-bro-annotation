import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';

import { env } from './env';

export interface AuthUserClaims {
  id: string;
  name: string;
  email: string;
}

export function hashUserPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export function checkPassword(password: string, passwordHash: string): Promise<boolean> {
  return bcrypt.compare(password, passwordHash);
}

export function signAccessToken(claims: AuthUserClaims): string {
  return jwt.sign(claims, env.authAccessTokenSecret, { expiresIn: env.authAccessTokenTtl } as jwt.SignOptions);
}

export function signRefreshToken(claims: AuthUserClaims): string {
  return jwt.sign(claims, env.authRefreshTokenSecret, { expiresIn: env.authRefreshTokenTtl } as jwt.SignOptions);
}

export function verifyAccessToken(token: string): AuthUserClaims {
  return jwt.verify(token, env.authAccessTokenSecret) as AuthUserClaims;
}

export function verifyRefreshToken(token: string): AuthUserClaims {
  return jwt.verify(token, env.authRefreshTokenSecret) as AuthUserClaims;
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
