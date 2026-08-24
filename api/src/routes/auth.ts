import { Router } from 'express';

import { requireAuth } from '../middleware/requireAuth';
import { authLimiter } from '../middleware/rateLimit';
import { PasswordResetToken } from '../models/PasswordResetToken';
import { RegistrationEmailCode } from '../models/RegistrationEmailCode';
import { User } from '../models/User';
import {
  checkPassword,
  createEmailOneTimeCode,
  hashEmailOneTimeCode,
  hashUserPassword,
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
} from '../utils/auth';
import { asyncHandler } from '../utils/asyncHandler';
import { clearAuthCookies, getAccessTokenCookieName, getRefreshTokenCookieName, setAuthCookies } from '../utils/cookies';
import { sendPasswordResetCode, sendRegistrationCode } from '../utils/email';
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  refreshSchema,
  registerRequestSchema,
  registerSchema,
  resetPasswordSchema,
  updateProfileSchema,
} from '../validation/auth';

const REGISTRATION_CODE_TTL_MS = 15 * 60 * 1000;
const PASSWORD_RESET_CODE_TTL_MS = 15 * 60 * 1000;

const router = Router();

function publicUser(user: { _id: unknown; name: string; email: string }) {
  return { id: String(user._id), name: user.name, email: user.email };
}

router.post(
  '/register-request',
  authLimiter,
  asyncHandler(async (req, res) => {
    const { name, email, password } = registerRequestSchema.parse(req.body);

    const existing = await User.findOne({ email });
    if (existing) {
      res.status(409).json({ error: 'E-mail já cadastrado' });
      return;
    }

    const code = createEmailOneTimeCode();
    const codeHash = hashEmailOneTimeCode(code, email);
    const passwordHash = await hashUserPassword(password);

    await RegistrationEmailCode.deleteMany({ email, usedAt: null });
    await RegistrationEmailCode.create({
      email,
      codeHash,
      payloadJson: JSON.stringify({ name, email, passwordHash }),
      expiresAt: new Date(Date.now() + REGISTRATION_CODE_TTL_MS),
    });

    await sendRegistrationCode(email, code);

    res.status(200).json({ message: 'Código enviado para o seu e-mail.' });
  })
);

router.post(
  '/register',
  authLimiter,
  asyncHandler(async (req, res) => {
    const { email, code } = registerSchema.parse(req.body);
    const codeHash = hashEmailOneTimeCode(code, email);

    const record = await RegistrationEmailCode.findOne({
      email,
      codeHash,
      usedAt: null,
      expiresAt: { $gt: new Date() },
    });

    if (!record) {
      res.status(400).json({ error: 'Código inválido ou expirado' });
      return;
    }

    const payload = JSON.parse(record.payloadJson) as { name: string; email: string; passwordHash: string };
    const user = await User.create({
      name: payload.name,
      email: payload.email,
      passwordHash: payload.passwordHash,
    });

    record.usedAt = new Date();
    await record.save();

    const claims = publicUser(user);
    const accessToken = signAccessToken(claims);
    const refreshToken = signRefreshToken(claims, user.tokenVersion);
    setAuthCookies(res, { accessToken, refreshToken });

    res.status(201).json({ user: claims, accessToken, refreshToken });
  })
);

router.post(
  '/login',
  authLimiter,
  asyncHandler(async (req, res) => {
    const { email, password } = loginSchema.parse(req.body);

    const user = await User.findOne({ email });
    if (!user || !(await checkPassword(password, user.passwordHash))) {
      res.status(401).json({ error: 'Credenciais inválidas' });
      return;
    }

    const claims = publicUser(user);
    const accessToken = signAccessToken(claims);
    const refreshToken = signRefreshToken(claims, user.tokenVersion);
    setAuthCookies(res, { accessToken, refreshToken });

    res.status(200).json({ user: claims, accessToken, refreshToken });
  })
);

router.post(
  '/refresh',
  asyncHandler(async (req, res) => {
    const bodyRefreshToken = refreshSchema.partial().parse(req.body ?? {}).refreshToken;
    const refreshToken = bodyRefreshToken ?? req.cookies?.[getRefreshTokenCookieName()];

    if (!refreshToken) {
      res.status(401).json({ error: 'Refresh token inválido ou expirado' });
      return;
    }

    let claims;
    try {
      claims = verifyRefreshToken(refreshToken);
    } catch {
      res.status(401).json({ error: 'Refresh token inválido ou expirado' });
      return;
    }

    const user = await User.findById(claims.id);
    // Refresh tokens issued before this check existed carry no tokenVersion claim at all —
    // treat that as version 0 (the schema default) so already-logged-in sessions survive the
    // deploy instead of everyone being forced to log back in at once.
    if (!user || user.tokenVersion !== (claims.tokenVersion ?? 0)) {
      res.status(401).json({ error: 'Refresh token inválido ou expirado' });
      return;
    }

    const freshClaims = publicUser(user);
    const accessToken = signAccessToken(freshClaims);
    setAuthCookies(res, { accessToken });

    res.status(200).json({ user: freshClaims, accessToken });
  })
);

