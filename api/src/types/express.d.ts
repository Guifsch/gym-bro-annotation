import type { AuthUserClaims } from '../utils/auth';

declare global {
  namespace Express {
    interface Request {
      user?: AuthUserClaims;
    }
  }
}

export {};
