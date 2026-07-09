export type NormalizedOfferTerms = {
  offerId: string;
  providerPubKey: string;
  pricePerUnitCredits: number;
  offerReferenceEventId: string;
  defaultEvidenceFormat: string;
  offerExpiresAt?: string;
  status?: string;
};

export type CompensationMode = "credits" | "barter" | "mixed";

export type OfferCompensationSummary = {
  compensationMode: CompensationMode;
  termsHash?: string;
  barterTerms?: string;
  barterTags: string[];
};

function readString(record: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return undefined;
}

function readNumber(record: Record<string, unknown>, ...keys: string[]): number {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }
  return 0;
}

function readEvidenceFormats(record: Record<string, unknown>): string[] {
  const raw =
    record.allowed_evidence_formats ??
    record.allowedEvidenceFormats ??
    record.allowedEvidenceFormat;
  if (Array.isArray(raw)) {
    return raw.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
  }
  return ["artifactHash"];
}

function readStringArray(record: Record<string, unknown>, ...keys: string[]): string[] {
  for (const key of keys) {
    const value = record[key];
    if (Array.isArray(value)) {
      return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
    }
    if (typeof value === "string" && value.trim()) {
      return value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
    }
  }
  return [];
}

export function compensationModeLabel(mode: CompensationMode): string {
  if (mode === "barter") {
    return "Barter";
  }
  if (mode === "mixed") {
    return "Credits + barter";
  }
  return "Credits";
}

export function readOfferCompensationSummary(
  offer: Record<string, unknown> | null | undefined
): OfferCompensationSummary | null {
  if (!offer) {
    return null;
  }

  const rawMode = readString(offer, "compensation_mode", "compensationMode") ?? "credits";
  const compensationMode: CompensationMode =
    rawMode === "barter" || rawMode === "mixed" ? rawMode : "credits";

  return {
    compensationMode,
    termsHash: readString(offer, "terms_hash", "termsHash"),
    barterTerms: readString(offer, "barter_terms", "barterTerms"),
    barterTags: readStringArray(offer, "barter_tags", "barterTags")
  };
}

export function normalizeOfferTerms(
  offerId: string,
  offer: Record<string, unknown> | null | undefined
): NormalizedOfferTerms | null {
  if (!offer) {
    return null;
  }

  const offerReferenceEventId = readString(offer, "created_event_id", "createdEventId");
  if (!offerReferenceEventId) {
    return null;
  }

  const providerPubKey = readString(offer, "provider_pub_key", "providerPubKey");
  if (!providerPubKey) {
    return null;
  }

  const pricePerUnitCredits = readNumber(offer, "price_per_unit_credits", "pricePerUnitCredits");
  if (pricePerUnitCredits <= 0) {
    return null;
  }

  const evidenceFormats = readEvidenceFormats(offer);

  return {
    offerId: readString(offer, "offer_id", "offerId") ?? offerId,
    providerPubKey,
    pricePerUnitCredits,
    offerReferenceEventId,
    defaultEvidenceFormat: evidenceFormats[0] ?? "artifactHash",
    offerExpiresAt: readString(offer, "offer_expires_at", "offerExpiresAt"),
    status: readString(offer, "status")
  };
}
