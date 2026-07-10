export type OrderDeadlineHint = {
  kind: "order_expired" | "expires_soon" | "past_due" | "relative_terms";
  label: string;
  detail: string;
};

export type OrderDeadlineContext = {
  fundedAt?: string | null;
  milestoneFunded?: boolean;
};

const EXPIRES_SOON_MS = 7 * 24 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export function parseDaysAfterFunding(dueWindow: string | null | undefined): number | null {
  if (!dueWindow?.trim()) {
    return null;
  }
  const match = dueWindow.trim().match(/(\d+)\s*days?\s+after\s+(?:escrow\s+)?fund(?:ing)?/i);
  if (!match) {
    return null;
  }
  const days = Number.parseInt(match[1], 10);
  return Number.isFinite(days) && days > 0 ? days : null;
}

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

function deriveFundingRelativeDeadlineHint(
  dueWindow: string,
  fundedAt: Date,
  nowMs: number
): OrderDeadlineHint | null {
  const daysAfterFunding = parseDaysAfterFunding(dueWindow);
  if (!daysAfterFunding) {
    return null;
  }

  const dueMs = fundedAt.getTime() + daysAfterFunding * DAY_MS;
  const delta = dueMs - nowMs;
  if (delta < 0) {
    return {
      kind: "past_due",
      label: "Past due",
      detail: `${daysAfterFunding} days after funding elapsed (${dueWindow})`
    };
  }
  if (delta <= EXPIRES_SOON_MS) {
    return {
      kind: "expires_soon",
      label: "Due soon",
      detail: `${daysAfterFunding} days after funding (${dueWindow})`
    };
  }
  return null;
}

export function deriveOrderDeadlineHint(
  orderExpiresAt: string | null | undefined,
  dueWindow: string | null | undefined,
  context?: OrderDeadlineContext,
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

  const fundedAt = parseTimestamp(context?.fundedAt);
  if (dueWindow?.trim() && fundedAt) {
    const relativeHint = deriveFundingRelativeDeadlineHint(dueWindow, fundedAt, nowMs);
    if (relativeHint) {
      return relativeHint;
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

  const daysAfterFunding = parseDaysAfterFunding(dueWindow);
  if (daysAfterFunding && context?.milestoneFunded) {
    return {
      kind: "relative_terms",
      label: `${daysAfterFunding}-day window`,
      detail: `Terms specify ${daysAfterFunding} days after funding — verify against locked terms hash`
    };
  }

  return null;
}
