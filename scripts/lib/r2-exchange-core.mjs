import {
  COMMUNITY_ARTIFACT_LANE_PRESETS,
  COMMUNITY_ARTIFACT_LANES,
} from "./r6-lane-template-registry.mjs";
import {
  createUnsignedEnvelope,
  derivePublicKey,
  signUnsignedEnvelope,
} from "../../packages/sdk-ts/dist/index.js";

export const ALLOWED_LANES = COMMUNITY_ARTIFACT_LANES;

export const R2_KEYS = {
  buyer: "4444444444444444444444444444444444444444444444444444444444444444",
  provider: "5555555555555555555555555555555555555555555555555555555555555555",
  sponsorA: "6666666666666666666666666666666666666666666666666666666666666666",
  sponsorB: "7777777777777777777777777777777777777777777777777777777777777777",
};

const LANE_PRESETS = Object.fromEntries(
  COMMUNITY_ARTIFACT_LANES.map((lane) => {
    const preset = COMMUNITY_ARTIFACT_LANE_PRESETS[lane];
    return [
      lane,
      {
        unitDefinition: preset.unitDefinition,
        pricePerUnitCredits: preset.pricePerUnitCredits,
        artifactHash: preset.artifactHash,
        summary: preset.summary,
      },
    ];
  }),
);

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

export async function buildR2ExchangeEvents(lane, runId, baseDate = "2026-07-02") {
  if (!ALLOWED_LANES.includes(lane)) {
    throw new Error(`lane must be one of: ${ALLOWED_LANES.join(", ")}`);
  }

  const preset = LANE_PRESETS[lane];
  const buyerPk = await derivePublicKey(R2_KEYS.buyer);
  const providerPk = await derivePublicKey(R2_KEYS.provider);
  const sponsorAPk = await derivePublicKey(R2_KEYS.sponsorA);
  const sponsorBPk = await derivePublicKey(R2_KEYS.sponsorB);

  const offerId = `r2-${runId}-offer`;
  const orderId = `r2-${runId}-order`;
  const claimId = `r2-${runId}-claim`;
  const milestoneId = "m1";

  const events = [];

  events.push(
    await signEvent(R2_KEYS.buyer, "IdentityCreate", timestampAt(baseDate, 0), {
      identityPubKey: buyerPk,
      metadata: { displayName: "r2-operator" },
    }),
    await signEvent(R2_KEYS.provider, "IdentityCreate", timestampAt(baseDate, 1), {
      identityPubKey: providerPk,
      metadata: { displayName: "r2-counterparty" },
    }),
    await signEvent(R2_KEYS.sponsorA, "IdentityCreate", timestampAt(baseDate, 2), {
      identityPubKey: sponsorAPk,
      metadata: { displayName: "r2-sponsor-a" },
    }),
    await signEvent(R2_KEYS.sponsorB, "IdentityCreate", timestampAt(baseDate, 3), {
      identityPubKey: sponsorBPk,
      metadata: { displayName: "r2-sponsor-b" },
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
      summary: preset.summary,
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
    serviceType: lane,
    unitDefinition: preset.unitDefinition,
    pricePerUnitCredits: preset.pricePerUnitCredits,
    deliveryMode: "artifact",
    offerExpiresAt: "2026-12-01T00:00:00Z",
    allowedEvidenceFormats: ["artifactHash"],
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
          amountCredits: preset.pricePerUnitCredits,
          evidenceFormat: "artifactHash",
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
        amount: preset.pricePerUnitCredits,
        milestoneId,
        orderId,
        sinkKind: "ServiceEscrowSink",
        spenderPubKey: buyerPk,
      },
      undefined,
      `${runId}-escrow-1`,
    ),
  );

  const delivery = await signEvent(
    R2_KEYS.provider,
    "ServiceDelivery",
    timestampAt(baseDate, 15),
    {
      artifactHashes: [preset.artifactHash],
      deliveredAt: timestampAt(baseDate, 15),
      evidenceFormat: "artifactHash",
      milestoneId,
      orderId,
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
    lane,
    offerId,
    orderId,
    milestoneId,
    buyerPubKey: buyerPk,
    providerPubKey: providerPk,
    asOf: `${baseDate}T00:15:00Z`,
    artifactHash: preset.artifactHash,
  };
}

export async function submitEventsViaHttp(baseUrl, events) {
  const results = [];
  for (const event of events) {
    const response = await fetch(`${baseUrl.replace(/\/+$/, "")}/events`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(event),
    });
    const body = await response.json();
    if (!response.ok || !body.accepted) {
      throw new Error(
        `ingest rejected for ${event.kind}: ${body.code ?? response.status} ${body.message ?? ""}`.trim(),
      );
    }
    results.push(body);
  }
  return results;
}

export async function verifyExchangeClosed(baseUrl, orderId, asOf) {
  const url =
    `${baseUrl.replace(/\/+$/, "")}/state/order/${encodeURIComponent(orderId)}` +
    `?as_of=${encodeURIComponent(asOf)}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`order lookup failed: ${response.status}`);
  }
  const body = await response.json();
  const status = body?.data?.status;
  if (status !== "closed") {
    throw new Error(`expected order status closed, got ${status ?? "unknown"}`);
  }
  return body;
}
