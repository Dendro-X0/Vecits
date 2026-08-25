import { createUnsignedEnvelope, DEFAULT_POLICY_VERSION } from "@new-start/sdk-ts";

export type BuildOrderAmendInput = {
  authorPubKey: string;
  orderId: string;
  milestoneId: string;
  amountCredits: number;
  orderExpiresAt: string;
  orderReferenceEventId: string;
  amendReferenceEventId?: string;
  amendedAt?: string;
  reasonHash?: string;
  policyVersion?: string;
  createdAt?: string;
};

export function milestoneReadyForAmend(status: string): boolean {
  return status === "Open" || status === "PartiallyFunded" || status === "Funded";
}

export function buildOrderAmendUnsigned(input: BuildOrderAmendInput) {
  if (!input.orderId.trim()) {
    throw new Error("orderId is required");
  }
  if (!input.milestoneId.trim()) {
    throw new Error("milestoneId is required");
  }
  if (!Number.isInteger(input.amountCredits) || input.amountCredits <= 0) {
    throw new Error("amountCredits must be a positive integer");
  }
  if (!input.orderExpiresAt.trim()) {
    throw new Error("orderExpiresAt is required");
  }
  if (!input.orderReferenceEventId.trim()) {
    throw new Error("order reference event id is required");
  }

  const references: Record<string, string> = {
    order: input.orderReferenceEventId.trim()
  };
  const amendRef = input.amendReferenceEventId?.trim();
  if (amendRef) {
    references.amend = amendRef;
  }

  const payload: Record<string, unknown> = {
    orderId: input.orderId.trim(),
    milestoneId: input.milestoneId.trim(),
    amountCredits: input.amountCredits,
    orderExpiresAt: input.orderExpiresAt.trim(),
    amendedAt: input.amendedAt ?? new Date().toISOString()
  };
  const reasonHash = input.reasonHash?.trim();
  if (reasonHash) {
    payload.reasonHash = reasonHash;
  }

  return createUnsignedEnvelope({
    authorPubKey: input.authorPubKey,
    kind: "OrderAmend",
    policyVersion: input.policyVersion ?? DEFAULT_POLICY_VERSION,
    createdAt: input.createdAt,
    payload,
    references
  });
}
