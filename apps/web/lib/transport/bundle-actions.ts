import type { ParsedTransportBundle } from "@/lib/transport/bundle";
import { storeTransportOfferDraft } from "@/lib/transport/bundle-storage";

export type TransportBundleApplyResult =
  | { kind: "route"; href: string; message: string }
  | { kind: "review"; message: string };

export function resolveTransportBundleAction(bundle: ParsedTransportBundle): TransportBundleApplyResult {
  switch (bundle.type) {
    case "identity.intro":
      return {
        kind: "review",
        message: "Review the identity intro below. Copy the pubkey — scanning does not create a vouch."
      };
    case "vouch.request":
      return {
        kind: "review",
        message:
          "Review the vouch request. As a sponsor you still sign and submit Vouch yourself — nothing auto-submits."
      };
    case "offer.draft":
      storeTransportOfferDraft(bundle.payload);
      return {
        kind: "route",
        href: "/dashboard/builder?step=offer&import=transport-draft",
        message: "Offer draft stored — review fields in the builder before you sign."
      };
    case "order.resume": {
      const params = new URLSearchParams();
      const step = bundle.payload.builderStep ?? "delivery";
      params.set("step", step);
      params.set("order", bundle.payload.orderId);
      if (bundle.payload.milestoneId) {
        params.set("milestone", bundle.payload.milestoneId);
      }
      return {
        kind: "route",
        href: `/dashboard/builder?${params.toString()}`,
        message: "Opening guided builder at the shared order step."
      };
    }
  }
}

export function buildVouchPayloadPreview(subjectPubKey: string): string {
  return JSON.stringify({ subjectPubKey }, null, 2);
}
