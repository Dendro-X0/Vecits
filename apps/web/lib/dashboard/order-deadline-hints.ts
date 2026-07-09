export type OrderDeadlineHint = {
  kind: "order_expired" | "expires_soon" | "past_due";
  label: string;
  detail: string;
};

const EXPIRES_SOON_MS = 7 * 24 * 60 * 60 * 1000;

function parseTimestamp(value: string | null | undefined): Date | null {
  if (!value?.trim()) {
    return null;
  }
  const parsed = Date.parse(value.trim());
  if (!Number.isFinite(parsed)) {
    return null;
  }
  return new Date(parsed);
}

function extractIsoDate(value: string | null | undefined): Date | null {
  if (!value?.trim()) {
    return null;
  }
  const match = value.match(/\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z)?/);
  if (!match) {
    return null;
  }
  return parseTimestamp(match[0].includes("T") ? match[0] : `${match[0]}T23:59:59Z`);
}

export function deriveOrderDeadlineHint(
  orderExpiresAt: string | null | undefined,
  dueWindow: string | null | undefined,
  now = new Date()
): OrderDeadlineHint | null {
  const orderExpiry = parseTimestamp(orderExpiresAt);
  const dueDate = extractIsoDate(dueWindow);
  const nowMs = now.getTime();

  if (orderExpiry) {
    const delta = orderExpiry.getTime() - nowMs;
    if (delta < 0) {
      return {
        kind: "order_expired",
        label: "Order expired",
        detail: `Order expiry passed at ${orderExpiresAt}`
      };
    }
    if (delta <= EXPIRES_SOON_MS) {
      return {
        kind: "expires_soon",
        label: "Expires soon",
        detail: `Order expires at ${orderExpiresAt}`
      };
    }
  }

  if (dueDate) {
    const delta = dueDate.getTime() - nowMs;
    if (delta < 0) {
      return {
        kind: "past_due",
        label: "Past due",
        detail: `Milestone due window passed (${dueWindow})`
      };
    }
    if (delta <= EXPIRES_SOON_MS) {
      return {
        kind: "expires_soon",
        label: "Due soon",
        detail: `Milestone due window: ${dueWindow}`
      };
    }
  }

  return null;
}
