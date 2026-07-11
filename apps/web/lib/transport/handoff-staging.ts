export const HANDOFF_STAGING_KIND = "vectis.handoff.staging.v1";

export type HandoffPartyRole = "provider" | "buyer";

export type HandoffAckStaging = {
  v: 1;
  kind: typeof HANDOFF_STAGING_KIND;
  orderId: string;
  milestoneId: string;
  partyRole: HandoffPartyRole;
  ackHash: string;
  ackLabel?: string;
  createdAt: string;
};

export function buildHandoffAckStaging(input: {
  orderId: string;
  milestoneId: string;
  partyRole: HandoffPartyRole;
  ackHash: string;
  ackLabel?: string;
  createdAt?: string;
}): HandoffAckStaging {
  return {
    v: 1,
    kind: HANDOFF_STAGING_KIND,
    orderId: input.orderId.trim(),
    milestoneId: input.milestoneId.trim(),
    partyRole: input.partyRole,
    ackHash: input.ackHash.trim(),
    ackLabel: input.ackLabel?.trim() || undefined,
    createdAt: input.createdAt ?? new Date().toISOString()
  };
}

export function serializeHandoffAckStaging(staging: HandoffAckStaging): string {
  return JSON.stringify(staging);
}

export function parseHandoffAckStaging(raw: string):
  | { ok: true; staging: HandoffAckStaging }
  | { ok: false; error: string } {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { ok: false, error: "Staging input is empty." };
  }

  let parsed: unknown;
  try {
    const jsonStart = trimmed.indexOf("{");
    const jsonEnd = trimmed.lastIndexOf("}");
    const slice =
      jsonStart >= 0 && jsonEnd > jsonStart ? trimmed.slice(jsonStart, jsonEnd + 1) : trimmed;
    parsed = JSON.parse(slice);
  } catch {
    return { ok: false, error: "Staging input is not valid JSON." };
  }

  if (!parsed || typeof parsed !== "object") {
    return { ok: false, error: "Staging payload must be a JSON object." };
  }

  const record = parsed as Partial<HandoffAckStaging>;
  if (record.kind !== HANDOFF_STAGING_KIND || record.v !== 1) {
    return { ok: false, error: `Expected kind ${HANDOFF_STAGING_KIND}.` };
  }
  if (!record.orderId?.trim() || !record.milestoneId?.trim() || !record.ackHash?.trim()) {
    return { ok: false, error: "Staging requires orderId, milestoneId, and ackHash." };
  }
  if (record.partyRole !== "provider" && record.partyRole !== "buyer") {
    return { ok: false, error: "Staging partyRole must be provider or buyer." };
  }

  return {
    ok: true,
    staging: {
      v: 1,
      kind: HANDOFF_STAGING_KIND,
      orderId: record.orderId.trim(),
      milestoneId: record.milestoneId.trim(),
      partyRole: record.partyRole,
      ackHash: record.ackHash.trim(),
      ackLabel: record.ackLabel?.trim() || undefined,
      createdAt: record.createdAt ?? new Date().toISOString()
    }
  };
}
