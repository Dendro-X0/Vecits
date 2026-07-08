export type MarketplaceLane = {
  id: string;
  label: string;
  description: string;
  mutualAid?: boolean;
};

export const MARKETPLACE_LANES: MarketplaceLane[] = [
  {
    id: "software-fixes",
    label: "Software Fixes",
    description: "Narrow, artifact-verifiable bug fixes and CI repairs."
  },
  {
    id: "feature-work",
    label: "Feature Work",
    description: "Bounded feature increments with milestone-first defaults."
  },
  {
    id: "documentation",
    label: "Documentation",
    description: "Structured written deliverables and doc debt cleanup."
  },
  {
    id: "translation",
    label: "Translation",
    description: "Artifact-backed language and localization packages."
  },
  {
    id: "testing",
    label: "Testing",
    description: "Reproduction reports and verification artifacts."
  },
  {
    id: "research",
    label: "Research",
    description: "Structured analysis briefs with hashed outputs."
  },
  {
    id: "project-maintenance",
    label: "Project Maintenance",
    description: "Stalled project continuation and upkeep tasks.",
    mutualAid: true
  },
  {
    id: "compute-job",
    label: "Compute Jobs",
    description: "Deterministic compute with receipt-based delivery."
  }
];

export const MUTUAL_AID_LANE_IDS = new Set(
  MARKETPLACE_LANES.filter((lane) => lane.mutualAid).map((lane) => lane.id)
);

export function getLaneById(laneId: string): MarketplaceLane | undefined {
  return MARKETPLACE_LANES.find((lane) => lane.id === laneId);
}

export type SortOption = "alignment" | "newest" | "reputation" | "credits-asc" | "credits-desc";

export const SORT_OPTIONS: { id: SortOption; label: string; guestAllowed: boolean }[] = [
  { id: "alignment", label: "Alignment", guestAllowed: false },
  { id: "newest", label: "Newest", guestAllowed: true },
  { id: "reputation", label: "Reputation", guestAllowed: true },
  { id: "credits-asc", label: "Credits: Low to high", guestAllowed: true },
  { id: "credits-desc", label: "Credits: High to low", guestAllowed: true }
];
