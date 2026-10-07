import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const AUTH_TAG_BYTES = 16;
const IV_BYTES = 12;
const KEY_BYTES = 32;
const KEY_VARIABLE = "TOKEN_ENCRYPTION_KEY";
const PAYLOAD_VERSION = "v1";
const DECRYPTION_ERROR = "Unable to decrypt token.";

function readEncryptionKey(): Buffer {
  const encodedKey = process.env[KEY_VARIABLE];

  if (!encodedKey) {
    throw new Error(`${KEY_VARIABLE} is required.`);
  }

  if (
    encodedKey.length % 4 !== 0 ||
    !/^[A-Za-z0-9+/]+={0,2}$/.test(encodedKey)
  ) {
    throw new Error(
      `${KEY_VARIABLE} must be base64 that decodes to exactly 32 bytes.`,
    );
  }

  const key = Buffer.from(encodedKey, "base64");

  if (key.length !== KEY_BYTES || key.toString("base64") !== encodedKey) {
    throw new Error(
      `${KEY_VARIABLE} must be base64 that decodes to exactly 32 bytes.`,
    );
  }

  return key;
}

function decodePayloadPart(value: string): Buffer {
  if (!/^[A-Za-z0-9_-]*$/.test(value)) {
    throw new Error(DECRYPTION_ERROR);
  }

  const decoded = Buffer.from(value, "base64url");

  if (decoded.toString("base64url") !== value) {
    throw new Error(DECRYPTION_ERROR);
  }

  return decoded;
}

export function encryptToken(plaintext: string): string {
  const key = readEncryptionKey();
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return [
    PAYLOAD_VERSION,
    iv.toString("base64url"),
    authTag.toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(".");
}

export function decryptToken(payload: string): string {
  const key = readEncryptionKey();

  try {
    const parts = payload.split(".");

    if (parts.length !== 4 || parts[0] !== PAYLOAD_VERSION) {
      throw new Error(DECRYPTION_ERROR);
    }

    const iv = decodePayloadPart(parts[1]);
    const authTag = decodePayloadPart(parts[2]);
    const ciphertext = decodePayloadPart(parts[3]);

    if (iv.length !== IV_BYTES || authTag.length !== AUTH_TAG_BYTES) {
      throw new Error(DECRYPTION_ERROR);
    }

    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    return Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    throw new Error(DECRYPTION_ERROR);
  }
}
