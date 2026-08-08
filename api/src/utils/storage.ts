import { randomUUID } from 'crypto';

import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

import { env } from './env';

let cachedClient: S3Client | null = null;

function getR2Client(): S3Client {
  if (cachedClient) return cachedClient;
  cachedClient = new S3Client({
    region: 'auto',
    endpoint: `https://${env.r2AccountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: env.r2AccessKeyId,
      secretAccessKey: env.r2SecretAccessKey,
    },
  });
  return cachedClient;
}

function ensureConfigured(): void {
  if (!env.r2AccountId || !env.r2AccessKeyId || !env.r2SecretAccessKey || !env.r2BucketName || !env.r2PublicUrlBase) {
    throw new Error('R2 não configurado: defina R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME e R2_PUBLIC_URL_BASE');
  }
}

const EXTENSION_BY_CONTENT_TYPE: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
};

export async function uploadImageToR2(
  buffer: Buffer,
  contentType: string,
  userId: string,
  folder: string
): Promise<{ key: string; url: string }> {
  ensureConfigured();
  const extension = EXTENSION_BY_CONTENT_TYPE[contentType] ?? 'bin';
  const key = `${folder}/${userId}/${randomUUID()}.${extension}`;

  await getR2Client().send(
    new PutObjectCommand({
      Bucket: env.r2BucketName,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    })
  );

  return { key, url: `${env.r2PublicUrlBase}/${key}` };
}

export async function deleteImageFromR2(key: string): Promise<void> {
  try {
    ensureConfigured();
    await getR2Client().send(new DeleteObjectCommand({ Bucket: env.r2BucketName, Key: key }));
  } catch (err) {
    console.error(`[storage] Falha ao excluir objeto do R2 (key: ${key})`, err);
  }
}
