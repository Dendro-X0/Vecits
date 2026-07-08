export type NormalizedOfferTerms = {
  offerId: string;
  providerPubKey: string;
  pricePerUnitCredits: number;
  offerReferenceEventId: string;
  defaultEvidenceFormat: string;
  offerExpiresAt?: string;
  status?: string;
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
