import { createUnsignedEnvelope, DEFAULT_POLICY_VERSION } from "@new-start/sdk-ts";

export type BuildServiceOrderInput = {
  authorPubKey: string;
  orderId: string;
  offerId: string;
  providerPubKey: string;
  buyerPubKey: string;
  milestoneAmountCredits: number;
  milestoneEvidenceFormat: string;
  offerReferenceEventId: string;
  orderExpiresAt?: string;
  policyVersion?: string;
  createdAt?: string;
  milestoneId?: string;
};

export function generateOrderId(offerId: string): string {
  const slug = offerId.replace(/[^a-zA-Z0-9-]+/g, "-").slice(0, 48);
  return `${slug}-order-${Date.now()}`;
}

export function defaultOrderExpiresAt(offerExpiresAt?: string): string {
  const fallback = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  if (!offerExpiresAt) {
    return fallback.toISOString();
  }
  const offerExpiry = new Date(offerExpiresAt);
  if (Number.isNaN(offerExpiry.getTime())) {
    return fallback.toISOString();
  }
  return offerExpiry < fallback ? offerExpiry.toISOString() : fallback.toISOString();
}

export function buildServiceOrderUnsigned(input: BuildServiceOrderInput) {
  if (!input.orderId.trim()) {
    throw new Error("orderId is required");
  }
  if (!input.offerId.trim()) {
    throw new Error("offerId is required");
  }
  if (!input.providerPubKey.trim()) {
    throw new Error("providerPubKey is required");
  }
  if (!input.buyerPubKey.trim()) {
    throw new Error("buyerPubKey is required");
  }
  if (!Number.isFinite(input.milestoneAmountCredits) || input.milestoneAmountCredits <= 0) {
    throw new Error("milestone amount must be a positive integer");
  }
  if (!input.milestoneEvidenceFormat.trim()) {
    throw new Error("milestone evidenceFormat is required");
  }
  if (!input.offerReferenceEventId.trim()) {
    throw new Error("offer reference event id is required");
  }

  const milestoneId = input.milestoneId?.trim() || "m1";
  const orderExpiresAt = input.orderExpiresAt ?? defaultOrderExpiresAt();

  return createUnsignedEnvelope({
    authorPubKey: input.authorPubKey,
    kind: "ServiceOrder",
    policyVersion: input.policyVersion ?? DEFAULT_POLICY_VERSION,
    createdAt: input.createdAt,
    payload: {
      orderId: input.orderId.trim(),
      offerId: input.offerId.trim(),
      providerPubKey: input.providerPubKey.trim(),
      buyerPubKey: input.buyerPubKey.trim(),
      milestones: [
        {
          milestoneId,
          amountCredits: Math.floor(input.milestoneAmountCredits),
          evidenceFormat: input.milestoneEvidenceFormat.trim()
        }
      ],
      orderExpiresAt
    },
    references: {
      offer: input.offerReferenceEventId.trim()
    }
  });
}
