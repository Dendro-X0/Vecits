import path from "node:path";
import { fileURLToPath } from "node:url";

const WORKSPACE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

/** Digital artifact lanes deployable by community operators (R6-L2). */
export const COMMUNITY_ARTIFACT_LANES = [
  "software-fixes",
  "feature-work",
  "documentation",
  "translation",
  "testing",
  "research",
  "project-maintenance",
];

/** Specialized lanes with strict evidence contracts (documented; separate drills). */
export const SPECIALIZED_LANES = [
  {
    id: "compute-job",
    drill: "npm run r6:compute-job:drill",
    runbook: "docs/runbooks/compute-job-lane-runbook.md",
    fixtureAccept: "marketplace-compute-job-accept.jsonl",
    fixtureDispute: "marketplace-compute-job-dispute.jsonl",
  },
  {
    id: "physical-handoff",
    fixtureAccept: "marketplace-physical-handoff-accept.jsonl",
  },
];

export const COMMUNITY_ARTIFACT_LANE_PRESETS = {
  "software-fixes": {
    label: "Software Fixes",
    unitDefinition: "fix per issue",
    pricePerUnitCredits: 100,
    artifactHash: "r6-software-fixes-artifact",
    summary: "R6 community lane drill — software-fixes",
    fixtures: {
      accept: "marketplace-accept.jsonl",
      dispute: "marketplace-dispute-settle.jsonl",
    },
  },
  "feature-work": {
    label: "Small Feature Work",
    unitDefinition: "feature increment",
    pricePerUnitCredits: 180,
    artifactHash: "r6-feature-work-artifact",
    summary: "R6 community lane drill — feature-work",
    fixtures: {
      accept: "marketplace-feature-work-accept.jsonl",
      dispute: "marketplace-feature-work-dispute.jsonl",
    },
  },
  documentation: {
    label: "Documentation",
    unitDefinition: "doc update",
    pricePerUnitCredits: 90,
    artifactHash: "r6-documentation-artifact",
    summary: "R6 community lane drill — documentation",
    fixtures: {
      accept: "marketplace-documentation-accept.jsonl",
      dispute: "marketplace-documentation-dispute.jsonl",
    },
  },
  translation: {
    label: "Translation",
    unitDefinition: "translation package",
    pricePerUnitCredits: 110,
    artifactHash: "r6-translation-artifact",
    summary: "R6 community lane drill — translation",
    fixtures: {
      accept: "marketplace-translation-accept.jsonl",
      dispute: "marketplace-translation-dispute.jsonl",
    },
  },
  testing: {
    label: "Testing and Reproduction",
    unitDefinition: "test report",
    pricePerUnitCredits: 95,
    artifactHash: "r6-testing-artifact",
    summary: "R6 community lane drill — testing",
    fixtures: {
      accept: "marketplace-testing-accept.jsonl",
      dispute: "marketplace-testing-dispute.jsonl",
    },
  },
  research: {
    label: "Structured Research",
    unitDefinition: "research brief",
    pricePerUnitCredits: 140,
    artifactHash: "r6-research-artifact",
    summary: "R6 community lane drill — research",
    fixtures: {
      accept: "marketplace-research-accept.jsonl",
      dispute: "marketplace-research-dispute.jsonl",
    },
  },
  "project-maintenance": {
    label: "Project Maintenance",
    unitDefinition: "maintenance task",
    pricePerUnitCredits: 160,
    artifactHash: "r6-project-maintenance-artifact",
    summary: "R6 community lane drill — project-maintenance",
    fixtures: {
      accept: "marketplace-project-maintenance-accept.jsonl",
      dispute: "marketplace-project-maintenance-dispute.jsonl",
    },
  },
};

/** Discovery bridge defaults — must stay aligned with scripts/lib/discovery-bridge/lane-templates.mjs */
export const DISCOVERY_LANE_DEFAULTS = {
  "software-fixes": {
    serviceType: "software-fixes",
    unitDefinition: "fix per issue",
    deliveryMode: "artifact",
    allowedEvidenceFormats: ["artifactHash"],
  },
  "feature-work": {
    serviceType: "feature-work",
    unitDefinition: "feature increment",
    deliveryMode: "artifact",
    allowedEvidenceFormats: ["artifactHash"],
  },
  documentation: {
    serviceType: "documentation",
    unitDefinition: "doc update",
    deliveryMode: "artifact",
    allowedEvidenceFormats: ["artifactHash"],
  },
  translation: {
    serviceType: "translation",
    unitDefinition: "translation package",
    deliveryMode: "artifact",
    allowedEvidenceFormats: ["artifactHash"],
  },
  testing: {
    serviceType: "testing",
    unitDefinition: "test report",
    deliveryMode: "artifact",
    allowedEvidenceFormats: ["artifactHash"],
  },
  research: {
    serviceType: "research",
    unitDefinition: "research brief",
    deliveryMode: "artifact",
    allowedEvidenceFormats: ["artifactHash"],
  },
  "project-maintenance": {
    serviceType: "project-maintenance",
    unitDefinition: "maintenance task",
    deliveryMode: "artifact",
    allowedEvidenceFormats: ["artifactHash"],
  },
  "compute-job": {
    serviceType: "compute-job",
    unitDefinition: "deterministic compute job",
    deliveryMode: "receipt",
    allowedEvidenceFormats: ["job-receipt-v1"],
  },
};

export function fixturePath(filename) {
  return path.join(WORKSPACE_ROOT, "fixtures", "valid", filename);
}

export function presetForLane(lane) {
  const preset = COMMUNITY_ARTIFACT_LANE_PRESETS[lane];
  if (!preset) {
    throw new Error(`unknown community artifact lane: ${lane}`);
  }
  return preset;
}
