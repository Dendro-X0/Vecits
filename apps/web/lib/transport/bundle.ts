export const TRANSPORT_BUNDLE_KIND = "vectis.transport.v1" as const;
export const TRANSPORT_BUNDLE_VERSION = 1;

const HEX64_REGEX = /^[0-9a-f]{64}$/;

export const TRANSPORT_BUNDLE_TTL_MS = {
  intro: 24 * 60 * 60 * 1000,
  vouch: 24 * 60 * 60 * 1000,
  offer: 24 * 60 * 60 * 1000,
  order: 60 * 60 * 1000
} as const;

export type TransportBundleType =
  | "identity.intro"
  | "vouch.request"
  | "offer.draft"
  | "order.resume";

export type IdentityIntroPayload = {
  pubKey: string;
  displayLabel?: string;
  bio?: string;
};

export type VouchRequestPayload = {
  subjectPubKey: string;
  identityEventId?: string | null;
  displayLabel?: string;
};

export type OfferDraftPayload = {
  serviceType: string;
  title: string;
  description?: string;
  unitDefinition?: string;
  deliveryMode?: string;
  allowedEvidenceFormats?: string[];
};

export type OrderResumePayload = {
  orderId: string;
  milestoneId?: string;
  builderStep?: "offer" | "order" | "escrowSpend" | "delivery" | "accept" | "dispute" | "settle";
  buyerPubKey?: string;
  providerPubKey?: string;
};

export type TransportBundlePayloadByType = {
  "identity.intro": IdentityIntroPayload;
  "vouch.request": VouchRequestPayload;
  "offer.draft": OfferDraftPayload;
  "order.resume": OrderResumePayload;
};

export type TransportBundle<T extends TransportBundleType = TransportBundleType> = {
  v: typeof TRANSPORT_BUNDLE_VERSION;
  kind: typeof TRANSPORT_BUNDLE_KIND;
  type: T;
  createdAt: string;
  expiresAt: string;
  nodeUrl: string;
  payload: TransportBundlePayloadByType[T];
  signature?: string;
  signerPubKey?: string;
};

export type ParsedTransportBundle =
  | TransportBundle<"identity.intro">
  | TransportBundle<"vouch.request">
  | TransportBundle<"offer.draft">
  | TransportBundle<"order.resume">;

export type TransportBundleValidation =
  | { ok: true; bundle: ParsedTransportBundle; expired: false }
  | { ok: true; bundle: ParsedTransportBundle; expired: true }
  | { ok: false; error: string };

function isIso8601(value: string): boolean {
  return Number.isFinite(Date.parse(value));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readHex64(value: unknown): string | null {
  const text = readString(value);
  if (!text) {
    return null;
  }
  const normalized = text.toLowerCase();
  return HEX64_REGEX.test(normalized) ? normalized : null;
}

function readStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  const items = value.map((item) => readString(item)).filter((item): item is string => Boolean(item));
  return items.length > 0 ? items : [];
}

function validatePayload(type: TransportBundleType, payload: unknown): string | null {
  if (!isRecord(payload)) {
    return "payload must be an object";
  }

  switch (type) {
    case "identity.intro": {
      if (!readHex64(payload.pubKey)) {
        return "identity.intro requires payload.pubKey (64-char hex)";
      }
      return null;
    }
    case "vouch.request": {
      if (!readHex64(payload.subjectPubKey)) {
        return "vouch.request requires payload.subjectPubKey (64-char hex)";
      }
      return null;
    }
    case "offer.draft": {
      if (!readString(payload.serviceType) || !readString(payload.title)) {
        return "offer.draft requires payload.serviceType and payload.title";
      }
      return null;
    }
    case "order.resume": {
      if (!readString(payload.orderId)) {
        return "order.resume requires payload.orderId";
      }
      return null;
    }
    default:
      return `unsupported bundle type: ${type as string}`;
  }
}

const BUNDLE_TYPES = new Set<TransportBundleType>([
  "identity.intro",
  "vouch.request",
  "offer.draft",
  "order.resume"
]);

export function parseTransportBundleInput(raw: string): TransportBundleValidation {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { ok: false, error: "Bundle input is empty." };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    const jsonStart = trimmed.indexOf("{");
    const jsonEnd = trimmed.lastIndexOf("}");
    if (jsonStart >= 0 && jsonEnd > jsonStart) {
      try {
        parsed = JSON.parse(trimmed.slice(jsonStart, jsonEnd + 1));
      } catch {
        return { ok: false, error: "Input is not valid JSON." };
      }
    } else {
      return { ok: false, error: "Input is not valid JSON." };
    }
  }

  if (!isRecord(parsed)) {
    return { ok: false, error: "Bundle must be a JSON object." };
  }

  if (parsed.v !== TRANSPORT_BUNDLE_VERSION) {
    return { ok: false, error: `Unsupported bundle version (expected ${TRANSPORT_BUNDLE_VERSION}).` };
  }
  if (parsed.kind !== TRANSPORT_BUNDLE_KIND) {
    return { ok: false, error: `Unsupported bundle kind (expected ${TRANSPORT_BUNDLE_KIND}).` };
  }

  const type = readString(parsed.type);
  if (!type || !BUNDLE_TYPES.has(type as TransportBundleType)) {
    return { ok: false, error: "Missing or unsupported bundle type." };
  }

  const createdAt = readString(parsed.createdAt);
  const expiresAt = readString(parsed.expiresAt);
  const nodeUrl = readString(parsed.nodeUrl);
  if (!createdAt || !isIso8601(createdAt)) {
    return { ok: false, error: "createdAt must be a valid ISO 8601 timestamp." };
  }
  if (!expiresAt || !isIso8601(expiresAt)) {
    return { ok: false, error: "expiresAt must be a valid ISO 8601 timestamp." };
  }
  if (!nodeUrl) {
    return { ok: false, error: "nodeUrl is required." };
  }

  const payloadError = validatePayload(type as TransportBundleType, parsed.payload);
  if (payloadError) {
    return { ok: false, error: payloadError };
  }

  const bundle = parsed as ParsedTransportBundle;
  const expired = Date.parse(expiresAt) <= Date.now();
  return expired ? { ok: true, bundle, expired: true } : { ok: true, bundle, expired: false };
}

