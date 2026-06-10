import { base64ToBytes, bytesToBase64, bytesToUtf8, utf8ToBytes } from "./bytes";

export const DEFAULT_PBKDF2_ITERATIONS = 310_000;

export type EncryptedPayload = {
  version: 1;
  algorithm: "AES-GCM";
  kdf: "PBKDF2-SHA-256";
  iterations: number;
  salt: string;
  iv: string;
  ciphertext: string;
};

function webCrypto(): Crypto {
  if (!globalThis.crypto?.subtle) {
    throw new Error("Web Crypto is not available in this environment.");
  }
  return globalThis.crypto;
}

function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  webCrypto().getRandomValues(bytes);
  return bytes;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

async function deriveAesKey(passphrase: string, salt: Uint8Array, iterations: number): Promise<CryptoKey> {
  const crypto = webCrypto();
  const passphraseKey = await crypto.subtle.importKey(
    "raw",
    toArrayBuffer(utf8ToBytes(passphrase)),
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: toArrayBuffer(salt),
      iterations,
    },
    passphraseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function encryptBytesWithPassphrase(
  plaintext: Uint8Array,
  passphrase: string,
  iterations = DEFAULT_PBKDF2_ITERATIONS
): Promise<EncryptedPayload> {
  const crypto = webCrypto();
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const key = await deriveAesKey(passphrase, salt, iterations);
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv: toArrayBuffer(iv) }, key, toArrayBuffer(plaintext));

  return {
    version: 1,
    algorithm: "AES-GCM",
    kdf: "PBKDF2-SHA-256",
    iterations,
    salt: bytesToBase64(salt),
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
  };
}

export async function decryptBytesWithPassphrase(payload: EncryptedPayload, passphrase: string): Promise<Uint8Array> {
  const crypto = webCrypto();
  const salt = base64ToBytes(payload.salt);
  const iv = base64ToBytes(payload.iv);
  const key = await deriveAesKey(passphrase, salt, payload.iterations);
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: toArrayBuffer(iv) },
    key,
    toArrayBuffer(base64ToBytes(payload.ciphertext))
  );
  return new Uint8Array(plaintext);
}

export async function encryptJsonWithPassphrase(value: unknown, passphrase: string): Promise<EncryptedPayload> {
  return encryptBytesWithPassphrase(utf8ToBytes(JSON.stringify(value)), passphrase);
}

export async function decryptJsonWithPassphrase<T>(payload: EncryptedPayload, passphrase: string): Promise<T> {
  const bytes = await decryptBytesWithPassphrase(payload, passphrase);
  return JSON.parse(bytesToUtf8(bytes)) as T;
}
