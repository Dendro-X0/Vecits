import { canonicalize } from "json-canonicalize";
import {
  createUnsignedEnvelope,
  derivePublicKey,
  signUnsignedEnvelope,
} from "../../packages/sdk-ts/dist/index.js";
import { R2_KEYS } from "./r2-exchange-core.mjs";

const LANE = "compute-job";

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

function timestampAt(baseDate, second) {
  return `${baseDate}T00:00:${String(second).padStart(2, "0")}Z`;
}

async function sha256Hex(input) {
  const bytes =
    typeof input === "string" ? new TextEncoder().encode(input) : new Uint8Array(input);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return Buffer.from(digest).toString("hex");
}

async function buildDeliveryHints({ jobId, providerPubKey, notes, outputHashes, urls }) {
  const notesHash = await sha256Hex(notes.trim());
  const receipt = {
    version: "job-receipt-v1",
    jobId,
    providerPubKey: providerPubKey.toLowerCase(),
    generatedAt: `${new Date().toISOString().slice(0, 19)}Z`,
    inputHashes: [],
    outputHashes,
    urls,
    notesHash,
  };
  const canonicalReceipt = canonicalize(receipt);
  const receiptHash = await sha256Hex(canonicalReceipt);
  return {
    receipt,
    canonicalReceipt,
    receiptHash,
    notesHash,
    deliveryHints: {
      evidenceFormat: "job-receipt-v1",
      artifactHashes: [receiptHash, ...outputHashes],
      notesHash,
      urls,
    },
  };
}

