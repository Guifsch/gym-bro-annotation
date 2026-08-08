import rateLimit from 'express-rate-limit';

/** Applies to login, registration, and password-reset/change endpoints — brute-force is the concern here. */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas tentativas. Tente novamente em alguns minutos.' },
});

/** Generic ceiling for every other route — protects the free-tier instance from being hammered. */
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas requisições. Tente novamente em alguns minutos.' },
});
