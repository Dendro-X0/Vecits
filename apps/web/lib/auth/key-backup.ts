import type { AuthSession } from "@/lib/auth/session";
import {
  bytesToBase64Url,
  base64UrlToBytes,
  decryptBytes,
  deriveKeyFromPassword,
  encryptBytes,
  PBKDF2_ITERATIONS
} from "@/lib/auth/vault-crypto";

export const KEY_BACKUP_FORMAT = "vectis-key-backup" as const;
export const KEY_BACKUP_VERSION = 1 as const;
export const KEY_BACKUP_EXTENSION = ".vectis-key.json";

export type KeyBackupDocument = {
  format: typeof KEY_BACKUP_FORMAT;
  version: typeof KEY_BACKUP_VERSION;
  createdAt: string;
  publicKeyHex: string;
  kdf: {
    name: "PBKDF2";
    hash: "SHA-256";
    iterations: number;
    salt: string;
  };
  cipher: {
    name: "AES-GCM";
    iv: string;
    ciphertext: string;
  };
};

type BackupPayload = {
  secretKeyHex: string;
  publicKeyHex: string;
};

export function isKeyBackupDocument(value: unknown): value is KeyBackupDocument {
  if (!value || typeof value !== "object") {
    return false;
  }
  const doc = value as KeyBackupDocument;
  return (
    doc.format === KEY_BACKUP_FORMAT &&
    doc.version === KEY_BACKUP_VERSION &&
    typeof doc.publicKeyHex === "string" &&
    typeof doc.createdAt === "string" &&
    doc.kdf?.name === "PBKDF2" &&
    typeof doc.kdf.salt === "string" &&
    typeof doc.cipher?.ciphertext === "string" &&
    typeof doc.cipher?.iv === "string"
  );
}

export async function createKeyBackup(
  session: AuthSession,
  password: string
): Promise<KeyBackupDocument> {
  const derived = await deriveKeyFromPassword(password);
  const payload: BackupPayload = {
    secretKeyHex: session.secretKeyHex,
    publicKeyHex: session.publicKeyHex
  };
  const encrypted = await encryptBytes(
    derived.key,
    new TextEncoder().encode(JSON.stringify(payload))
  );

  return {
    format: KEY_BACKUP_FORMAT,
    version: KEY_BACKUP_VERSION,
    createdAt: new Date().toISOString(),
    publicKeyHex: session.publicKeyHex,
    kdf: {
      name: "PBKDF2",
      hash: "SHA-256",
      iterations: derived.iterations,
      salt: bytesToBase64Url(derived.salt)
    },
    cipher: {
      name: "AES-GCM",
      iv: bytesToBase64Url(encrypted.iv),
      ciphertext: bytesToBase64Url(encrypted.ciphertext)
    }
  };
}

export async function restoreKeyBackup(
  document: KeyBackupDocument,
  password: string
): Promise<AuthSession> {
  const derived = await deriveKeyFromPassword(password, base64UrlToBytes(document.kdf.salt));
  if (derived.iterations !== document.kdf.iterations) {
    throw new Error("Unsupported backup KDF parameters.");
  }

  let payload: BackupPayload;
  try {
    const plaintext = await decryptBytes(
      derived.key,
      base64UrlToBytes(document.cipher.ciphertext),
      base64UrlToBytes(document.cipher.iv)
    );
    payload = JSON.parse(new TextDecoder().decode(plaintext)) as BackupPayload;
  } catch {
    throw new Error("Could not decrypt backup. Check your backup password.");
  }

  if (
    typeof payload.secretKeyHex !== "string" ||
    typeof payload.publicKeyHex !== "string" ||
    payload.publicKeyHex !== document.publicKeyHex
  ) {
    throw new Error("Backup payload is invalid or corrupted.");
  }

  return {
    secretKeyHex: payload.secretKeyHex,
    publicKeyHex: payload.publicKeyHex
  };
}

export function downloadKeyBackup(backup: KeyBackupDocument, filename?: string): void {
  const blob = new Blob([JSON.stringify(backup, null, 2)], {
    type: "application/json"
  });
  const url = URL.createObjectURL(blob);
  const anchor = window.document.createElement("a");
  anchor.href = url;
  anchor.download =
    filename ?? `vectis-key-${backup.publicKeyHex.slice(0, 8)}${KEY_BACKUP_EXTENSION}`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function readKeyBackupFile(file: File): Promise<KeyBackupDocument> {
  const text = await file.text();
  const parsed: unknown = JSON.parse(text);
  if (!isKeyBackupDocument(parsed)) {
    throw new Error("File is not a valid Vectis encrypted key backup.");
  }
  return parsed;
}

export function backupSecurityNote(): string {
  return `Backups use PBKDF2 (${PBKDF2_ITERATIONS} iterations) + AES-GCM. Store the backup file and password separately.`;
}
