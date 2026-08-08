import { z } from 'zod';

const email = z.string().trim().email().max(254).toLowerCase();
const name = z.string().trim().min(2).max(80);
const password = z.string().min(8).max(128);
const code = z.string().length(6);
const token = z.string().min(1).max(2000);

export const registerRequestSchema = z.object({
  name,
  email,
  password,
});

export const registerSchema = z.object({
  email,
  code,
});

export const loginSchema = z.object({
  email,
  password: z.string().min(1).max(128),
});

export const refreshSchema = z.object({
  refreshToken: token,
});

export const forgotPasswordSchema = z.object({
  email,
});

export const resetPasswordSchema = z.object({
  email,
  code,
  password,
});

export const logoutSchema = z.object({
  refreshToken: token,
});

export const updateProfileSchema = z.object({
  name: name.optional(),
  email: email.optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: password,
});
