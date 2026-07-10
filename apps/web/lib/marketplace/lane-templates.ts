export type ServiceLaneTemplate = {
  id: string;
  label: string;
  serviceType: string;
  unitDefinition: string;
  deliveryMode: string;
  allowedEvidenceFormats: string[];
  defaultMilestoneEvidenceFormat: string;
  strict: boolean;
  description: string;
};

export const SERVICE_LANE_TEMPLATES: ServiceLaneTemplate[] = [
  {
    id: "software-fixes",
    label: "Software Fixes",
    serviceType: "software-fixes",
    unitDefinition: "fix per issue",
    deliveryMode: "artifact",
    allowedEvidenceFormats: ["artifactHash"],
    defaultMilestoneEvidenceFormat: "artifactHash",
    strict: false,
    description: "Narrow artifact-verifiable fixes for bugs and defects."
  },
  {
    id: "feature-work",
    label: "Small Feature Work",
    serviceType: "feature-work",
    unitDefinition: "feature increment",
    deliveryMode: "artifact",
    allowedEvidenceFormats: ["artifactHash"],
    defaultMilestoneEvidenceFormat: "artifactHash",
    strict: false,
    description: "Small bounded feature increments with explicit deliverables."
  },
  {
    id: "documentation",
    label: "Documentation",
    serviceType: "documentation",
    unitDefinition: "doc update",
    deliveryMode: "artifact",
    allowedEvidenceFormats: ["artifactHash"],
    defaultMilestoneEvidenceFormat: "artifactHash",
    strict: false,
    description: "Structured documentation improvements anchored by artifacts."
  },
  {
    id: "translation",
    label: "Translation",
    serviceType: "translation",
    unitDefinition: "translation package",
    deliveryMode: "artifact",
    allowedEvidenceFormats: ["artifactHash"],
    defaultMilestoneEvidenceFormat: "artifactHash",
    strict: false,
    description: "Translation deliverables for docs and structured text assets."
  },
  {
    id: "testing",
    label: "Testing and Reproduction",
    serviceType: "testing",
    unitDefinition: "test report",
    deliveryMode: "artifact",
    allowedEvidenceFormats: ["artifactHash"],
    defaultMilestoneEvidenceFormat: "artifactHash",
    strict: false,
    description: "Test, reproduction, and verification outputs with evidence anchors."
  },
  {
    id: "research",
    label: "Structured Research",
    serviceType: "research",
    unitDefinition: "research brief",
    deliveryMode: "artifact",
    allowedEvidenceFormats: ["artifactHash"],
    defaultMilestoneEvidenceFormat: "artifactHash",
    strict: false,
    description: "Structured analysis and research outputs with artifact proofs."
  },
  {
    id: "project-maintenance",
    label: "Project Maintenance",
    serviceType: "project-maintenance",
    unitDefinition: "maintenance task",
    deliveryMode: "artifact",
    allowedEvidenceFormats: ["artifactHash"],
    defaultMilestoneEvidenceFormat: "artifactHash",
    strict: false,
    description: "Stalled-project continuation and maintenance-oriented deliverables."
  },
  {
    id: "compute-job",
    label: "Compute Job",
    serviceType: "compute-job",
    unitDefinition: "deterministic compute job",
    deliveryMode: "receipt",
    allowedEvidenceFormats: ["job-receipt-v1"],
    defaultMilestoneEvidenceFormat: "job-receipt-v1",
    strict: true,
    description: "Standardized job-runner lane with deterministic receipt evidence."
  },
  {
    id: "local-resource-exchange",
    label: "Local Resource Exchange",
    serviceType: "local-resource-exchange",
    unitDefinition: "local exchange handoff",
    deliveryMode: "local-community",
    allowedEvidenceFormats: ["local-resource-receipt-v1"],
    defaultMilestoneEvidenceFormat: "local-resource-receipt-v1",
    strict: true,
    description: "Offline constrained lane with deterministic local receipt format."
  },
  {
    id: "physical-handoff",
    label: "Physical Handoff",
    serviceType: "physical-handoff",
    unitDefinition: "in-person handoff",
    deliveryMode: "in-person",
    allowedEvidenceFormats: ["physical-handoff-ack-dual-v1"],
    defaultMilestoneEvidenceFormat: "physical-handoff-ack-dual-v1",
    strict: true,
    description: "Offline constrained lane requiring dual acknowledgment evidence."
  }
];

export const DEFAULT_SERVICE_LANE_TEMPLATE_ID = "software-fixes";

export const SERVICE_LANE_TEMPLATE_BY_ID = new Map(
  SERVICE_LANE_TEMPLATES.map((template) => [template.id, template] as const)
);

export const SERVICE_LANE_TEMPLATE_BY_SERVICE_TYPE = new Map(
  SERVICE_LANE_TEMPLATES.map((template) => [template.serviceType, template] as const)
);

export const COMMUNITY_LANE_TEMPLATES = SERVICE_LANE_TEMPLATES.filter((template) => !template.strict);

export const EXPERIMENTAL_LANE_TEMPLATES = SERVICE_LANE_TEMPLATES.filter((template) => template.strict);

export function resolveLaneTemplateForServiceType(serviceType: string): ServiceLaneTemplate | null {
  return SERVICE_LANE_TEMPLATE_BY_SERVICE_TYPE.get(serviceType.trim()) ?? null;
}

export function resolveLaneTemplateById(templateId: string): ServiceLaneTemplate | null {
  return SERVICE_LANE_TEMPLATE_BY_ID.get(templateId) ?? null;
}

export function isExperimentalLaneTemplate(template: ServiceLaneTemplate | null): boolean {
  return Boolean(template?.strict);
}
