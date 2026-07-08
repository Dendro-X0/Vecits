import type { AuthSession } from "@/lib/auth/session";
import {
  asBufferSource,
  base64UrlToBytes,
  bytesToBase64Url,
  decryptJson,
  deriveKeyFromPassword,
  encryptJson,
  hexToBytes,
  randomBytes
} from "@/lib/auth/vault-crypto";

export const PASSKEY_VAULT_STORAGE_KEY = "vectis.auth.passkey_vault";
export const PASSKEY_VAULT_VERSION = 1 as const;

export type PasskeyVaultRecord = {
  version: typeof PASSKEY_VAULT_VERSION;
  credentialId: string;
  publicKeyHex: string;
  prfSalt: string;
  ciphertext: string;
  iv: string;
  passwordFallback?: {
    kdfSalt: string;
    iv: string;
    ciphertext: string;
    iterations: number;
  };
  createdAt: string;
  label?: string;
};

type VaultPayload = AuthSession;

type PrfExtensionInput = {
  eval?: {
    first?: BufferSource;
  };
};

type PrfExtensionOutput = {
  results?: {
    first?: ArrayBuffer;
  };
};

function getRpId(): string {
  return window.location.hostname;
}

function randomChallenge(): Uint8Array {
  return randomBytes(32);
}

