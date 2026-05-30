import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ENCRYPTION_PREFIX = "enc:v1:";
const IV_LENGTH = 12;
let cachedEncryptionKey: Buffer | null | undefined;

function getEncryptionKey(): Buffer | null {
  if (cachedEncryptionKey !== undefined) {
    return cachedEncryptionKey;
  }

  const rawKey = process.env.DATA_ENCRYPTION_KEY;
  if (!rawKey || rawKey.trim().length === 0) {
    cachedEncryptionKey = null;
    return cachedEncryptionKey;
  }

  try {
    const key = Buffer.from(rawKey, "base64");
    cachedEncryptionKey = key.length === 32 ? key : null;
    return cachedEncryptionKey;
  } catch {
    cachedEncryptionKey = null;
    return cachedEncryptionKey;
  }
}

export function encryptField(value: string): string {
  const key = getEncryptionKey();
  if (!key) return value;
  if (value.startsWith(ENCRYPTION_PREFIX)) return value;

  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${ENCRYPTION_PREFIX}${Buffer.concat([iv, authTag, encrypted]).toString("base64")}`;
}

export function decryptField(value: string): string {
  if (!value.startsWith(ENCRYPTION_PREFIX)) return value;

  const key = getEncryptionKey();
  if (!key) return value;

  try {
    const payload = Buffer.from(value.slice(ENCRYPTION_PREFIX.length), "base64");
    const iv = payload.subarray(0, IV_LENGTH);
    const authTag = payload.subarray(IV_LENGTH, IV_LENGTH + 16);
    const encrypted = payload.subarray(IV_LENGTH + 16);

    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]).toString("utf8");

    return decrypted;
  } catch {
    // Keep original stored value if decryption fails
    return value;
  }
}
