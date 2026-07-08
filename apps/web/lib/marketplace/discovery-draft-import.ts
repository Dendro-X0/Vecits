export const DISCOVERY_OFFER_DRAFT_KIND = "ServiceOffer" as const;

export type DiscoveryOfferDraftPayload = {
  serviceType: string;
  title: string;
  description?: string;
  unitDefinition: string;
  deliveryMode: string;
  allowedEvidenceFormats: string[];
};

export type DiscoveryOfferDraftProvenance = {
  signalId: string;
  sourceUrl?: string;
  suggestedLane: string;
  dedupeKey?: string;
};

export type DiscoveryOfferDraft = {
  draftKind: typeof DISCOVERY_OFFER_DRAFT_KIND;
  payload: DiscoveryOfferDraftPayload;
  provenance: DiscoveryOfferDraftProvenance;
};

export type DiscoveryDraftBuilderPrefill = {
  serviceType: string;
  unitDefinition: string;
  deliveryMode: string;
  allowedEvidenceFormats: string;
  milestoneEvidenceFormat: string;
  offerId: string;
  termsHash: string;
  laneTemplateId: string | null;
  title: string;
  description: string;
  suggestedLane: string;
  signalId: string;
  sourceUrl?: string;
};

export function isDiscoveryOfferDraft(value: unknown): value is DiscoveryOfferDraft {
  if (!value || typeof value !== "object") {
    return false;
  }
  const draft = value as DiscoveryOfferDraft;
  return (
    draft.draftKind === DISCOVERY_OFFER_DRAFT_KIND &&
    typeof draft.payload?.serviceType === "string" &&
    typeof draft.payload?.title === "string" &&
    typeof draft.payload?.unitDefinition === "string" &&
    typeof draft.payload?.deliveryMode === "string" &&
    Array.isArray(draft.payload?.allowedEvidenceFormats) &&
    typeof draft.provenance?.signalId === "string" &&
    typeof draft.provenance?.suggestedLane === "string"
  );
}

export function parseDiscoveryDraftJsonl(text: string): DiscoveryOfferDraft[] {
  const drafts: DiscoveryOfferDraft[] = [];
  const lines = text.split("\n");
  for (const [index, line] of lines.entries()) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      throw new Error(`Line ${index + 1} is not valid JSON.`);
    }
    if (!isDiscoveryOfferDraft(parsed)) {
      throw new Error(`Line ${index + 1} is not a valid discovery ServiceOffer draft.`);
    }
    if (!parsed.payload.title.trim()) {
      throw new Error(`Line ${index + 1} is missing draft title.`);
    }
    drafts.push(parsed);
  }
  if (drafts.length === 0) {
    throw new Error("No discovery offer drafts found in input.");
  }
  return drafts;
}

function slugifyOfferPrefix(value: string): string {
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return normalized || "discovery-draft";
}

export function discoveryDraftToBuilderPrefill(
  draft: DiscoveryOfferDraft,
  laneTemplateIdForServiceType: (serviceType: string) => string | null
): DiscoveryDraftBuilderPrefill {
  const { payload, provenance } = draft;
  const evidenceFormats = payload.allowedEvidenceFormats.map((value) => value.trim()).filter(Boolean);
  if (evidenceFormats.length === 0) {
    throw new Error("Draft allowedEvidenceFormats must include at least one value.");
  }

  const prefix = provenance.dedupeKey
    ? slugifyOfferPrefix(provenance.dedupeKey)
    : provenance.signalId.slice(0, 12);

  return {
    serviceType: payload.serviceType,
    unitDefinition: payload.unitDefinition,
    deliveryMode: payload.deliveryMode,
    allowedEvidenceFormats: evidenceFormats.join(","),
    milestoneEvidenceFormat: evidenceFormats[0],
    offerId: `${prefix}-offer`,
    termsHash: `discovery-draft:${provenance.signalId}`,
    laneTemplateId: laneTemplateIdForServiceType(payload.serviceType),
    title: payload.title.trim(),
    description: payload.description?.trim() ?? "",
    suggestedLane: provenance.suggestedLane,
    signalId: provenance.signalId,
    sourceUrl: provenance.sourceUrl
  };
}

export function discoveryDraftImportNote(): string {
  return "Discovery drafts are unsigned previews. Signing and kernel ingest are required before an offer is authoritative.";
}
