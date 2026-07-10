import {
  bytesToBase64Url,
  base64UrlToBytes,
  decryptJson,
  encryptJson,
  hexToBytes
} from "@/lib/auth/vault-crypto";

export const WORKSPACE_STORE_FORMAT = "vectis-workspace-orders" as const;
export const WORKSPACE_STORE_VERSION = 1 as const;

export type OrderWorkspaceStore = Record<string, OrderWorkspaceRecord>;

export type OrderWorkspaceNote = {
  body: string;
  updatedAt: string;
};

export type OrderWorkspaceReminder = {
  remindAt: string;
  label: string;
  enabled: boolean;
  firedAt?: string | null;
};

export type OrderWorkspaceRecord = {
  note: OrderWorkspaceNote;
  reminder?: OrderWorkspaceReminder | null;
};

export type WorkspaceStoreDocument = {
  format: typeof WORKSPACE_STORE_FORMAT;
  version: typeof WORKSPACE_STORE_VERSION;
  publicKeyHex: string;
  cipher: {
    name: "AES-GCM";
    iv: string;
    ciphertext: string;
  };
};

async function deriveWorkspaceKey(secretKeyHex: string): Promise<CryptoKey> {
  const digest = await crypto.subtle.digest("SHA-256", hexToBytes(secretKeyHex));
  return crypto.subtle.importKey("raw", digest, { name: "AES-GCM" }, false, [
    "encrypt",
    "decrypt"
  ]);
}

export async function encryptWorkspaceStore(
  secretKeyHex: string,
  publicKeyHex: string,
  store: OrderWorkspaceStore
): Promise<WorkspaceStoreDocument> {
  const key = await deriveWorkspaceKey(secretKeyHex);
  const encrypted = await encryptJson(key, store);

  return {
    format: WORKSPACE_STORE_FORMAT,
    version: WORKSPACE_STORE_VERSION,
    publicKeyHex,
    cipher: {
      name: "AES-GCM",
      iv: bytesToBase64Url(encrypted.iv),
      ciphertext: bytesToBase64Url(encrypted.ciphertext)
    }
  };
}

export async function decryptWorkspaceStore(
  secretKeyHex: string,
  document: WorkspaceStoreDocument
): Promise<OrderWorkspaceStore> {
  if (
    document.format !== WORKSPACE_STORE_FORMAT ||
    document.version !== WORKSPACE_STORE_VERSION
  ) {
    throw new Error("Unsupported workspace store format.");
  }

  const key = await deriveWorkspaceKey(secretKeyHex);
  return decryptJson<OrderWorkspaceStore>(
    key,
    base64UrlToBytes(document.cipher.ciphertext),
    base64UrlToBytes(document.cipher.iv)
  );
}

export function isWorkspaceStoreDocument(value: unknown): value is WorkspaceStoreDocument {
  if (!value || typeof value !== "object") {
    return false;
  }
  const doc = value as WorkspaceStoreDocument;
  return (
    doc.format === WORKSPACE_STORE_FORMAT &&
    doc.version === WORKSPACE_STORE_VERSION &&
    typeof doc.publicKeyHex === "string" &&
    typeof doc.cipher?.iv === "string" &&
    typeof doc.cipher?.ciphertext === "string"
  );
}

export function emptyWorkspaceRecord(): OrderWorkspaceRecord {
  return {
    note: { body: "", updatedAt: new Date(0).toISOString() },
    reminder: null
  };
}
