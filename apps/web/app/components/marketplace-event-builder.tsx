"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  createUnsignedEnvelope,
  derivePublicKey,
  generateEd25519KeyPair,
  NodeApiError,
  NodeClient,
  signUnsignedEnvelope,
  type IngestResult,
  type SignedEnvelope
} from "@new-start/sdk-ts";
import { FormEvent, useEffect, useState } from "react";
import { KernelTruthNotice } from "./kernel-truth-notice";
import { DiscoveryDraftImportPanel } from "@/components/marketplace/discovery-draft-import-panel";
import { MilestoneScheduleEditor } from "@/components/marketplace/milestone-schedule-editor";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import {
  buildMilestonePayloadRows,
  createDefaultMilestoneDraft,
  createInitialMilestoneRows,
  milestoneDraftRequirements,
  milestoneTermsPayload,
  readMilestonesFromPayload,
  type OrderMilestoneDraft
} from "@/lib/marketplace/milestone-draft";
import {
  discoveryDraftToBuilderPrefill,
  type DiscoveryDraftBuilderPrefill,
  type DiscoveryOfferDraft
} from "@/lib/marketplace/discovery-draft-import";
import {
  clearTransportOfferDraft,
  readTransportOfferDraft
} from "@/lib/transport/bundle-storage";
import type { OfferDraftPayload } from "@/lib/transport/bundle";
import { buildDisputeBuilderHref } from "@/lib/dashboard/builder-handoff";
import {
  defaultNodeClientBaseUrlForForms,
  validateNodeClientBaseUrl
} from "@/lib/node-client-base-url";
import { LanePublishFitPanel } from "@/components/marketplace/lane-publish-fit-panel";
import {
  DEFAULT_SERVICE_LANE_TEMPLATE_ID,
  SERVICE_LANE_TEMPLATES,
  SERVICE_LANE_TEMPLATE_BY_ID,
  SERVICE_LANE_TEMPLATE_BY_SERVICE_TYPE,
  resolveLaneTemplateForServiceType,
  type ServiceLaneTemplate
} from "@/lib/marketplace/lane-templates";
import {
  legacyButtonStyle,
  legacyCodePanelStyle,
  legacyDisabledButtonStyle,
  legacyErrorPanelStyle,
  legacyFieldStyle,
  legacyLinkButtonStyle,
  legacySectionStyle,
  legacySelectedButtonStyle,
  legacySuccessPanelStyle,
  legacyWarningPanelStyle
} from "@/lib/ui/theme-surfaces";

export type MarketplaceBuilderMode =
  | "offer"
  | "order"
  | "escrowSpend"
  | "delivery"
  | "accept"
  | "dispute"
  | "settle";

type BuilderMode = MarketplaceBuilderMode;

export type MarketplaceEventBuilderProps = {
  variant?: "full" | "transaction";
  controlledMode?: BuilderMode;
  onControlledModeChange?: (mode: BuilderMode) => void;
  onAccepted?: (mode: BuilderMode) => void;
  showDiscoveryImport?: boolean;
  initialMode?: BuilderMode;
  prefillOrderId?: string;
  prefillMilestoneId?: string;
  providerEligibility?: {
    thresholdMet: boolean;
    incomingActiveVouchWeight: number;
    threshold: number;
  } | null;
};

type FixturePreset = "acceptFlow" | "timeoutFlow";
type FlowRoute = "acceptPath" | "disputePath";
type BuilderStarter = "alpha-accept" | "alpha-timeout" | "project-maintenance";
type BuilderLaneStarter =
  | "software-fixes"
  | "feature-work"
  | "documentation"
  | "translation"
  | "testing"
  | "research"
  | "project-maintenance";
type CompensationMode = "credits" | "barter" | "mixed";
type ExplorerQuickLink = { label: string; href: string };
type SessionAcceptedEvent = {
  eventId: string;
  kind: SignedEnvelope["kind"];
  authorPubKey: string;
  createdAt: string;
  payload: Record<string, unknown>;
  references?: Record<string, string>;
  recordedAt: string;
};

type ChecklistStep = {
  mode: BuilderMode;
  kind: SignedEnvelope["kind"];
  label: string;
  completed: boolean;
  eventId?: string;
};

type FieldRequirement = {
  label: string;
  ok: boolean;
};

type AutofillSourceEvent = Pick<
  SignedEnvelope,
  "kind" | "eventId" | "authorPubKey" | "payload" | "references"
>;

type SubmitError = {
  status: number | null;
  code: string | null;
  message: string;
  payload: unknown;
};

type ReachabilityState = {
  status: "idle" | "checking" | "ok" | "error";
  message: string;
};

type LaneStarterPreset = {
  draftPrefix: string;
  pricePerUnitCredits: string;
  termsHash: string;
  artifactHash: string;
  disputeReasonCode: string;
  notesHash: string;
  buyerRefundCredits: string;
  providerRewardCredits: string;
};

type ComputeDeliveryHints = {
  evidenceFormat: string;
  artifactHashes: string[];
  notesHash: string;
  urls: string[];
};

type PersistedBuilderState = {
  version: number;
  flowRoute: FlowRoute;
  activePreset: FixturePreset | null;
  mode: BuilderMode;
  baseUrl: string;
  createdAt: string;
  sessionAcceptedEvents: SessionAcceptedEvent[];
};

const DEFAULT_NODE_API_BASE_URL = defaultNodeClientBaseUrlForForms();
const BUILDER_STORAGE_KEY = "new-start.marketplace-builder";
const BUILDER_STORAGE_VERSION = 2;
const RFC3339_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

const FIXTURE_IDENTITY_KEYS = {
  alice: "d04ab232742bb4ab3a1368bd4615e4e6d0224ab71a016baf8520a332c9778737",
  bob: "a09aa5f47a6759802ff955f8dc2d2a14a5c99d23be97f864127ff9383455a4f0"
} as const;

const FIXTURE_PRESETS: Record<
  FixturePreset,
  {
    label: string;
    offerId: string;
    orderId: string;
    escrowNonce: string;
    disputedAt: string;
  }
> = {
  acceptFlow: {
    label: "Accept Flow",
    offerId: "mk-accept-offer",
    orderId: "mk-accept-order",
    escrowNonce: "mk-accept-escrow-1",
    disputedAt: "2026-03-01T00:09:30Z"
  },
  timeoutFlow: {
    label: "Timeout Flow",
    offerId: "mk-timeout-offer",
    orderId: "mk-timeout-order",
    escrowNonce: "mk-timeout-escrow-1",
    disputedAt: "2026-03-01T00:09:00Z"
  }
};

const BUILDER_STARTERS: Record<
  BuilderStarter,
  {
    label: string;
    description: string;
    laneTemplateId: string;
    flowRoute: FlowRoute;
    fixturePreset: FixturePreset | null;
    draftIds?: {
      offerId: string;
      orderId: string;
      orderOfferId: string;
    };
  }
> = {
  "alpha-accept": {
    label: "Alpha Accept Flow",
    description: "Loads the default accepted-path marketplace starter for initial digital lanes.",
    laneTemplateId: "software-fixes",
    flowRoute: "acceptPath",
    fixturePreset: "acceptFlow"
  },
  "alpha-timeout": {
    label: "Alpha Timeout/Dispute Flow",
    description: "Loads the dispute-path starter for deterministic timeout and settlement testing.",
    laneTemplateId: "software-fixes",
    flowRoute: "disputePath",
    fixturePreset: "timeoutFlow"
  },
  "project-maintenance": {
    label: "Project Maintenance Lane",
    description: "Starts a maintenance-oriented offer/order flow for stalled project support work.",
    laneTemplateId: "project-maintenance",
    flowRoute: "acceptPath",
    fixturePreset: null,
    draftIds: {
      offerId: "pm-demo-offer",
      orderId: "pm-demo-order",
      orderOfferId: "pm-demo-offer"
    }
  }
};

const ALPHA_LANE_STARTER_IDS: BuilderLaneStarter[] = [
  "software-fixes",
  "feature-work",
  "documentation",
  "translation",
  "testing",
  "research",
  "project-maintenance"
];

const LANE_STARTER_PRESETS: Record<BuilderLaneStarter, LaneStarterPreset> = {
  "software-fixes": {
    draftPrefix: "software-fixes-demo",
    pricePerUnitCredits: "100",
    termsHash: "terms-software-fixes-demo",
    artifactHash: "artifact-software-fixes-demo",
    disputeReasonCode: "quality",
    notesHash: "notes-software-fixes-demo",
    buyerRefundCredits: "100",
    providerRewardCredits: "0"
  },
  "feature-work": {
    draftPrefix: "feature-work-demo",
    pricePerUnitCredits: "180",
    termsHash: "terms-feature-work-demo",
    artifactHash: "artifact-feature-work-demo",
    disputeReasonCode: "scope",
    notesHash: "notes-feature-work-demo",
    buyerRefundCredits: "120",
    providerRewardCredits: "60"
  },
  documentation: {
    draftPrefix: "documentation-demo",
    pricePerUnitCredits: "90",
    termsHash: "terms-documentation-demo",
    artifactHash: "artifact-documentation-demo",
    disputeReasonCode: "quality",
    notesHash: "notes-documentation-demo",
    buyerRefundCredits: "90",
    providerRewardCredits: "0"
  },
  translation: {
    draftPrefix: "translation-demo",
    pricePerUnitCredits: "110",
    termsHash: "terms-translation-demo",
    artifactHash: "artifact-translation-demo",
    disputeReasonCode: "quality",
    notesHash: "notes-translation-demo",
    buyerRefundCredits: "110",
    providerRewardCredits: "0"
  },
  testing: {
    draftPrefix: "testing-demo",
    pricePerUnitCredits: "95",
    termsHash: "terms-testing-demo",
    artifactHash: "artifact-testing-demo",
    disputeReasonCode: "quality",
    notesHash: "notes-testing-demo",
    buyerRefundCredits: "95",
    providerRewardCredits: "0"
  },
  research: {
    draftPrefix: "research-demo",
    pricePerUnitCredits: "140",
    termsHash: "terms-research-demo",
    artifactHash: "artifact-research-demo",
    disputeReasonCode: "scope",
    notesHash: "notes-research-demo",
    buyerRefundCredits: "100",
    providerRewardCredits: "40"
  },
  "project-maintenance": {
    draftPrefix: "project-maintenance-demo",
    pricePerUnitCredits: "160",
    termsHash: "terms-project-maintenance-demo",
    artifactHash: "artifact-project-maintenance-demo",
    disputeReasonCode: "quality",
    notesHash: "notes-project-maintenance-demo",
    buyerRefundCredits: "120",
    providerRewardCredits: "40"
  }
};

const FLOW_STEPS: Record<FlowRoute, BuilderMode[]> = {
  acceptPath: ["offer", "order", "escrowSpend", "delivery", "accept"],
  disputePath: ["offer", "order", "escrowSpend", "delivery", "dispute", "settle"]
};

const BUILDER_EVENT_KINDS: SignedEnvelope["kind"][] = [
  "ServiceOffer",
  "ServiceOrder",
  "SpendCredits",
  "ServiceDelivery",
  "ServiceAccept",
  "ServiceDispute",
  "ServiceSettle"
];

