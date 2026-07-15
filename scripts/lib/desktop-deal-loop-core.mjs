import {
  buildR2ExchangeEvents,
  R2_KEYS,
  submitEventsViaHttp,
  verifyExchangeClosed,
} from "./r2-exchange-core.mjs";
import { COMMUNITY_ARTIFACT_LANE_PRESETS } from "./r6-lane-template-registry.mjs";
import { derivePublicKey } from "../../packages/sdk-ts/dist/index.js";

export const DEAL_LOOP_LANE = "software-fixes";

export const DEAL_LOOP_PRESET = COMMUNITY_ARTIFACT_LANE_PRESETS[DEAL_LOOP_LANE];

export { R2_KEYS, verifyExchangeClosed };

const IDEMPOTENT_INGEST_PATTERNS = [
  /already exists/i,
  /duplicate eventId/i,
  /duplicate nonce/i,
  /active vouch already exists/i,
];

export async function deriveDealLoopKeys() {
  const [buyerPubKey, providerPubKey, sponsorAPubKey, sponsorBPubKey] = await Promise.all([
    derivePublicKey(R2_KEYS.buyer),
    derivePublicKey(R2_KEYS.provider),
    derivePublicKey(R2_KEYS.sponsorA),
    derivePublicKey(R2_KEYS.sponsorB),
  ]);
  return { buyerPubKey, providerPubKey, sponsorAPubKey, sponsorBPubKey };
}

export async function buildDealLoopPrerequisiteEvents(options = {}) {
  const lane = options.lane ?? DEAL_LOOP_LANE;
  const runId = options.runId ?? `deal-loop-${Date.now()}`;
  const baseDate = options.baseDate ?? "2026-07-02";
  const exchange = await buildR2ExchangeEvents(lane, runId, baseDate);
  const offerIndex = exchange.events.findIndex((event) => event.kind === "ServiceOffer");
  if (offerIndex < 0) {
    throw new Error("deal-loop prerequisites: ServiceOffer marker missing from exchange bundle");
  }

  return {
    lane,
    runId,
    baseDate,
    events: exchange.events.slice(0, offerIndex),
    buyerPubKey: exchange.buyerPubKey,
    providerPubKey: exchange.providerPubKey,
    milestoneId: exchange.milestoneId,
    pricePerUnitCredits: DEAL_LOOP_PRESET.pricePerUnitCredits,
    artifactHash: DEAL_LOOP_PRESET.artifactHash,
  };
}

export async function submitEventsBestEffort(baseUrl, events) {
  const root = baseUrl.replace(/\/+$/, "");
  const results = [];
  for (const event of events) {
    const response = await fetch(`${root}/events`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(event),
    });
    const body = await response.json().catch(() => ({}));
    if (response.ok && body.accepted) {
      results.push({ kind: event.kind, accepted: true, skipped: false });
      continue;
    }

    const message = `${body.code ?? response.status} ${body.message ?? ""}`.trim();
    if (IDEMPOTENT_INGEST_PATTERNS.some((pattern) => pattern.test(message))) {
      results.push({ kind: event.kind, accepted: false, skipped: true, message });
      continue;
    }

    throw new Error(`ingest rejected for ${event.kind}: ${message}`);
  }
  return results;
}

