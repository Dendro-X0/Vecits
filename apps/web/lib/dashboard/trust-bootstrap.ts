import { NodeClient } from "@new-start/sdk-ts";

const DEFAULT_NODE =
  process.env.NEXT_PUBLIC_NODE_API_BASE_URL ?? "http://127.0.0.1:7878";

const DEFAULT_ONBOARDING_THRESHOLD = 2;
const HEX64_REGEX = /^[0-9a-fA-F]{64}$/;

export const TRUST_PHASE_LABEL = "Founding network";

export type ActiveIncomingVouch = {
  voucherPubKey: string;
  weight: number;
  vouchEventId: string;
  createdAt: string;
  expiresAt?: string;
};

export type ProviderEligibility = {
  identityExists: boolean;
  identityEventId: string | null;
  incomingActiveVouches: number;
  incomingActiveVouchWeight: number;
  threshold: number;
  thresholdSource: string;
  thresholdMet: boolean;
  activeIncomingVouches: ActiveIncomingVouch[];
  asOf: string;
};

export type BuyerCreditsSnapshot = {
  effectiveBalance: number | null;
  needsCredits: boolean;
};

export type TrustBootstrapSnapshot =
  | {
      kind: "live";
      nodeLabel: string;
      provider: ProviderEligibility;
      buyer: BuyerCreditsSnapshot;
    }
  | {
      kind: "error";
      nodeLabel: string;
      message: string;
    };

type ParsedEvent = {
  eventId: string;
  createdAt: string;
  createdAtMs: number;
  kind: string;
  authorPubKey: string;
  payload: Record<string, unknown>;
  references?: Record<string, unknown>;
};

export type SponsorParseResult = {
  valid: string[];
  duplicates: string[];
  invalid: string[];
};

export function parseSponsorPubKeys(value: string): SponsorParseResult {
  const tokens = value
    .split(/[,\n\r\t ]+/)
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  const seen = new Set<string>();
  const valid: string[] = [];
  const duplicates: string[] = [];
  const invalid: string[] = [];
  for (const token of tokens) {
    if (!HEX64_REGEX.test(token)) {
      invalid.push(token);
      continue;
    }
    if (seen.has(token)) {
      duplicates.push(token);
      continue;
    }
    seen.add(token);
    valid.push(token);
  }
  return { valid, duplicates, invalid };
}

export function buildSponsorRequestMessage(input: {
  identityPubKey: string;
  identityEventId: string | null;
  sponsorPubKeys: string[];
  baseUrl?: string;
}): string {
  if (!HEX64_REGEX.test(input.identityPubKey)) {
    return "Sign in with a valid identity to build sponsor request messages.";
  }

  const sponsorsLine =
    input.sponsorPubKeys.length > 0 ? input.sponsorPubKeys.join(", ") : "<add sponsor pubkeys>";
  const identityReferenceLine = input.identityEventId
    ? `Identity event reference: ${input.identityEventId}`
    : "Identity event reference: <pending — create identity on-node first>";

  return [
    "Vectis sponsor vouch request",
    "",
    `Identity pubkey: ${input.identityPubKey}`,
    identityReferenceLine,
    `Requested sponsors: ${sponsorsLine}`,
    "",
    "Please sign and submit a Vouch event with payload:",
    JSON.stringify({ subjectPubKey: input.identityPubKey }, null, 2),
    "",
    `Node target: ${input.baseUrl ?? DEFAULT_NODE}/events`,
    "",
    "Admission vouches help you publish offers. They are separate from milestone settlement —",
    "escrow, delivery, and accept events still follow locked terms on each order."
  ].join("\n");
}

