/**
 * Staged exchange practice copy (docs/specs/staged-exchange-practice-design.md).
 */

export type ExchangeProfile = "staged-digital" | "offline-oneshot" | "general";

const STAGED_LANES = new Set([
  "compute-job",
  "software-fixes",
  "feature-work",
  "documentation",
  "translation",
  "testing",
  "research",
  "project-maintenance"
]);

const OFFLINE_LANES = new Set(["physical-handoff", "local-resource-exchange"]);

export function exchangeProfileForLane(serviceType: string): ExchangeProfile {
  const lane = serviceType.trim();
  if (OFFLINE_LANES.has(lane)) return "offline-oneshot";
  if (STAGED_LANES.has(lane)) return "staged-digital";
  return "general";
}

export const STAGED_DIGITAL_MILESTONE_HINT =
  "Digital or virtual resources (compute, API grants, code): prefer two or more milestones. Credits release only when each phase is accepted — not as ongoing yield.";

export const OFFLINE_ONESHOT_MILESTONE_HINT =
  "Offline or in-person deals: prefer a single milestone with dual-ack or local receipt. Meeting again later means a new order, not fake phases.";

export const GENERAL_MILESTONE_HINT =
  "Add phased work as separate milestones. Each phase funds, delivers, and accepts on its own — credits are coordination fuel that move at phase completion.";

export function milestoneScheduleHint(serviceType?: string): string {
  const profile = exchangeProfileForLane(serviceType ?? "");
  if (profile === "staged-digital") return STAGED_DIGITAL_MILESTONE_HINT;
  if (profile === "offline-oneshot") return OFFLINE_ONESHOT_MILESTONE_HINT;
  return GENERAL_MILESTONE_HINT;
}
