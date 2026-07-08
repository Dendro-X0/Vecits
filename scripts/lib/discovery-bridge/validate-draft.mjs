import { laneTemplateForServiceType } from "./lane-templates.mjs";

function sameStringArray(left, right) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

export function validateOfferDraft(draft) {
  if (draft?.draftKind !== "ServiceOffer") {
    throw new Error("draftKind must be ServiceOffer");
  }

  const payload = draft.payload ?? {};
  const template = laneTemplateForServiceType(payload.serviceType);

  if (payload.serviceType !== template.serviceType) {
    throw new Error(`serviceType mismatch: ${payload.serviceType}`);
  }
  if (payload.unitDefinition !== template.unitDefinition) {
    throw new Error(`unitDefinition mismatch for ${payload.serviceType}`);
  }
  if (payload.deliveryMode !== template.deliveryMode) {
    throw new Error(`deliveryMode mismatch for ${payload.serviceType}`);
  }
  if (!sameStringArray(payload.allowedEvidenceFormats ?? [], template.allowedEvidenceFormats)) {
    throw new Error(`allowedEvidenceFormats mismatch for ${payload.serviceType}`);
  }
  if (!payload.title?.trim()) {
    throw new Error("offer draft missing title");
  }

  return true;
}