export function serializeTransportBundle(bundle: TransportBundle): string {
  return JSON.stringify(bundle);
}

function addMs(iso: string, ms: number): string {
  return new Date(Date.parse(iso) + ms).toISOString();
}

export function buildIdentityIntroBundle(input: {
  pubKey: string;
  nodeUrl: string;
  displayLabel?: string;
  bio?: string;
  createdAt?: string;
}): TransportBundle<"identity.intro"> {
  const createdAt = input.createdAt ?? new Date().toISOString();
  return {
    v: TRANSPORT_BUNDLE_VERSION,
    kind: TRANSPORT_BUNDLE_KIND,
    type: "identity.intro",
    createdAt,
    expiresAt: addMs(createdAt, TRANSPORT_BUNDLE_TTL_MS.intro),
    nodeUrl: input.nodeUrl.trim(),
    payload: {
      pubKey: input.pubKey.trim().toLowerCase(),
      displayLabel: input.displayLabel?.trim() || undefined,
      bio: input.bio?.trim() || undefined
    }
  };
}

export function buildVouchRequestBundle(input: {
  subjectPubKey: string;
  nodeUrl: string;
  identityEventId?: string | null;
  displayLabel?: string;
  createdAt?: string;
}): TransportBundle<"vouch.request"> {
  const createdAt = input.createdAt ?? new Date().toISOString();
  return {
    v: TRANSPORT_BUNDLE_VERSION,
    kind: TRANSPORT_BUNDLE_KIND,
    type: "vouch.request",
    createdAt,
    expiresAt: addMs(createdAt, TRANSPORT_BUNDLE_TTL_MS.vouch),
    nodeUrl: input.nodeUrl.trim(),
    payload: {
      subjectPubKey: input.subjectPubKey.trim().toLowerCase(),
      identityEventId: input.identityEventId ?? undefined,
      displayLabel: input.displayLabel?.trim() || undefined
    }
  };
}

export function buildOfferDraftBundle(input: {
  nodeUrl: string;
  payload: OfferDraftPayload;
  createdAt?: string;
}): TransportBundle<"offer.draft"> {
  const createdAt = input.createdAt ?? new Date().toISOString();
  return {
    v: TRANSPORT_BUNDLE_VERSION,
    kind: TRANSPORT_BUNDLE_KIND,
    type: "offer.draft",
    createdAt,
    expiresAt: addMs(createdAt, TRANSPORT_BUNDLE_TTL_MS.offer),
    nodeUrl: input.nodeUrl.trim(),
    payload: {
      serviceType: input.payload.serviceType.trim(),
      title: input.payload.title.trim(),
      description: input.payload.description?.trim() || undefined,
      unitDefinition: input.payload.unitDefinition?.trim() || undefined,
      deliveryMode: input.payload.deliveryMode?.trim() || undefined,
      allowedEvidenceFormats: input.payload.allowedEvidenceFormats
        ?.map((value) => value.trim())
        .filter(Boolean)
    }
  };
}

export function buildOrderResumeBundle(input: {
  nodeUrl: string;
  payload: OrderResumePayload;
  createdAt?: string;
}): TransportBundle<"order.resume"> {
  const createdAt = input.createdAt ?? new Date().toISOString();
  return {
    v: TRANSPORT_BUNDLE_VERSION,
    kind: TRANSPORT_BUNDLE_KIND,
    type: "order.resume",
    createdAt,
    expiresAt: addMs(createdAt, TRANSPORT_BUNDLE_TTL_MS.order),
    nodeUrl: input.nodeUrl.trim(),
    payload: {
      orderId: input.payload.orderId.trim(),
      milestoneId: input.payload.milestoneId?.trim() || undefined,
      builderStep: input.payload.builderStep,
      buyerPubKey: input.payload.buyerPubKey?.trim().toLowerCase() || undefined,
      providerPubKey: input.payload.providerPubKey?.trim().toLowerCase() || undefined
    }
  };
}

export function transportBundleTypeLabel(type: TransportBundleType): string {
  switch (type) {
    case "identity.intro":
      return "Identity intro";
    case "vouch.request":
      return "Vouch request";
    case "offer.draft":
      return "Offer draft";
    case "order.resume":
      return "Order resume";
    default:
      return type;
  }
}
