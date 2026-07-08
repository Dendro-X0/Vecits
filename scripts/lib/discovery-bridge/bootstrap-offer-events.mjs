import { createHash } from "node:crypto";
import {
  createUnsignedEnvelope,
  derivePublicKey,
  signUnsignedEnvelope,
} from "../../../packages/sdk-ts/dist/index.js";

const ALICE_SECRET = "1111111111111111111111111111111111111111111111111111111111111111";
const BOB_SECRET = "2222222222222222222222222222222222222222222222222222222222222222";
const CAROL_SECRET = "3333333333333333333333333333333333333333333333333333333333333333";

const LANE_DEFAULT_PRICES = {
  "software-fixes": 100,
  "feature-work": 180,
  documentation: 90,
  translation: 110,
  testing: 95,
  research: 140,
  "project-maintenance": 160,
  "compute-job": 220,
};

async function signEvent(secretKey, kind, createdAt, payload, references, nonce) {
  const authorPubKey = await derivePublicKey(secretKey);
  const unsigned = createUnsignedEnvelope({
    authorPubKey,
    kind,
    createdAt,
    payload,
    references,
    nonce,
    policyVersion: "v0-default",
  });
  return signUnsignedEnvelope(unsigned, secretKey);
}

export function offerIdForDraft(draft, prefix = "disc") {
  const signalId = draft.provenance?.signalId;
  if (!signalId) {
    throw new Error("offer draft missing provenance.signalId");
  }
  return `${prefix}-${signalId.slice(0, 24)}`;
}

export async function buildOfferEventsFromDraft(draft, options = {}) {
  const baseTime = options.baseTime ?? "2026-07-01T00:00:00Z";
  const offerId = options.offerId ?? offerIdForDraft(draft, options.offerIdPrefix);
  const serviceType = draft.payload.serviceType;
  const pricePerUnitCredits =
    options.pricePerUnitCredits ?? LANE_DEFAULT_PRICES[serviceType] ?? 100;

  const alicePk = await derivePublicKey(ALICE_SECRET);
  const bobPk = await derivePublicKey(BOB_SECRET);
  const carolPk = await derivePublicKey(CAROL_SECRET);

  const events = [
    await signEvent(ALICE_SECRET, "IdentityCreate", `${baseTime.slice(0, 11)}00:00:00Z`, {
      identityPubKey: alicePk,
      metadata: { displayName: "alice" },
    }),
    await signEvent(BOB_SECRET, "IdentityCreate", `${baseTime.slice(0, 11)}00:00:01Z`, {
      identityPubKey: bobPk,
      metadata: { displayName: "bob" },
    }),
    await signEvent(CAROL_SECRET, "IdentityCreate", `${baseTime.slice(0, 11)}00:00:02Z`, {
      identityPubKey: carolPk,
      metadata: { displayName: "carol" },
    }),
    await signEvent(ALICE_SECRET, "Vouch", `${baseTime.slice(0, 11)}00:01:00Z`, {
      subjectPubKey: bobPk,
      weight: 1,
    }),
    await signEvent(CAROL_SECRET, "Vouch", `${baseTime.slice(0, 11)}00:01:01Z`, {
      subjectPubKey: bobPk,
      weight: 1,
    }),
    await signEvent(BOB_SECRET, "ServiceOffer", `${baseTime.slice(0, 11)}00:02:00Z`, {
      offerId,
      serviceType,
      unitDefinition: draft.payload.unitDefinition,
      pricePerUnitCredits,
      deliveryMode: draft.payload.deliveryMode,
      offerExpiresAt: options.offerExpiresAt ?? "2026-12-01T00:00:00Z",
      allowedEvidenceFormats: draft.payload.allowedEvidenceFormats,
      termsHash: createHash("sha256").update(draft.provenance.signalId).digest("hex"),
    }),
  ];

  return {
    events,
    offerId,
    providerPubKey: bobPk,
    serviceType,
  };
}
