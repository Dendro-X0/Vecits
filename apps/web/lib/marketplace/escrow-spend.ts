import { createUnsignedEnvelope, DEFAULT_POLICY_VERSION } from "@new-start/sdk-ts";

export type BuildEscrowSpendInput = {
  authorPubKey: string;
  spenderPubKey: string;
  orderId: string;
  milestoneId: string;
  amount: number;
  nonce: string;
  orderReferenceEventId: string;
  policyVersion?: string;
  createdAt?: string;
};

export function generateEscrowNonce(orderId: string, milestoneId: string): string {
  return `${orderId}-${milestoneId}-escrow-${Date.now()}`;
}

export function milestoneNeedsFunding(input: {
  amountCredits: number;
  fundedAmount: number;
  status: string;
}): boolean {
  if (input.fundedAmount >= input.amountCredits) {
    return false;
  }
  return input.status === "Open" || input.status === "PartiallyFunded";
}

export function buildEscrowSpendUnsigned(input: BuildEscrowSpendInput) {
  if (!input.spenderPubKey.trim()) {
    throw new Error("spenderPubKey is required");
  }
  if (!input.orderId.trim()) {
    throw new Error("orderId is required");
  }
  if (!input.milestoneId.trim()) {
    throw new Error("milestoneId is required");
  }
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw new Error("amount must be a positive integer");
  }
  if (!input.nonce.trim()) {
    throw new Error("nonce is required");
  }
  if (!input.orderReferenceEventId.trim()) {
    throw new Error("order reference event id is required");
  }

  return createUnsignedEnvelope({
    authorPubKey: input.authorPubKey,
    kind: "SpendCredits",
    policyVersion: input.policyVersion ?? DEFAULT_POLICY_VERSION,
    createdAt: input.createdAt,
    payload: {
      spenderPubKey: input.spenderPubKey.trim(),
      sinkKind: "ServiceEscrowSink",
      amount: Math.floor(input.amount),
      orderId: input.orderId.trim(),
      milestoneId: input.milestoneId.trim()
    },
    references: {
      order: input.orderReferenceEventId.trim()
    },
    nonce: input.nonce.trim()
  });
}
