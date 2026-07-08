import { createUnsignedEnvelope, DEFAULT_POLICY_VERSION } from "@new-start/sdk-ts";

export type BuildServiceDeliveryInput = {
  authorPubKey: string;
  orderId: string;
  milestoneId: string;
  evidenceFormat: string;
  artifactHash: string;
  orderReferenceEventId: string;
  deliveredAt?: string;
  notesHash?: string;
  policyVersion?: string;
  createdAt?: string;
};

export function milestoneReadyForDelivery(status: string): boolean {
  return status === "Funded";
}

export function buildServiceDeliveryUnsigned(input: BuildServiceDeliveryInput) {
  if (!input.orderId.trim()) {
    throw new Error("orderId is required");
  }
  if (!input.milestoneId.trim()) {
    throw new Error("milestoneId is required");
  }
  if (!input.evidenceFormat.trim()) {
    throw new Error("evidenceFormat is required");
  }
  if (!input.artifactHash.trim()) {
    throw new Error("artifact hash is required");
  }
  if (!input.orderReferenceEventId.trim()) {
    throw new Error("order reference event id is required");
  }

  const payload: Record<string, unknown> = {
    orderId: input.orderId.trim(),
    milestoneId: input.milestoneId.trim(),
    evidenceFormat: input.evidenceFormat.trim(),
    deliveredAt: input.deliveredAt ?? new Date().toISOString(),
    artifactHashes: [input.artifactHash.trim()]
  };

  if (input.notesHash?.trim()) {
    payload.notesHash = input.notesHash.trim();
  }

  return createUnsignedEnvelope({
    authorPubKey: input.authorPubKey,
    kind: "ServiceDelivery",
    policyVersion: input.policyVersion ?? DEFAULT_POLICY_VERSION,
    createdAt: input.createdAt,
    payload,
    references: {
      order: input.orderReferenceEventId.trim()
    }
  });
}