export async function loadProviderEligibility(
  identityPubKey: string,
  options: { baseUrl?: string; asOf?: string } = {}
): Promise<ProviderEligibility | null> {
  const normalizedKey = identityPubKey.trim().toLowerCase();
  if (!HEX64_REGEX.test(normalizedKey)) {
    return null;
  }

  const baseUrl = options.baseUrl?.trim() || DEFAULT_NODE;
  const client = new NodeClient({ baseUrl });
  const asOf = options.asOf;

  const [identityCreates, vouches, vouchRevokes, thresholdInfo] = await Promise.all([
    fetchEventsByKind(client, "IdentityCreate", { authorPubKey: normalizedKey }),
    fetchEventsByKind(client, "Vouch"),
    fetchEventsByKind(client, "VouchRevoke"),
    resolveOnboardingThreshold(client, asOf)
  ]);

  return computeProviderEligibility({
    identityPubKey: normalizedKey,
    identityCreateEvents: identityCreates,
    vouchEvents: vouches,
    vouchRevokeEvents: vouchRevokes,
    threshold: thresholdInfo.threshold,
    thresholdSource: thresholdInfo.source
  });
}

export async function loadTrustBootstrapSnapshot(
  identityPubKey: string
): Promise<TrustBootstrapSnapshot> {
  const normalizedKey = identityPubKey.trim().toLowerCase();
  if (!HEX64_REGEX.test(normalizedKey)) {
    return {
      kind: "error",
      nodeLabel: DEFAULT_NODE,
      message: "Invalid identity public key."
    };
  }

  try {
    const client = new NodeClient({ baseUrl: DEFAULT_NODE });
    const [provider, balanceView] = await Promise.all([
      loadProviderEligibility(normalizedKey, { baseUrl: DEFAULT_NODE }),
      client.getBalance(normalizedKey).catch(() => null)
    ]);

    if (!provider) {
      return {
        kind: "error",
        nodeLabel: DEFAULT_NODE,
        message: "Could not compute provider eligibility."
      };
    }

    const balanceData = (balanceView?.data as Record<string, unknown> | null) ?? null;
    const effectiveBalance = balanceData
      ? readBalanceCredits(balanceData)
      : null;

    return {
      kind: "live",
      nodeLabel: DEFAULT_NODE,
      provider,
      buyer: {
        effectiveBalance,
        needsCredits: effectiveBalance === null || effectiveBalance <= 0
      }
    };
  } catch (error) {
    return {
      kind: "error",
      nodeLabel: DEFAULT_NODE,
      message: error instanceof Error ? error.message : "Could not load trust bootstrap status."
    };
  }
}

