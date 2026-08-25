import { createUnsignedEnvelope, DEFAULT_POLICY_VERSION } from "@new-start/sdk-ts";

export type BuildServiceCancelInput = {
  authorPubKey: string;
  orderId: string;
  milestoneId: string;
  orderReferenceEventId: string;
  cancelReferenceEventId?: string;
  cancelledAt?: string;
  reasonHash?: string;
  policyVersion?: string;
  createdAt?: string;
};

export function milestoneReadyForCancel(status: string): boolean {
  return status === "Open" || status === "PartiallyFunded" || status === "Funded";
}

export function buildServiceCancelUnsigned(input: BuildServiceCancelInput) {
  if (!input.orderId.trim()) {
    throw new Error("orderId is required");
  }
  if (!input.milestoneId.trim()) {
    throw new Error("milestoneId is required");
  }
  if (!input.orderReferenceEventId.trim()) {
    throw new Error("order reference event id is required");
  }

  const references: Record<string, string> = {
    order: input.orderReferenceEventId.trim()
  };
  const cancelRef = input.cancelReferenceEventId?.trim();
  if (cancelRef) {
    references.cancel = cancelRef;
  }

  const payload: Record<string, unknown> = {
    orderId: input.orderId.trim(),
    milestoneId: input.milestoneId.trim(),
    cancelledAt: input.cancelledAt ?? new Date().toISOString()
  };
  const reasonHash = input.reasonHash?.trim();
  if (reasonHash) {
    payload.reasonHash = reasonHash;
  }

  return createUnsignedEnvelope({
    authorPubKey: input.authorPubKey,
    kind: "ServiceCancel",
    policyVersion: input.policyVersion ?? DEFAULT_POLICY_VERSION,
    createdAt: input.createdAt,
    payload,
    references
  });
}
