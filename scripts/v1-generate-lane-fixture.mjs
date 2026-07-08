import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { createUnsignedEnvelope, derivePublicKey, signUnsignedEnvelope } from "../packages/sdk-ts/dist/index.js";

const ALLOWED_LANES = [
  "software-fixes",
  "feature-work",
  "documentation",
  "translation",
  "testing",
  "research",
  "project-maintenance",
  "compute-job"
];

const ALLOWED_FLOWS = ["accept", "dispute"];

const ALICE_SECRET = "1111111111111111111111111111111111111111111111111111111111111111";
const BOB_SECRET = "2222222222222222222222222222222222222222222222222222222222222222";
const CAROL_SECRET = "3333333333333333333333333333333333333333333333333333333333333333";

const LANE_PRESETS = {
  "software-fixes": {
    unitDefinition: "fix per issue",
    pricePerUnitCredits: 100,
    artifactHash: "artifact-software-fixes-demo",
    disputeReasonCode: "quality",
    summary: "software fixes reproducible lane fixture"
  },
  "feature-work": {
    unitDefinition: "feature increment",
    pricePerUnitCredits: 180,
    artifactHash: "artifact-feature-work-demo",
    disputeReasonCode: "scope",
    summary: "feature work reproducible lane fixture"
  },
  documentation: {
    unitDefinition: "doc update",
    pricePerUnitCredits: 90,
    artifactHash: "artifact-documentation-demo",
    disputeReasonCode: "quality",
    summary: "documentation reproducible lane fixture"
  },
  translation: {
    unitDefinition: "translation package",
    pricePerUnitCredits: 110,
    artifactHash: "artifact-translation-demo",
    disputeReasonCode: "quality",
    summary: "translation reproducible lane fixture"
  },
  testing: {
    unitDefinition: "test report",
    pricePerUnitCredits: 95,
    artifactHash: "artifact-testing-demo",
    disputeReasonCode: "quality",
    summary: "testing reproducible lane fixture"
  },
  research: {
    unitDefinition: "research brief",
    pricePerUnitCredits: 140,
    artifactHash: "artifact-research-demo",
    disputeReasonCode: "scope",
    summary: "research reproducible lane fixture"
  },
  "project-maintenance": {
    unitDefinition: "maintenance task",
    pricePerUnitCredits: 160,
    artifactHash: "artifact-project-maintenance-demo",
    disputeReasonCode: "quality",
    summary: "project maintenance reproducible lane fixture"
  },
  "compute-job": {
    unitDefinition: "deterministic compute job",
    pricePerUnitCredits: 220,
    artifactHash: "artifact-compute-job-demo",
    disputeReasonCode: "verification",
    summary: "compute job reproducible lane fixture",
    deliveryMode: "receipt",
    evidenceFormat: "job-receipt-v1",
    notesHash: "compute-job-receipt-notes"
  }
};

const FLOW_BASE_DATES = {
  accept: "2026-03-05",
  dispute: "2026-03-06"
};

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const lane = args.lane;
  const flow = args.flow;
  const outPath =
    args.out ??
    path.join(
      "target",
      "tmp",
      `lane-${lane}-${flow}.jsonl`
    );

  if (!ALLOWED_LANES.includes(lane)) {
    throw new Error(`invalid --lane, expected one of: ${ALLOWED_LANES.join(", ")}`);
  }
  if (!ALLOWED_FLOWS.includes(flow)) {
    throw new Error(`invalid --flow, expected one of: ${ALLOWED_FLOWS.join(", ")}`);
  }

  const events = await buildLaneFixture(lane, flow);
  await mkdir(path.dirname(outPath), { recursive: true });
  await writeFile(outPath, `${events.map(event => JSON.stringify(event)).join("\n")}\n`, "utf8");
  console.log(outPath);
}