function readBalanceCredits(data: Record<string, unknown>): number | null {
  const raw =
    data.effective_balance ?? data.effectiveBalance ?? data.available_credits ?? data.availableCredits;
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return raw;
  }
  if (typeof raw === "string" && raw.trim()) {
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

async function fetchEventsByKind(
  client: NodeClient,
  kind: string,
  options: { authorPubKey?: string } = {}
): Promise<ParsedEvent[]> {
  const output: ParsedEvent[] = [];
  let cursor: number | undefined;
  let pages = 0;

  while (pages < 50) {
    const page = await client.listEvents({
      kind,
      author_pub_key: options.authorPubKey,
      limit: 200,
      cursor
    });
    for (const row of page.events) {
      const parsed = parseEventRow(row);
      if (parsed) {
        output.push(parsed);
      }
    }

    if (page.next_cursor === null || page.next_cursor === undefined || page.next_cursor === cursor) {
      break;
    }
    cursor = page.next_cursor;
    pages += 1;
  }

  return output;
}

async function resolveOnboardingThreshold(
  client: NodeClient,
  asOf?: string
): Promise<{ threshold: number; source: string }> {
  try {
    const view = await client.getPolicy(asOf);
    const policy = asRecord(view.data?.policy);
    const threshold = asPositiveInteger(policy?.provider_eligibility_threshold);
    if (threshold !== null) {
      return {
        threshold,
        source: "policy.provider_eligibility_threshold"
      };
    }
  } catch {
    // fallback below
  }
  return {
    threshold: DEFAULT_ONBOARDING_THRESHOLD,
    source: "fallback_default"
  };
}

function computeProviderEligibility(input: {
  identityPubKey: string;
  identityCreateEvents: ParsedEvent[];
  vouchEvents: ParsedEvent[];
  vouchRevokeEvents: ParsedEvent[];
  threshold: number;
  thresholdSource: string;
}): ProviderEligibility {
  const effectiveAsOfMs = Date.now();
  const effectiveAsOf = new Date(effectiveAsOfMs).toISOString();

  const identityEvents = input.identityCreateEvents
    .filter((event) => event.kind === "IdentityCreate")
    .filter((event) => event.createdAtMs <= effectiveAsOfMs)
    .filter((event) => {
      const identityPubKey = asString(event.payload.identityPubKey);
      return identityPubKey === input.identityPubKey || event.authorPubKey === input.identityPubKey;
    })
    .sort(compareEventsAsc);

  const identityLatest = identityEvents[identityEvents.length - 1];

  const actions = [...input.vouchEvents, ...input.vouchRevokeEvents]
    .filter((event) => event.createdAtMs <= effectiveAsOfMs)
    .filter((event) => event.kind === "Vouch" || event.kind === "VouchRevoke")
    .filter((event) => asString(event.payload.subjectPubKey) === input.identityPubKey)
    .sort(compareEventsAsc);

  const vouchState = new Map<
    string,
    {
      active: boolean;
      weight: number;
      vouchEventId: string;
      createdAt: string;
      expiresAt?: string;
    }
  >();

  for (const action of actions) {
    const voucherPubKey = action.authorPubKey;
    if (action.kind === "Vouch") {
      const weight = asPositiveInteger(action.payload.weight) ?? 1;
      const expiresAt = asString(action.payload.expiresAt) ?? undefined;
      vouchState.set(voucherPubKey, {
        active: true,
        weight,
        vouchEventId: action.eventId,
        createdAt: action.createdAt,
        expiresAt
      });
      continue;
    }

    const existing = vouchState.get(voucherPubKey);
    if (existing) {
      vouchState.set(voucherPubKey, { ...existing, active: false });
    }
  }

  const activeIncomingVouches = [...vouchState.entries()]
    .filter(([, state]) => state.active)
    .filter(([, state]) => !isExpiredAt(state.expiresAt, effectiveAsOfMs))
    .map(([voucherPubKey, state]) => ({
      voucherPubKey,
      weight: state.weight,
      vouchEventId: state.vouchEventId,
      createdAt: state.createdAt,
      expiresAt: state.expiresAt
    }))
    .sort((left, right) => left.voucherPubKey.localeCompare(right.voucherPubKey));

  const incomingActiveVouchWeight = activeIncomingVouches.reduce(
    (sum, entry) => sum + entry.weight,
    0
  );

  return {
    asOf: effectiveAsOf,
    identityExists: Boolean(identityLatest),
    identityEventId: identityLatest?.eventId ?? null,
    incomingActiveVouches: activeIncomingVouches.length,
    incomingActiveVouchWeight,
    threshold: input.threshold,
    thresholdSource: input.thresholdSource,
    thresholdMet: incomingActiveVouchWeight >= input.threshold,
    activeIncomingVouches
  };
}

function parseEventRow(row: Record<string, unknown>): ParsedEvent | null {
  const eventId = asString(row.event_id);
  const createdAt = asString(row.created_at);
  const kind = asString(row.kind);
  const authorPubKey = asString(row.author_pub_key);
  const payload = asRecord(row.payload_json);
  const createdAtMs = toTimestamp(createdAt ?? "");
  if (!eventId || !createdAt || !kind || !authorPubKey || !payload || createdAtMs === null) {
    return null;
  }
  const references = asRecord(row.references_json) ?? undefined;
  return {
    eventId,
    createdAt,
    createdAtMs,
    kind,
    authorPubKey,
    payload,
    references
  };
}

function compareEventsAsc(left: ParsedEvent, right: ParsedEvent): number {
  return (
    left.createdAtMs - right.createdAtMs ||
    left.createdAt.localeCompare(right.createdAt) ||
    left.eventId.localeCompare(right.eventId)
  );
}

function isExpiredAt(expiresAt: string | undefined, asOfMs: number): boolean {
  if (!expiresAt) {
    return false;
  }
  const expiresAtMs = toTimestamp(expiresAt);
  if (expiresAtMs === null) {
    return false;
  }
  return expiresAtMs <= asOfMs;
}

function toTimestamp(value: string): number | null {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function asString(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }
  return value.trim();
}

function asPositiveInteger(value: unknown): number | null {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number.parseInt(value.trim(), 10);
    if (Number.isInteger(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return null;
}
