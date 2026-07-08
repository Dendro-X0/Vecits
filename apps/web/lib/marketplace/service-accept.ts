import { createUnsignedEnvelope, DEFAULT_POLICY_VERSION } from "@new-start/sdk-ts";

export type BuildServiceAcceptInput = {
  authorPubKey: string;
  orderId: string;
  milestoneId: string;
  deliveryReferenceEventId: string;
  acceptedAt?: string;
  policyVersion?: string;
  createdAt?: string;
};

export function milestoneReadyForAccept(status: string): boolean {
  return status === "Delivered";
}

export function buildServiceAcceptUnsigned(input: BuildServiceAcceptInput) {
  if (!input.orderId.trim()) {
    throw new Error("orderId is required");
  }
  if (!input.milestoneId.trim()) {
    throw new Error("milestoneId is required");
  }
  if (!input.deliveryReferenceEventId.trim()) {
    throw new Error("delivery reference event id is required");
  }

  return createUnsignedEnvelope({
    authorPubKey: input.authorPubKey,
    kind: "ServiceAccept",
    policyVersion: input.policyVersion ?? DEFAULT_POLICY_VERSION,
    createdAt: input.createdAt,
    payload: {
      orderId: input.orderId.trim(),
      milestoneId: input.milestoneId.trim(),
      acceptedAt: input.acceptedAt ?? new Date().toISOString()
    },
    references: {
      delivery: input.deliveryReferenceEventId.trim()
    }
  });
}
