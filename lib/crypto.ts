/**
 * AES-256-GCM encryption for storing CRM credentials in the database.
 * Uses ENCRYPTION_SECRET from env — must be exactly 32 bytes (64 hex chars).
 */
import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;  // 96-bit IV for GCM

function getKey(): Buffer {
  const secret = process.env.ENCRYPTION_SECRET;
  if (!secret) throw new Error('ENCRYPTION_SECRET is not set in environment');
  if (secret.length !== 64) throw new Error('ENCRYPTION_SECRET must be 64 hex characters (32 bytes)');
  return Buffer.from(secret, 'hex');
}

/** Encrypt a plaintext string → "iv:authTag:ciphertext" (all hex) */
export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString('hex'), authTag.toString('hex'), encrypted.toString('hex')].join(':');
}

/** Decrypt a "iv:authTag:ciphertext" string → plaintext */
export function decrypt(encoded: string): string {
  const key = getKey();
  const [ivHex, authTagHex, encryptedHex] = encoded.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const encrypted = Buffer.from(encryptedHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}

/** Safely decrypt, returning null on failure instead of throwing */
export function safeDecrypt(encoded: string | null | undefined): string | null {
  if (!encoded) return null;
  try { return decrypt(encoded); } catch { return null; }
}

/** Generate a random 32-byte hex key (for use as ENCRYPTION_SECRET) */
export function generateKey(): string {
  return crypto.randomBytes(32).toString('hex');
}