import {
  createUnsignedEnvelope,
  derivePublicKey,
  signUnsignedEnvelope,
} from "../../packages/sdk-ts/dist/index.js";
import { R2_KEYS } from "./r2-exchange-core.mjs";

export const GENESIS_KEYS = {
  sponsorA: R2_KEYS.sponsorA,
  sponsorB: R2_KEYS.sponsorB,
  provider: "8888888888888888888888888888888888888888888888888888888888888888",
};

const LANE = "software-fixes";

async function signEvent(secretKey, kind, createdAt, payload, references) {
  const authorPubKey = await derivePublicKey(secretKey);
  const unsigned = createUnsignedEnvelope({
    authorPubKey,
    kind,
    createdAt,
    payload,
    references,
    policyVersion: "v0-default",
  });
  return signUnsignedEnvelope(unsigned, secretKey);
}

function timestampAt(baseDate, second) {
  return `${baseDate}T00:00:${String(second).padStart(2, "0")}Z`;
}

export async function buildR2GenesisBootstrap(runId, baseDate = "2026-07-02") {
  const sponsorAPk = await derivePublicKey(GENESIS_KEYS.sponsorA);
  const sponsorBPk = await derivePublicKey(GENESIS_KEYS.sponsorB);
  const providerPk = await derivePublicKey(GENESIS_KEYS.provider);
  const offerId = `r2-genesis-${runId}-offer`;
  const preVouchOfferId = `${offerId}-rejected`;
  const preVouchAsOf = `${baseDate}T00:00:04Z`;
  const asOf = `${baseDate}T00:00:12Z`;

  const identities = [
    await signEvent(GENESIS_KEYS.sponsorA, "IdentityCreate", timestampAt(baseDate, 0), {
      identityPubKey: sponsorAPk,
      metadata: { displayName: "r2-genesis-sponsor-a" },
    }),
    await signEvent(GENESIS_KEYS.sponsorB, "IdentityCreate", timestampAt(baseDate, 1), {
      identityPubKey: sponsorBPk,
      metadata: { displayName: "r2-genesis-sponsor-b" },
    }),
    await signEvent(GENESIS_KEYS.provider, "IdentityCreate", timestampAt(baseDate, 2), {
      identityPubKey: providerPk,
      metadata: { displayName: "r2-genesis-provider" },
    }),
  ];

  const preVouchOffer = await signEvent(
    GENESIS_KEYS.provider,
    "ServiceOffer",
    timestampAt(baseDate, 3),
    {
      offerId: preVouchOfferId,
      serviceType: LANE,
      unitDefinition: "fix per issue",
      pricePerUnitCredits: 100,
      deliveryMode: "artifact",
      offerExpiresAt: "2026-12-01T00:00:00Z",
      allowedEvidenceFormats: ["artifactHash"],
    },
  );

  const foundingVouches = [
    await signEvent(GENESIS_KEYS.sponsorA, "Vouch", timestampAt(baseDate, 4), {
      subjectPubKey: providerPk,
      weight: 1,
    }),
    await signEvent(GENESIS_KEYS.sponsorB, "Vouch", timestampAt(baseDate, 5), {
      subjectPubKey: providerPk,
      weight: 1,
    }),
  ];

  const offer = await signEvent(GENESIS_KEYS.provider, "ServiceOffer", timestampAt(baseDate, 6), {
    offerId,
    serviceType: LANE,
    unitDefinition: "fix per issue",
    pricePerUnitCredits: 100,
    deliveryMode: "artifact",
    offerExpiresAt: "2026-12-01T00:00:00Z",
    allowedEvidenceFormats: ["artifactHash"],
  });

  return {
    lane: LANE,
    offerId,
    preVouchOfferId,
    providerPubKey: providerPk,
    sponsorPubKeys: [sponsorAPk, sponsorBPk],
    preVouchAsOf,
    asOf,
    identities,
    preVouchOffer,
    foundingVouches,
    offer,
    foundingSponsors: {
      networkPhase: "founding",
      providerEligibilityThreshold: 2,
      sponsors: [
        {
          displayName: "r2-genesis-sponsor-a",
          pubKey: sponsorAPk,
        },
        {
          displayName: "r2-genesis-sponsor-b",
          pubKey: sponsorBPk,
        },
      ],
    },
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

export async function verifyPreVouchOfferBlocked(baseUrl, preVouchOfferId, preVouchAsOf) {
  const root = baseUrl.replace(/\/+$/, "");
  const offerResponse = await fetch(
    `${root}/state/offer/${encodeURIComponent(preVouchOfferId)}?as_of=${encodeURIComponent(preVouchAsOf)}`,
  );
  if (!offerResponse.ok) {
    throw new Error(`offer lookup failed: ${offerResponse.status}`);
  }
  const offerBody = await offerResponse.json();
  if (offerBody?.data != null) {
    throw new Error("expected pre-vouch offer to be absent from replay state");
  }

  const replayResponse = await fetch(
    `${root}/state/replay?as_of=${encodeURIComponent(preVouchAsOf)}`,
  );
  if (!replayResponse.ok) {
    throw new Error(`replay lookup failed: ${replayResponse.status}`);
  }
  const replayBody = await replayResponse.json();
  const invalidEvents = replayBody?.data?.invalid_events ?? [];
  const match = invalidEvents.find(
    entry =>
      entry?.kind === "ServiceOffer" &&
      typeof entry?.message === "string" &&
      entry.message.includes("trust threshold"),
  );
  if (!match) {
    throw new Error("expected replay invalid_events to include below-threshold ServiceOffer");
  }
  return { offerBody, replayBody, invalidEvent: match };
}

export async function verifyGenesisOfferLive(baseUrl, offerId, providerPubKey, asOf) {
  const root = baseUrl.replace(/\/+$/, "");
  const offerResponse = await fetch(
    `${root}/state/offer/${encodeURIComponent(offerId)}?as_of=${encodeURIComponent(asOf)}`,
  );
  if (!offerResponse.ok) {
    throw new Error(`offer lookup failed: ${offerResponse.status}`);
  }
  const offerBody = await offerResponse.json();
  if (offerBody?.data?.provider_pub_key !== providerPubKey) {
    throw new Error("offer provider pubkey mismatch");
  }
  if (offerBody?.data?.status !== "active") {
    throw new Error(`expected offer status active, got ${offerBody?.data?.status ?? "unknown"}`);
  }

  const discoveryResponse = await fetch(
    `${root}/state/discovery?as_of=${encodeURIComponent(asOf)}&service_type=software-fixes&alpha_defaults=0&limit=50`,
  );
  if (!discoveryResponse.ok) {
    throw new Error(`discovery lookup failed: ${discoveryResponse.status}`);
  }
  const discoveryBody = await discoveryResponse.json();
  const offers = discoveryBody?.data?.offers ?? [];
  if (!offers.some(row => row.offer_id === offerId)) {
    throw new Error(`offer ${offerId} missing from discovery view`);
  }

  const reputationResponse = await fetch(
    `${root}/state/reputation/${encodeURIComponent(providerPubKey)}?as_of=${encodeURIComponent(asOf)}`,
  );
  if (!reputationResponse.ok) {
    throw new Error(`reputation lookup failed: ${reputationResponse.status}`);
  }

  return { offerBody, discoveryBody, reputationBody: await reputationResponse.json() };
}
