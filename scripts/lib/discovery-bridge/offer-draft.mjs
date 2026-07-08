import { laneTemplateForServiceType } from "./lane-templates.mjs";
import { normalizeSignal } from "./signal-schema.mjs";

export function signalToOfferDraft(rawSignal) {
  const signal = normalizeSignal(rawSignal);
  const lane = signal.suggestedLane;
  const template = laneTemplateForServiceType(lane);

  return {
    draftKind: "ServiceOffer",
    payload: {
      serviceType: template.serviceType,
      title: signal.title,
      description: [signal.expansionRationale, signal.url].filter(Boolean).join("\n"),
      unitDefinition: template.unitDefinition,
      deliveryMode: template.deliveryMode,
      allowedEvidenceFormats: template.allowedEvidenceFormats,
    },
    provenance: {
      signalId: signal.signalId,
      sourceUrl: signal.url,
      suggestedLane: lane,
      dedupeKey: signal.dedupeKey,
    },
  };
}

export function signalsToOfferDrafts(signals) {
  return signals.map(signal => signalToOfferDraft(signal));
}