export async function buildR6ComputeJobExchangeEvents(runId, baseDate = "2026-07-02") {
  const buyerPk = await derivePublicKey(R2_KEYS.buyer);
  const providerPk = await derivePublicKey(R2_KEYS.provider);
  const sponsorAPk = await derivePublicKey(R2_KEYS.sponsorA);
  const sponsorBPk = await derivePublicKey(R2_KEYS.sponsorB);

  const offerId = `r6-${runId}-offer`;
  const orderId = `r6-${runId}-order`;
  const claimId = `r6-${runId}-claim`;
  const milestoneId = "m1";
  const jobId = `r6-${runId}-job`;
  const pricePerUnitCredits = 220;
  const outputHashes = [`output-${runId}-1`];
  const urls = [`https://example.com/compute-job/${runId}`];
  const notes = `R6 compute-job lane drill receipt for ${runId}`;

  const receiptBundle = await buildDeliveryHints({
    jobId,
    providerPubKey: providerPk,
    notes,
    outputHashes,
    urls,
  });

  const events = [];

  events.push(
    await signEvent(R2_KEYS.buyer, "IdentityCreate", timestampAt(baseDate, 0), {
      identityPubKey: buyerPk,
      metadata: { displayName: "r6-buyer" },
    }),
    await signEvent(R2_KEYS.provider, "IdentityCreate", timestampAt(baseDate, 1), {
      identityPubKey: providerPk,
      metadata: { displayName: "r6-provider" },
    }),
    await signEvent(R2_KEYS.sponsorA, "IdentityCreate", timestampAt(baseDate, 2), {
      identityPubKey: sponsorAPk,
      metadata: { displayName: "r6-sponsor-a" },
    }),
    await signEvent(R2_KEYS.sponsorB, "IdentityCreate", timestampAt(baseDate, 3), {
      identityPubKey: sponsorBPk,
      metadata: { displayName: "r6-sponsor-b" },
    }),
    await signEvent(R2_KEYS.buyer, "Vouch", timestampAt(baseDate, 4), {
      subjectPubKey: sponsorAPk,
      weight: 1,
    }),
    await signEvent(R2_KEYS.buyer, "Vouch", timestampAt(baseDate, 5), {
      subjectPubKey: sponsorBPk,
      weight: 1,
    }),
    await signEvent(R2_KEYS.sponsorA, "Vouch", timestampAt(baseDate, 6), {
      subjectPubKey: providerPk,
      weight: 1,
    }),
    await signEvent(R2_KEYS.sponsorB, "Vouch", timestampAt(baseDate, 7), {
      subjectPubKey: providerPk,
      weight: 1,
    }),
  );

  const claim = await signEvent(
    R2_KEYS.buyer,
    "ContributionClaim",
    timestampAt(baseDate, 8),
    {
      claimId,
      claimType: "maintenance",
      artifactHash: `claim-${runId}`,
      summary: "R6 compute-job lane operator drill",
      requestedCredits: 500,
    },
  );
  events.push(claim);
  events.push(
    await signEvent(
      R2_KEYS.sponsorA,
      "ContributionAttest",
      timestampAt(baseDate, 9),
      { claimId, decision: "approve" },
      { claim: claim.eventId },
    ),
    await signEvent(
      R2_KEYS.sponsorB,
      "ContributionAttest",
      timestampAt(baseDate, 10),
      { claimId, decision: "approve" },
      { claim: claim.eventId },
    ),
    await signEvent(
      R2_KEYS.buyer,
      "MintCredits",
      timestampAt(baseDate, 11),
      {
        beneficiaryPubKey: buyerPk,
        amount: 500,
        expiresAt: "2026-12-01T00:00:00Z",
        mintReason: "contribution",
        sourceClaimId: claimId,
      },
      { claim: claim.eventId },
    ),
  );

  const offer = await signEvent(R2_KEYS.provider, "ServiceOffer", timestampAt(baseDate, 12), {
    offerId,
    serviceType: LANE,
    unitDefinition: "deterministic compute job",
    pricePerUnitCredits,
    deliveryMode: "receipt",
    offerExpiresAt: "2026-12-01T00:00:00Z",
    allowedEvidenceFormats: ["job-receipt-v1"],
  });
  events.push(offer);

  const order = await signEvent(
    R2_KEYS.buyer,
    "ServiceOrder",
    timestampAt(baseDate, 13),
    {
      buyerPubKey: buyerPk,
      milestones: [
        {
          amountCredits: pricePerUnitCredits,
          evidenceFormat: "job-receipt-v1",
          milestoneId,
        },
      ],
      offerId,
      orderExpiresAt: "2026-12-15T00:00:00Z",
      orderId,
      providerPubKey: providerPk,
    },
    { offer: offer.eventId },
  );
  events.push(order);

  events.push(
    await signEvent(
      R2_KEYS.buyer,
      "SpendCredits",
      timestampAt(baseDate, 14),
      {
        amount: pricePerUnitCredits,
        milestoneId,
        orderId,
        sinkKind: "ServiceEscrowSink",
        spenderPubKey: buyerPk,
      },
      undefined,
      `${runId}-escrow-1`,
    ),
  );

  const { deliveryHints } = receiptBundle;
  const delivery = await signEvent(
    R2_KEYS.provider,
    "ServiceDelivery",
    timestampAt(baseDate, 15),
    {
      artifactHashes: deliveryHints.artifactHashes,
      deliveredAt: timestampAt(baseDate, 15),
      evidenceFormat: "job-receipt-v1",
      milestoneId,
      orderId,
      urls: deliveryHints.urls,
      notesHash: deliveryHints.notesHash,
    },
    { order: order.eventId },
  );
  events.push(delivery);

  events.push(
    await signEvent(
      R2_KEYS.buyer,
      "ServiceAccept",
      timestampAt(baseDate, 16),
      {
        acceptedAt: timestampAt(baseDate, 16),
        milestoneId,
        orderId,
      },
      { delivery: delivery.eventId },
    ),
  );

  return {
    events,
    lane: LANE,
    offerId,
    orderId,
    milestoneId,
    jobId,
    buyerPubKey: buyerPk,
    providerPubKey: providerPk,
    asOf: `${baseDate}T00:16:00Z`,
    receiptBundle,
    pricePerUnitCredits,
  };
}