async function fetchJson(url) {
  const response = await fetch(url, { cache: "no-store" });
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function listEventsByKind(baseUrl, kind) {
  const root = baseUrl.replace(/\/+$/, "");
  const events = [];
  let cursor;
  for (let page = 0; page < 20; page += 1) {
    const params = new URLSearchParams({ kind, limit: "200" });
    if (cursor !== undefined) {
      params.set("cursor", String(cursor));
    }
    const body = await fetchJson(`${root}/events?${params.toString()}`);
    const pageEvents = Array.isArray(body?.events) ? body.events : [];
    events.push(...pageEvents);
    const nextCursor = body?.next_cursor;
    if (nextCursor === null || nextCursor === undefined || nextCursor === cursor) {
      break;
    }
    cursor = nextCursor;
  }
  return events;
}

function readEventPayload(eventRow) {
  if (eventRow?.payload && typeof eventRow.payload === "object") {
    return eventRow.payload;
  }
  if (eventRow?.payload_json && typeof eventRow.payload_json === "object") {
    return eventRow.payload_json;
  }
  if (eventRow?.raw_json?.payload && typeof eventRow.raw_json.payload === "object") {
    return eventRow.raw_json.payload;
  }
  return null;
}

function readSubjectPubKey(eventRow) {
  const payload = readEventPayload(eventRow);
  if (!payload) {
    return null;
  }
  const subject = payload.subjectPubKey ?? payload.subject_pub_key;
  return typeof subject === "string" ? subject.trim().toLowerCase() : null;
}

function readVouchWeight(eventRow) {
  const payload = readEventPayload(eventRow);
  if (!payload) {
    return 1;
  }
  const weight = payload.weight;
  return typeof weight === "number" && Number.isFinite(weight) ? weight : 1;
}

async function fetchProviderEligibility(baseUrl, providerPubKey) {
  const normalizedProvider = providerPubKey.trim().toLowerCase();
  const [vouchEvents, revokeEvents, policyBody] = await Promise.all([
    listEventsByKind(baseUrl, "Vouch"),
    listEventsByKind(baseUrl, "VouchRevoke"),
    fetchJson(`${baseUrl.replace(/\/+$/, "")}/state/policy`),
  ]);

  const activeRevokedSubjects = new Set(
    revokeEvents
      .map((row) => readSubjectPubKey(row))
      .filter((value) => Boolean(value)),
  );

  const incomingActiveVouchWeight = vouchEvents.reduce((total, row) => {
    const subject = readSubjectPubKey(row);
    if (subject !== normalizedProvider || activeRevokedSubjects.has(subject)) {
      return total;
    }
    return total + readVouchWeight(row);
  }, 0);

  const policy = policyBody?.data?.policy ?? policyBody?.data ?? {};
  const threshold = Number(
    policy.providerEligibilityThreshold ?? policy.provider_eligibility_threshold ?? 2,
  );

  return {
    incomingActiveVouchWeight,
    threshold: Number.isFinite(threshold) ? threshold : 2,
  };
}

async function fetchBuyerCredits(baseUrl, buyerPubKey) {
  const root = baseUrl.replace(/\/+$/, "");
  const body = await fetchJson(`${root}/state/balance/${encodeURIComponent(buyerPubKey)}`);
  const raw = body?.data?.effective_balance ?? body?.data?.effectiveBalance;
  return typeof raw === "number" && Number.isFinite(raw) ? raw : 0;
}

export async function ensureDealLoopPrerequisites(baseUrl, options = {}) {
  const bundle = await buildDealLoopPrerequisiteEvents(options);
  const ingest = await submitEventsBestEffort(baseUrl, bundle.events);
  const eligibility = await fetchProviderEligibility(baseUrl, bundle.providerPubKey);
  const buyerCredits = await fetchBuyerCredits(baseUrl, bundle.buyerPubKey);
  const providerReady = eligibility.incomingActiveVouchWeight >= eligibility.threshold;
  const creditsReady = buyerCredits > 0;

  return {
    ...bundle,
    asOf: `${bundle.baseDate}T00:11:00Z`,
    ingest,
    eligibility,
    buyerCredits,
    providerReady,
    creditsReady,
  };
}

export async function ensureDealLoopPrerequisitesStrict(baseUrl, options = {}) {
  const summary = await ensureDealLoopPrerequisites(baseUrl, options);
  if (!summary.providerReady) {
    throw new Error(
      `provider vouch weight ${summary.eligibility.incomingActiveVouchWeight} is below threshold ${summary.eligibility.threshold}`,
    );
  }
  if (!summary.creditsReady) {
    throw new Error(`buyer effective balance is ${summary.buyerCredits} — mint credits first`);
  }
  return summary;
}

export async function seedDealLoopViaApi(baseUrl, options = {}) {
  const bundle = await buildDealLoopPrerequisiteEvents(options);
  const exchange = await buildR2ExchangeEvents(bundle.lane, bundle.runId, bundle.baseDate);
  await submitEventsViaHttp(baseUrl, exchange.events);
  const asOf = exchange.asOf;
  await verifyExchangeClosed(baseUrl, exchange.orderId, asOf);
  return exchange;
}
