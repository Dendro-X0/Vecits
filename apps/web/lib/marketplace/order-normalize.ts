export type NormalizedMilestone = {
  id: string;
  amountCredits: number;
  fundedAmount: number;
  status: string;
  evidenceFormat: string;
  deliveryEventId?: string;
};

export type NormalizedOrderExchange = {
  orderId: string;
  offerId: string;
  buyerPubKey: string;
  providerPubKey: string;
  orderReferenceEventId: string;
  status: string;
  milestones: NormalizedMilestone[];
};

function readString(record: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return undefined;
}

function readNumber(record: Record<string, unknown>, ...keys: string[]): number {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }
  return 0;
}

export function normalizeOrderExchange(
  orderId: string,
  order: Record<string, unknown>,
  milestones: Array<{ id: string; data: Record<string, unknown> | null }>
): NormalizedOrderExchange | null {
  const orderReferenceEventId = readString(order, "created_event_id", "createdEventId");
  const buyerPubKey = readString(order, "buyer_pub_key", "buyerPubKey");
  const providerPubKey = readString(order, "provider_pub_key", "providerPubKey");
  const offerId = readString(order, "offer_id", "offerId");

  if (!orderReferenceEventId || !buyerPubKey || !providerPubKey || !offerId) {
    return null;
  }

  return {
    orderId,
    offerId,
    buyerPubKey,
    providerPubKey,
    orderReferenceEventId,
    status: readString(order, "status") ?? "unknown",
    milestones: milestones
      .filter((milestone) => milestone.data)
      .map((milestone) => ({
        id: milestone.id,
        amountCredits: readNumber(milestone.data!, "amount_credits", "amountCredits"),
        fundedAmount: readNumber(milestone.data!, "funded_amount", "fundedAmount"),
        status: readString(milestone.data!, "status") ?? "unknown",
        evidenceFormat:
          readString(milestone.data!, "evidence_format", "evidenceFormat") ?? "artifactHash",
        deliveryEventId: readString(
          milestone.data!,
          "delivery_event_id",
          "deliveryEventId"
        )
      }))
  };
}