export function MarketplaceEventBuilder({
  variant = "full",
  controlledMode,
  onControlledModeChange,
  onAccepted,
  showDiscoveryImport = true,
  initialMode,
  prefillOrderId,
  prefillMilestoneId,
  providerEligibility
}: MarketplaceEventBuilderProps = {}) {
  const searchParams = useSearchParams();
  const isTransaction = variant === "transaction";
  const isControlled = controlledMode !== undefined;
  const [internalMode, setInternalMode] = useState<BuilderMode>("offer");
  const mode = isControlled ? controlledMode : internalMode;

  function setModeState(nextMode: BuilderMode) {
    if (isControlled) {
      onControlledModeChange?.(nextMode);
    } else {
      setInternalMode(nextMode);
    }
  }

  useEffect(() => {
    if (!initialMode || isControlled) {
      return;
    }
    setInternalMode(initialMode);
  }, [initialMode, isControlled]);

  useEffect(() => {
    const orderId = prefillOrderId?.trim();
    if (!orderId) {
      return;
    }
    setOrderId(orderId);
    setEscrowOrderId(orderId);
    setDeliveryOrderId(orderId);
    setAcceptOrderId(orderId);
    setDisputeOrderId(orderId);
    setSettleOrderId(orderId);
  }, [prefillOrderId]);

  useEffect(() => {
    const milestoneId = prefillMilestoneId?.trim();
    if (!milestoneId) {
      return;
    }
    setEscrowMilestoneId(milestoneId);
    setDeliveryMilestoneId(milestoneId);
    setAcceptMilestoneId(milestoneId);
    setDisputeMilestoneId(milestoneId);
    setSettleMilestoneId(milestoneId);
  }, [prefillMilestoneId]);

  const [flowRoute, setFlowRoute] = useState<FlowRoute>("acceptPath");
  const [activePreset, setActivePreset] = useState<FixturePreset | null>(null);
  const [baseUrl, setBaseUrl] = useState(DEFAULT_NODE_API_BASE_URL);
  const [authorPubKey, setAuthorPubKey] = useState("");
  const [authorSecretKey, setAuthorSecretKey] = useState("");
  const [policyVersion, setPolicyVersion] = useState("v0-default");
  const [createdAt, setCreatedAt] = useState("");

  const [offerId, setOfferId] = useState("");
  const [serviceLaneTemplateId, setServiceLaneTemplateId] = useState(DEFAULT_SERVICE_LANE_TEMPLATE_ID);
  const [serviceType, setServiceType] = useState("software-fixes");
  const [unitDefinition, setUnitDefinition] = useState("fix per issue");
  const [pricePerUnitCredits, setPricePerUnitCredits] = useState("100");
  const [compensationMode, setCompensationMode] = useState<CompensationMode>("credits");
  const [barterTerms, setBarterTerms] = useState("");
  const [barterTags, setBarterTags] = useState("");
  const [deliveryMode, setDeliveryMode] = useState("artifact");
  const [offerExpiresAt, setOfferExpiresAt] = useState("2026-12-01T00:00:00Z");
  const [allowedEvidenceFormats, setAllowedEvidenceFormats] = useState("artifactHash");
  const [termsHash, setTermsHash] = useState("");

  const [orderId, setOrderId] = useState("");
  const [orderOfferId, setOrderOfferId] = useState("");
  const [providerPubKey, setProviderPubKey] = useState("");
  const [buyerPubKey, setBuyerPubKey] = useState("");
  const [orderExpiresAt, setOrderExpiresAt] = useState("2026-12-15T00:00:00Z");
  const [milestoneRows, setMilestoneRows] = useState<OrderMilestoneDraft[]>(createInitialMilestoneRows);
  const [milestoneTermsHashMessage, setMilestoneTermsHashMessage] = useState<string | null>(null);
  const [offerReferenceEventId, setOfferReferenceEventId] = useState("");

  const [deliveryOrderId, setDeliveryOrderId] = useState("");
  const [deliveryMilestoneId, setDeliveryMilestoneId] = useState("m1");
  const [deliveryEvidenceFormat, setDeliveryEvidenceFormat] = useState("artifactHash");
  const [deliveryArtifactHashes, setDeliveryArtifactHashes] = useState("hash-1");
  const [deliveryUrls, setDeliveryUrls] = useState("");
  const [deliveryNotesHash, setDeliveryNotesHash] = useState("");
  const [deliveryHintsJson, setDeliveryHintsJson] = useState("");
  const [deliveryHintsMessage, setDeliveryHintsMessage] = useState<string | null>(null);
  const [deliveredAt, setDeliveredAt] = useState("2026-03-01T00:08:00Z");
  const [deliveryOrderReferenceEventId, setDeliveryOrderReferenceEventId] = useState("");

  const [acceptOrderId, setAcceptOrderId] = useState("");
  const [acceptMilestoneId, setAcceptMilestoneId] = useState("m1");
  const [acceptedAt, setAcceptedAt] = useState("2026-03-01T00:09:00Z");
  const [acceptDeliveryReferenceEventId, setAcceptDeliveryReferenceEventId] = useState("");

  const [disputeOrderId, setDisputeOrderId] = useState("");
  const [disputeMilestoneId, setDisputeMilestoneId] = useState("m1");
  const [disputeReasonCode, setDisputeReasonCode] = useState("quality");
  const [disputeNotesHash, setDisputeNotesHash] = useState("");
  const [disputedAt, setDisputedAt] = useState("2026-03-01T00:09:30Z");
  const [disputeDeliveryReferenceEventId, setDisputeDeliveryReferenceEventId] = useState("");

  const [settleOrderId, setSettleOrderId] = useState("");
  const [settleMilestoneId, setSettleMilestoneId] = useState("m1");
  const [settleOutcome, setSettleOutcome] = useState<"buyerWins" | "split">("split");
  const [buyerRefundCredits, setBuyerRefundCredits] = useState("100");
  const [providerRewardCredits, setProviderRewardCredits] = useState("0");
  const [settledAt, setSettledAt] = useState("2026-03-01T00:10:00Z");
  const [settleDisputeReferenceEventId, setSettleDisputeReferenceEventId] = useState("");

  const [escrowSpenderPubKey, setEscrowSpenderPubKey] = useState("");
  const [escrowOrderId, setEscrowOrderId] = useState("");
  const [escrowMilestoneId, setEscrowMilestoneId] = useState("m1");
  const [escrowAmount, setEscrowAmount] = useState("100");
  const [escrowNonce, setEscrowNonce] = useState("escrow-1");
  const [escrowOrderReferenceEventId, setEscrowOrderReferenceEventId] = useState("");

  const [signedEvent, setSignedEvent] = useState<SignedEnvelope | null>(null);
  const [ingestResult, setIngestResult] = useState<IngestResult | null>(null);
  const [submitError, setSubmitError] = useState<SubmitError | null>(null);
  const [showSubmitErrorPayload, setShowSubmitErrorPayload] = useState(false);
  const [sessionAcceptedEvents, setSessionAcceptedEvents] = useState<SessionAcceptedEvent[]>([]);
  const [checklistMessage, setChecklistMessage] = useState<string>("");
  const [reachability, setReachability] = useState<ReachabilityState>({
    status: "idle",
    message: ""
  });
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);
  const [lastAppliedLaunchKey, setLastAppliedLaunchKey] = useState<string | null>(null);
  const [importedDraftMeta, setImportedDraftMeta] = useState<DiscoveryDraftBuilderPrefill | null>(
    null
  );

  useEffect(() => {
    const trimmedOrderId = prefillOrderId?.trim();
    if (!trimmedOrderId || !isTransaction) {
      return;
    }
    const hydrateOrderId = trimmedOrderId;

    let cancelled = false;
    async function hydrateMilestonesFromOrder() {
      try {
        const targetBaseUrl = (baseUrl.trim() || DEFAULT_NODE_API_BASE_URL).trim();
        const client = new NodeClient({ baseUrl: targetBaseUrl });
        const view = await client.getOrder(hydrateOrderId);
        if (cancelled) {
          return;
        }
        const orderData = (view.data as Record<string, unknown> | null) ?? null;
        if (!orderData) {
          return;
        }

        const milestoneIds = Array.isArray(orderData.milestone_ids)
          ? (orderData.milestone_ids as string[]).filter((id) => typeof id === "string" && id.trim())
          : Array.isArray(orderData.milestoneIds)
            ? (orderData.milestoneIds as string[]).filter((id) => typeof id === "string" && id.trim())
            : [];

        if (milestoneIds.length <= 1) {
          return;
        }

        setMilestoneRows(
          milestoneIds.map((id, index) => ({
            ...createDefaultMilestoneDraft(index),
            milestoneId: id.trim()
          }))
        );
      } catch {
        // Best effort — user can still enter milestone IDs manually.
      }
    }

    void hydrateMilestonesFromOrder();
    return () => {
      cancelled = true;
    };
  }, [prefillOrderId, isTransaction, baseUrl]);

  const primaryMilestoneRow = milestoneRows[0] ?? createDefaultMilestoneDraft(0);
  const milestoneId = primaryMilestoneRow.milestoneId;
  const milestoneAmountCredits = primaryMilestoneRow.amountCredits;
  const milestoneEvidenceFormat = primaryMilestoneRow.evidenceFormat;
  const milestoneDeliverable = primaryMilestoneRow.deliverable;
  const milestoneDueWindow = primaryMilestoneRow.dueWindow;
  const milestoneAcceptanceCriteria = primaryMilestoneRow.acceptanceCriteria;

  const activeLaneTemplate = resolveLaneTemplateForServiceType(serviceType);
  const laneTemplateConstraintWarning = validateLaneTemplateConstraints({
    mode: "offer",
    serviceType,
    deliveryMode,
    allowedEvidenceFormats,
    milestoneEvidenceFormat,
    deliveryEvidenceFormat
  });
  const barterTagList = parseCommaList(barterTags);
  const deliveryArtifactHashList = parseCommaList(deliveryArtifactHashes);
  const deliveryUrlList = parseCommaList(deliveryUrls);

  const flowSteps = FLOW_STEPS[flowRoute];
  const currentFlowStepIndex = flowSteps.indexOf(mode);
  const isOnFlowStep = currentFlowStepIndex >= 0;
  const hasPrevFlowStep = currentFlowStepIndex > 0;
  const hasNextFlowStep = isOnFlowStep && currentFlowStepIndex < flowSteps.length - 1;
  const acceptChecklist = buildFlowChecklist("acceptPath", sessionAcceptedEvents);
  const disputeChecklist = buildFlowChecklist("disputePath", sessionAcceptedEvents);
  const activeChecklist = flowRoute === "acceptPath" ? acceptChecklist : disputeChecklist;
  const recommendedStep = flowSteps.find(step => !isModeCompleted(activeChecklist, step)) ?? null;
  const transactionSubmitState: "draft" | "submitting" | "accepted" | "failed" = isSubmitting
    ? "submitting"
    : submitError
      ? "failed"
      : ingestResult?.accepted
        ? "accepted"
        : "draft";
  const requirementInput = {
    offerId,
    serviceType,
    unitDefinition,
    pricePerUnitCredits,
    compensationMode,
    barterTerms,
    barterTags,
    deliveryMode,
    offerExpiresAt,
    allowedEvidenceFormats,
    orderId,
    orderOfferId,
    providerPubKey,
    buyerPubKey,
    orderExpiresAt,
    milestoneRows,
    guidedOrderTerms: isTransaction,
    escrowSpenderPubKey,
    escrowOrderId,
    escrowMilestoneId,
    escrowAmount,
    escrowNonce,
    deliveryOrderId,
    deliveryMilestoneId,
    deliveryEvidenceFormat,
    deliveredAt,
    acceptOrderId,
    acceptMilestoneId,
    acceptedAt,
    disputeOrderId,
    disputeMilestoneId,
    disputeReasonCode,
    disputedAt,
    settleOrderId,
    settleMilestoneId,
    buyerRefundCredits,
    providerRewardCredits,
    settledAt
  };
  const currentRequirements = modeRequirements(mode, requirementInput);
  const currentMissingCount = currentRequirements.filter(requirement => !requirement.ok).length;
  const recommendedRequirements = recommendedStep ? modeRequirements(recommendedStep, requirementInput) : [];
  const recommendedMissingCount = recommendedRequirements.filter(requirement => !requirement.ok).length;
  const recommendedAcceptedAutofillAvailable =
    recommendedStep && recommendedStep !== "offer"
      ? Boolean(
          findLatestAcceptedEvent(
            sessionAcceptedEvents,
            expectedAutofillKindsForMode(recommendedStep)
          )
        )
      : false;
  const currentAcceptedAutofillAvailable =
    mode !== "offer"
      ? Boolean(findLatestAcceptedEvent(sessionAcceptedEvents, expectedAutofillKindsForMode(mode)))
      : false;
  const currentLaneStarterHref =
    serviceLaneTemplateId !== "custom"
      ? `/?builder_lane=${serviceLaneTemplateId}&builder_flow=${
          flowRoute === "disputePath" ? "dispute" : "accept"
        }#marketplace-event-builder`
      : null;
  const currentLaneDiscoveryHref =
    serviceType.trim().length > 0
      ? `/explorer/discovery?service_type=${encodeURIComponent(serviceType.trim())}&alpha_defaults=0`
      : null;
  const currentLaneReputationHref =
    serviceType.trim().length > 0
      ? `/explorer/reputation?lane=${encodeURIComponent(serviceType.trim())}&limit=20`
      : null;
  const quickLinks =
    ingestResult?.accepted === true
      ? buildExplorerQuickLinks({
          mode,
          baseUrl: (baseUrl.trim() || DEFAULT_NODE_API_BASE_URL).trim(),
          asOf: createdAt.trim() || undefined,
          offerId,
          orderId,
          milestoneId,
          escrowOrderId,
          escrowMilestoneId,
          deliveryOrderId,
          deliveryMilestoneId,
          acceptOrderId,
          acceptMilestoneId,
          disputeOrderId,
          disputeMilestoneId,
          settleOrderId,
          settleMilestoneId
        })
      : [];

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(BUILDER_STORAGE_KEY);
      if (!raw) {
        return;
      }
      const parsed = parsePersistedBuilderState(raw);
      if (!parsed) {
        window.localStorage.removeItem(BUILDER_STORAGE_KEY);
        return;
      }
      setFlowRoute(parsed.flowRoute);
      setActivePreset(parsed.activePreset);
      if (!isControlled) {
        setModeState(parsed.mode);
      }
      setBaseUrl(parsed.baseUrl || DEFAULT_NODE_API_BASE_URL);
      setCreatedAt(parsed.createdAt);
      setSessionAcceptedEvents(parsed.sessionAcceptedEvents);
    } catch {
      window.localStorage.removeItem(BUILDER_STORAGE_KEY);
    } finally {
      setIsHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }
    const persisted: PersistedBuilderState = {
      version: BUILDER_STORAGE_VERSION,
      flowRoute,
      activePreset,
      mode,
      baseUrl,
      createdAt,
      sessionAcceptedEvents
    };
    try {
      window.localStorage.setItem(BUILDER_STORAGE_KEY, JSON.stringify(persisted));
    } catch {
      // ignore persistence failures
    }
  }, [activePreset, baseUrl, createdAt, flowRoute, isHydrated, mode, sessionAcceptedEvents]);

  useEffect(() => {
    if (serviceLaneTemplateId === "custom") {
      return;
    }
    const matched = resolveLaneTemplateForServiceType(serviceType);
    const nextTemplateId = matched?.id ?? "custom";
    if (serviceLaneTemplateId !== nextTemplateId) {
      setServiceLaneTemplateId(nextTemplateId);
    }
  }, [serviceLaneTemplateId, serviceType]);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }
    const starterParam = searchParams.get("builder_starter");
    if (!isBuilderStarter(starterParam)) {
      const laneParam = searchParams.get("builder_lane");
      const flowParam = normalizeBuilderFlowQuery(searchParams.get("builder_flow"));
      if (!isBuilderLaneStarter(laneParam)) {
        if (lastAppliedLaunchKey !== null) {
          setLastAppliedLaunchKey(null);
        }
        return;
      }
      const laneLaunchKey = `lane:${laneParam}:${flowParam}`;
      if (laneLaunchKey === lastAppliedLaunchKey) {
        return;
      }
      applyLaneStarter(laneParam, flowParam);
      setLastAppliedLaunchKey(laneLaunchKey);
      return;
    }
    const starterLaunchKey = `starter:${starterParam}`;
    if (starterLaunchKey === lastAppliedLaunchKey) {
      return;
    }
    applyBuilderStarter(starterParam);
    setLastAppliedLaunchKey(starterLaunchKey);
  }, [isHydrated, lastAppliedLaunchKey, searchParams]);

  async function handleGenerateAuthor() {
    const keys = await generateEd25519KeyPair();
    setAuthorPubKey(keys.publicKeyHex);
    setAuthorSecretKey(keys.secretKeyHex);
  }

  function setBuyerFromAuthor() {
    setBuyerPubKey(authorPubKey.trim());
  }

  function setEscrowSpenderFromAuthor() {
    setEscrowSpenderPubKey(authorPubKey.trim());
  }

  function updatePrimaryMilestone(patch: Partial<OrderMilestoneDraft>) {
    setMilestoneRows((rows) =>
      rows.map((row, index) => (index === 0 ? { ...row, ...patch } : row))
    );
  }

  function applyServiceLaneTemplate(templateId: string) {
    const template = SERVICE_LANE_TEMPLATE_BY_ID.get(templateId);
    if (!template) {
      return;
    }
    setServiceLaneTemplateId(template.id);
    setServiceType(template.serviceType);
    setUnitDefinition(template.unitDefinition);
    setDeliveryMode(template.deliveryMode);
    setAllowedEvidenceFormats(template.allowedEvidenceFormats.join(","));
    updatePrimaryMilestone({ evidenceFormat: template.defaultMilestoneEvidenceFormat });
    setDeliveryEvidenceFormat(template.defaultMilestoneEvidenceFormat);
  }

  function handleServiceLaneTemplateChange(value: string) {
    if (value === "custom") {
      setServiceLaneTemplateId("custom");
      return;
    }
    applyServiceLaneTemplate(value);
  }

  function applyBuilderStarter(starter: BuilderStarter) {
    const preset = BUILDER_STARTERS[starter];
    setSessionAcceptedEvents([]);
    resetBuilderInputs();
    setFlowRoute(preset.flowRoute);
    setModeWithContext("offer");
    applyServiceLaneTemplate(preset.laneTemplateId);
    if (preset.fixturePreset) {
      applyFixturePreset(preset.fixturePreset);
    } else {
      setActivePreset(null);
      setOfferId(preset.draftIds?.offerId ?? "");
      setOrderId(preset.draftIds?.orderId ?? "");
      setOrderOfferId(preset.draftIds?.orderOfferId ?? "");
      setEscrowOrderId(preset.draftIds?.orderId ?? "");
      setDeliveryOrderId(preset.draftIds?.orderId ?? "");
      setAcceptOrderId(preset.draftIds?.orderId ?? "");
      setDisputeOrderId(preset.draftIds?.orderId ?? "");
      setSettleOrderId(preset.draftIds?.orderId ?? "");
    }
    setChecklistMessage(`Starter loaded: ${preset.label}.`);
    setTimeout(() => setChecklistMessage(""), 1800);
  }

  function applyLaneStarter(laneTemplateId: BuilderLaneStarter, flowRouteValue: FlowRoute) {
    const template = SERVICE_LANE_TEMPLATE_BY_ID.get(laneTemplateId);
    const preset = LANE_STARTER_PRESETS[laneTemplateId];
    if (!template) {
      return;
    }
    const draftPrefix = preset?.draftPrefix ?? laneTemplateId.replace(/[^a-z0-9]+/gi, "-");
    const createdAtByMode = laneStarterCreatedAt(flowRouteValue);
    setSessionAcceptedEvents([]);
    resetBuilderInputs();
    setFlowRoute(flowRouteValue);
    setModeWithContext("offer");
    applyServiceLaneTemplate(laneTemplateId);
    setActivePreset(null);
    setCreatedAt(createdAtByMode.offer);
    setOfferId(`${draftPrefix}-offer`);
    setOrderId(`${draftPrefix}-order`);
    setOrderOfferId(`${draftPrefix}-offer`);
    setProviderPubKey(FIXTURE_IDENTITY_KEYS.bob);
    setBuyerPubKey(FIXTURE_IDENTITY_KEYS.alice);
    setEscrowOrderId(`${draftPrefix}-order`);
    setEscrowSpenderPubKey(FIXTURE_IDENTITY_KEYS.alice);
    setEscrowNonce(`${draftPrefix}-escrow-1`);
    setDeliveryOrderId(`${draftPrefix}-order`);
    setDeliveryArtifactHashes(preset?.artifactHash ?? `${draftPrefix}-artifact`);
    setDeliveryUrls(`https://example.com/${draftPrefix}/artifact`);
    setDeliveryNotesHash(preset?.notesHash ?? `${draftPrefix}-notes`);
    setDeliveredAt(createdAtByMode.delivery);
    setAcceptOrderId(`${draftPrefix}-order`);
    setAcceptedAt(createdAtByMode.accept);
    setDisputeOrderId(`${draftPrefix}-order`);
    setDisputeReasonCode(preset?.disputeReasonCode ?? "quality");
    setDisputeNotesHash(preset?.notesHash ?? `${draftPrefix}-notes`);
    setDisputedAt(createdAtByMode.dispute);
    setSettleOrderId(`${draftPrefix}-order`);
    setBuyerRefundCredits(preset?.buyerRefundCredits ?? "100");
    setProviderRewardCredits(preset?.providerRewardCredits ?? "0");
    setSettledAt(createdAtByMode.settle);
    setPricePerUnitCredits(preset?.pricePerUnitCredits ?? "100");
    setTermsHash(preset?.termsHash ?? `terms-${draftPrefix}`);
    setChecklistMessage(
      `Starter loaded: ${template.label} (${flowRouteValue === "disputePath" ? "dispute path" : "accept path"}).`
    );
    setTimeout(() => setChecklistMessage(""), 1800);
  }

  async function copyChecklist() {
    const content = buildChecklistCopyText({
      acceptChecklist,
      disputeChecklist,
      sessionAcceptedEvents
    });
    try {
      if (!navigator.clipboard) {
        throw new Error("Clipboard API unavailable");
      }
      await navigator.clipboard.writeText(content);
      setChecklistMessage("Checklist copied.");
      setTimeout(() => setChecklistMessage(""), 1500);
    } catch {
      setChecklistMessage("Copy failed.");
      setTimeout(() => setChecklistMessage(""), 1800);
    }
  }

  async function copyCurrentLaneStarterLink() {
    if (!currentLaneStarterHref) {
      setChecklistMessage("Lane starter link unavailable for custom lane.");
      setTimeout(() => setChecklistMessage(""), 1800);
      return;
    }
    try {
      if (!navigator.clipboard) {
        throw new Error("Clipboard API unavailable");
      }
      await navigator.clipboard.writeText(currentLaneStarterHref);
      setChecklistMessage("Current lane starter link copied.");
      setTimeout(() => setChecklistMessage(""), 1500);
    } catch {
      setChecklistMessage("Copy failed.");
      setTimeout(() => setChecklistMessage(""), 1800);
    }
  }

  function clearChecklist() {
    setSessionAcceptedEvents([]);
    setChecklistMessage("Checklist cleared.");
    setTimeout(() => setChecklistMessage(""), 1500);
  }

  function resetBuilderInputs() {
    setModeWithContext("offer");
    setActivePreset(null);
    setSignedEvent(null);
    setIngestResult(null);
    setSubmitError(null);
    setShowSubmitErrorPayload(false);
    setReachability({ status: "idle", message: "" });
    setErrorMessage(null);

    setAuthorPubKey("");
    setAuthorSecretKey("");
    setPolicyVersion("v0-default");
    setCreatedAt("");

    setOfferId("");
    setServiceLaneTemplateId(DEFAULT_SERVICE_LANE_TEMPLATE_ID);
    setServiceType("software-fixes");
    setUnitDefinition("fix per issue");
    setPricePerUnitCredits("100");
    setCompensationMode("credits");
    setBarterTerms("");
    setBarterTags("");
    setDeliveryMode("artifact");
    setOfferExpiresAt("2026-12-01T00:00:00Z");
    setAllowedEvidenceFormats("artifactHash");
    setTermsHash("");

    setOrderId("");
    setOrderOfferId("");
    setProviderPubKey("");
    setBuyerPubKey("");
    setOrderExpiresAt("2026-12-15T00:00:00Z");
    setMilestoneRows(createInitialMilestoneRows());
    setOfferReferenceEventId("");

    setEscrowSpenderPubKey("");
    setEscrowOrderId("");
    setEscrowMilestoneId("m1");
    setEscrowAmount("100");
    setEscrowNonce("escrow-1");
    setEscrowOrderReferenceEventId("");

    setDeliveryOrderId("");
    setDeliveryMilestoneId("m1");
    setDeliveryEvidenceFormat("artifactHash");
    setDeliveryArtifactHashes("hash-1");
    setDeliveryUrls("");
    setDeliveryNotesHash("");
    setDeliveredAt("2026-03-01T00:08:00Z");
    setDeliveryOrderReferenceEventId("");

    setAcceptOrderId("");
    setAcceptMilestoneId("m1");
    setAcceptedAt("2026-03-01T00:09:00Z");
    setAcceptDeliveryReferenceEventId("");

    setDisputeOrderId("");
    setDisputeMilestoneId("m1");
    setDisputeReasonCode("quality");
    setDisputeNotesHash("");
    setDisputedAt("2026-03-01T00:09:30Z");
    setDisputeDeliveryReferenceEventId("");

    setSettleOrderId("");
    setSettleMilestoneId("m1");
    setSettleOutcome("split");
    setBuyerRefundCredits("100");
    setProviderRewardCredits("0");
    setSettledAt("2026-03-01T00:10:00Z");
    setSettleDisputeReferenceEventId("");

    applyServiceLaneTemplate(DEFAULT_SERVICE_LANE_TEMPLATE_ID);

    setChecklistMessage("Builder inputs reset.");
    setTimeout(() => setChecklistMessage(""), 1500);
  }

  function resetSessionAndChecklist() {
    setFlowRoute("acceptPath");
    setBaseUrl(DEFAULT_NODE_API_BASE_URL);
    setSessionAcceptedEvents([]);
    resetBuilderInputs();
    setChecklistMessage("Session and checklist reset.");
    setTimeout(() => setChecklistMessage(""), 1500);
  }

  function setModeWithContext(nextMode: BuilderMode) {
    if (activePreset) {
      const currentPresetTime = fixtureCreatedAt(activePreset, mode);
      const createdAtTrimmed = createdAt.trim();
      if (!createdAtTrimmed || createdAtTrimmed === currentPresetTime) {
        setCreatedAt(fixtureCreatedAt(activePreset, nextMode));
      }
    }
    setModeState(nextMode);
  }

  function stepFlow(offset: -1 | 1) {
    if (currentFlowStepIndex < 0) {
      setModeWithContext(flowSteps[0]);
      return;
    }
    const nextIndex = currentFlowStepIndex + offset;
    if (nextIndex < 0 || nextIndex >= flowSteps.length) {
      return;
    }
    if (offset > 0) {
      const currentMode = flowSteps[currentFlowStepIndex];
      if (!isModeCompleted(activeChecklist, currentMode)) {
        setErrorMessage(
          `Cannot move forward yet: ${modeLabel(currentMode)} has not been accepted in this session.`
        );
        return;
      }
      const nextMode = flowSteps[nextIndex];
      const nextRequirements = modeRequirements(nextMode, {
        offerId,
        serviceType,
        unitDefinition,
        pricePerUnitCredits,
        compensationMode,
        barterTerms,
        barterTags,
        deliveryMode,
        offerExpiresAt,
        allowedEvidenceFormats,
        orderId,
        orderOfferId,
        providerPubKey,
        buyerPubKey,
        orderExpiresAt,
        milestoneRows,
        guidedOrderTerms: isTransaction,
        escrowSpenderPubKey,
        escrowOrderId,
        escrowMilestoneId,
        escrowAmount,
        escrowNonce,
        deliveryOrderId,
        deliveryMilestoneId,
        deliveryEvidenceFormat,
        deliveredAt,
        acceptOrderId,
        acceptMilestoneId,
        acceptedAt,
        disputeOrderId,
        disputeMilestoneId,
        disputeReasonCode,
        disputedAt,
        settleOrderId,
        settleMilestoneId,
        buyerRefundCredits,
        providerRewardCredits,
        settledAt
      });
      const missing = nextRequirements.filter(requirement => !requirement.ok);
      if (missing.length > 0) {
        const labels = missing.slice(0, 3).map(requirement => requirement.label).join(", ");
        const suffix = missing.length > 3 ? ` (+${missing.length - 3} more)` : "";
        setErrorMessage(`Cannot move to ${modeLabel(nextMode)}. Missing: ${labels}${suffix}.`);
        return;
      }
    }
    setModeWithContext(flowSteps[nextIndex]);
  }

  function applyFixturePreset(presetKey: FixturePreset) {
    const preset = FIXTURE_PRESETS[presetKey];
    setErrorMessage(null);
    setIngestResult(null);
    setActivePreset(presetKey);
    setFlowRoute(presetKey === "timeoutFlow" ? "disputePath" : "acceptPath");

    applyServiceLaneTemplate(DEFAULT_SERVICE_LANE_TEMPLATE_ID);
    setPricePerUnitCredits("100");
    setOfferExpiresAt("2026-12-01T00:00:00Z");
    setTermsHash("");

    setOfferId(preset.offerId);
    setOrderOfferId(preset.offerId);
    setOrderId(preset.orderId);
    setProviderPubKey(FIXTURE_IDENTITY_KEYS.bob);
    setBuyerPubKey(FIXTURE_IDENTITY_KEYS.alice);
    setOrderExpiresAt("2026-12-15T00:00:00Z");
    setMilestoneRows(createInitialMilestoneRows());
    setOfferReferenceEventId("");

    setEscrowSpenderPubKey(FIXTURE_IDENTITY_KEYS.alice);
    setEscrowOrderId(preset.orderId);
    setEscrowMilestoneId("m1");
    setEscrowAmount("100");
    setEscrowNonce(preset.escrowNonce);
    setEscrowOrderReferenceEventId("");

    setDeliveryOrderId(preset.orderId);
    setDeliveryMilestoneId("m1");
    setDeliveryEvidenceFormat("artifactHash");
    setDeliveryArtifactHashes("hash-1");
    setDeliveryUrls("");
    setDeliveryNotesHash("");
    setDeliveredAt("2026-03-01T00:08:00Z");
    setDeliveryOrderReferenceEventId("");

    setAcceptOrderId(preset.orderId);
    setAcceptMilestoneId("m1");
    setAcceptedAt("2026-03-01T00:09:00Z");
    setAcceptDeliveryReferenceEventId("");

    setDisputeOrderId(preset.orderId);
    setDisputeMilestoneId("m1");
    setDisputeReasonCode("quality");
    setDisputeNotesHash("");
    setDisputedAt(preset.disputedAt);
    setDisputeDeliveryReferenceEventId("");

    setSettleOrderId(preset.orderId);
    setSettleMilestoneId("m1");
    setSettleOutcome("split");
    setBuyerRefundCredits("100");
    setProviderRewardCredits("0");
    setSettledAt("2026-03-01T00:10:00Z");
    setSettleDisputeReferenceEventId("");

    setCreatedAt(fixtureCreatedAt(presetKey, mode));
  }

  function handleUseLastSignedEvent() {
    if (!signedEvent) {
      setErrorMessage("No signed event available yet. Sign one event first.");
      return;
    }
    applyAutofillFromSource(signedEvent, "signed");
  }

  function handleUsePreviousAcceptedEvent() {
    const expectedKinds = expectedAutofillKindsForMode(mode);
    const source = findLatestAcceptedEvent(sessionAcceptedEvents, expectedKinds);
    if (!source) {
      const displayKinds = expectedKinds.join(" / ");
      setErrorMessage(
        `No accepted prior event found for ${modeLabel(mode)}. Expected: ${displayKinds}.`
      );
      return;
    }
    applyAutofillFromSource(source, "accepted");
  }

  async function handleCheckNodeReachability() {
    const targetBaseUrl = (baseUrl.trim() || DEFAULT_NODE_API_BASE_URL).trim();
    const baseUrlError = validateNodeClientBaseUrl(targetBaseUrl);
    if (baseUrlError) {
      setReachability({ status: "error", message: baseUrlError });
      return;
    }

    setReachability({ status: "checking", message: "Checking node reachability..." });
    try {
      const client = new NodeClient({ baseUrl: targetBaseUrl });
      const replay = await client.replay();
      setReachability({
        status: "ok",
        message: `Reachable (source: ${replay.source}, as_of: ${replay.as_of})`
      });
    } catch (error) {
      if (error instanceof NodeApiError) {
        setReachability({
          status: "error",
          message: `Reachability failed: ${error.message} (status ${error.status})`
        });
      } else if (error instanceof Error) {
        setReachability({ status: "error", message: `Reachability failed: ${error.message}` });
      } else {
        setReachability({ status: "error", message: "Reachability failed: unknown error." });
      }
    }
  }

  function applyAutofillFromSource(source: AutofillSourceEvent, sourceLabel: "signed" | "accepted") {
    setErrorMessage(null);
    if (mode === "offer") {
      setErrorMessage("ServiceOffer mode has no upstream reference autofill.");
      return;
    }
    if (!isObjectRecord(source.payload)) {
      setErrorMessage(`Last ${sourceLabel} event payload is malformed.`);
      return;
    }

    const payload = source.payload;
    if (mode === "order") {
      if (source.kind !== "ServiceOffer") {
        setErrorMessage(`Order autofill expects a ${sourceLabel} ServiceOffer event.`);
        return;
      }
      const linkedServiceType = readStringField(payload, "serviceType");
      if (linkedServiceType) {
        setServiceType(linkedServiceType);
      }
      const linkedUnitDefinition = readStringField(payload, "unitDefinition");
      if (linkedUnitDefinition) {
        setUnitDefinition(linkedUnitDefinition);
      }
      const linkedDeliveryMode = readStringField(payload, "deliveryMode");
      if (linkedDeliveryMode) {
        setDeliveryMode(linkedDeliveryMode);
      }
      const linkedAllowedEvidenceFormats = readStringArrayField(payload, "allowedEvidenceFormats");
      if (linkedAllowedEvidenceFormats.length > 0) {
        setAllowedEvidenceFormats(linkedAllowedEvidenceFormats.join(","));
        if (!linkedAllowedEvidenceFormats.includes(milestoneEvidenceFormat.trim())) {
          updatePrimaryMilestone({ evidenceFormat: linkedAllowedEvidenceFormats[0] });
        }
        if (!linkedAllowedEvidenceFormats.includes(deliveryEvidenceFormat.trim())) {
          setDeliveryEvidenceFormat(linkedAllowedEvidenceFormats[0]);
        }
      }
      const linkedOfferId = readStringField(payload, "offerId");
      if (linkedOfferId) {
        setOrderOfferId(linkedOfferId);
      }
      setOfferReferenceEventId(source.eventId);
      if (!providerPubKey.trim()) {
        setProviderPubKey(source.authorPubKey);
      }
      return;
    }

    if (mode === "escrowSpend") {
      if (source.kind !== "ServiceOrder") {
        setErrorMessage(`Escrow spend autofill expects a ${sourceLabel} ServiceOrder event.`);
        return;
      }
      const linkedOrderId = readStringField(payload, "orderId");
      if (linkedOrderId) {
        setEscrowOrderId(linkedOrderId);
      }
      const buyer = readStringField(payload, "buyerPubKey");
      if (buyer) {
        setEscrowSpenderPubKey(buyer);
      }
      const milestone = readFirstMilestone(payload);
      const milestones = readMilestonesFromPayload(payload);
      if (milestones) {
        setMilestoneRows(milestones);
      }
      if (milestone?.milestoneId) {
        setEscrowMilestoneId(milestone.milestoneId);
      }
      if (typeof milestone?.amountCredits === "number" && Number.isFinite(milestone.amountCredits)) {
        setEscrowAmount(String(milestone.amountCredits));
      }
      setEscrowOrderReferenceEventId(source.eventId);
      return;
    }

    if (mode === "delivery") {
      if (source.kind === "ServiceOrder") {
        const linkedOrderId = readStringField(payload, "orderId");
        if (linkedOrderId) {
          setDeliveryOrderId(linkedOrderId);
        }
        const milestone = readFirstMilestone(payload);
        const milestones = readMilestonesFromPayload(payload);
        if (milestones) {
          setMilestoneRows(milestones);
        }
        if (milestone?.milestoneId) {
          setDeliveryMilestoneId(milestone.milestoneId);
        }
        if (milestone?.evidenceFormat) {
          setDeliveryEvidenceFormat(milestone.evidenceFormat);
        }
        setDeliveryOrderReferenceEventId(source.eventId);
        return;
      }
      if (source.kind === "SpendCredits") {
        const linkedOrderId = readStringField(payload, "orderId");
        if (linkedOrderId) {
          setDeliveryOrderId(linkedOrderId);
        }
        const linkedMilestoneId = readStringField(payload, "milestoneId");
        if (linkedMilestoneId) {
          setDeliveryMilestoneId(linkedMilestoneId);
        }
        const orderReferenceId =
          source.references && typeof source.references.order === "string"
            ? source.references.order
            : null;
        if (orderReferenceId) {
          setDeliveryOrderReferenceEventId(orderReferenceId);
        }
        return;
      }
      setErrorMessage(
        `Delivery autofill expects a ${sourceLabel} ServiceOrder or SpendCredits event.`
      );
      return;
    }

    if (mode === "accept") {
      if (source.kind !== "ServiceDelivery") {
        setErrorMessage(`Accept autofill expects a ${sourceLabel} ServiceDelivery event.`);
        return;
      }
      const linkedOrderId = readStringField(payload, "orderId");
      if (linkedOrderId) {
        setAcceptOrderId(linkedOrderId);
      }
      const linkedMilestoneId = readStringField(payload, "milestoneId");
      if (linkedMilestoneId) {
        setAcceptMilestoneId(linkedMilestoneId);
      }
      setAcceptDeliveryReferenceEventId(source.eventId);
      return;
    }

    if (mode === "dispute") {
      if (source.kind !== "ServiceDelivery") {
        setErrorMessage(`Dispute autofill expects a ${sourceLabel} ServiceDelivery event.`);
        return;
      }
      const linkedOrderId = readStringField(payload, "orderId");
      if (linkedOrderId) {
        setDisputeOrderId(linkedOrderId);
      }
      const linkedMilestoneId = readStringField(payload, "milestoneId");
      if (linkedMilestoneId) {
        setDisputeMilestoneId(linkedMilestoneId);
      }
      setDisputeDeliveryReferenceEventId(source.eventId);
      return;
    }

    if (source.kind !== "ServiceDispute") {
      setErrorMessage(`Settle autofill expects a ${sourceLabel} ServiceDispute event.`);
      return;
    }
    const linkedOrderId = readStringField(payload, "orderId");
    if (linkedOrderId) {
      setSettleOrderId(linkedOrderId);
    }
    const linkedMilestoneId = readStringField(payload, "milestoneId");
    if (linkedMilestoneId) {
      setSettleMilestoneId(linkedMilestoneId);
    }
    setSettleDisputeReferenceEventId(source.eventId);
  }

  async function handleHashMilestoneTerms() {
    setMilestoneTermsHashMessage(null);
    const termsRows = milestoneTermsPayload(milestoneRows);
    const missing = termsRows.find(
      (row) => !row.deliverable || !row.dueWindow || !row.acceptanceCriteria
    );
    if (missing) {
      setMilestoneTermsHashMessage(
        "Fill deliverable, due window, and acceptance criteria for every milestone first."
      );
      return;
    }
    try {
      const digest = await sha256Hex(JSON.stringify(termsRows));
      setTermsHash(`terms-${digest.slice(0, 16)}`);
      setMilestoneTermsHashMessage("Terms hash updated from milestone schedule.");
    } catch {
      setMilestoneTermsHashMessage("Could not hash milestone terms in this browser.");
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setIngestResult(null);
    setSubmitError(null);
    setShowSubmitErrorPayload(false);

    const targetBaseUrl = (baseUrl.trim() || DEFAULT_NODE_API_BASE_URL).trim();
    const baseUrlError = validateNodeClientBaseUrl(targetBaseUrl);
    if (baseUrlError) {
      setSubmitError({
        status: null,
        code: "client_preflight",
        message: baseUrlError,
        payload: { field: "baseUrl" }
      });
      return;
    }

    const createdAtError = validateOptionalRfc3339(createdAt.trim() || undefined);
    if (createdAtError) {
      setSubmitError({
        status: null,
        code: "client_preflight",
        message: createdAtError,
        payload: { field: "createdAt" }
      });
      return;
    }

    const authorPubKeyTrimmed = authorPubKey.trim();
    const authorSecretKeyTrimmed = authorSecretKey.trim();
    if (!authorPubKeyTrimmed || !authorSecretKeyTrimmed) {
      setSubmitError({
        status: null,
        code: "client_preflight",
        message: "Author public key and secret key are required.",
        payload: { field: "authorKeys" }
      });
      return;
    }

    if (
      isTransaction &&
      mode === "offer" &&
      providerEligibility &&
      !providerEligibility.thresholdMet
    ) {
      setSubmitError({
        status: null,
        code: "client_preflight",
        message: `Provider admission not met: vouch weight ${providerEligibility.incomingActiveVouchWeight} is below threshold ${providerEligibility.threshold}. Ask sponsors for vouches before publishing.`,
        payload: { field: "providerEligibility" }
      });
      return;
    }

    const currentRequirements = modeRequirements(mode, {
      offerId,
      serviceType,
      unitDefinition,
      pricePerUnitCredits,
      compensationMode,
      barterTerms,
      barterTags,
      deliveryMode,
      offerExpiresAt,
      allowedEvidenceFormats,
      orderId,
      orderOfferId,
      providerPubKey,
      buyerPubKey,
      orderExpiresAt,
      milestoneRows,
      guidedOrderTerms: isTransaction,
      escrowSpenderPubKey,
      escrowOrderId,
      escrowMilestoneId,
      escrowAmount,
      escrowNonce,
      deliveryOrderId,
      deliveryMilestoneId,
      deliveryEvidenceFormat,
      deliveredAt,
      acceptOrderId,
      acceptMilestoneId,
      acceptedAt,
      disputeOrderId,
      disputeMilestoneId,
      disputeReasonCode,
      disputedAt,
      settleOrderId,
      settleMilestoneId,
      buyerRefundCredits,
      providerRewardCredits,
      settledAt
    });
    const missingRequirements = currentRequirements.filter(requirement => !requirement.ok);
    if (missingRequirements.length > 0) {
      setSubmitError({
        status: null,
        code: "client_preflight",
        message: `Missing required fields for ${modeLabel(mode)}.`,
        payload: {
          missing: missingRequirements.map(requirement => requirement.label)
        }
      });
      return;
    }

    if (mode === "delivery" && !hasDeliveryEvidenceInput(deliveryArtifactHashes, deliveryUrls, deliveryNotesHash)) {
      setSubmitError({
        status: null,
        code: "client_preflight",
        message: "Delivery requires at least one proof item (hash, URL, or notes hash).",
        payload: { field: "deliveryEvidence" }
      });
      return;
    }

    const laneConstraintError = validateLaneTemplateConstraints({
      mode,
      serviceType,
      deliveryMode,
      allowedEvidenceFormats,
      milestoneEvidenceFormat,
      deliveryEvidenceFormat
    });
    if (laneConstraintError) {
      setSubmitError({
        status: null,
        code: "client_preflight",
        message: laneConstraintError,
        payload: {
          field: "laneTemplate"
        }
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const derivedPub = await derivePublicKey(authorSecretKeyTrimmed);
      if (derivedPub !== authorPubKeyTrimmed) {
        setSubmitError({
          status: null,
          code: "client_preflight",
          message: "Author pubkey does not match the provided secret key.",
          payload: { field: "authorKeys" }
        });
        return;
      }

      const common = {
        authorPubKey: authorPubKeyTrimmed,
        policyVersion: policyVersion.trim() || undefined,
        createdAt: createdAt.trim() || undefined
      };

      const unsigned =
        mode === "offer"
          ? buildOfferUnsigned({
              ...common,
              offerId,
              serviceType,
              unitDefinition,
              pricePerUnitCredits,
              compensationMode,
              barterTerms,
              barterTags,
              deliveryMode,
              offerExpiresAt,
              allowedEvidenceFormats,
              termsHash
            })
          : mode === "order"
            ? buildOrderUnsigned({
                ...common,
                orderId,
                offerId: orderOfferId,
                providerPubKey,
                buyerPubKey,
                orderExpiresAt,
                milestoneRows,
                offerReferenceEventId
              })
            : mode === "delivery"
              ? buildDeliveryUnsigned({
                  ...common,
                  orderId: deliveryOrderId,
                  milestoneId: deliveryMilestoneId,
                  evidenceFormat: deliveryEvidenceFormat,
                  artifactHashes: deliveryArtifactHashes,
                  urls: deliveryUrls,
                  notesHash: deliveryNotesHash,
                  deliveredAt,
                  orderReferenceEventId: deliveryOrderReferenceEventId
                })
              : mode === "accept"
                ? buildAcceptUnsigned({
                    ...common,
                    orderId: acceptOrderId,
                    milestoneId: acceptMilestoneId,
                    acceptedAt,
                    deliveryReferenceEventId: acceptDeliveryReferenceEventId
                  })
                : mode === "dispute"
                  ? buildDisputeUnsigned({
                      ...common,
                      orderId: disputeOrderId,
                      milestoneId: disputeMilestoneId,
                      reasonCode: disputeReasonCode,
                      notesHash: disputeNotesHash,
                      disputedAt,
                      deliveryReferenceEventId: disputeDeliveryReferenceEventId
                    })
                  : mode === "settle"
                    ? buildSettleUnsigned({
                        ...common,
                        orderId: settleOrderId,
                        milestoneId: settleMilestoneId,
                        outcome: settleOutcome,
                        buyerRefundCredits,
                        providerRewardCredits,
                        settledAt,
                        disputeReferenceEventId: settleDisputeReferenceEventId
                      })
                    : buildEscrowSpendUnsigned({
                        ...common,
                        spenderPubKey: escrowSpenderPubKey,
                        orderId: escrowOrderId,
                        milestoneId: escrowMilestoneId,
                        amount: escrowAmount,
                        nonce: escrowNonce,
                        orderReferenceEventId: escrowOrderReferenceEventId
                      });

      const signed = await signUnsignedEnvelope(unsigned, authorSecretKeyTrimmed);
      setSignedEvent(signed);

      const client = new NodeClient({
        baseUrl: targetBaseUrl
      });
      const result = await client.submitSignedEnvelope(signed);
      setIngestResult(result);
      if (!result.accepted) {
        setSubmitError({
          status: 200,
          code: result.code,
          message: result.message ?? "Event rejected by node.",
          payload: result
        });
      }
      if (result.accepted) {
        setSessionAcceptedEvents(previous => [
          ...previous,
          {
            eventId: signed.eventId,
            kind: signed.kind,
            authorPubKey: signed.authorPubKey,
            createdAt: signed.createdAt,
            payload: signed.payload,
            references: signed.references,
            recordedAt: new Date().toISOString()
          }
        ]);
        onAccepted?.(mode);
      }
    } catch (error) {
      if (error instanceof NodeApiError) {
        setSubmitError({
          status: error.status,
          code: extractNodeApiCode(error.payload),
          message: error.message,
          payload: error.payload
        });
      } else if (error instanceof Error) {
        setSubmitError({
          status: null,
          code: null,
          message: error.message,
          payload: null
        });
      } else {
        setSubmitError({
          status: null,
          code: null,
          message: "Unknown error while signing/submitting marketplace event.",
          payload: null
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  function applyDiscoveryDraft(draft: DiscoveryOfferDraft) {
    const prefill = discoveryDraftToBuilderPrefill(
      draft,
      (serviceTypeValue) => SERVICE_LANE_TEMPLATE_BY_SERVICE_TYPE.get(serviceTypeValue)?.id ?? null
    );

    setSessionAcceptedEvents([]);
    resetBuilderInputs();
    setFlowRoute("acceptPath");
    setModeWithContext("offer");
    setActivePreset(null);

    if (prefill.laneTemplateId) {
      applyServiceLaneTemplate(prefill.laneTemplateId);
    } else {
      setServiceLaneTemplateId("custom");
      setServiceType(prefill.serviceType);
      setUnitDefinition(prefill.unitDefinition);
      setDeliveryMode(prefill.deliveryMode);
      setAllowedEvidenceFormats(prefill.allowedEvidenceFormats);
      updatePrimaryMilestone({ evidenceFormat: prefill.milestoneEvidenceFormat });
      setDeliveryEvidenceFormat(prefill.milestoneEvidenceFormat);
    }

    setOfferId(prefill.offerId);
    setTermsHash(prefill.termsHash);
    setImportedDraftMeta(prefill);
    setChecklistMessage("Discovery draft imported — review fields before sign+submit.");
    setTimeout(() => setChecklistMessage(""), 2200);
  }

  function applyTransportOfferDraft(draft: OfferDraftPayload) {
    const evidenceFormats =
      draft.allowedEvidenceFormats?.map((value) => value.trim()).filter(Boolean) ?? [];
    const laneTemplateId =
      SERVICE_LANE_TEMPLATE_BY_SERVICE_TYPE.get(draft.serviceType)?.id ?? null;

    setSessionAcceptedEvents([]);
    resetBuilderInputs();
    setFlowRoute("acceptPath");
    setModeWithContext("offer");
    setActivePreset(null);

    if (laneTemplateId) {
      applyServiceLaneTemplate(laneTemplateId);
    } else {
      setServiceLaneTemplateId("custom");
      setServiceType(draft.serviceType);
      if (draft.unitDefinition) {
        setUnitDefinition(draft.unitDefinition);
      }
      if (draft.deliveryMode) {
        setDeliveryMode(draft.deliveryMode);
      }
      if (evidenceFormats.length > 0) {
        setAllowedEvidenceFormats(evidenceFormats.join(","));
        updatePrimaryMilestone({ evidenceFormat: evidenceFormats[0] });
        setDeliveryEvidenceFormat(evidenceFormats[0]);
      }
    }

    const slug =
      draft.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 40) || "transport-draft";
    const offerId = `${slug}-offer`;
    const termsHash = `transport-draft:${Date.now()}`;

    setOfferId(offerId);
    setTermsHash(termsHash);
    setImportedDraftMeta({
      serviceType: draft.serviceType,
      unitDefinition: draft.unitDefinition ?? "",
      deliveryMode: draft.deliveryMode ?? "",
      allowedEvidenceFormats: evidenceFormats.join(","),
      milestoneEvidenceFormat: evidenceFormats[0] ?? "",
      offerId,
      termsHash,
      laneTemplateId,
      title: draft.title,
      description: draft.description ?? "",
      suggestedLane: "transport-bundle",
      signalId: "transport-bundle"
    });
    setChecklistMessage("Transport offer draft imported — review fields before sign+submit.");
    setTimeout(() => setChecklistMessage(""), 2200);
  }

  useEffect(() => {
    if (searchParams.get("import") !== "transport-draft") {
      return;
    }
    const draft = readTransportOfferDraft();
    if (!draft) {
      return;
    }
    applyTransportOfferDraft(draft);
    clearTransportOfferDraft();
  }, [searchParams]);

  function applyComputeDeliveryHints() {
    try {
      const parsed = parseComputeDeliveryHintsJson(deliveryHintsJson);
      setDeliveryEvidenceFormat(parsed.evidenceFormat);
      setDeliveryArtifactHashes(parsed.artifactHashes.join(","));
      setDeliveryUrls(parsed.urls.join(","));
      setDeliveryNotesHash(parsed.notesHash);
      setDeliveryHintsMessage("Applied compute delivery hints.");
      setErrorMessage(null);
    } catch (error) {
      setDeliveryHintsMessage(null);
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to parse compute delivery hints."
      );
    }
  }

  return (
    <section
      id="marketplace-event-builder"
      style={isTransaction ? transactionSectionStyle : sectionStyle}
    >
      {!isTransaction ? (
        <>
          <h2 style={{ marginTop: 0 }}>Marketplace Event Builder (Draft → Sign → Submit)</h2>
          <p style={{ marginTop: 0, opacity: 0.85 }}>
            Build marketplace events, sign locally with Ed25519, and submit to `POST /events`.
          </p>
        </>
      ) : null}

      {showDiscoveryImport ? (
        <div id="discovery-draft-import" style={{ marginBottom: "0.9rem" }}>
          <DiscoveryDraftImportPanel onImport={applyDiscoveryDraft} variant="inline" />
        </div>
      ) : null}

      {importedDraftMeta ? (
        <div style={{ ...legacyWarningPanelStyle, marginBottom: "0.9rem" }}>
          <p style={{ marginTop: 0, marginBottom: "0.35rem", color: "var(--warning)", fontWeight: 600 }}>
            Imported draft
          </p>
          <p style={{ marginTop: 0, marginBottom: "0.35rem", opacity: 0.9 }}>
            Classifier lane: <code>{importedDraftMeta.suggestedLane}</code> · serviceType{" "}
            <code>{importedDraftMeta.serviceType}</code>
          </p>
          <p style={{ marginTop: 0, marginBottom: "0.35rem", opacity: 0.9 }}>
            <strong>{importedDraftMeta.title}</strong>
          </p>
          {importedDraftMeta.description ? (
            <p style={{ marginTop: 0, marginBottom: "0.35rem", opacity: 0.82, whiteSpace: "pre-wrap" }}>
              {importedDraftMeta.description}
            </p>
          ) : null}
          <p style={{ marginTop: 0, marginBottom: 0, opacity: 0.8, fontSize: "0.92rem" }}>
            Review the details before you publish. The offer is not live until your node accepts it.
          </p>
        </div>
      ) : null}

      {!isTransaction ? (
        <>
      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginBottom: "0.8rem" }}>
        <button
          type="button"
          style={mode === "offer" ? selectedButtonStyle : buttonStyle}
          onClick={() => setModeWithContext("offer")}
        >
          ServiceOffer
        </button>
        <button
          type="button"
          style={mode === "order" ? selectedButtonStyle : buttonStyle}
          onClick={() => setModeWithContext("order")}
        >
          ServiceOrder
        </button>
        <button
          type="button"
          style={mode === "escrowSpend" ? selectedButtonStyle : buttonStyle}
          onClick={() => setModeWithContext("escrowSpend")}
        >
          SpendCredits (Escrow)
        </button>
        <button
          type="button"
          style={mode === "delivery" ? selectedButtonStyle : buttonStyle}
          onClick={() => setModeWithContext("delivery")}
        >
          ServiceDelivery
        </button>
        <button
          type="button"
          style={mode === "accept" ? selectedButtonStyle : buttonStyle}
          onClick={() => setModeWithContext("accept")}
        >
          ServiceAccept
        </button>
        <button
          type="button"
          style={mode === "dispute" ? selectedButtonStyle : buttonStyle}
          onClick={() => setModeWithContext("dispute")}
        >
          ServiceDispute
        </button>
        <button
          type="button"
          style={mode === "settle" ? selectedButtonStyle : buttonStyle}
          onClick={() => setModeWithContext("settle")}
        >
          ServiceSettle
        </button>
      </div>
      <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap", marginBottom: "0.8rem" }}>
        <span style={{ opacity: 0.85, alignSelf: "center" }}>Flow:</span>
        <button
          type="button"
          style={flowRoute === "acceptPath" ? selectedButtonStyle : buttonStyle}
          onClick={() => setFlowRoute("acceptPath")}
        >
          Accept Path
        </button>
        <button
          type="button"
          style={flowRoute === "disputePath" ? selectedButtonStyle : buttonStyle}
          onClick={() => setFlowRoute("disputePath")}
        >
          Dispute Path
        </button>
        <button
          type="button"
          style={mode === flowSteps[0] ? disabledButtonStyle : buttonStyle}
          onClick={() => setModeWithContext(flowSteps[0])}
          disabled={mode === flowSteps[0]}
        >
          Go Flow Start
        </button>
        <button
          type="button"
          style={hasPrevFlowStep ? buttonStyle : disabledButtonStyle}
          onClick={() => stepFlow(-1)}
          disabled={!hasPrevFlowStep}
        >
          Prev Step
        </button>
        <button
          type="button"
          style={hasNextFlowStep ? buttonStyle : disabledButtonStyle}
          onClick={() => stepFlow(1)}
          disabled={!hasNextFlowStep}
        >
          Next Step
        </button>
        <span style={{ opacity: 0.85, alignSelf: "center" }}>
          Step {isOnFlowStep ? currentFlowStepIndex + 1 : "-"}
          /{flowSteps.length}
        </span>
      </div>
      <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap", marginBottom: "0.8rem" }}>
        <span style={{ opacity: 0.85, alignSelf: "center" }}>Fixture presets:</span>
        {(Object.keys(FIXTURE_PRESETS) as FixturePreset[]).map(presetKey => (
          <button
            key={presetKey}
            type="button"
            style={buttonStyle}
            onClick={() => applyFixturePreset(presetKey)}
          >
            {FIXTURE_PRESETS[presetKey].label}
          </button>
        ))}
      </div>
      <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap", marginBottom: "0.45rem" }}>
        <span style={{ opacity: 0.85, alignSelf: "center" }}>Lane accept starters:</span>
        {ALPHA_LANE_STARTER_IDS.map(templateId => {
          const template = SERVICE_LANE_TEMPLATE_BY_ID.get(templateId);
          if (!template) {
            return null;
          }
          return (
            <button
              key={`accept-${templateId}`}
              type="button"
              style={buttonStyle}
              onClick={() => applyLaneStarter(templateId, "acceptPath")}
            >
              {template.label}
            </button>
          );
        })}
      </div>
      <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap", marginBottom: "0.8rem" }}>
        <span style={{ opacity: 0.85, alignSelf: "center" }}>Lane dispute starters:</span>
        {ALPHA_LANE_STARTER_IDS.map(templateId => {
          const template = SERVICE_LANE_TEMPLATE_BY_ID.get(templateId);
          if (!template) {
            return null;
          }
          return (
            <button
              key={`dispute-${templateId}`}
              type="button"
              style={buttonStyle}
              onClick={() => applyLaneStarter(templateId, "disputePath")}
            >
              {template.label}
            </button>
          );
        })}
      </div>
      <section style={{ ...panelStyle, marginTop: 0, marginBottom: "0.8rem" }}>
        <h3 style={{ marginTop: 0, marginBottom: "0.5rem" }}>Current Lane Shortcuts</h3>
        <p style={{ marginTop: 0, marginBottom: "0.55rem", opacity: 0.85 }}>
          Jump to inspection surfaces or copy the current lane starter without leaving the builder.
        </p>
        <div style={{ display: "flex", gap: "0.55rem", flexWrap: "wrap" }}>
          {currentLaneDiscoveryHref ? (
            <Link href={currentLaneDiscoveryHref} style={linkButtonStyle}>
              Open lane discovery
            </Link>
          ) : null}
          {currentLaneReputationHref ? (
            <Link href={currentLaneReputationHref} style={linkButtonStyle}>
              Open lane reputation
            </Link>
          ) : null}
          <button
            type="button"
            style={currentLaneStarterHref ? buttonStyle : disabledButtonStyle}
            onClick={copyCurrentLaneStarterLink}
            disabled={!currentLaneStarterHref}
          >
            Copy current lane starter URL
          </button>
        </div>
        {currentLaneStarterHref ? (
          <p style={{ marginTop: "0.55rem", marginBottom: 0, opacity: 0.85 }}>
            current starter: <code>{currentLaneStarterHref}</code>
          </p>
        ) : (
          <p style={{ marginTop: "0.55rem", marginBottom: 0, opacity: 0.85 }}>
            current starter unavailable while using a custom lane template.
          </p>
        )}
      </section>
      <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap", marginBottom: "0.8rem" }}>
        <button
          type="button"
          style={isHydrated ? buttonStyle : disabledButtonStyle}
          onClick={resetBuilderInputs}
          disabled={!isHydrated}
        >
          Reset Builder Inputs
        </button>
        <button
          type="button"
          style={isHydrated ? buttonStyle : disabledButtonStyle}
          onClick={resetSessionAndChecklist}
          disabled={!isHydrated}
        >
          Reset Session + Checklist
        </button>
        <span style={{ opacity: 0.85, alignSelf: "center" }}>
          Workspace persistence: {isHydrated ? "enabled" : "loading"}
        </span>
      </div>
      <section style={{ ...panelStyle, marginTop: 0, marginBottom: "0.8rem" }}>
        <h3 style={{ marginTop: 0, marginBottom: "0.5rem" }}>Next Recommended Action</h3>
        {recommendedStep ? (
          <>
            <p style={{ marginTop: 0, marginBottom: "0.45rem", opacity: 0.9 }}>
              <strong>{modeLabel(recommendedStep)}</strong> - {modePurpose(recommendedStep)}
            </p>
            <p style={{ marginTop: 0, marginBottom: "0.55rem", opacity: 0.85 }}>
              Missing required fields: {recommendedMissingCount}
            </p>
            <div style={{ display: "flex", gap: "0.55rem", flexWrap: "wrap", marginBottom: "0.65rem" }}>
              {mode !== recommendedStep ? (
                <button
                  type="button"
                  style={buttonStyle}
                  onClick={() => setModeWithContext(recommendedStep)}
                >
                  Go To Recommended Step
                </button>
              ) : null}
              {mode === recommendedStep && recommendedStep !== "offer" ? (
                <button
                  type="button"
                  style={recommendedAcceptedAutofillAvailable ? buttonStyle : disabledButtonStyle}
                  onClick={handleUsePreviousAcceptedEvent}
                  disabled={!recommendedAcceptedAutofillAvailable}
                >
                  Autofill From Previous Accepted Event
                </button>
              ) : null}
            </div>
            <ul style={{ marginTop: 0, marginBottom: 0 }}>
              {recommendedRequirements.map(requirement => (
                <li key={requirement.label}>
                  {requirement.ok ? "✅" : "⬜"} {requirement.label}
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p style={{ marginTop: 0, marginBottom: 0, opacity: 0.9 }}>
            Current flow is complete for this session.
          </p>
        )}
      </section>
        </>
      ) : null}

      {isTransaction ? (
        <div className="grid gap-4 pb-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(260px,0.8fr)]">
          <div className="rounded-xl border border-border bg-muted/25 p-4">
            <p className="text-sm font-medium text-foreground">Complete this step</p>
            <p className="mt-1 text-sm text-muted-foreground">{modePurpose(mode)}</p>
            <p className="mt-3 text-xs text-muted-foreground">
              {currentMissingCount === 0
                ? "Everything required for this step is ready."
                : `${currentMissingCount} required field${currentMissingCount === 1 ? "" : "s"} still need attention.`}
            </p>
            <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
              {currentRequirements.map(requirement => (
                <li key={requirement.label}>
                  {requirement.ok ? "✓" : "○"} {friendlyRequirementLabel(requirement.label)}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-sm font-medium text-foreground">Helpful shortcuts</p>
            <div style={{ display: "flex", gap: "0.55rem", flexWrap: "wrap", marginTop: "0.75rem" }}>
              <button
                type="button"
                style={reachability.status === "checking" ? disabledButtonStyle : buttonStyle}
                onClick={handleCheckNodeReachability}
                disabled={reachability.status === "checking"}
              >
                {reachability.status === "checking" ? "Checking connection..." : "Check connection"}
              </button>
              <button type="button" onClick={handleGenerateAuthor} style={buttonStyle}>
                Generate signing key
              </button>
              {mode !== "offer" ? (
                <button type="button" onClick={handleUseLastSignedEvent} style={buttonStyle}>
                  Use last signed step
                </button>
              ) : null}
              {mode !== "offer" ? (
                <button
                  type="button"
                  onClick={handleUsePreviousAcceptedEvent}
                  style={currentAcceptedAutofillAvailable ? buttonStyle : disabledButtonStyle}
                  disabled={!currentAcceptedAutofillAvailable}
                >
                  Use previous step
                </button>
              ) : null}
              {mode === "order" ? (
                <button type="button" onClick={setBuyerFromAuthor} style={buttonStyle}>
                  Use my key as buyer
                </button>
              ) : null}
              {mode === "escrowSpend" ? (
                <button type="button" onClick={setEscrowSpenderFromAuthor} style={buttonStyle}>
                  Use my key as payer
                </button>
              ) : null}
            </div>
            {reachability.message ? (
              <p
                className="mt-3 text-sm"
                style={{ color: reachability.status === "error" ? "var(--destructive)" : "var(--status-ok)" }}
              >
                {reachability.message}
              </p>
            ) : null}
            {signedEvent ? (
              <p style={{ marginTop: "0.75rem", marginBottom: 0, opacity: 0.85, fontSize: "0.92rem" }}>
                Last signed step: <code>{signedEvent.kind}</code> <code>{signedEvent.eventId}</code>
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className={isTransaction ? "space-y-5" : undefined}>
        {isTransaction ? (
          <details className="mb-5 rounded-xl border border-border bg-muted/20 px-4 py-3">
            <summary className="cursor-pointer text-sm font-medium text-foreground">
              Advanced details
            </summary>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label style={{ display: "block", marginBottom: "0.5rem" }}>
                Node URL
                <input
                  value={baseUrl}
                  onChange={event => setBaseUrl(event.target.value)}
                  style={fieldStyle}
                  placeholder="http://127.0.0.1:7878"
                />
              </label>
              <label style={{ display: "block", marginBottom: "0.5rem" }}>
                Public signing key
                <input
                  value={authorPubKey}
                  onChange={event => setAuthorPubKey(event.target.value)}
                  style={fieldStyle}
                  placeholder="64-char hex public key"
                />
              </label>
              <label style={{ display: "block", marginBottom: "0.5rem" }}>
                Secret signing key
                <input
                  value={authorSecretKey}
                  onChange={event => setAuthorSecretKey(event.target.value)}
                  style={fieldStyle}
                  placeholder="64-char hex secret key"
                />
              </label>
              <label style={{ display: "block", marginBottom: "0.5rem" }}>
                Policy version (optional)
                <input
                  value={policyVersion}
                  onChange={event => setPolicyVersion(event.target.value)}
                  style={fieldStyle}
                  placeholder="v0-default"
                />
              </label>
              <label style={{ display: "block", marginBottom: "0.5rem" }}>
                Created at (optional RFC3339)
                <input
                  value={createdAt}
                  onChange={event => setCreatedAt(event.target.value)}
                  style={fieldStyle}
                  placeholder="2026-03-01T00:05:00Z"
                />
              </label>
            </div>
          </details>
        ) : (
          <>
            <label style={{ display: "block", marginBottom: "0.5rem" }}>
              Node API Base URL
              <input
                value={baseUrl}
                onChange={event => setBaseUrl(event.target.value)}
                style={fieldStyle}
                placeholder="http://127.0.0.1:7878"
              />
            </label>
            <div style={{ display: "flex", gap: "0.55rem", flexWrap: "wrap", marginBottom: "0.75rem" }}>
              <button
                type="button"
                style={reachability.status === "checking" ? disabledButtonStyle : buttonStyle}
                onClick={handleCheckNodeReachability}
                disabled={reachability.status === "checking"}
              >
                {reachability.status === "checking" ? "Checking Node..." : "Check Node Reachability"}
              </button>
              {reachability.message ? (
                <span
                  style={{
                    alignSelf: "center",
                    color: reachability.status === "error" ? "var(--destructive)" : "var(--status-ok)"
                  }}
                >
                  {reachability.message}
                </span>
              ) : null}
            </div>
            <label style={{ display: "block", marginBottom: "0.5rem" }}>
              Author Public Key
              <input
                value={authorPubKey}
                onChange={event => setAuthorPubKey(event.target.value)}
                style={fieldStyle}
                placeholder="64-char hex public key"
              />
            </label>
            <label style={{ display: "block", marginBottom: "0.5rem" }}>
              Author Secret Key
              <input
                value={authorSecretKey}
                onChange={event => setAuthorSecretKey(event.target.value)}
                style={fieldStyle}
                placeholder="64-char hex secret key"
              />
            </label>
            <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginBottom: "0.75rem" }}>
              <button type="button" onClick={handleGenerateAuthor} style={buttonStyle}>
                Generate Author Keypair
              </button>
              {mode !== "offer" ? (
                <button type="button" onClick={handleUseLastSignedEvent} style={buttonStyle}>
                  Autofill From Last Signed Event
                </button>
              ) : null}
              {mode !== "offer" ? (
                <button
                  type="button"
                  onClick={handleUsePreviousAcceptedEvent}
                  style={currentAcceptedAutofillAvailable ? buttonStyle : disabledButtonStyle}
                  disabled={!currentAcceptedAutofillAvailable}
                >
                  Autofill From Previous Accepted Event
                </button>
              ) : null}
              {mode === "order" ? (
                <button type="button" onClick={setBuyerFromAuthor} style={buttonStyle}>
                  Use Author as Buyer
                </button>
              ) : null}
              {mode === "escrowSpend" ? (
                <button type="button" onClick={setEscrowSpenderFromAuthor} style={buttonStyle}>
                  Use Author as Spender
                </button>
              ) : null}
            </div>
            {signedEvent ? (
              <p style={{ marginTop: 0, marginBottom: "0.75rem", opacity: 0.85 }}>
                Last signed event: <code>{signedEvent.kind}</code> <code>{signedEvent.eventId}</code>
              </p>
            ) : null}

            <label style={{ display: "block", marginBottom: "0.5rem" }}>
              Policy Version (optional)
              <input
                value={policyVersion}
                onChange={event => setPolicyVersion(event.target.value)}
                style={fieldStyle}
                placeholder="v0-default"
              />
            </label>
            <label style={{ display: "block", marginBottom: "0.5rem" }}>
              createdAt (optional RFC3339)
              <input
                value={createdAt}
                onChange={event => setCreatedAt(event.target.value)}
                style={fieldStyle}
                placeholder="2026-03-01T00:05:00Z"
              />
            </label>
          </>
        )}

        {mode === "offer" ? (
          <>
            {isTransaction && providerEligibility && !providerEligibility.thresholdMet ? (
              <div className="mb-4 rounded-xl border border-amber-500/35 bg-amber-500/10 px-4 py-3 text-sm">
                <p className="font-medium text-foreground">Provider admission required</p>
                <p className="mt-1 text-muted-foreground">
                  Your vouch weight is {providerEligibility.incomingActiveVouchWeight} — the node
                  requires {providerEligibility.threshold} to publish offers. Sponsor vouches are
                  for <span className="font-medium text-foreground">admission</span> only; milestone
                  settlement still follows locked escrow terms.
                </p>
                <Link href="/dashboard" className="mt-2 inline-flex text-sm font-medium text-primary hover:underline">
                  Open trust bootstrap on Overview
                </Link>
              </div>
            ) : null}
            {isTransaction ? (
              <div className="mb-4 rounded-xl border border-border/70 bg-muted/25 px-4 py-3 text-sm leading-relaxed text-muted-foreground">
                Start with the basics buyers care about: what you offer, how pricing works, how proof is delivered, and when the offer expires.
              </div>
            ) : null}
            {isTransaction ? (
              <LanePublishFitPanel
                template={activeLaneTemplate}
                customLane={serviceLaneTemplateId === "custom"}
              />
            ) : null}
            <div className={isTransaction ? "grid gap-4 lg:grid-cols-2" : undefined}>
            <label style={{ display: "block", marginBottom: "0.5rem" }}>
              {isTransaction ? "Offer ID" : "offerId"}
              <input
                value={offerId}
                onChange={event => setOfferId(event.target.value)}
                style={fieldStyle}
                placeholder="mk-demo-offer"
              />
            </label>
            <label style={{ display: "block", marginBottom: "0.5rem" }}>
              {isTransaction ? "Offer template" : "Service Lane Template"}
              <Select
                value={serviceLaneTemplateId}
                onValueChange={value => {
                  if (!value) return;
                  handleServiceLaneTemplateChange(value);
                }}
              >
                <SelectTrigger className="mt-1.5 w-full min-w-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent align="start">
                  {SERVICE_LANE_TEMPLATES.map(template => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.label}
                    </SelectItem>
                  ))}
                  <SelectItem value="custom">Custom (manual)</SelectItem>
                </SelectContent>
              </Select>
            </label>
            {activeLaneTemplate ? (
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                Template: {activeLaneTemplate.description}{" "}
                {activeLaneTemplate.strict ? "(strict constraints)" : "(guided defaults)"}.
              </p>
            ) : (
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                Custom lane: constraints depend on node policy; validate fields manually.
              </p>
            )}
            {serviceLaneTemplateId !== "custom" ? (
              <div style={{ marginBottom: "0.65rem" }}>
                <button
                  type="button"
                  onClick={() => applyServiceLaneTemplate(serviceLaneTemplateId)}
                  style={buttonStyle}
                >
                  {isTransaction ? "Reset template defaults" : "Reapply Template Constraints"}
                </button>
              </div>
            ) : null}
            <label style={{ display: "block", marginBottom: "0.5rem" }}>
              {isTransaction ? "Service category" : "serviceType"}
              <input
                value={serviceType}
                onChange={event => setServiceType(event.target.value)}
                style={fieldStyle}
                placeholder="software-fixes"
              />
            </label>
            <label style={{ display: "block", marginBottom: "0.5rem" }}>
              {isTransaction ? "What is being sold" : "unitDefinition"}
              <input
                value={unitDefinition}
                onChange={event => setUnitDefinition(event.target.value)}
                style={fieldStyle}
                placeholder="fix per issue"
              />
            </label>
            <label style={{ display: "block", marginBottom: "0.5rem" }}>
              {isTransaction ? "Price per unit" : "pricePerUnitCredits"}
              <input
                value={pricePerUnitCredits}
                onChange={event => setPricePerUnitCredits(event.target.value)}
                style={fieldStyle}
                placeholder="100"
              />
            </label>
            <label style={{ display: "block", marginBottom: "0.5rem" }}>
              {isTransaction ? "Compensation mode" : "compensationMode"}
              <Select
                value={compensationMode}
                onValueChange={value => {
                  if (!value) return;
                  setCompensationMode(value as CompensationMode);
                }}
              >
                <SelectTrigger className="mt-1.5 w-full min-w-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent align="start">
                  <SelectItem value="credits">Credits only</SelectItem>
                  <SelectItem value="barter">Barter only</SelectItem>
                  <SelectItem value="mixed">Mixed (credits + barter)</SelectItem>
                </SelectContent>
              </Select>
            </label>
            {compensationMode !== "credits" ? (
              <>
                <label style={{ display: "block", marginBottom: "0.5rem" }}>
                  {isTransaction ? "Barter terms" : "barterTerms"}
                  <input
                    value={barterTerms}
                    onChange={event => setBarterTerms(event.target.value)}
                    style={fieldStyle}
                    placeholder="Example: one design revision plus two hours of QA support"
                  />
                </label>
                <label style={{ display: "block", marginBottom: "0.5rem" }}>
                  {isTransaction ? "Barter tags (optional, comma-separated)" : "barterTags (optional, comma-separated)"}
                  <input
                    value={barterTags}
                    onChange={event => setBarterTags(event.target.value)}
                    style={fieldStyle}
                    placeholder="design,qa-support,community-credits"
                  />
                </label>
              </>
            ) : null}
            <label style={{ display: "block", marginBottom: "0.5rem" }}>
              {isTransaction ? "Delivery style" : "deliveryMode"}
              <input
                value={deliveryMode}
                onChange={event => setDeliveryMode(event.target.value)}
                style={fieldStyle}
                placeholder="artifact"
              />
            </label>
            <label style={{ display: "block", marginBottom: "0.5rem" }}>
              {isTransaction ? "Offer expires at" : "offerExpiresAt"}
              <input
                value={offerExpiresAt}
                onChange={event => setOfferExpiresAt(event.target.value)}
                style={fieldStyle}
                placeholder="2026-12-01T00:00:00Z"
              />
            </label>
            <label style={{ display: "block", marginBottom: "0.5rem" }}>
              {isTransaction ? "Accepted proof formats (comma-separated)" : "allowedEvidenceFormats (comma-separated)"}
              <input
                value={allowedEvidenceFormats}
                onChange={event => setAllowedEvidenceFormats(event.target.value)}
                style={fieldStyle}
                placeholder="artifactHash,proofUrl"
              />
            </label>
            <label style={{ display: "block", marginBottom: "0.5rem" }}>
              {isTransaction ? "Terms hash (optional)" : "termsHash (optional)"}
              <input
                value={termsHash}
                onChange={event => setTermsHash(event.target.value)}
                style={fieldStyle}
                placeholder="optional terms hash"
              />
            </label>
            </div>
            {laneTemplateConstraintWarning ? (
              <pre style={legacyErrorPanelStyle}>
                {laneTemplateConstraintWarning}
              </pre>
            ) : null}
          </>
        ) : null}

        {mode === "order" ? (
          <>
            {isTransaction ? (
              <div className="mb-4 rounded-xl border border-border/70 bg-muted/25 px-4 py-3 text-sm leading-relaxed text-muted-foreground">
                Capture who is buying, who is providing, and what milestone will be funded first.
              </div>
            ) : null}
            {isTransaction ? (
              <div className="mb-4 rounded-xl border border-border/70 bg-muted/20 px-4 py-3">
                <p className="text-sm font-medium text-foreground">Terms lock preview</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Confirm compensation and terms before signing this order.
                </p>
                <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                  <div className="rounded-lg border border-border/70 bg-background/70 px-3 py-2">
                    <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Offer ID</p>
                    <p className="mt-1 font-mono text-foreground">
                      {orderOfferId.trim() || offerId.trim() || "Set offer ID first"}
                    </p>
                  </div>
                  <div className="rounded-lg border border-border/70 bg-background/70 px-3 py-2">
                    <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Compensation</p>
                    <p className="mt-1 text-foreground">{compensationModeLabel(compensationMode)}</p>
                  </div>
                  <div className="rounded-lg border border-border/70 bg-background/70 px-3 py-2 sm:col-span-2">
                    <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Terms hash</p>
                    <p className="mt-1 font-mono text-foreground">{termsHash.trim() || "Not set (optional)"}</p>
                  </div>
                  {compensationMode !== "credits" ? (
                    <div className="rounded-lg border border-border/70 bg-background/70 px-3 py-2 sm:col-span-2">
                      <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Barter terms</p>
                      <p className="mt-1 text-foreground">{barterTerms.trim() || "Required before submit"}</p>
                    </div>
                  ) : null}
                  {barterTagList.length > 0 ? (
                    <div className="rounded-lg border border-border/70 bg-background/70 px-3 py-2 sm:col-span-2">
                      <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Barter tags</p>
                      <p className="mt-1 text-foreground">{barterTagList.join(", ")}</p>
                    </div>
                  ) : null}
                  {milestoneRows.map((row, index) => (
                    <div
                      key={`${row.milestoneId}-${index}`}
                      className="rounded-lg border border-border/70 bg-background/70 px-3 py-2 sm:col-span-2"
                    >
                      <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
                        Milestone {index + 1}
                      </p>
                      <p className="mt-1 font-mono text-sm text-foreground">
                        {row.milestoneId} · {row.amountCredits} credits · {row.evidenceFormat}
                      </p>
                      {row.deliverable.trim() ? (
                        <p className="mt-1 text-sm text-foreground">{row.deliverable.trim()}</p>
                      ) : null}
                      {row.dueWindow.trim() ? (
                        <p className="mt-1 text-xs text-muted-foreground">Due: {row.dueWindow.trim()}</p>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            <div className={isTransaction ? "grid gap-4 lg:grid-cols-2" : undefined}>
            <label style={{ display: "block", marginBottom: "0.5rem" }}>
              {isTransaction ? "Order ID" : "orderId"}
              <input
                value={orderId}
                onChange={event => setOrderId(event.target.value)}
                style={fieldStyle}
                placeholder="mk-demo-order"
              />
            </label>
            <label style={{ display: "block", marginBottom: "0.5rem" }}>
              {isTransaction ? "Offer ID" : "offerId"}
              <input
                value={orderOfferId}
                onChange={event => setOrderOfferId(event.target.value)}
                style={fieldStyle}
                placeholder="mk-demo-offer"
              />
            </label>
            <label style={{ display: "block", marginBottom: "0.5rem" }}>
              {isTransaction ? "Provider public key" : "providerPubKey"}
              <input
                value={providerPubKey}
                onChange={event => setProviderPubKey(event.target.value)}
                style={fieldStyle}
                placeholder="provider identity pubkey"
              />
            </label>
            <label style={{ display: "block", marginBottom: "0.5rem" }}>
              {isTransaction ? "Buyer public key" : "buyerPubKey"}
              <input
                value={buyerPubKey}
                onChange={event => setBuyerPubKey(event.target.value)}
                style={fieldStyle}
                placeholder="buyer identity pubkey"
              />
            </label>
            <label style={{ display: "block", marginBottom: "0.5rem" }}>
              {isTransaction ? "Order expires at" : "orderExpiresAt"}
              <input
                value={orderExpiresAt}
                onChange={event => setOrderExpiresAt(event.target.value)}
                style={fieldStyle}
                placeholder="2026-12-15T00:00:00Z"
              />
            </label>
            </div>
            {isTransaction ? (
              <div className="mb-4">
                <MilestoneScheduleEditor
                  rows={milestoneRows}
                  guidedTerms
                  onChange={setMilestoneRows}
                  onHashTerms={() => void handleHashMilestoneTerms()}
                  termsHashMessage={milestoneTermsHashMessage}
                />
              </div>
            ) : null}
            {!isTransaction ? (
              <div className="mb-4">
                <MilestoneScheduleEditor
                  rows={milestoneRows}
                  guidedTerms={false}
                  onChange={setMilestoneRows}
                />
              </div>
            ) : null}
            <details className={isTransaction ? "mb-2 rounded-xl border border-border bg-muted/20 px-4 py-3" : undefined}>
              <summary className={isTransaction ? "cursor-pointer text-sm font-medium text-foreground" : undefined}>
                {isTransaction ? "Reference details" : "references.offer eventId (optional but recommended)"}
              </summary>
              <label style={{ display: "block", marginBottom: isTransaction ? 0 : "0.5rem", marginTop: isTransaction ? "0.75rem" : undefined }}>
                {isTransaction ? "Offer reference event ID" : "references.offer eventId (optional but recommended)"}
                <input
                  value={offerReferenceEventId}
                  onChange={event => setOfferReferenceEventId(event.target.value)}
                  style={fieldStyle}
                  placeholder="offer eventId for reference resolution"
                />
              </label>
            </details>
          </>
        ) : null}

        {mode === "escrowSpend" ? (
          <>
            {isTransaction ? (
              <div className="mb-4 rounded-xl border border-border/70 bg-muted/25 px-4 py-3 text-sm leading-relaxed text-muted-foreground">
                Fund the milestone so work can begin. Use the payer key that will spend the credits.
              </div>
            ) : null}
            <div className={isTransaction ? "grid gap-4 lg:grid-cols-2" : undefined}>
            <label style={{ display: "block", marginBottom: "0.5rem" }}>
              {isTransaction ? "Payer public key" : "spenderPubKey"}
              <input
                value={escrowSpenderPubKey}
                onChange={event => setEscrowSpenderPubKey(event.target.value)}
                style={fieldStyle}
                placeholder="buyer's public key"
              />
            </label>
            <label style={{ display: "block", marginBottom: "0.5rem" }}>
              {isTransaction ? "Order ID" : "orderId"}
              <input
                value={escrowOrderId}
                onChange={event => setEscrowOrderId(event.target.value)}
                style={fieldStyle}
                placeholder="mk-demo-order"
              />
            </label>
            <MilestoneIdField
              label={isTransaction ? "Milestone" : "milestoneId"}
              value={escrowMilestoneId}
              onChange={setEscrowMilestoneId}
              rows={milestoneRows}
              isTransaction={isTransaction}
            />
            <label style={{ display: "block", marginBottom: "0.5rem" }}>
              {isTransaction ? "Amount to fund" : "amount"}
              <input
                value={escrowAmount}
                onChange={event => setEscrowAmount(event.target.value)}
                style={fieldStyle}
                placeholder="100"
              />
            </label>
            <label style={{ display: "block", marginBottom: "0.5rem" }}>
              {isTransaction ? "Payment nonce" : "nonce"}
              <input
                value={escrowNonce}
                onChange={event => setEscrowNonce(event.target.value)}
                style={fieldStyle}
                placeholder="escrow-1"
              />
            </label>
            </div>
            <details className={isTransaction ? "mb-2 rounded-xl border border-border/70 bg-muted/25 px-4 py-3" : undefined}>
              <summary className={isTransaction ? "cursor-pointer text-sm font-medium text-foreground" : undefined}>
                {isTransaction ? "Reference details" : "references.order eventId (optional but recommended)"}
              </summary>
              <label style={{ display: "block", marginBottom: isTransaction ? 0 : "0.5rem", marginTop: isTransaction ? "0.75rem" : undefined }}>
                {isTransaction ? "Order reference event ID" : "references.order eventId (optional but recommended)"}
                <input
                  value={escrowOrderReferenceEventId}
                  onChange={event => setEscrowOrderReferenceEventId(event.target.value)}
                  style={fieldStyle}
                  placeholder="service order eventId"
                />
              </label>
            </details>
          </>
        ) : null}

        {mode === "delivery" ? (
          <>
            {isTransaction ? (
              <div className="mb-4 rounded-xl border border-border/70 bg-muted/25 px-4 py-3 text-sm leading-relaxed text-muted-foreground">
                Submit the proof that this milestone is complete. Add links, hashes, or notes that the buyer can verify.
              </div>
            ) : null}
            {isTransaction ? (
              <div className="mb-4 rounded-xl border border-border/70 bg-muted/20 px-4 py-3">
                <p className="text-sm font-medium text-foreground">Evidence summary</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Include at least one proof item before submitting delivery.
                </p>
                <div className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
                  <div className="rounded-lg border border-border/70 bg-background/70 px-3 py-2">
                    <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Hashes</p>
                    <p className="mt-1 text-foreground">{deliveryArtifactHashList.length}</p>
                  </div>
                  <div className="rounded-lg border border-border/70 bg-background/70 px-3 py-2">
                    <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">URLs</p>
                    <p className="mt-1 text-foreground">{deliveryUrlList.length}</p>
                  </div>
                  <div className="rounded-lg border border-border/70 bg-background/70 px-3 py-2">
                    <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Notes hash</p>
                    <p className="mt-1 text-foreground">{deliveryNotesHash.trim() ? "Added" : "None"}</p>
                  </div>
                </div>
              </div>
            ) : null}
            <div className={isTransaction ? "grid gap-4 lg:grid-cols-2" : undefined}>
            <label style={{ display: "block", marginBottom: "0.5rem" }}>
              {isTransaction ? "Order ID" : "orderId"}
              <input
                value={deliveryOrderId}
                onChange={event => setDeliveryOrderId(event.target.value)}
                style={fieldStyle}
                placeholder="mk-demo-order"
              />
            </label>
            <MilestoneIdField
              label={isTransaction ? "Milestone" : "milestoneId"}
              value={deliveryMilestoneId}
              onChange={setDeliveryMilestoneId}
              rows={milestoneRows}
              isTransaction={isTransaction}
            />
            <label style={{ display: "block", marginBottom: "0.5rem" }}>
              {isTransaction ? "Proof format" : "evidenceFormat"}
              <input
                value={deliveryEvidenceFormat}
                onChange={event => setDeliveryEvidenceFormat(event.target.value)}
                style={fieldStyle}
                placeholder="artifactHash"
              />
            </label>
            <label style={{ display: "block", marginBottom: "0.5rem" }}>
              {isTransaction ? "Delivered at" : "deliveredAt"}
              <input
                value={deliveredAt}
                onChange={event => setDeliveredAt(event.target.value)}
                style={fieldStyle}
                placeholder="2026-03-01T00:08:00Z"
              />
            </label>
            <label style={{ display: "block", marginBottom: "0.5rem" }}>
              {isTransaction ? "Proof hashes (optional)" : "artifactHashes (optional, comma-separated)"}
              <input
                value={deliveryArtifactHashes}
                onChange={event => setDeliveryArtifactHashes(event.target.value)}
                style={fieldStyle}
                placeholder="hash-1, hash-2"
              />
            </label>
            <label style={{ display: "block", marginBottom: "0.5rem" }}>
              {isTransaction ? "Proof URLs (optional)" : "urls (optional, comma-separated)"}
              <input
                value={deliveryUrls}
                onChange={event => setDeliveryUrls(event.target.value)}
                style={fieldStyle}
                placeholder="https://example.com/artifact"
              />
            </label>
            <label style={{ display: "block", marginBottom: "0.5rem" }}>
              {isTransaction ? "Notes hash (optional)" : "notesHash (optional)"}
              <input
                value={deliveryNotesHash}
                onChange={event => setDeliveryNotesHash(event.target.value)}
                style={fieldStyle}
                placeholder="optional notes hash"
              />
            </label>
            </div>
            <details className={isTransaction ? "mb-2 rounded-xl border border-border/70 bg-muted/25 px-4 py-3" : undefined}>
              <summary className={isTransaction ? "cursor-pointer text-sm font-medium text-foreground" : undefined}>
                {isTransaction ? "Reference details" : "references.order eventId (optional but recommended)"}
              </summary>
              <label style={{ display: "block", marginBottom: isTransaction ? 0 : "0.5rem", marginTop: isTransaction ? "0.75rem" : undefined }}>
                {isTransaction ? "Order reference event ID" : "references.order eventId (optional but recommended)"}
                <input
                  value={deliveryOrderReferenceEventId}
                  onChange={event => setDeliveryOrderReferenceEventId(event.target.value)}
                  style={fieldStyle}
                  placeholder="service order eventId"
                />
              </label>
            </details>
            {(serviceType.trim() === "compute-job" || deliveryEvidenceFormat.trim() === "job-receipt-v1") ? (
              <div style={legacySuccessPanelStyle}>
                <strong style={{ display: "block", marginBottom: "0.45rem", color: "var(--status-ok)" }}>
                  Compute Receipt Delivery Hints
                </strong>
                <p style={{ marginTop: 0, marginBottom: "0.45rem", opacity: 0.85 }}>
                  Paste the contents of <code>job-receipt-v1-delivery-hints.json</code> to autofill
                  the compute delivery evidence fields.
                </p>
                <textarea
                  value={deliveryHintsJson}
                  onChange={event => setDeliveryHintsJson(event.target.value)}
                  style={{
                    ...fieldStyle,
                    minHeight: "7rem",
                    resize: "vertical"
                  }}
                  placeholder={`{\n  "evidenceFormat": "job-receipt-v1",\n  "artifactHashes": ["<receipt-hash>", "<output-hash>"],\n  "notesHash": "<notes-sha256>",\n  "urls": ["https://example.com/job/output"]\n}`}
                />
                <div style={{ display: "flex", gap: "0.55rem", flexWrap: "wrap", marginTop: "0.65rem" }}>
                  <button type="button" style={buttonStyle} onClick={applyComputeDeliveryHints}>
                    Apply Delivery Hints
                  </button>
                </div>
                {deliveryHintsMessage ? (
                  <p style={{ marginTop: "0.45rem", marginBottom: 0, color: "var(--status-ok)" }}>
                    {deliveryHintsMessage}
                  </p>
                ) : null}
              </div>
            ) : null}
          </>
        ) : null}

        {mode === "accept" ? (
          <>
            {isTransaction ? (
              <div className="mb-4 rounded-xl border border-border/70 bg-muted/25 px-4 py-3 text-sm leading-relaxed text-muted-foreground">
                Confirm that the milestone was delivered successfully and release the payout.
              </div>
            ) : null}
            {isTransaction ? (
              <div className="mb-4 rounded-xl border border-dashed border-border/80 bg-muted/15 px-4 py-3 text-sm">
                <p className="font-medium text-foreground">Problem with delivery?</p>
                <p className="mt-1 text-muted-foreground">
                  If work does not meet the locked terms, use the guided dispute branch instead of accepting.
                </p>
                <Link
                  href={buildDisputeBuilderHref(
                    acceptOrderId.trim() || null,
                    "dispute",
                    acceptMilestoneId.trim() || null
                  )}
                  className="mt-2 inline-flex text-sm font-medium text-primary hover:underline"
                >
                  Open dispute resolution
                </Link>
              </div>
            ) : null}
            <div className={isTransaction ? "grid gap-4 lg:grid-cols-2" : undefined}>
            <label style={{ display: "block", marginBottom: "0.5rem" }}>
              {isTransaction ? "Order ID" : "orderId"}
              <input
                value={acceptOrderId}
                onChange={event => setAcceptOrderId(event.target.value)}
                style={fieldStyle}
                placeholder="mk-demo-order"
              />
            </label>
            <MilestoneIdField
              label={isTransaction ? "Milestone" : "milestoneId"}
              value={acceptMilestoneId}
              onChange={setAcceptMilestoneId}
              rows={milestoneRows}
              isTransaction={isTransaction}
            />
            <label style={{ display: "block", marginBottom: "0.5rem" }}>
              {isTransaction ? "Accepted at" : "acceptedAt"}
              <input
                value={acceptedAt}
                onChange={event => setAcceptedAt(event.target.value)}
                style={fieldStyle}
                placeholder="2026-03-01T00:09:00Z"
              />
            </label>
            </div>
            <details className={isTransaction ? "mb-2 rounded-xl border border-border/70 bg-muted/25 px-4 py-3" : undefined}>
              <summary className={isTransaction ? "cursor-pointer text-sm font-medium text-foreground" : undefined}>
                {isTransaction ? "Reference details" : "references.delivery eventId (optional but recommended)"}
              </summary>
              <label style={{ display: "block", marginBottom: isTransaction ? 0 : "0.5rem", marginTop: isTransaction ? "0.75rem" : undefined }}>
                {isTransaction ? "Delivery reference event ID" : "references.delivery eventId (optional but recommended)"}
                <input
                  value={acceptDeliveryReferenceEventId}
                  onChange={event => setAcceptDeliveryReferenceEventId(event.target.value)}
                  style={fieldStyle}
                  placeholder="service delivery eventId"
                />
              </label>
            </details>
          </>
        ) : null}

        {mode === "dispute" ? (
          <>
            {isTransaction ? (
              <div className="mb-4 rounded-xl border border-border/70 bg-muted/25 px-4 py-3 text-sm leading-relaxed text-muted-foreground">
                Open a dispute when delivered work does not match the locked terms. Pick a reason and
                reference the delivery event when you have it.
              </div>
            ) : null}
            <div className={isTransaction ? "grid gap-4 lg:grid-cols-2" : undefined}>
            <label style={{ display: "block", marginBottom: "0.5rem" }}>
              {isTransaction ? "Order ID" : "orderId"}
              <input
                value={disputeOrderId}
                onChange={event => setDisputeOrderId(event.target.value)}
                style={fieldStyle}
                placeholder="mk-demo-order"
              />
            </label>
            <MilestoneIdField
              label={isTransaction ? "Milestone" : "milestoneId"}
              value={disputeMilestoneId}
              onChange={setDisputeMilestoneId}
              rows={milestoneRows}
              isTransaction={isTransaction}
            />
            <label style={{ display: "block", marginBottom: "0.5rem" }}>
              {isTransaction ? "Dispute reason" : "reasonCode"}
              {isTransaction ? (
                <Select
                  value={disputeReasonCode}
                  onValueChange={value => {
                    if (!value) return;
                    setDisputeReasonCode(value);
                  }}
                >
                  <SelectTrigger className="mt-1.5 w-full min-w-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent align="start">
                    <SelectItem value="quality">Quality — work does not meet criteria</SelectItem>
                    <SelectItem value="scope">Scope — deliverable outside agreed terms</SelectItem>
                    <SelectItem value="timeout">Timeout — windows expired without resolution</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <input
                  value={disputeReasonCode}
                  onChange={event => setDisputeReasonCode(event.target.value)}
                  style={fieldStyle}
                  placeholder="quality"
                />
              )}
            </label>
            <label style={{ display: "block", marginBottom: "0.5rem" }}>
              {isTransaction ? "Notes hash (optional)" : "notesHash (optional)"}
              <input
                value={disputeNotesHash}
                onChange={event => setDisputeNotesHash(event.target.value)}
                style={fieldStyle}
                placeholder="optional dispute notes hash"
              />
            </label>
            {!isTransaction ? (
              <label style={{ display: "block", marginBottom: "0.5rem" }}>
                disputedAt
                <input
                  value={disputedAt}
                  onChange={event => setDisputedAt(event.target.value)}
                  style={fieldStyle}
                  placeholder="2026-03-01T00:09:30Z"
                />
              </label>
            ) : null}
            </div>
            <details className={isTransaction ? "mb-2 rounded-xl border border-border/70 bg-muted/25 px-4 py-3" : undefined}>
              <summary className={isTransaction ? "cursor-pointer text-sm font-medium text-foreground" : undefined}>
                {isTransaction ? "Reference details" : "references.delivery eventId (optional but recommended)"}
              </summary>
              {isTransaction ? (
                <label style={{ display: "block", marginBottom: "0.5rem", marginTop: "0.75rem" }}>
                  Disputed at (optional RFC3339)
                  <input
                    value={disputedAt}
                    onChange={event => setDisputedAt(event.target.value)}
                    style={fieldStyle}
                    placeholder="2026-03-01T00:09:30Z"
                  />
                </label>
              ) : null}
              <label style={{ display: "block", marginBottom: isTransaction ? 0 : "0.5rem", marginTop: isTransaction ? "0.75rem" : undefined }}>
                {isTransaction ? "Delivery reference event ID" : "references.delivery eventId (optional but recommended)"}
                <input
                  value={disputeDeliveryReferenceEventId}
                  onChange={event => setDisputeDeliveryReferenceEventId(event.target.value)}
                  style={fieldStyle}
                  placeholder="service delivery eventId"
                />
              </label>
            </details>
          </>
        ) : null}

        {mode === "settle" ? (
          <>
            {isTransaction ? (
              <div className="mb-4 rounded-xl border border-border/70 bg-muted/25 px-4 py-3 text-sm leading-relaxed text-muted-foreground">
                Propose how credits move after a dispute. Preview the split before you sign and submit.
              </div>
            ) : null}
            {isTransaction ? (
              <div className="mb-4 rounded-xl border border-border/70 bg-muted/20 px-4 py-3">
                <p className="text-sm font-medium text-foreground">Settlement preview</p>
                <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                  <div className="rounded-lg border border-border/70 bg-background/70 px-3 py-2">
                    <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Outcome</p>
                    <p className="mt-1 text-foreground">
                      {settleOutcome === "buyerWins" ? "Buyer wins" : "Split"}
                    </p>
                  </div>
                  <div className="rounded-lg border border-border/70 bg-background/70 px-3 py-2">
                    <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Buyer refund</p>
                    <p className="mt-1 font-mono text-foreground">{buyerRefundCredits || "0"} credits</p>
                  </div>
                  <div className="rounded-lg border border-border/70 bg-background/70 px-3 py-2 sm:col-span-2">
                    <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Provider reward</p>
                    <p className="mt-1 font-mono text-foreground">{providerRewardCredits || "0"} credits</p>
                  </div>
                </div>
              </div>
            ) : null}
            <div className={isTransaction ? "grid gap-4 lg:grid-cols-2" : undefined}>
            <label style={{ display: "block", marginBottom: "0.5rem" }}>
              {isTransaction ? "Order ID" : "orderId"}
              <input
                value={settleOrderId}
                onChange={event => setSettleOrderId(event.target.value)}
                style={fieldStyle}
                placeholder="mk-demo-order"
              />
            </label>
            <MilestoneIdField
              label={isTransaction ? "Milestone" : "milestoneId"}
              value={settleMilestoneId}
              onChange={setSettleMilestoneId}
              rows={milestoneRows}
              isTransaction={isTransaction}
            />
            <label style={{ display: "block", marginBottom: "0.5rem" }}>
              {isTransaction ? "Settlement outcome" : "outcome"}
              <Select
                value={settleOutcome}
                onValueChange={value => {
                  if (!value) return;
                  setSettleOutcome(value as "buyerWins" | "split");
                }}
              >
                <SelectTrigger className="mt-1.5 w-full min-w-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent align="start">
                  <SelectItem value="split">Split — divide refund and reward</SelectItem>
                  <SelectItem value="buyerWins">Buyer wins — full refund to buyer</SelectItem>
                </SelectContent>
              </Select>
            </label>
            <label style={{ display: "block", marginBottom: "0.5rem" }}>
              {isTransaction ? "Buyer refund credits" : "buyerRefundCredits"}
              <input
                value={buyerRefundCredits}
                onChange={event => setBuyerRefundCredits(event.target.value)}
                style={fieldStyle}
                placeholder="100"
              />
            </label>
            <label style={{ display: "block", marginBottom: "0.5rem" }}>
              {isTransaction ? "Provider reward credits" : "providerRewardCredits"}
              <input
                value={providerRewardCredits}
                onChange={event => setProviderRewardCredits(event.target.value)}
                style={fieldStyle}
                placeholder="0"
              />
            </label>
            {!isTransaction ? (
              <label style={{ display: "block", marginBottom: "0.5rem" }}>
                settledAt
                <input
                  value={settledAt}
                  onChange={event => setSettledAt(event.target.value)}
                  style={fieldStyle}
                  placeholder="2026-03-01T00:10:00Z"
                />
              </label>
            ) : null}
            </div>
            <details className={isTransaction ? "mb-2 rounded-xl border border-border/70 bg-muted/25 px-4 py-3" : undefined}>
              <summary className={isTransaction ? "cursor-pointer text-sm font-medium text-foreground" : undefined}>
                {isTransaction ? "Reference details" : "references.dispute eventId (optional but recommended)"}
              </summary>
              {isTransaction ? (
                <label style={{ display: "block", marginBottom: "0.5rem", marginTop: "0.75rem" }}>
                  Settled at (optional RFC3339)
                  <input
                    value={settledAt}
                    onChange={event => setSettledAt(event.target.value)}
                    style={fieldStyle}
                    placeholder="2026-03-01T00:10:00Z"
                  />
                </label>
              ) : null}
              <label style={{ display: "block", marginBottom: isTransaction ? 0 : "0.5rem", marginTop: isTransaction ? "0.75rem" : undefined }}>
                {isTransaction ? "Dispute reference event ID" : "references.dispute eventId (optional but recommended)"}
                <input
                  value={settleDisputeReferenceEventId}
                  onChange={event => setSettleDisputeReferenceEventId(event.target.value)}
                  style={fieldStyle}
                  placeholder="service dispute eventId"
                />
              </label>
            </details>
          </>
        ) : null}

        {isTransaction ? (
          <div className="mb-4 rounded-xl border border-border/70 bg-muted/20 px-4 py-3">
            <p className="text-sm font-medium text-foreground">Submission status</p>
            {transactionSubmitState === "draft" ? (
              <p className="mt-1 text-sm text-muted-foreground">
                Draft ready. Review this step and submit when you are ready.
              </p>
            ) : null}
            {transactionSubmitState === "submitting" ? (
              <p className="mt-1 text-sm text-primary">
                Signing envelope and submitting to node…
              </p>
            ) : null}
            {transactionSubmitState === "accepted" ? (
              <p className="mt-1 text-sm text-[var(--status-ok)]">
                Accepted by node. You can continue to the next step.
              </p>
            ) : null}
            {transactionSubmitState === "failed" ? (
              <p className="mt-1 text-sm text-destructive">
                Last submit failed. Your draft is preserved — fix the issue below and retry.
              </p>
            ) : null}
          </div>
        ) : null}

        <button type="submit" disabled={isSubmitting} style={buttonStyle}>
          {isSubmitting
            ? `Signing + submitting ${isTransaction ? transactionModeLabel(mode) : modeLabel(mode)}...`
            : isTransaction
              ? transactionSubmitState === "failed"
                ? `Retry ${transactionModeLabel(mode)}`
                : `Sign and submit ${transactionModeLabel(mode)}`
              : `Sign + Submit ${modeLabel(mode)}`}
        </button>
      </form>

      {isTransaction ? (
        ingestResult?.accepted ? (
          <section style={legacySuccessPanelStyle}>
            <h3 style={{ marginTop: 0, marginBottom: "0.45rem", color: "var(--status-ok)" }}>
              Step completed
            </h3>
            <p style={{ marginTop: 0, marginBottom: "0.35rem", opacity: 0.9 }}>
              {transactionModeLabel(mode)} was recorded by your node. Continue to the next step when you are ready.
            </p>
            {signedEvent ? (
              <p style={{ marginTop: 0, marginBottom: 0, opacity: 0.82, fontSize: "0.92rem" }}>
                Event id: <code>{signedEvent.eventId}</code>
              </p>
            ) : null}
          </section>
        ) : null
      ) : (
        <>
          {signedEvent ? <pre style={panelStyle}>{JSON.stringify(signedEvent, null, 2)}</pre> : null}
          {ingestResult ? <pre style={panelStyle}>{JSON.stringify(ingestResult, null, 2)}</pre> : null}
        </>
      )}
      {submitError ? (
        <section style={legacyErrorPanelStyle}>
          <h3 style={{ marginTop: 0, marginBottom: "0.5rem" }}>
            {isTransaction ? "Submit failed" : "Submit Error"}
          </h3>
          {isTransaction ? (
            <p style={{ marginTop: 0, marginBottom: "0.55rem", opacity: 0.9 }}>
              Nothing was accepted by the node. Adjust the fields and submit again — your draft stays in place.
            </p>
          ) : null}
          <p style={{ marginTop: 0, marginBottom: "0.35rem" }}>
            <strong>Status:</strong> {submitError.status ?? "n/a"}
          </p>
          <p style={{ marginTop: 0, marginBottom: "0.35rem" }}>
            <strong>Code:</strong> {submitError.code ?? "n/a"}
          </p>
          <p style={{ marginTop: 0, marginBottom: "0.55rem" }}>
            <strong>Message:</strong> {submitError.message}
          </p>
          <div style={{ display: "flex", gap: "0.55rem", flexWrap: "wrap" }}>
            {isTransaction ? (
              <button type="button" style={buttonStyle} onClick={() => setSubmitError(null)}>
                Dismiss error
              </button>
            ) : null}
            <button
              type="button"
              style={buttonStyle}
              onClick={() => setShowSubmitErrorPayload(previous => !previous)}
            >
              {showSubmitErrorPayload ? "Hide Raw Error Payload" : "Show Raw Error Payload"}
            </button>
          </div>
          {showSubmitErrorPayload ? (
            <pre style={{ ...panelStyle, marginTop: "0.6rem" }}>
              {JSON.stringify(submitError.payload, null, 2)}
            </pre>
          ) : null}
        </section>
      ) : null}
      {quickLinks.length > 0 ? (
        <section style={panelStyle}>
          <h3 style={{ marginTop: 0, marginBottom: "0.5rem" }}>
            {isTransaction ? "What to do next" : "Inspect Submitted State"}
          </h3>
          <p style={{ marginTop: 0, opacity: 0.85 }}>
            {isTransaction
              ? "Your step is accepted. Verify the state below or continue in Transactions when live order progress matters more than raw event details."
              : "Event accepted. Jump into explorer views using the same node context."}
          </p>
          <ul style={{ marginBottom: 0 }}>
            {quickLinks.map(link => (
              <li key={link.href}>
                <Link href={link.href} style={{ color: "var(--primary)" }}>
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {!isTransaction ? (
      <section style={panelStyle}>
        <h3 style={{ marginTop: 0, marginBottom: "0.5rem" }}>Event Chain Checklist (Session)</h3>
        <p style={{ marginTop: 0, opacity: 0.85 }}>
          Tracks kernel-accepted marketplace events in this browser session for quick progress checks.
        </p>
        <KernelTruthNotice variant="session" />
        <div style={{ display: "flex", gap: "0.55rem", flexWrap: "wrap", marginBottom: "0.65rem" }}>
          <button
            type="button"
            style={sessionAcceptedEvents.length > 0 ? buttonStyle : disabledButtonStyle}
            onClick={copyChecklist}
            disabled={sessionAcceptedEvents.length === 0}
          >
            Copy Checklist
          </button>
          <button
            type="button"
            style={sessionAcceptedEvents.length > 0 ? buttonStyle : disabledButtonStyle}
            onClick={clearChecklist}
            disabled={sessionAcceptedEvents.length === 0}
          >
            Clear Session Checklist
          </button>
        </div>
        {checklistMessage ? <p style={{ marginTop: 0, color: "var(--status-ok)" }}>{checklistMessage}</p> : null}
        <p style={{ marginTop: 0, marginBottom: "0.4rem", opacity: 0.85 }}>
          Accept Path ({acceptChecklist.filter(step => step.completed).length}/{acceptChecklist.length})
        </p>
        <ul style={{ marginTop: 0 }}>
          {acceptChecklist.map(step => (
            <li key={`accept-${step.mode}`}>
              {step.completed ? "✅" : "⬜"} {step.label}
              {step.eventId ? <code style={{ marginLeft: "0.4rem" }}>{step.eventId}</code> : null}
            </li>
          ))}
        </ul>
        <p style={{ marginTop: 0, marginBottom: "0.4rem", opacity: 0.85 }}>
          Dispute Path ({disputeChecklist.filter(step => step.completed).length}/{disputeChecklist.length})
        </p>
        <ul style={{ marginTop: 0, marginBottom: 0 }}>
          {disputeChecklist.map(step => (
            <li key={`dispute-${step.mode}`}>
              {step.completed ? "✅" : "⬜"} {step.label}
              {step.eventId ? <code style={{ marginLeft: "0.4rem" }}>{step.eventId}</code> : null}
            </li>
          ))}
        </ul>
      </section>
      ) : null}
      {errorMessage ? (
        <pre style={legacyErrorPanelStyle}>
          {errorMessage}
        </pre>
      ) : null}
    </section>
  );
}

function buildOfferUnsigned(input: {
  authorPubKey: string;
  policyVersion?: string;
  createdAt?: string;
  offerId: string;
  serviceType: string;
  unitDefinition: string;
  pricePerUnitCredits: string;
  compensationMode: CompensationMode;
  barterTerms: string;
  barterTags: string;
  deliveryMode: string;
  offerExpiresAt: string;
  allowedEvidenceFormats: string;
  termsHash: string;
}) {
  const price = parsePositiveInteger(input.pricePerUnitCredits, "pricePerUnitCredits");
  const evidenceFormats = parseCommaList(input.allowedEvidenceFormats);
  if (evidenceFormats.length === 0) {
    throw new Error("allowedEvidenceFormats requires at least one value.");
  }
  if (input.compensationMode !== "credits" && input.barterTerms.trim().length === 0) {
    throw new Error("barterTerms is required when compensationMode is barter or mixed.");
  }
  const barterTags = parseCommaList(input.barterTags);

  const payload: Record<string, unknown> = {
    offerId: requireNonEmpty(input.offerId, "offerId"),
    serviceType: requireNonEmpty(input.serviceType, "serviceType"),
    unitDefinition: requireNonEmpty(input.unitDefinition, "unitDefinition"),
    pricePerUnitCredits: price,
    compensationMode: requireCompensationMode(input.compensationMode),
    deliveryMode: requireNonEmpty(input.deliveryMode, "deliveryMode"),
    offerExpiresAt: requireNonEmpty(input.offerExpiresAt, "offerExpiresAt"),
    allowedEvidenceFormats: evidenceFormats
  };
  if (input.barterTerms.trim()) {
    payload.barterTerms = input.barterTerms.trim();
  }
  if (barterTags.length > 0) {
    payload.barterTags = barterTags;
  }
  if (input.termsHash.trim()) {
    payload.termsHash = input.termsHash.trim();
  }

  return createUnsignedEnvelope({
    authorPubKey: input.authorPubKey,
    kind: "ServiceOffer",
    payload,
    policyVersion: input.policyVersion,
    createdAt: input.createdAt
  });
}

function buildOrderUnsigned(input: {
  authorPubKey: string;
  policyVersion?: string;
  createdAt?: string;
  orderId: string;
  offerId: string;
  providerPubKey: string;
  buyerPubKey: string;
  orderExpiresAt: string;
  milestoneRows: OrderMilestoneDraft[];
  offerReferenceEventId: string;
}) {
  const milestones = buildMilestonePayloadRows(input.milestoneRows).map((row) => ({
    milestoneId: requireNonEmpty(row.milestoneId, "milestoneId"),
    amountCredits: parsePositiveInteger(String(row.amountCredits), "milestone amountCredits"),
    evidenceFormat: requireNonEmpty(row.evidenceFormat, "milestone evidenceFormat")
  }));

  if (milestones.length === 0) {
    throw new Error("At least one milestone is required.");
  }

  const payload: Record<string, unknown> = {
    orderId: requireNonEmpty(input.orderId, "orderId"),
    offerId: requireNonEmpty(input.offerId, "offerId"),
    providerPubKey: requireNonEmpty(input.providerPubKey, "providerPubKey"),
    buyerPubKey: requireNonEmpty(input.buyerPubKey, "buyerPubKey"),
    milestones,
    orderExpiresAt: requireNonEmpty(input.orderExpiresAt, "orderExpiresAt")
  };

  const references =
    input.offerReferenceEventId.trim().length > 0
      ? { offer: input.offerReferenceEventId.trim() }
      : undefined;

  return createUnsignedEnvelope({
    authorPubKey: input.authorPubKey,
    kind: "ServiceOrder",
    payload,
    policyVersion: input.policyVersion,
    createdAt: input.createdAt,
    references
  });
}

function buildDeliveryUnsigned(input: {
  authorPubKey: string;
  policyVersion?: string;
  createdAt?: string;
  orderId: string;
  milestoneId: string;
  evidenceFormat: string;
  artifactHashes: string;
  urls: string;
  notesHash: string;
  deliveredAt: string;
  orderReferenceEventId: string;
}) {
  const payload: Record<string, unknown> = {
    orderId: requireNonEmpty(input.orderId, "orderId"),
    milestoneId: requireNonEmpty(input.milestoneId, "milestoneId"),
    evidenceFormat: requireNonEmpty(input.evidenceFormat, "evidenceFormat"),
    deliveredAt: requireNonEmpty(input.deliveredAt, "deliveredAt")
  };

  const artifactHashes = parseCommaList(input.artifactHashes);
  if (artifactHashes.length > 0) {
    payload.artifactHashes = artifactHashes;
  }
  const urls = parseCommaList(input.urls);
  if (urls.length > 0) {
    payload.urls = urls;
  }
  if (input.notesHash.trim()) {
    payload.notesHash = input.notesHash.trim();
  }

  const references =
    input.orderReferenceEventId.trim().length > 0
      ? { order: input.orderReferenceEventId.trim() }
      : undefined;

  return createUnsignedEnvelope({
    authorPubKey: input.authorPubKey,
    kind: "ServiceDelivery",
    payload,
    policyVersion: input.policyVersion,
    createdAt: input.createdAt,
    references
  });
}

function buildAcceptUnsigned(input: {
  authorPubKey: string;
  policyVersion?: string;
  createdAt?: string;
  orderId: string;
  milestoneId: string;
  acceptedAt: string;
  deliveryReferenceEventId: string;
}) {
  const payload: Record<string, unknown> = {
    orderId: requireNonEmpty(input.orderId, "orderId"),
    milestoneId: requireNonEmpty(input.milestoneId, "milestoneId"),
    acceptedAt: requireNonEmpty(input.acceptedAt, "acceptedAt")
  };

  const references =
    input.deliveryReferenceEventId.trim().length > 0
      ? { delivery: input.deliveryReferenceEventId.trim() }
      : undefined;

  return createUnsignedEnvelope({
    authorPubKey: input.authorPubKey,
    kind: "ServiceAccept",
    payload,
    policyVersion: input.policyVersion,
    createdAt: input.createdAt,
    references
  });
}

function buildDisputeUnsigned(input: {
  authorPubKey: string;
  policyVersion?: string;
  createdAt?: string;
  orderId: string;
  milestoneId: string;
  reasonCode: string;
  notesHash: string;
  disputedAt: string;
  deliveryReferenceEventId: string;
}) {
  const payload: Record<string, unknown> = {
    orderId: requireNonEmpty(input.orderId, "orderId"),
    milestoneId: requireNonEmpty(input.milestoneId, "milestoneId"),
    reasonCode: requireNonEmpty(input.reasonCode, "reasonCode"),
    disputedAt: requireNonEmpty(input.disputedAt, "disputedAt")
  };
  if (input.notesHash.trim()) {
    payload.notesHash = input.notesHash.trim();
  }

  const references =
    input.deliveryReferenceEventId.trim().length > 0
      ? { delivery: input.deliveryReferenceEventId.trim() }
      : undefined;

  return createUnsignedEnvelope({
    authorPubKey: input.authorPubKey,
    kind: "ServiceDispute",
    payload,
    policyVersion: input.policyVersion,
    createdAt: input.createdAt,
    references
  });
}

function buildSettleUnsigned(input: {
  authorPubKey: string;
  policyVersion?: string;
  createdAt?: string;
  orderId: string;
  milestoneId: string;
  outcome: "buyerWins" | "split";
  buyerRefundCredits: string;
  providerRewardCredits: string;
  settledAt: string;
  disputeReferenceEventId: string;
}) {
  const outcome = input.outcome === "buyerWins" ? "buyerWins" : "split";
  const buyerRefund = parseNonNegativeInteger(input.buyerRefundCredits, "buyerRefundCredits");
  const providerReward = parseNonNegativeInteger(
    input.providerRewardCredits,
    "providerRewardCredits"
  );

  const payload: Record<string, unknown> = {
    orderId: requireNonEmpty(input.orderId, "orderId"),
    milestoneId: requireNonEmpty(input.milestoneId, "milestoneId"),
    outcome,
    buyerRefundCredits: buyerRefund,
    providerRewardCredits: providerReward,
    settledAt: requireNonEmpty(input.settledAt, "settledAt")
  };

  const references =
    input.disputeReferenceEventId.trim().length > 0
      ? { dispute: input.disputeReferenceEventId.trim() }
      : undefined;

  return createUnsignedEnvelope({
    authorPubKey: input.authorPubKey,
    kind: "ServiceSettle",
    payload,
    policyVersion: input.policyVersion,
    createdAt: input.createdAt,
    references
  });
}

function buildEscrowSpendUnsigned(input: {
  authorPubKey: string;
  policyVersion?: string;
  createdAt?: string;
  spenderPubKey: string;
  orderId: string;
  milestoneId: string;
  amount: string;
  nonce: string;
  orderReferenceEventId: string;
}) {
  const amount = parsePositiveInteger(input.amount, "amount");
  const payload: Record<string, unknown> = {
    spenderPubKey: requireNonEmpty(input.spenderPubKey, "spenderPubKey"),
    sinkKind: "ServiceEscrowSink",
    amount,
    orderId: requireNonEmpty(input.orderId, "orderId"),
    milestoneId: requireNonEmpty(input.milestoneId, "milestoneId")
  };

  const references =
    input.orderReferenceEventId.trim().length > 0
      ? { order: input.orderReferenceEventId.trim() }
      : undefined;

  return createUnsignedEnvelope({
    authorPubKey: input.authorPubKey,
    kind: "SpendCredits",
    payload,
    policyVersion: input.policyVersion,
    createdAt: input.createdAt,
    references,
    nonce: requireNonEmpty(input.nonce, "nonce")
  });
}

function buildExplorerQuickLinks(input: {
  mode: BuilderMode;
  baseUrl: string;
  asOf?: string;
  offerId: string;
  orderId: string;
  milestoneId: string;
  escrowOrderId: string;
  escrowMilestoneId: string;
  deliveryOrderId: string;
  deliveryMilestoneId: string;
  acceptOrderId: string;
  acceptMilestoneId: string;
  disputeOrderId: string;
  disputeMilestoneId: string;
  settleOrderId: string;
  settleMilestoneId: string;
}): ExplorerQuickLink[] {
  const links: ExplorerQuickLink[] = [];
  const baseQuery: Record<string, string | undefined> = {
    base_url: input.baseUrl,
    as_of: input.asOf
  };

  if (input.mode === "offer") {
    const id = input.offerId.trim();
    if (id) {
      links.push({
        label: `Open Offer (${id})`,
        href: buildExplorerHref("/explorer/offers", { ...baseQuery, id })
      });
    }
    return links;
  }

  if (input.mode === "order") {
    const offerId = input.offerId.trim();
    if (offerId) {
      links.push({
        label: `Open Offer (${offerId})`,
        href: buildExplorerHref("/explorer/offers", { ...baseQuery, id: offerId })
      });
    }
  }

  const { orderId, milestoneId } = orderMilestoneFromMode(input);
  if (orderId) {
    links.push({
      label: `Open Order (${orderId})`,
      href: buildExplorerHref("/explorer/orders", { ...baseQuery, id: orderId })
    });
  }
  if (orderId && milestoneId) {
    links.push({
      label: `Open Milestone (${orderId}/${milestoneId})`,
      href: buildExplorerHref("/explorer/milestones", {
        ...baseQuery,
        order_id: orderId,
        milestone_id: milestoneId
      })
    });
  }
  links.push({
    label: "Open Explorer Index",
    href: buildExplorerHref("/explorer", baseQuery)
  });
  return uniqueLinks(links);
}

function orderMilestoneFromMode(input: {
  mode: BuilderMode;
  orderId: string;
  milestoneId: string;
  escrowOrderId: string;
  escrowMilestoneId: string;
  deliveryOrderId: string;
  deliveryMilestoneId: string;
  acceptOrderId: string;
  acceptMilestoneId: string;
  disputeOrderId: string;
  disputeMilestoneId: string;
  settleOrderId: string;
  settleMilestoneId: string;
}): { orderId?: string; milestoneId?: string } {
  if (input.mode === "order") {
    return {
      orderId: input.orderId.trim() || undefined,
      milestoneId: input.milestoneId.trim() || undefined
    };
  }
  if (input.mode === "escrowSpend") {
    return {
      orderId: input.escrowOrderId.trim() || undefined,
      milestoneId: input.escrowMilestoneId.trim() || undefined
    };
  }
  if (input.mode === "delivery") {
    return {
      orderId: input.deliveryOrderId.trim() || undefined,
      milestoneId: input.deliveryMilestoneId.trim() || undefined
    };
  }
  if (input.mode === "accept") {
    return {
      orderId: input.acceptOrderId.trim() || undefined,
      milestoneId: input.acceptMilestoneId.trim() || undefined
    };
  }
  if (input.mode === "dispute") {
    return {
      orderId: input.disputeOrderId.trim() || undefined,
      milestoneId: input.disputeMilestoneId.trim() || undefined
    };
  }
  if (input.mode === "settle") {
    return {
      orderId: input.settleOrderId.trim() || undefined,
      milestoneId: input.settleMilestoneId.trim() || undefined
    };
  }
  return {};
}

function buildExplorerHref(path: string, query: Record<string, string | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    const normalized = value?.trim();
    if (normalized) {
      params.set(key, normalized);
    }
  }
  const queryString = params.toString();
  return queryString ? `${path}?${queryString}` : path;
}

function uniqueLinks(links: ExplorerQuickLink[]): ExplorerQuickLink[] {
  const seen = new Set<string>();
  const unique: ExplorerQuickLink[] = [];
  for (const link of links) {
    if (seen.has(link.href)) {
      continue;
    }
    seen.add(link.href);
    unique.push(link);
  }
  return unique;
}

function friendlyRequirementLabel(label: string): string {
  if (label === "authorPubKey") {
    return "Public signing key";
  }
  if (label === "authorSecretKey") {
    return "Secret signing key";
  }
  if (label === "serviceType") {
    return "Service category";
  }
  if (label === "unitDefinition") {
    return "What is being sold";
  }
  if (label === "pricePerUnitCredits") {
    return "Price per unit";
  }
  if (label === "compensationMode") {
    return "Compensation mode";
  }
  if (label === "barterTerms") {
    return "Barter terms";
  }
  if (label === "deliveryMode") {
    return "Delivery style";
  }
  if (label === "offerExpiresAt") {
    return "Offer expiration";
  }
  if (label === "offerId" || label === "orderId" || label === "milestoneId") {
    return label.replace(/([A-Z])/g, " $1");
  }
  if (label === "buyerPubKey") {
    return "Buyer public key";
  }
  if (label === "providerPubKey") {
    return "Provider public key";
  }
  if (label === "milestoneAmountCredits") {
    return "Milestone amount";
  }
  if (label === "milestoneEvidenceFormat" || label === "deliveryEvidenceFormat") {
    return "Proof format";
  }
  if (label === "milestoneDeliverable") {
    return "Deliverable";
  }
  if (label === "milestoneDueWindow") {
    return "Due window";
  }
  if (label === "milestoneAcceptanceCriteria") {
    return "Acceptance criteria";
  }
  if (label === "escrowAmount") {
    return "Funding amount";
  }
  if (label === "deliveryOrderId" || label === "acceptOrderId") {
    return "Order ID";
  }
  return label.replace(/([A-Z])/g, " $1");
}

function modePurpose(mode: BuilderMode): string {
  if (mode === "offer") {
    return "Publish the service lane and delivery/evidence terms.";
  }
  if (mode === "order") {
    return "Bind buyer/provider to an offer with milestone specs.";
  }
  if (mode === "escrowSpend") {
    return "Fund a milestone into escrow using buyer credits.";
  }
  if (mode === "delivery") {
    return "Submit milestone delivery evidence from the provider.";
  }
  if (mode === "accept") {
    return "Accept delivered work and close milestone payout.";
  }
  if (mode === "dispute") {
    return "Open a dispute on delivered work within allowed window.";
  }
  return "Finalize dispute outcome via deterministic settlement proposal.";
}

function isModeCompleted(checklist: ChecklistStep[], mode: BuilderMode): boolean {
  const step = checklist.find(item => item.mode === mode);
  return step?.completed ?? false;
}

function expectedAutofillKindsForMode(mode: BuilderMode): SignedEnvelope["kind"][] {
  if (mode === "order") {
    return ["ServiceOffer"];
  }
  if (mode === "escrowSpend") {
    return ["ServiceOrder"];
  }
  if (mode === "delivery") {
    return ["SpendCredits", "ServiceOrder"];
  }
  if (mode === "accept" || mode === "dispute") {
    return ["ServiceDelivery"];
  }
  if (mode === "settle") {
    return ["ServiceDispute"];
  }
  return [];
}

function findLatestAcceptedEvent(
  sessionAcceptedEvents: SessionAcceptedEvent[],
  allowedKinds: SignedEnvelope["kind"][]
): SessionAcceptedEvent | null {
  for (let index = sessionAcceptedEvents.length - 1; index >= 0; index -= 1) {
    const event = sessionAcceptedEvents[index];
    if (allowedKinds.includes(event.kind)) {
      return event;
    }
  }
  return null;
}

function modeRequirements(
  mode: BuilderMode,
  fields: {
    offerId: string;
    serviceType: string;
    unitDefinition: string;
    pricePerUnitCredits: string;
    compensationMode: CompensationMode;
    barterTerms: string;
    barterTags: string;
    deliveryMode: string;
    offerExpiresAt: string;
    allowedEvidenceFormats: string;
    orderId: string;
    orderOfferId: string;
    providerPubKey: string;
    buyerPubKey: string;
    orderExpiresAt: string;
    milestoneRows: OrderMilestoneDraft[];
    guidedOrderTerms?: boolean;
    escrowSpenderPubKey: string;
    escrowOrderId: string;
    escrowMilestoneId: string;
    escrowAmount: string;
    escrowNonce: string;
    deliveryOrderId: string;
    deliveryMilestoneId: string;
    deliveryEvidenceFormat: string;
    deliveredAt: string;
    acceptOrderId: string;
    acceptMilestoneId: string;
    acceptedAt: string;
    disputeOrderId: string;
    disputeMilestoneId: string;
    disputeReasonCode: string;
    disputedAt: string;
    settleOrderId: string;
    settleMilestoneId: string;
    buyerRefundCredits: string;
    providerRewardCredits: string;
    settledAt: string;
  }
): FieldRequirement[] {
  const text = (label: string, value: string): FieldRequirement => ({
    label,
    ok: value.trim().length > 0
  });
  const positiveInt = (label: string, value: string): FieldRequirement => {
    const parsed = Number.parseInt(value.trim(), 10);
    return { label, ok: Number.isFinite(parsed) && parsed > 0 };
  };
  const nonNegativeInt = (label: string, value: string): FieldRequirement => {
    const parsed = Number.parseInt(value.trim(), 10);
    return { label, ok: Number.isFinite(parsed) && parsed >= 0 };
  };

  if (mode === "offer") {
    const requirements: FieldRequirement[] = [
      text("offerId", fields.offerId),
      text("serviceType", fields.serviceType),
      text("unitDefinition", fields.unitDefinition),
      positiveInt("pricePerUnitCredits", fields.pricePerUnitCredits),
      text("compensationMode", fields.compensationMode),
      text("deliveryMode", fields.deliveryMode),
      text("offerExpiresAt", fields.offerExpiresAt),
      text("allowedEvidenceFormats", fields.allowedEvidenceFormats)
    ];
    if (fields.compensationMode !== "credits") {
      requirements.push(text("barterTerms", fields.barterTerms));
    }
    return requirements;
  }
  if (mode === "order") {
    const requirements: FieldRequirement[] = [
      text("orderId", fields.orderId),
      text("offerId", fields.orderOfferId),
      text("providerPubKey", fields.providerPubKey),
      text("buyerPubKey", fields.buyerPubKey),
      text("orderExpiresAt", fields.orderExpiresAt),
      ...milestoneDraftRequirements(fields.milestoneRows, Boolean(fields.guidedOrderTerms)).map(
        (requirement) => ({
          label: requirement.label,
          ok: requirement.ok
        })
      )
    ];
    return requirements;
  }
  if (mode === "escrowSpend") {
    return [
      text("spenderPubKey", fields.escrowSpenderPubKey),
      text("orderId", fields.escrowOrderId),
      text("milestoneId", fields.escrowMilestoneId),
      positiveInt("amount", fields.escrowAmount),
      text("nonce", fields.escrowNonce)
    ];
  }
  if (mode === "delivery") {
    return [
      text("orderId", fields.deliveryOrderId),
      text("milestoneId", fields.deliveryMilestoneId),
      text("evidenceFormat", fields.deliveryEvidenceFormat),
      text("deliveredAt", fields.deliveredAt)
    ];
  }
  if (mode === "accept") {
    return [
      text("orderId", fields.acceptOrderId),
      text("milestoneId", fields.acceptMilestoneId),
      text("acceptedAt", fields.acceptedAt)
    ];
  }
  if (mode === "dispute") {
    return [
      text("orderId", fields.disputeOrderId),
      text("milestoneId", fields.disputeMilestoneId),
      text("reasonCode", fields.disputeReasonCode),
      text("disputedAt", fields.disputedAt)
    ];
  }
  return [
    text("orderId", fields.settleOrderId),
    text("milestoneId", fields.settleMilestoneId),
    nonNegativeInt("buyerRefundCredits", fields.buyerRefundCredits),
    nonNegativeInt("providerRewardCredits", fields.providerRewardCredits),
    text("settledAt", fields.settledAt)
  ];
}

function validateOptionalRfc3339(value: string | undefined): string | null {
  if (!value) {
    return null;
  }
  if (!RFC3339_REGEX.test(value)) {
    return "Invalid createdAt: expected RFC3339, e.g. 2026-03-01T00:00:00Z";
  }
  return null;
}

function extractNodeApiCode(payload: unknown): string | null {
  if (!isObjectRecord(payload)) {
    return null;
  }
  const code = payload.code;
  return typeof code === "string" && code.trim().length > 0 ? code : null;
}

function parsePersistedBuilderState(raw: string): PersistedBuilderState | null {
  try {
    const value = JSON.parse(raw) as unknown;
    if (!isObjectRecord(value)) {
      return null;
    }
    if (value.version !== BUILDER_STORAGE_VERSION) {
      return null;
    }
    if (!isFlowRoute(value.flowRoute) || !isBuilderMode(value.mode)) {
      return null;
    }

    const activePreset = isFixturePreset(value.activePreset) ? value.activePreset : null;
    const baseUrl =
      typeof value.baseUrl === "string" && value.baseUrl.trim().length > 0
        ? value.baseUrl
        : DEFAULT_NODE_API_BASE_URL;
    const createdAt = typeof value.createdAt === "string" ? value.createdAt : "";
    const sessionAcceptedEvents = Array.isArray(value.sessionAcceptedEvents)
      ? value.sessionAcceptedEvents.map(parseSessionAcceptedEvent).filter(isSessionAcceptedEvent)
      : [];

    return {
      version: BUILDER_STORAGE_VERSION,
      flowRoute: value.flowRoute,
      activePreset,
      mode: value.mode,
      baseUrl,
      createdAt,
      sessionAcceptedEvents
    };
  } catch {
    return null;
  }
}

function parseSessionAcceptedEvent(value: unknown): SessionAcceptedEvent | null {
  if (!isObjectRecord(value)) {
    return null;
  }
  if (
    typeof value.eventId !== "string" ||
    typeof value.kind !== "string" ||
    typeof value.authorPubKey !== "string" ||
    typeof value.createdAt !== "string" ||
    typeof value.recordedAt !== "string"
  ) {
    return null;
  }
  if (!isBuilderEventKind(value.kind)) {
    return null;
  }
  if (!isObjectRecord(value.payload)) {
    return null;
  }
  const references = isStringRecord(value.references) ? value.references : undefined;
  return {
    eventId: value.eventId,
    kind: value.kind,
    authorPubKey: value.authorPubKey,
    createdAt: value.createdAt,
    payload: value.payload,
    references,
    recordedAt: value.recordedAt
  };
}

function isSessionAcceptedEvent(value: SessionAcceptedEvent | null): value is SessionAcceptedEvent {
  return value !== null;
}

function isBuilderMode(value: unknown): value is BuilderMode {
  return (
    value === "offer" ||
    value === "order" ||
    value === "escrowSpend" ||
    value === "delivery" ||
    value === "accept" ||
    value === "dispute" ||
    value === "settle"
  );
}

function isFlowRoute(value: unknown): value is FlowRoute {
  return value === "acceptPath" || value === "disputePath";
}

function isBuilderStarter(value: unknown): value is BuilderStarter {
  return value === "alpha-accept" || value === "alpha-timeout" || value === "project-maintenance";
}

function isBuilderLaneStarter(value: unknown): value is BuilderLaneStarter {
  return (
    value === "software-fixes" ||
    value === "feature-work" ||
    value === "documentation" ||
    value === "translation" ||
    value === "testing" ||
    value === "research" ||
    value === "project-maintenance"
  );
}

function normalizeBuilderFlowQuery(value: string | null): FlowRoute {
  return value === "dispute" ? "disputePath" : "acceptPath";
}

function isFixturePreset(value: unknown): value is FixturePreset {
  return value === "acceptFlow" || value === "timeoutFlow";
}

function isBuilderEventKind(value: string): value is SignedEnvelope["kind"] {
  return BUILDER_EVENT_KINDS.includes(value as SignedEnvelope["kind"]);
}

function isStringRecord(value: unknown): value is Record<string, string> {
  if (!isObjectRecord(value)) {
    return false;
  }
  for (const entry of Object.values(value)) {
    if (typeof entry !== "string") {
      return false;
    }
  }
  return true;
}

function buildFlowChecklist(
  flow: FlowRoute,
  sessionAcceptedEvents: SessionAcceptedEvent[]
): ChecklistStep[] {
  const latestByKind = latestAcceptedByKind(sessionAcceptedEvents);
  return FLOW_STEPS[flow].map(stepMode => {
    const kind = modeEventKind(stepMode);
    const matched = latestByKind.get(kind);
    return {
      mode: stepMode,
      kind,
      label: checklistStepLabel(stepMode),
      completed: Boolean(matched),
      eventId: matched?.eventId
    };
  });
}

function latestAcceptedByKind(
  sessionAcceptedEvents: SessionAcceptedEvent[]
): Map<SignedEnvelope["kind"], SessionAcceptedEvent> {
  const map = new Map<SignedEnvelope["kind"], SessionAcceptedEvent>();
  for (const event of sessionAcceptedEvents) {
    map.set(event.kind, event);
  }
  return map;
}

function checklistStepLabel(mode: BuilderMode): string {
  if (mode === "escrowSpend") {
    return "SpendCredits (ServiceEscrowSink)";
  }
  return modeLabel(mode);
}

function modeEventKind(mode: BuilderMode): SignedEnvelope["kind"] {
  if (mode === "offer") {
    return "ServiceOffer";
  }
  if (mode === "order") {
    return "ServiceOrder";
  }
  if (mode === "escrowSpend") {
    return "SpendCredits";
  }
  if (mode === "delivery") {
    return "ServiceDelivery";
  }
  if (mode === "accept") {
    return "ServiceAccept";
  }
  if (mode === "dispute") {
    return "ServiceDispute";
  }
  return "ServiceSettle";
}

function buildChecklistCopyText(input: {
  acceptChecklist: ChecklistStep[];
  disputeChecklist: ChecklistStep[];
  sessionAcceptedEvents: SessionAcceptedEvent[];
}): string {
  const acceptDone = input.acceptChecklist.filter(step => step.completed).length;
  const disputeDone = input.disputeChecklist.filter(step => step.completed).length;
  const lines: string[] = [
    "Marketplace Event Chain Checklist (Session)",
    "",
    `Accept Path (${acceptDone}/${input.acceptChecklist.length})`
  ];

  for (const step of input.acceptChecklist) {
    lines.push(
      `- [${step.completed ? "x" : " "}] ${step.label}${step.eventId ? ` (${step.eventId})` : ""}`
    );
  }

  lines.push("");
  lines.push(`Dispute Path (${disputeDone}/${input.disputeChecklist.length})`);
  for (const step of input.disputeChecklist) {
    lines.push(
      `- [${step.completed ? "x" : " "}] ${step.label}${step.eventId ? ` (${step.eventId})` : ""}`
    );
  }

  if (input.sessionAcceptedEvents.length > 0) {
    lines.push("");
    lines.push("Session Accepted Events (oldest -> newest)");
    for (const [index, event] of input.sessionAcceptedEvents.entries()) {
      lines.push(`${index + 1}. ${event.kind} ${event.eventId} @ ${event.createdAt}`);
    }
  }

  return lines.join("\n");
}

function transactionModeLabel(mode: BuilderMode): string {
  if (mode === "offer") {
    return "your offer";
  }
  if (mode === "order") {
    return "your order";
  }
  if (mode === "escrowSpend") {
    return "escrow funding";
  }
  if (mode === "delivery") {
    return "your delivery";
  }
  if (mode === "accept") {
    return "completion acceptance";
  }
  if (mode === "dispute") {
    return "your dispute";
  }
  return "settlement";
}

function modeLabel(mode: BuilderMode): string {
  if (mode === "offer") {
    return "ServiceOffer";
  }
  if (mode === "order") {
    return "ServiceOrder";
  }
  if (mode === "escrowSpend") {
    return "SpendCredits";
  }
  if (mode === "delivery") {
    return "ServiceDelivery";
  }
  if (mode === "accept") {
    return "ServiceAccept";
  }
  if (mode === "dispute") {
    return "ServiceDispute";
  }
  return "ServiceSettle";
}

function compensationModeLabel(mode: CompensationMode): string {
  if (mode === "credits") {
    return "Credits only";
  }
  if (mode === "barter") {
    return "Barter only";
  }
  return "Mixed (credits + barter)";
}

function fixtureCreatedAt(preset: FixturePreset, mode: BuilderMode): string {
  const baseByMode: Record<BuilderMode, string> = {
    offer: "2026-03-01T00:05:00Z",
    order: "2026-03-01T00:06:00Z",
    escrowSpend: "2026-03-01T00:07:00Z",
    delivery: "2026-03-01T00:08:00Z",
    accept: "2026-03-01T00:09:00Z",
    dispute: preset === "timeoutFlow" ? "2026-03-01T00:09:00Z" : "2026-03-01T00:09:30Z",
    settle: "2026-03-01T00:10:00Z"
  };
  return baseByMode[mode];
}

function laneStarterCreatedAt(flowRoute: FlowRoute): Record<
  "offer" | "order" | "escrowSpend" | "delivery" | "accept" | "dispute" | "settle",
  string
> {
  return {
    offer: "2026-04-01T00:05:00Z",
    order: "2026-04-01T00:06:00Z",
    escrowSpend: "2026-04-01T00:07:00Z",
    delivery: "2026-04-01T00:08:00Z",
    accept: "2026-04-01T00:09:00Z",
    dispute: flowRoute === "disputePath" ? "2026-04-01T00:09:30Z" : "2026-04-01T00:09:15Z",
    settle: "2026-04-01T00:10:00Z"
  };
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validateLaneTemplateConstraints(input: {
  mode: BuilderMode;
  serviceType: string;
  deliveryMode: string;
  allowedEvidenceFormats: string;
  milestoneEvidenceFormat: string;
  deliveryEvidenceFormat: string;
}): string | null {
  const template = resolveLaneTemplateForServiceType(input.serviceType);
  if (!template) {
    return null;
  }

  const offerDeliveryMode = input.deliveryMode.trim();
  const offeredEvidenceFormats = parseCommaList(input.allowedEvidenceFormats);
  if (template.strict) {
    if (offerDeliveryMode !== template.deliveryMode) {
      return `Lane template mismatch: serviceType \`${template.serviceType}\` requires deliveryMode \`${template.deliveryMode}\`.`;
    }
    if (!stringListEquals(offeredEvidenceFormats, template.allowedEvidenceFormats)) {
      return `Lane template mismatch: serviceType \`${template.serviceType}\` requires allowedEvidenceFormats \`${template.allowedEvidenceFormats.join(",")}\`.`;
    }
  }

  if (input.mode === "order") {
    const milestoneEvidence = input.milestoneEvidenceFormat.trim();
    if (milestoneEvidence && offeredEvidenceFormats.length > 0 && !offeredEvidenceFormats.includes(milestoneEvidence)) {
      return "Lane consistency check failed: milestone evidenceFormat must be listed in offer allowedEvidenceFormats.";
    }
    if (template.strict && milestoneEvidence !== template.defaultMilestoneEvidenceFormat) {
      return `Lane template mismatch: serviceType \`${template.serviceType}\` requires milestone evidenceFormat \`${template.defaultMilestoneEvidenceFormat}\`.`;
    }
  }

  if (input.mode === "delivery" && template.strict) {
    const deliveryEvidence = input.deliveryEvidenceFormat.trim();
    if (deliveryEvidence !== template.defaultMilestoneEvidenceFormat) {
      return `Lane template mismatch: serviceType \`${template.serviceType}\` requires delivery evidenceFormat \`${template.defaultMilestoneEvidenceFormat}\`.`;
    }
  }

  return null;
}

function stringListEquals(left: string[], right: string[]): boolean {
  if (left.length !== right.length) {
    return false;
  }
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) {
      return false;
    }
  }
  return true;
}

function readStringField(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function readStringArrayField(record: Record<string, unknown>, key: string): string[] {
  const value = record[key];
  if (!Array.isArray(value)) {
    return [];
  }
  const out: string[] = [];
  for (const item of value) {
    if (typeof item === "string" && item.trim().length > 0) {
      out.push(item.trim());
    }
  }
  return out;
}

function readFirstMilestone(record: Record<string, unknown>): {
  milestoneId: string | null;
  amountCredits: number | null;
  evidenceFormat: string | null;
} | null {
  const rawMilestones = record.milestones;
  if (!Array.isArray(rawMilestones) || rawMilestones.length === 0) {
    return null;
  }
  const first = rawMilestones[0];
  if (!isObjectRecord(first)) {
    return null;
  }

  const amountCredits = typeof first.amountCredits === "number" ? first.amountCredits : null;
  return {
    milestoneId: readStringField(first, "milestoneId"),
    amountCredits,
    evidenceFormat: readStringField(first, "evidenceFormat")
  };
}

function parseComputeDeliveryHintsJson(raw: string): ComputeDeliveryHints {
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Delivery hints must be valid JSON.");
  }
  if (!isObjectRecord(parsed)) {
    throw new Error("Delivery hints must be a JSON object.");
  }

  const evidenceFormat = readStringField(parsed, "evidenceFormat");
  if (evidenceFormat !== "job-receipt-v1") {
    throw new Error("Delivery hints evidenceFormat must equal `job-receipt-v1`.");
  }

  const artifactHashes = readStringArrayField(parsed, "artifactHashes");
  if (artifactHashes.length === 0) {
    throw new Error("Delivery hints must include at least one artifact hash.");
  }

  const notesHash = readStringField(parsed, "notesHash");
  if (!notesHash) {
    throw new Error("Delivery hints must include `notesHash`.");
  }

  const urls = readStringArrayField(parsed, "urls");
  return {
    evidenceFormat,
    artifactHashes,
    notesHash,
    urls
  };
}

function parseCommaList(value: string): string[] {
  return value
    .split(",")
    .map(part => part.trim())
    .filter(Boolean);
}

function hasDeliveryEvidenceInput(artifactHashes: string, urls: string, notesHash: string): boolean {
  return parseCommaList(artifactHashes).length > 0 || parseCommaList(urls).length > 0 || notesHash.trim().length > 0;
}

function requireCompensationMode(value: string): CompensationMode {
  if (value === "credits" || value === "barter" || value === "mixed") {
    return value;
  }
  throw new Error("compensationMode must be credits, barter, or mixed.");
}

function requireNonEmpty(value: string, fieldName: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(`${fieldName} is required.`);
  }
  return trimmed;
}

function parsePositiveInteger(raw: string, fieldName: string): number {
  const parsed = Number.parseInt(raw.trim(), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${fieldName} must be a positive integer.`);
  }
  return parsed;
}

function parseNonNegativeInteger(raw: string, fieldName: string): number {
  const parsed = Number.parseInt(raw.trim(), 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${fieldName} must be a non-negative integer.`);
  }
  return parsed;
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function MilestoneIdField({
  label,
  value,
  onChange,
  rows,
  isTransaction,
  placeholder = "m1"
}: {
  label: string;
  value: string;
  onChange: (nextValue: string) => void;
  rows: OrderMilestoneDraft[];
  isTransaction: boolean;
  placeholder?: string;
}) {
  const useSelect = isTransaction && rows.length > 1;

  return (
    <label style={{ display: "block", marginBottom: "0.5rem" }}>
      {label}
      {useSelect ? (
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          style={fieldStyle}
        >
          {rows.map((row, index) => (
            <option key={row.milestoneId} value={row.milestoneId}>
              {`Milestone ${index + 1} (${row.milestoneId})`}
            </option>
          ))}
        </select>
      ) : (
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          style={fieldStyle}
          placeholder={placeholder}
        />
      )}
    </label>
  );
}

const transactionSectionStyle = {
  marginTop: 0,
  border: "none",
  borderRadius: 0,
  padding: 0,
  background: "transparent"
} as const;

const sectionStyle = legacySectionStyle;
const fieldStyle = legacyFieldStyle;
const buttonStyle = legacyButtonStyle;
const selectedButtonStyle = legacySelectedButtonStyle;
const linkButtonStyle = legacyLinkButtonStyle;
const disabledButtonStyle = legacyDisabledButtonStyle;
const panelStyle = legacyCodePanelStyle;
