function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  port: Number(process.env.PORT ?? 4000),
  mongodbUri: requireEnv('MONGODB_URI'),
  authAccessTokenSecret: requireEnv('AUTH_ACCESS_TOKEN_SECRET'),
  authRefreshTokenSecret: requireEnv('AUTH_REFRESH_TOKEN_SECRET'),
  authAccessTokenTtl: process.env.AUTH_ACCESS_TOKEN_TTL ?? '15m',
  authRefreshTokenTtl: process.env.AUTH_REFRESH_TOKEN_TTL ?? '30d',
  emailCodePepper: requireEnv('EMAIL_CODE_PEPPER'),
  resendApiKey: process.env.RESEND_API_KEY ?? '',
  resendFromEmail: process.env.RESEND_FROM_EMAIL ?? 'Gym Bro <onboarding@resend.dev>',
  corsOrigin: process.env.CORS_ORIGIN ?? '*',
  r2AccountId: process.env.R2_ACCOUNT_ID ?? '',
  r2AccessKeyId: process.env.R2_ACCESS_KEY_ID ?? '',
  r2SecretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? '',
  r2BucketName: process.env.R2_BUCKET_NAME ?? '',
  r2PublicUrlBase: process.env.R2_PUBLIC_URL_BASE ?? '',
};