router.post(
  '/forgot-password',
  authLimiter,
  asyncHandler(async (req, res) => {
    const { email } = forgotPasswordSchema.parse(req.body);
    const genericMessage = { message: 'Se o e-mail existir, um código foi enviado.' };

    const user = await User.findOne({ email });
    if (user) {
      const code = createEmailOneTimeCode();
      const tokenHash = hashEmailOneTimeCode(code, String(user._id));

      await PasswordResetToken.deleteMany({ userId: user._id, usedAt: null });
      await PasswordResetToken.create({
        userId: user._id,
        tokenHash,
        expiresAt: new Date(Date.now() + PASSWORD_RESET_CODE_TTL_MS),
      });

      await sendPasswordResetCode(email, code);
    }

    res.status(200).json(genericMessage);
  })
);

router.post(
  '/reset-password',
  authLimiter,
  asyncHandler(async (req, res) => {
    const { email, code, password } = resetPasswordSchema.parse(req.body);
    const invalidResponse = { error: 'Código inválido ou expirado' };

    const user = await User.findOne({ email });
    if (!user) {
      res.status(400).json(invalidResponse);
      return;
    }

    const tokenHash = hashEmailOneTimeCode(code, String(user._id));
    const record = await PasswordResetToken.findOne({
      userId: user._id,
      tokenHash,
      usedAt: null,
      expiresAt: { $gt: new Date() },
    });

    if (!record) {
      res.status(400).json(invalidResponse);
      return;
    }

    user.passwordHash = await hashUserPassword(password);
    user.tokenVersion += 1;
    await user.save();

    record.usedAt = new Date();
    await record.save();

    res.status(200).json({ message: 'Senha atualizada.' });
  })
);

router.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.user!.id);
    if (!user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }
    res.status(200).json({ user: publicUser(user) });
  })
);

router.patch(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const body = updateProfileSchema.parse(req.body);
    const user = await User.findById(req.user!.id);
    if (!user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    if (body.email && body.email !== user.email) {
      const existing = await User.findOne({ email: body.email });
      if (existing) {
        res.status(409).json({ error: 'E-mail já cadastrado' });
        return;
      }
      user.email = body.email;
    }
    if (body.name) user.name = body.name;
    await user.save();

    res.status(200).json({ user: publicUser(user) });
  })
);

router.post(
  '/change-password',
  authLimiter,
  requireAuth,
  asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);
    const user = await User.findById(req.user!.id);
    if (!user || !(await checkPassword(currentPassword, user.passwordHash))) {
      res.status(401).json({ error: 'Senha atual incorreta' });
      return;
    }

    user.passwordHash = await hashUserPassword(newPassword);
    user.tokenVersion += 1;
    await user.save();

    res.status(200).json({ message: 'Senha atualizada.' });
  })
);

router.post(
  '/logout',
  asyncHandler(async (req, res) => {
    // Best-effort revocation: cookies are always cleared regardless of whether we can identify
    // who's logging out (an expired/missing token here shouldn't turn "log out" into an error).
    // Tries the access token first (Bearer header for mobile, cookie for web), then falls back
    // to the refresh token (cookie or body) — covers every shape either client actually sends.
    const header = req.headers.authorization;
    const bearerToken = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : null;
    const accessToken = bearerToken ?? req.cookies?.[getAccessTokenCookieName()] ?? null;
    const refreshToken = req.body?.refreshToken ?? req.cookies?.[getRefreshTokenCookieName()] ?? null;

    let userId: string | null = null;
    if (accessToken) {
      try {
        userId = verifyAccessToken(accessToken).id;
      } catch {
        // expired/invalid — fall through to the refresh token below
      }
    }
    if (!userId && refreshToken) {
      try {
        userId = verifyRefreshToken(refreshToken).id;
      } catch {
        // nothing usable to identify the session — clear cookies and move on
      }
    }

    if (userId) {
      await User.updateOne({ _id: userId }, { $inc: { tokenVersion: 1 } });
    }

    clearAuthCookies(res);
    res.status(200).json({ message: 'ok' });
  })
);

export default router;
