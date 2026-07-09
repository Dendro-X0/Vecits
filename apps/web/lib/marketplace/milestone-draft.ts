export type OrderMilestoneDraft = {
  milestoneId: string;
  amountCredits: string;
  evidenceFormat: string;
  deliverable: string;
  dueWindow: string;
  acceptanceCriteria: string;
};

export type MilestoneFieldRequirement = {
  label: string;
  ok: boolean;
};

const DEFAULT_EVIDENCE_FORMAT = "artifactHash";

export function createDefaultMilestoneDraft(index: number): OrderMilestoneDraft {
  return {
    milestoneId: `m${index + 1}`,
    amountCredits: "100",
    evidenceFormat: DEFAULT_EVIDENCE_FORMAT,
    deliverable: "",
    dueWindow: "",
    acceptanceCriteria: ""
  };
}

export function createInitialMilestoneRows(): OrderMilestoneDraft[] {
  return [createDefaultMilestoneDraft(0)];
}

export function addMilestoneRow(rows: OrderMilestoneDraft[]): OrderMilestoneDraft[] {
  return [...rows, createDefaultMilestoneDraft(rows.length)];
}

export function removeMilestoneRow(rows: OrderMilestoneDraft[], index: number): OrderMilestoneDraft[] {
  if (rows.length <= 1) {
    return rows;
  }
  return rows.filter((_, rowIndex) => rowIndex !== index);
}

export function patchMilestoneRow(
  rows: OrderMilestoneDraft[],
  index: number,
  patch: Partial<OrderMilestoneDraft>
): OrderMilestoneDraft[] {
  return rows.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row));
}

export function milestoneDraftRequirements(
  rows: OrderMilestoneDraft[],
  guidedTerms: boolean
): MilestoneFieldRequirement[] {
  const requirements: MilestoneFieldRequirement[] = [];

  rows.forEach((row, index) => {
    const prefix = rows.length > 1 ? `Milestone ${index + 1}` : "Milestone";
    requirements.push({
      label: `${prefix} ID`,
      ok: row.milestoneId.trim().length > 0
    });
    const amount = Number.parseInt(row.amountCredits.trim(), 10);
    requirements.push({
      label: `${prefix} amountCredits`,
      ok: Number.isFinite(amount) && amount > 0
    });
    requirements.push({
      label: `${prefix} evidenceFormat`,
      ok: row.evidenceFormat.trim().length > 0
    });
    if (guidedTerms) {
      requirements.push({
        label: `${prefix} deliverable`,
        ok: row.deliverable.trim().length > 0
      });
      requirements.push({
        label: `${prefix} due window`,
        ok: row.dueWindow.trim().length > 0
      });
      requirements.push({
        label: `${prefix} acceptance criteria`,
        ok: row.acceptanceCriteria.trim().length > 0
      });
    }
  });

  const ids = rows.map((row) => row.milestoneId.trim()).filter(Boolean);
  requirements.push({
    label: "Unique milestone IDs",
    ok: ids.length === new Set(ids).size
  });

  return requirements;
}

export function buildMilestonePayloadRows(rows: OrderMilestoneDraft[]): Array<{
  milestoneId: string;
  amountCredits: number;
  evidenceFormat: string;
}> {
  return rows.map((row) => ({
    milestoneId: row.milestoneId.trim(),
    amountCredits: Number.parseInt(row.amountCredits.trim(), 10),
    evidenceFormat: row.evidenceFormat.trim()
  }));
}

export function readMilestonesFromPayload(
  record: Record<string, unknown>
): OrderMilestoneDraft[] | null {
  const rawMilestones = record.milestones;
  if (!Array.isArray(rawMilestones) || rawMilestones.length === 0) {
    return null;
  }

  const rows: OrderMilestoneDraft[] = [];
  for (let index = 0; index < rawMilestones.length; index += 1) {
    const item = rawMilestones[index];
    if (!item || typeof item !== "object") {
      continue;
    }
    const milestone = item as Record<string, unknown>;
    const milestoneId =
      typeof milestone.milestoneId === "string" && milestone.milestoneId.trim()
        ? milestone.milestoneId.trim()
        : `m${index + 1}`;
    const amountCredits =
      typeof milestone.amountCredits === "number" && Number.isFinite(milestone.amountCredits)
        ? String(milestone.amountCredits)
        : "100";
    const evidenceFormat =
      typeof milestone.evidenceFormat === "string" && milestone.evidenceFormat.trim()
        ? milestone.evidenceFormat.trim()
        : DEFAULT_EVIDENCE_FORMAT;

    rows.push({
      milestoneId,
      amountCredits,
      evidenceFormat,
      deliverable: "",
      dueWindow: "",
      acceptanceCriteria: ""
    });
  }

  return rows.length > 0 ? rows : null;
}

export function milestoneTermsPayload(rows: OrderMilestoneDraft[]) {
  return rows.map((row) => ({
    milestoneId: row.milestoneId.trim(),
    deliverable: row.deliverable.trim(),
    dueWindow: row.dueWindow.trim(),
    acceptanceCriteria: row.acceptanceCriteria.trim()
  }));
}