function readPasskeyVaultRecord(): PasskeyVaultRecord | null {
  const raw = localStorage.getItem(PASSKEY_VAULT_STORAGE_KEY);
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as PasskeyVaultRecord;
    if (parsed.version !== PASSKEY_VAULT_VERSION) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writePasskeyVaultRecord(record: PasskeyVaultRecord): void {
  localStorage.setItem(PASSKEY_VAULT_STORAGE_KEY, JSON.stringify(record));
}

export function hasPasskeyVault(): boolean {
  return readPasskeyVaultRecord() !== null;
}

export function getPasskeyVaultMeta(): Pick<PasskeyVaultRecord, "publicKeyHex" | "credentialId" | "label"> | null {
  const record = readPasskeyVaultRecord();
  if (!record) {
    return null;
  }
  return {
    publicKeyHex: record.publicKeyHex,
    credentialId: record.credentialId,
    label: record.label
  };
}

export function clearPasskeyVault(): void {
  localStorage.removeItem(PASSKEY_VAULT_STORAGE_KEY);
}

function supportsWebAuthn(): boolean {
  return typeof window !== "undefined" && "PublicKeyCredential" in window;
}

async function supportsPrf(): Promise<boolean> {
  if (!supportsWebAuthn()) {
    return false;
  }
  try {
    const credentialCtor = PublicKeyCredential as typeof PublicKeyCredential & {
      getClientCapabilities?: () => Promise<Record<string, boolean>>;
    };
    if (!credentialCtor.getClientCapabilities) {
      return false;
    }
    const result = await credentialCtor.getClientCapabilities();
    return Boolean(result["extension:prf"]);
  } catch {
    return false;
  }
}

function extractPrfOutput(credential: PublicKeyCredential | null): Uint8Array | null {
  if (!credential) {
    return null;
  }
  const extensions = credential.getClientExtensionResults() as { prf?: PrfExtensionOutput };
  const first = extensions.prf?.results?.first;
  if (!first) {
    return null;
  }
  return new Uint8Array(first);
}

export async function setupPasskeyVault(
  session: AuthSession,
  options: {
    label?: string;
    backupPassword?: string;
  } = {}
): Promise<{ prfEnabled: boolean }> {
  if (!supportsWebAuthn()) {
    throw new Error("Passkeys are not supported in this browser.");
  }

  const prfEnabled = await supportsPrf();
  const prfSalt = randomBytes(32);
  const userId = hexToBytes(session.publicKeyHex);

  const createOptions: PublicKeyCredentialCreationOptions = {
    challenge: asBufferSource(randomChallenge()),
    rp: {
      name: "Vectis",
      id: getRpId()
    },
    user: {
      id: asBufferSource(userId),
      name: session.publicKeyHex.slice(0, 16),
      displayName: options.label ?? "Vectis identity"
    },
    pubKeyCredParams: [{ type: "public-key", alg: -7 }],
    authenticatorSelection: {
      residentKey: "required",
      userVerification: "required"
    },
    extensions: prfEnabled
      ? ({
          prf: {
            eval: {
              first: asBufferSource(prfSalt)
            }
          }
        } as AuthenticationExtensionsClientInputs)
      : undefined
  };

  const created = (await navigator.credentials.create({
    publicKey: createOptions
  })) as PublicKeyCredential | null;

  if (!created) {
    throw new Error("Passkey creation was cancelled.");
  }

  let encryptionKey: CryptoKey;
  if (prfEnabled) {
    const prfOutput = extractPrfOutput(created);
    if (!prfOutput) {
      throw new Error(
        "Passkey was created but PRF output is unavailable. Use encrypted backup export instead."
      );
    }
    const derived = await crypto.subtle.importKey(
      "raw",
      asBufferSource(prfOutput),
      { name: "AES-GCM" },
      false,
      ["encrypt", "decrypt"]
    );
    encryptionKey = derived;
  } else if (options.backupPassword?.trim()) {
    const derived = await deriveKeyFromPassword(options.backupPassword.trim());
    encryptionKey = derived.key;
  } else {
    throw new Error(
      "This device does not expose WebAuthn PRF. Provide a backup password to create a passkey vault."
    );
  }

  const encrypted = await encryptJson(encryptionKey, {
    secretKeyHex: session.secretKeyHex,
    publicKeyHex: session.publicKeyHex
  } satisfies VaultPayload);

  const record: PasskeyVaultRecord = {
    version: PASSKEY_VAULT_VERSION,
    credentialId: bytesToBase64Url(new Uint8Array(created.rawId)),
    publicKeyHex: session.publicKeyHex,
    prfSalt: bytesToBase64Url(prfSalt),
    ciphertext: bytesToBase64Url(encrypted.ciphertext),
    iv: bytesToBase64Url(encrypted.iv),
    createdAt: new Date().toISOString(),
    label: options.label
  };

  if (!prfEnabled && options.backupPassword?.trim()) {
    const fallback = await deriveKeyFromPassword(options.backupPassword.trim());
    const fallbackEncrypted = await encryptJson(fallback.key, {
      secretKeyHex: session.secretKeyHex,
      publicKeyHex: session.publicKeyHex
    } satisfies VaultPayload);
    record.passwordFallback = {
      kdfSalt: bytesToBase64Url(fallback.salt),
      iv: bytesToBase64Url(fallbackEncrypted.iv),
      ciphertext: bytesToBase64Url(fallbackEncrypted.ciphertext),
      iterations: fallback.iterations
    };
  }

  writePasskeyVaultRecord(record);
  return { prfEnabled };
}

export async function unlockPasskeyVault(options: { backupPassword?: string } = {}): Promise<AuthSession> {
  const record = readPasskeyVaultRecord();
  if (!record) {
    throw new Error("No passkey vault is configured on this device.");
  }
  if (!supportsWebAuthn()) {
    throw new Error("Passkeys are not supported in this browser.");
  }

  const prfSalt = base64UrlToBytes(record.prfSalt);
  const credentialId = base64UrlToBytes(record.credentialId);

  const assertion = (await navigator.credentials.get({
    publicKey: {
      challenge: asBufferSource(randomChallenge()),
      rpId: getRpId(),
      allowCredentials: [{ type: "public-key", id: asBufferSource(credentialId) }],
      userVerification: "required",
      extensions: {
        prf: {
          eval: {
            first: asBufferSource(prfSalt)
          }
        }
      } as AuthenticationExtensionsClientInputs
    }
  })) as PublicKeyCredential | null;

  if (!assertion) {
    throw new Error("Passkey unlock was cancelled.");
  }

  const prfOutput = extractPrfOutput(assertion);
  if (prfOutput) {
    const encryptionKey = await crypto.subtle.importKey(
      "raw",
      asBufferSource(prfOutput),
      { name: "AES-GCM" },
      false,
      ["decrypt"]
    );
    return decryptJson<VaultPayload>(
      encryptionKey,
      base64UrlToBytes(record.ciphertext),
      base64UrlToBytes(record.iv)
    );
  }

  if (record.passwordFallback && options.backupPassword?.trim()) {
    const derived = await deriveKeyFromPassword(
      options.backupPassword.trim(),
      base64UrlToBytes(record.passwordFallback.kdfSalt)
    );
    return decryptJson<VaultPayload>(
      derived.key,
      base64UrlToBytes(record.passwordFallback.ciphertext),
      base64UrlToBytes(record.passwordFallback.iv)
    );
  }

  throw new Error(
    "Passkey unlock needs WebAuthn PRF support or your vault backup password on this device."
  );
}

export async function passkeyVaultCapabilities(): Promise<{
  webauthn: boolean;
  prf: boolean;
}> {
  return {
    webauthn: supportsWebAuthn(),
    prf: await supportsPrf()
  };
}
