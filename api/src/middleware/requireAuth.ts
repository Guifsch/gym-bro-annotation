import type { NextFunction, Request, Response } from 'express';

import { verifyAccessToken } from '../utils/auth';
import { getAccessTokenCookieName } from '../utils/cookies';

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  const bearerToken = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : null;
  const token = bearerToken ?? req.cookies?.[getAccessTokenCookieName()] ?? null;

  if (!token) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }

  try {
    req.user = verifyAccessToken(token);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}
