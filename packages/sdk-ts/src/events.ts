import { getPublicKey, getPublicKeyAsync, signAsync, utils, verifyAsync, etc } from "@noble/ed25519";
import { canonicalize } from "json-canonicalize";

import type {
  CreateUnsignedEnvelopeInput,
  Ed25519KeyPair,
  IdentityCreatePayload,
  IdentityMetadata,
  SignedEnvelope,
  UnsignedEnvelope
} from "./types.js";

export const DEFAULT_PROTOCOL_VERSION = "v0";
export const DEFAULT_POLICY_VERSION = "v0-default";

export function createUnsignedEnvelope(input: CreateUnsignedEnvelopeInput): UnsignedEnvelope {
  return {
    version: input.version ?? DEFAULT_PROTOCOL_VERSION,
    authorPubKey: input.authorPubKey,
    createdAt: input.createdAt ?? new Date().toISOString(),
    kind: input.kind,
    policyVersion: input.policyVersion ?? DEFAULT_POLICY_VERSION,
    payload: input.payload,
    references: input.references,
    nonce: input.nonce
  };
}

export function canonicalizeUnsignedEnvelope(unsigned: UnsignedEnvelope): string {
  return canonicalize(toCanonicalBody(unsigned));
}

export async function computeEventId(unsigned: UnsignedEnvelope): Promise<string> {
  const canonicalBytes = new TextEncoder().encode(canonicalizeUnsignedEnvelope(unsigned));
  return sha256Hex(canonicalBytes);
}

export async function generateEd25519KeyPair(): Promise<Ed25519KeyPair> {
  const secretKey = utils.randomSecretKey();
  const publicKey = await getPublicKeyAsync(secretKey);
  return {
    publicKeyHex: toHex(publicKey),
    secretKeyHex: toHex(secretKey)
  };
}

export function derivePublicKeySync(secretKeyHex: string): string {
  const secretKey = fromHex(secretKeyHex, 32, "secretKeyHex");
  return toHex(getPublicKey(secretKey));
}

export async function derivePublicKey(secretKeyHex: string): Promise<string> {
  const secretKey = fromHex(secretKeyHex, 32, "secretKeyHex");
  const publicKey = await getPublicKeyAsync(secretKey);
  return toHex(publicKey);
}

export async function signUnsignedEnvelope(
  unsigned: UnsignedEnvelope,
  secretKeyHex: string
): Promise<SignedEnvelope> {
  const secretKey = fromHex(secretKeyHex, 32, "secretKeyHex");
  const canonicalBytes = new TextEncoder().encode(canonicalizeUnsignedEnvelope(unsigned));
  const eventId = await sha256Hex(canonicalBytes);
  const signature = await signAsync(canonicalBytes, secretKey);
  return {
    ...unsigned,
    eventId,
    sig: toHex(signature)
  };
}

export async function verifySignedEnvelope(event: SignedEnvelope): Promise<boolean> {
  const unsigned: UnsignedEnvelope = {
    version: event.version,
    authorPubKey: event.authorPubKey,
    createdAt: event.createdAt,
    kind: event.kind,
    policyVersion: event.policyVersion,
    payload: event.payload,
    references: event.references,
    nonce: event.nonce
  };

  const expectedEventId = await computeEventId(unsigned);
  if (expectedEventId !== event.eventId) {
    return false;
  }

  const signature = fromHex(event.sig, 64, "sig");
  const publicKey = fromHex(event.authorPubKey, 32, "authorPubKey");
  const canonicalBytes = new TextEncoder().encode(canonicalizeUnsignedEnvelope(unsigned));
  return verifyAsync(signature, canonicalBytes, publicKey);
}

export function buildIdentityCreateUnsigned(
  authorPubKey: string,
  options: {
    metadata?: IdentityMetadata;
    recoveryPolicyHash?: string;
    createdAt?: string;
    policyVersion?: string;
    version?: string;
  } = {}
): UnsignedEnvelope {
  const payload: IdentityCreatePayload = {
    identityPubKey: authorPubKey
  };

  if (options.metadata) {
    payload.metadata = options.metadata;
  }

  if (options.recoveryPolicyHash) {
    payload.recoveryPolicyHash = options.recoveryPolicyHash;
  }

  return createUnsignedEnvelope({
    authorPubKey,
    kind: "IdentityCreate",
    payload: payload as unknown as Record<string, unknown>,
    createdAt: options.createdAt,
    policyVersion: options.policyVersion,
    version: options.version
  });
}

function toCanonicalBody(unsigned: UnsignedEnvelope): Record<string, unknown> {
  const body: Record<string, unknown> = {
    version: unsigned.version,
    authorPubKey: unsigned.authorPubKey,
    createdAt: unsigned.createdAt,
    kind: unsigned.kind,
    policyVersion: unsigned.policyVersion,
    payload: unsigned.payload
  };

  if (unsigned.references !== undefined) {
    body.references = unsigned.references;
  }

  if (unsigned.nonce !== undefined) {
    body.nonce = unsigned.nonce;
  }

  return body;
}

function toHex(value: Uint8Array): string {
  return etc.bytesToHex(value);
}

function fromHex(hex: string, expectedSize: number, fieldName: string): Uint8Array {
  const normalized = hex.trim();
  if (!/^[a-fA-F0-9]+$/.test(normalized) || normalized.length !== expectedSize * 2) {
    throw new Error(`invalid ${fieldName}; expected ${expectedSize * 2} hex characters`);
  }
  return etc.hexToBytes(normalized);
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  if (!globalThis.crypto?.subtle) {
    throw new Error("globalThis.crypto.subtle is required for event hashing");
  }
  const input = new Uint8Array(bytes.byteLength);
  input.set(bytes);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", input.buffer);
  return toHex(new Uint8Array(digest));
}
