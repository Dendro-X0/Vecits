import { canonicalize } from "json-canonicalize";
import { signAsync, verifyAsync, etc } from "@noble/ed25519";
import { derivePublicKey } from "../../../packages/sdk-ts/dist/index.js";
import { canonicalSignalBody } from "./signal-schema.mjs";

export const SIGNAL_ENVELOPE_SCHEMA = "discovery-signal-envelope-v1";

function envelopeBody(operatorPubKey, signedAt, signal) {
	return {
		schemaVersion: SIGNAL_ENVELOPE_SCHEMA,
		operatorPubKey,
		signedAt,
		signal: canonicalSignalBody(signal),
	};
}

function canonicalEnvelopeBytes(body) {
	return new TextEncoder().encode(canonicalize(body));
}

function toHex(bytes) {
	return etc.bytesToHex(bytes);
}

function fromHex(hex, expectedSize, fieldName) {
	const normalized = hex.trim();
	if (!/^[a-fA-F0-9]+$/.test(normalized) || normalized.length !== expectedSize * 2) {
		throw new Error(`invalid ${fieldName}; expected ${expectedSize * 2} hex characters`);
	}
	return etc.hexToBytes(normalized);
}

export async function signSignalEnvelope(signal, secretKey, signedAt = new Date().toISOString()) {
	const operatorPubKey = await derivePublicKey(secretKey);
	const body = envelopeBody(operatorPubKey, signedAt, signal);
	const signature = await signAsync(canonicalEnvelopeBytes(body), fromHex(secretKey, 32, "secretKey"));
	return {
		...body,
		sig: toHex(signature),
	};
}

export async function verifySignalEnvelope(envelope) {
	if (envelope.schemaVersion !== SIGNAL_ENVELOPE_SCHEMA) {
		return false;
	}
	if (!envelope.operatorPubKey || !envelope.signedAt || !envelope.signal || !envelope.sig) {
		return false;
	}
	const body = envelopeBody(envelope.operatorPubKey, envelope.signedAt, envelope.signal);
	const signature = fromHex(envelope.sig, 64, "sig");
	const publicKey = fromHex(envelope.operatorPubKey, 32, "operatorPubKey");
	return verifyAsync(signature, canonicalEnvelopeBytes(body), publicKey);
}

export function isSignalEnvelope(value) {
	return value?.schemaVersion === SIGNAL_ENVELOPE_SCHEMA;
}
