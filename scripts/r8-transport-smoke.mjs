#!/usr/bin/env node

/**
 * R8-C transport bundle smoke — validates Tier 1 envelope shape in-repo (no browser).
 */

const SAMPLE_VOUCH = {
  v: 1,
  kind: "vectis.transport.v1",
  type: "vouch.request",
  createdAt: "2026-07-10T12:00:00Z",
  expiresAt: "2026-07-11T12:00:00Z",
  nodeUrl: "https://node.example",
  payload: {
    subjectPubKey: "a".repeat(64)
  }
};

const SAMPLE_EXPIRED = {
  ...SAMPLE_VOUCH,
  expiresAt: "2020-01-01T00:00:00Z"
};

function assert(condition, message) {
  if (!condition) {
    console.error(`R8 transport smoke failed: ${message}`);
    process.exit(1);
  }
}

function validateEnvelope(bundle) {
  assert(bundle && typeof bundle === "object", "bundle must be object");
  assert(bundle.v === 1, "v must be 1");
  assert(bundle.kind === "vectis.transport.v1", "kind must be vectis.transport.v1");
  assert(typeof bundle.type === "string", "type required");
  assert(typeof bundle.createdAt === "string", "createdAt required");
  assert(typeof bundle.expiresAt === "string", "expiresAt required");
  assert(typeof bundle.nodeUrl === "string" && bundle.nodeUrl.length > 0, "nodeUrl required");
  assert(bundle.payload && typeof bundle.payload === "object", "payload required");
}

function isExpired(bundle) {
  return Date.parse(bundle.expiresAt) <= Date.now();
}

function validatePhysicalHandoffDelivery(payload) {
  if (payload.evidenceFormat !== "physical-handoff-ack-dual-v1") {
    return "evidenceFormat must be physical-handoff-ack-dual-v1";
  }
  const hashes = payload.artifactHashes;
  if (!Array.isArray(hashes) || hashes.length !== 2) {
    return "artifactHashes must contain exactly two entries";
  }
  if (new Set(hashes.map(String)).size !== 2) {
    return "artifactHashes must be distinct";
  }
  if (typeof payload.notesHash !== "string" || !payload.notesHash.trim()) {
    return "notesHash is required";
  }
  if (Array.isArray(payload.urls) && payload.urls.length > 0) {
    return "urls must be omitted for physical-handoff dual ack";
  }
  return null;
}

function main() {
  validateEnvelope(SAMPLE_VOUCH);
  assert(SAMPLE_VOUCH.type === "vouch.request", "vouch type");
  assert(/^[0-9a-f]{64}$/.test(SAMPLE_VOUCH.payload.subjectPubKey), "subject pubkey hex");

  validateEnvelope(SAMPLE_EXPIRED);
  assert(isExpired(SAMPLE_EXPIRED), "expired sample should be expired");
  assert(!isExpired(SAMPLE_VOUCH), "fresh sample should not be expired");

  const handoffPayload = {
    evidenceFormat: "physical-handoff-ack-dual-v1",
    artifactHashes: ["provider-ack", "buyer-ack"],
    notesHash: "notes-hash"
  };
  assert(validatePhysicalHandoffDelivery(handoffPayload) === null, "valid handoff delivery shape");
  assert(
    validatePhysicalHandoffDelivery({ ...handoffPayload, artifactHashes: ["same", "same"] }) !== null,
    "duplicate handoff hashes rejected"
  );

  console.log("R8 transport smoke passed (Tier 1 envelope + handoff delivery shape).");
}

main();