async function buildLaneFixture(lane, flow) {
  const preset = LANE_PRESETS[lane];
  const alicePk = await derivePublicKey(ALICE_SECRET);
  const bobPk = await derivePublicKey(BOB_SECRET);
  const carolPk = await derivePublicKey(CAROL_SECRET);
  const slug = lane.replace(/[^a-z0-9]+/gi, "-");
  const baseDate = FLOW_BASE_DATES[flow];

  const offerId = `${slug}-${flow}-offer`;
  const orderId = `${slug}-${flow}-order`;
  const claimId = `${slug}-${flow}-claim`;
  const milestoneId = "m1";

  const events = [];

  const aliceCreate = await signEvent(ALICE_SECRET, "IdentityCreate", timestampAt(baseDate, 0), {
    identityPubKey: alicePk,
    metadata: { displayName: "alice" }
  });
  const bobCreate = await signEvent(BOB_SECRET, "IdentityCreate", timestampAt(baseDate, 1), {
    identityPubKey: bobPk,
    metadata: { displayName: "bob" }
  });
  const carolCreate = await signEvent(CAROL_SECRET, "IdentityCreate", timestampAt(baseDate, 2), {
    identityPubKey: carolPk,
    metadata: { displayName: "carol" }
  });
  events.push(aliceCreate, bobCreate, carolCreate);

  events.push(
    await signEvent(ALICE_SECRET, "Vouch", timestampAt(baseDate, 3), { subjectPubKey: bobPk }),
    await signEvent(CAROL_SECRET, "Vouch", timestampAt(baseDate, 4), { subjectPubKey: bobPk }),
    await signEvent(ALICE_SECRET, "Vouch", timestampAt(baseDate, 5), { subjectPubKey: carolPk })
  );

  const claim = await signEvent(ALICE_SECRET, "ContributionClaim", timestampAt(baseDate, 6), {
    claimId,
    claimType: "maintenance",
    artifactHash: `claim-${slug}-${flow}`,
    summary: preset.summary,
    requestedCredits: 500
  });
  events.push(claim);
  events.push(
    await signEvent(
      BOB_SECRET,
      "ContributionAttest",
      timestampAt(baseDate, 7),
      { claimId, decision: "approve" },
      { claim: claim.eventId }
    ),
    await signEvent(
      CAROL_SECRET,
      "ContributionAttest",
      timestampAt(baseDate, 8),
      { claimId, decision: "approve" },
      { claim: claim.eventId }
    ),
    await signEvent(
      ALICE_SECRET,
      "MintCredits",
      timestampAt(baseDate, 9),
      {
        beneficiaryPubKey: alicePk,
        amount: 500,
        expiresAt: "2026-12-01T00:00:00Z",
        mintReason: "contribution",
        sourceClaimId: claimId
      },
      { claim: claim.eventId }
    )
  );

  const offer = await signEvent(BOB_SECRET, "ServiceOffer", timestampAt(baseDate, 10), {
    offerId,
    serviceType: lane,
    unitDefinition: preset.unitDefinition,
    pricePerUnitCredits: preset.pricePerUnitCredits,
    deliveryMode: preset.deliveryMode ?? "artifact",
    offerExpiresAt: "2026-12-01T00:00:00Z",
    allowedEvidenceFormats: [preset.evidenceFormat ?? "artifactHash"]
  });
  events.push(offer);

  const order = await signEvent(
    ALICE_SECRET,
    "ServiceOrder",
    timestampAt(baseDate, 11),
    {
      buyerPubKey: alicePk,
      milestones: [
        {
          amountCredits: preset.pricePerUnitCredits,
          evidenceFormat: preset.evidenceFormat ?? "artifactHash",
          milestoneId
        }
      ],
      offerId,
      orderExpiresAt: "2026-12-15T00:00:00Z",
      orderId,
      providerPubKey: bobPk
    },
    { offer: offer.eventId }
  );
  events.push(order);

  events.push(
    await signEvent(
      ALICE_SECRET,
      "SpendCredits",
      timestampAt(baseDate, 12),
      {
        amount: preset.pricePerUnitCredits,
        milestoneId,
        orderId,
        sinkKind: "ServiceEscrowSink",
        spenderPubKey: alicePk
      },
      undefined,
      `${slug}-${flow}-escrow-1`
    )
  );

  const delivery = await signEvent(
    BOB_SECRET,
    "ServiceDelivery",
    timestampAt(baseDate, 13),
    {
      artifactHashes: [preset.artifactHash],
      deliveredAt: timestampAt(baseDate, 13),
      evidenceFormat: preset.evidenceFormat ?? "artifactHash",
      milestoneId,
      orderId,
      urls: [`https://example.com/${slug}/${flow}`],
      notesHash: preset.notesHash
    },
    { order: order.eventId }
  );
  events.push(delivery);

  if (flow === "accept") {
    events.push(
      await signEvent(
        ALICE_SECRET,
        "ServiceAccept",
        timestampAt(baseDate, 14),
        { acceptedAt: timestampAt(baseDate, 14), milestoneId, orderId },
        { delivery: delivery.eventId }
      )
    );
    return events;
  }

  const dispute = await signEvent(
    ALICE_SECRET,
    "ServiceDispute",
    timestampAt(baseDate, 14),
    {
      disputedAt: timestampAt(baseDate, 14),
      milestoneId,
      orderId,
      reasonCode: preset.disputeReasonCode,
      notesHash: `notes-${slug}-${flow}`
    },
    { delivery: delivery.eventId }
  );
  events.push(dispute);

  return events;
}

async function signEvent(secretKey, kind, createdAt, payload, references, nonce) {
  const authorPubKey = await derivePublicKey(secretKey);
  const unsigned = createUnsignedEnvelope({
    authorPubKey,
    kind,
    createdAt,
    payload,
    references,
    nonce,
    policyVersion: "v0-default"
  });
  return signUnsignedEnvelope(unsigned, secretKey);
}

function parseArgs(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 1) {
    const part = argv[index];
    if (!part.startsWith("--")) {
      continue;
    }
    const key = part.slice(2);
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`missing value for --${key}`);
    }
    result[key] = value;
    index += 1;
  }
  if (typeof result.lane !== "string" || typeof result.flow !== "string") {
    throw new Error("usage: node ./scripts/v1-generate-lane-fixture.mjs --lane <lane> --flow <accept|dispute> [--out <path>]");
  }
  return result;
}

function timestampAt(baseDate, second) {
  return `${baseDate}T00:00:${String(second).padStart(2, "0")}Z`;
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
