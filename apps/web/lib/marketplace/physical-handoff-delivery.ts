import { createUnsignedEnvelope, DEFAULT_POLICY_VERSION } from "@new-start/sdk-ts";

export const PHYSICAL_HANDOFF_EVIDENCE_FORMAT = "physical-handoff-ack-dual-v1";

export type BuildPhysicalHandoffDeliveryInput = {
  authorPubKey: string;
  orderId: string;
  milestoneId: string;
  providerAckHash: string;
  buyerAckHash: string;
  notesHash: string;
  orderReferenceEventId: string;
  deliveredAt?: string;
  policyVersion?: string;
  createdAt?: string;
};

export function validatePhysicalHandoffAckHashes(providerAckHash: string, buyerAckHash: string): string | null {
  const provider = providerAckHash.trim();
  const buyer = buyerAckHash.trim();
  if (!provider || !buyer) {
    return "Both provider and buyer acknowledgment hashes are required.";
  }
  if (provider === buyer) {
    return "Provider and buyer acknowledgment hashes must be distinct.";
  }
  return null;
}

export function buildPhysicalHandoffDeliveryUnsigned(input: BuildPhysicalHandoffDeliveryInput) {
  const hashError = validatePhysicalHandoffAckHashes(input.providerAckHash, input.buyerAckHash);
  if (hashError) {
    throw new Error(hashError);
  }
  if (!input.notesHash.trim()) {
    throw new Error("notesHash is required for physical-handoff delivery.");
  }
  if (!input.orderReferenceEventId.trim()) {
    throw new Error("order reference event id is required.");
  }

  return createUnsignedEnvelope({
    authorPubKey: input.authorPubKey,
    kind: "ServiceDelivery",
    policyVersion: input.policyVersion ?? DEFAULT_POLICY_VERSION,
    createdAt: input.createdAt,
    payload: {
      orderId: input.orderId.trim(),
      milestoneId: input.milestoneId.trim(),
      evidenceFormat: PHYSICAL_HANDOFF_EVIDENCE_FORMAT,
      deliveredAt: input.deliveredAt ?? new Date().toISOString(),
      artifactHashes: [input.providerAckHash.trim(), input.buyerAckHash.trim()],
      notesHash: input.notesHash.trim()
    },
    references: {
      order: input.orderReferenceEventId.trim()
    }
  });
}
