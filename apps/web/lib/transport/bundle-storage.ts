import type { OfferDraftPayload } from "@/lib/transport/bundle";

export const TRANSPORT_OFFER_DRAFT_STORAGE_KEY = "vectis.transport.offer-draft";

export function storeTransportOfferDraft(payload: OfferDraftPayload): void {
  if (typeof window === "undefined") {
    return;
  }
  sessionStorage.setItem(TRANSPORT_OFFER_DRAFT_STORAGE_KEY, JSON.stringify(payload));
}

export function readTransportOfferDraft(): OfferDraftPayload | null {
  if (typeof window === "undefined") {
    return null;
  }
  const raw = sessionStorage.getItem(TRANSPORT_OFFER_DRAFT_STORAGE_KEY);
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as OfferDraftPayload;
  } catch {
    return null;
  }
}

export function clearTransportOfferDraft(): void {
  if (typeof window === "undefined") {
    return;
  }
  sessionStorage.removeItem(TRANSPORT_OFFER_DRAFT_STORAGE_KEY);
}
