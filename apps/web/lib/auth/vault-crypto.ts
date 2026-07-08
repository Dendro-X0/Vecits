const PBKDF2_ITERATIONS = 210_000;

export type DerivedKeyMaterial = {
  key: CryptoKey;
  salt: Uint8Array;
  iterations: number;
};

export function asBufferSource(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  return new Uint8Array(bytes);
}

export function randomBytes(length: number): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

export function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function base64UrlToBytes(value: string): Uint8Array<ArrayBuffer> {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

export function hexToBytes(hex: string): Uint8Array<ArrayBuffer> {
  const normalized = hex.trim();
  if (!/^[0-9a-fA-F]+$/.test(normalized) || normalized.length % 2 !== 0) {
    throw new Error("Invalid hex input");
  }
  const bytes = new Uint8Array(normalized.length / 2);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(normalized.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
}

export async function deriveKeyFromPassword(
  password: string,
  salt: Uint8Array = randomBytes(16)
): Promise<DerivedKeyMaterial> {
  const material = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  const key = await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: asBufferSource(salt),
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256"
    },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );

  return { key, salt, iterations: PBKDF2_ITERATIONS };
}

export async function encryptBytes(
  key: CryptoKey,
  plaintext: Uint8Array,
  iv: Uint8Array = randomBytes(12)
): Promise<{ ciphertext: Uint8Array<ArrayBuffer>; iv: Uint8Array<ArrayBuffer> }> {
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: asBufferSource(iv) },
    key,
    asBufferSource(plaintext)
  );
  return { ciphertext: new Uint8Array(encrypted), iv: asBufferSource(iv) };
}

export async function decryptBytes(
  key: CryptoKey,
  ciphertext: Uint8Array,
  iv: Uint8Array
): Promise<Uint8Array<ArrayBuffer>> {
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: asBufferSource(iv) },
    key,
    asBufferSource(ciphertext)
  );
  return new Uint8Array(decrypted);
}

export async function encryptJson(
  key: CryptoKey,
  value: unknown
): Promise<{ ciphertext: Uint8Array<ArrayBuffer>; iv: Uint8Array<ArrayBuffer> }> {
  const plaintext = new TextEncoder().encode(JSON.stringify(value));
  return encryptBytes(key, plaintext);
}

export async function decryptJson<T>(
  key: CryptoKey,
  ciphertext: Uint8Array,
  iv: Uint8Array
): Promise<T> {
  const plaintext = await decryptBytes(key, ciphertext, iv);
  return JSON.parse(new TextDecoder().decode(plaintext)) as T;
}

export { PBKDF2_ITERATIONS };
