/** Lane template defaults aligned with marketplace-event-builder SERVICE_LANE_TEMPLATES */
export const LANE_TEMPLATES = {
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

export function laneTemplateForServiceType(serviceType) {
  const template = LANE_TEMPLATES[serviceType];
  if (!template) {
    throw new Error(`unknown serviceType lane template: ${serviceType}`);
  }
  return template;
}
