/**
 * SX-S5 — Profile A multi-milestone staged exchange (software-fixes).
 *
 * Two milestones on one order: each phase funds → delivers → accepts.
 * Credits move only at phase accept (VL-D6 / SX-D1). No new event kinds.
 */

import {
  COMMUNITY_ARTIFACT_LANE_PRESETS,
} from "./r6-lane-template-registry.mjs";
import {
  createUnsignedEnvelope,
  derivePublicKey,
  signUnsignedEnvelope,
} from "../../packages/sdk-ts/dist/index.js";
import { R2_KEYS } from "./r2-exchange-core.mjs";

const LANE = "software-fixes";

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

/**
 * Build a two-milestone software-fixes happy path.
 * m1 = design/spec phase (40 credits), m2 = implementation phase (60 credits).
 */
export async function buildSxS5StagedExchangeEvents(runId, baseDate = "2026-07-24") {
  const preset = COMMUNITY_ARTIFACT_LANE_PRESETS[LANE];
  const buyerPk = await derivePublicKey(R2_KEYS.buyer);
  const providerPk = await derivePublicKey(R2_KEYS.provider);
  const sponsorAPk = await derivePublicKey(R2_KEYS.sponsorA);
  const sponsorBPk = await derivePublicKey(R2_KEYS.sponsorB);

  const offerId = `sx-s5-${runId}-offer`;
  const orderId = `sx-s5-${runId}-order`;
  const claimId = `sx-s5-${runId}-claim`;

  const milestones = [
    {
      milestoneId: "m1",
      amountCredits: 40,
      evidenceFormat: "artifactHash",
      artifactHash: `sx-s5-${runId}-spec`,
      phaseLabel: "design/spec hash",
    },
    {
      milestoneId: "m2",
      amountCredits: 60,
      evidenceFormat: "artifactHash",
      artifactHash: `sx-s5-${runId}-impl`,
      phaseLabel: "implementation artifact hash",
    },
  ];
  const totalCredits = milestones.reduce((sum, m) => sum + m.amountCredits, 0);
  const mintAmount = 500;

  if (totalCredits > mintAmount) {
    throw new Error(`milestone total ${totalCredits} exceeds mint ${mintAmount}`);
  }

  const events = [];
  let t = 0;

  events.push(
    await signEvent(R2_KEYS.buyer, "IdentityCreate", timestampAt(baseDate, t++), {
      identityPubKey: buyerPk,
      metadata: { displayName: "sx-s5-buyer" },
    }),
    await signEvent(R2_KEYS.provider, "IdentityCreate", timestampAt(baseDate, t++), {
      identityPubKey: providerPk,
      metadata: { displayName: "sx-s5-provider" },
    }),
    await signEvent(R2_KEYS.sponsorA, "IdentityCreate", timestampAt(baseDate, t++), {
      identityPubKey: sponsorAPk,
      metadata: { displayName: "sx-s5-sponsor-a" },
    }),
    await signEvent(R2_KEYS.sponsorB, "IdentityCreate", timestampAt(baseDate, t++), {
      identityPubKey: sponsorBPk,
      metadata: { displayName: "sx-s5-sponsor-b" },
    }),
    await signEvent(R2_KEYS.buyer, "Vouch", timestampAt(baseDate, t++), {
      subjectPubKey: sponsorAPk,
      weight: 1,
    }),
    await signEvent(R2_KEYS.buyer, "Vouch", timestampAt(baseDate, t++), {
      subjectPubKey: sponsorBPk,
      weight: 1,
    }),
    await signEvent(R2_KEYS.sponsorA, "Vouch", timestampAt(baseDate, t++), {
      subjectPubKey: providerPk,
      weight: 1,
    }),
    await signEvent(R2_KEYS.sponsorB, "Vouch", timestampAt(baseDate, t++), {
      subjectPubKey: providerPk,
      weight: 1,
    }),
  );

  const claim = await signEvent(
    R2_KEYS.buyer,
    "ContributionClaim",
    timestampAt(baseDate, t++),
    {
      claimId,
      claimType: "maintenance",
      artifactHash: `sx-s5-claim-${runId}`,
      summary: `SX-S5 staged ${LANE} drill`,
      requestedCredits: mintAmount,
    },
  );
  events.push(claim);
  events.push(
    await signEvent(
      R2_KEYS.sponsorA,
      "ContributionAttest",
      timestampAt(baseDate, t++),
      { claimId, decision: "approve" },
      { claim: claim.eventId },
    ),
    await signEvent(
      R2_KEYS.sponsorB,
      "ContributionAttest",
      timestampAt(baseDate, t++),
      { claimId, decision: "approve" },
      { claim: claim.eventId },
    ),
    await signEvent(
      R2_KEYS.buyer,
      "MintCredits",
      timestampAt(baseDate, t++),
      {
        beneficiaryPubKey: buyerPk,
        amount: mintAmount,
        expiresAt: "2026-12-01T00:00:00Z",
        mintReason: "contribution",
        sourceClaimId: claimId,
      },
      { claim: claim.eventId },
    ),
  );

  const offer = await signEvent(R2_KEYS.provider, "ServiceOffer", timestampAt(baseDate, t++), {
    offerId,
    serviceType: LANE,
    unitDefinition: preset.unitDefinition,
    pricePerUnitCredits: totalCredits,
    deliveryMode: "artifact",
    offerExpiresAt: "2026-12-01T00:00:00Z",
    allowedEvidenceFormats: ["artifactHash"],
  });
  events.push(offer);

  const order = await signEvent(
    R2_KEYS.buyer,
    "ServiceOrder",
    timestampAt(baseDate, t++),
    {
      buyerPubKey: buyerPk,
      milestones: milestones.map(({ milestoneId, amountCredits, evidenceFormat }) => ({
        milestoneId,
        amountCredits,
        evidenceFormat,
      })),
      offerId,
      orderExpiresAt: "2026-12-15T00:00:00Z",
      orderId,
      providerPubKey: providerPk,
    },
    { offer: offer.eventId },
  );
  events.push(order);

  for (const milestone of milestones) {
    const escrowAt = t++;
    events.push(
      await signEvent(
        R2_KEYS.buyer,
        "SpendCredits",
        timestampAt(baseDate, escrowAt),
        {
          amount: milestone.amountCredits,
          milestoneId: milestone.milestoneId,
          orderId,
          sinkKind: "ServiceEscrowSink",
          spenderPubKey: buyerPk,
        },
        undefined,
        `${runId}-escrow-${milestone.milestoneId}`,
      ),
    );

    const deliveredAt = t++;
    const delivery = await signEvent(
      R2_KEYS.provider,
      "ServiceDelivery",
      timestampAt(baseDate, deliveredAt),
      {
        artifactHashes: [milestone.artifactHash],
        deliveredAt: timestampAt(baseDate, deliveredAt),
        evidenceFormat: milestone.evidenceFormat,
        milestoneId: milestone.milestoneId,
        orderId,
      },
      { order: order.eventId },
    );
    events.push(delivery);

    const acceptedAt = t++;
    events.push(
      await signEvent(
        R2_KEYS.buyer,
        "ServiceAccept",
        timestampAt(baseDate, acceptedAt),
        {
          acceptedAt: timestampAt(baseDate, acceptedAt),
          milestoneId: milestone.milestoneId,
          orderId,
        },
        { delivery: delivery.eventId },
      ),
    );
  }

  return {
    events,
    lane: LANE,
    offerId,
    orderId,
    milestones: milestones.map(({ milestoneId, amountCredits, phaseLabel, artifactHash }) => ({
      milestoneId,
      amountCredits,
      phaseLabel,
      artifactHash,
    })),
    buyerPubKey: buyerPk,
    providerPubKey: providerPk,
    asOf: timestampAt(baseDate, Math.min(t + 1, 59)),
    totalCredits,
  };
}

export { LANE as SX_S5_LANE };
