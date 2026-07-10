import { milestoneNeedsFunding } from "@/lib/marketplace/escrow-spend";
import type { OrderDeadlineHint } from "@/lib/dashboard/order-deadline-hints";
import { deriveOrderDeadlineHint } from "@/lib/dashboard/order-deadline-hints";
import type { NormalizedMilestone, NormalizedOrderExchange } from "@/lib/marketplace/order-normalize";
import { milestoneReadyForAccept } from "@/lib/marketplace/service-accept";
import { milestoneReadyForDelivery } from "@/lib/marketplace/service-delivery";

import { buildBuilderHref, buildDisputeBuilderHref } from "./builder-handoff";

export type TransactionProgressStep = {
  id: "placed" | "funded" | "delivered" | "accepted";
  label: string;
  state: "done" | "current" | "upcoming";
};

export type TransactionBuilderStep = "escrowSpend" | "delivery" | "accept";

export type MilestoneProgressSummary = {
  id: string;
  index: number;
  label: string;
  status: string;
  phase: "upcoming" | "active" | "complete" | "disputed";
};

export type TransactionProgress = {
  steps: TransactionProgressStep[];
  headline: string;
  detail: string;
  nextActionLabel: string | null;
  needsViewerAction: boolean;
  isComplete: boolean;
  isDisputed: boolean;
  builderStep: TransactionBuilderStep | null;
  builderHref: string | null;
  disputeBuilderHref: string | null;
  activeMilestoneId: string | null;
  activeMilestoneIndex: number;
  milestoneTotal: number;
  milestoneSummaries: MilestoneProgressSummary[];
  deadlineHint: OrderDeadlineHint | null;
};

function milestoneFunded(milestone: NormalizedMilestone): boolean {
  if (milestone.fundedAmount >= milestone.amountCredits) {
    return true;
  }
  return ["Funded", "Delivered", "Accepted"].includes(milestone.status);
}

function milestoneDelivered(milestone: NormalizedMilestone): boolean {
  return milestone.status === "Delivered" || milestone.status === "Accepted";
}

function milestoneAccepted(milestone: NormalizedMilestone, orderStatus: string): boolean {
  return milestone.status === "Accepted" || orderStatus === "closed";
}

function milestoneDisputed(milestone: NormalizedMilestone): boolean {
  return milestone.status === "Disputed";
}

function findActiveMilestone(exchange: NormalizedOrderExchange): {
  milestone: NormalizedMilestone | null;
  index: number;
} {
  for (let index = 0; index < exchange.milestones.length; index += 1) {
    const milestone = exchange.milestones[index];
    if (!milestoneAccepted(milestone, exchange.status) && !milestoneDisputed(milestone)) {
      return { milestone, index };
    }
    if (milestoneDisputed(milestone)) {
      return { milestone, index };
    }
  }

  const lastIndex = Math.max(exchange.milestones.length - 1, 0);
  return {
    milestone: exchange.milestones[lastIndex] ?? null,
    index: lastIndex
  };
}

function buildMilestoneSummaries(exchange: NormalizedOrderExchange): MilestoneProgressSummary[] {
  const { index: activeIndex } = findActiveMilestone(exchange);

  return exchange.milestones.map((milestone, index) => {
    let phase: MilestoneProgressSummary["phase"] = "upcoming";
    if (milestoneDisputed(milestone)) {
      phase = "disputed";
    } else if (milestoneAccepted(milestone, exchange.status)) {
      phase = "complete";
    } else if (index === activeIndex) {
      phase = "active";
    }

    return {
      id: milestone.id,
      index: index + 1,
      label: `Milestone ${index + 1}`,
      status: milestone.status,
      phase
    };
  });
}

function milestoneScopeLabel(exchange: NormalizedOrderExchange, index: number): string {
  if (exchange.milestones.length <= 1) {
    return "";
  }
  const milestone = exchange.milestones[index];
  return `Milestone ${index + 1} of ${exchange.milestones.length} (${milestone?.id ?? "—"}) · `;
}

function resolveBuilderHandoff(
  currentStep: TransactionProgressStep["id"] | null,
  needsViewerAction: boolean,
  orderId: string,
  milestoneId?: string | null
): Pick<TransactionProgress, "builderStep" | "builderHref" | "disputeBuilderHref"> {
  if (!needsViewerAction || !currentStep || currentStep === "placed") {
    return { builderStep: null, builderHref: null, disputeBuilderHref: null };
  }

  const builderStep: TransactionBuilderStep =
    currentStep === "funded"
      ? "escrowSpend"
      : currentStep === "delivered"
        ? "delivery"
        : "accept";

  return {
    builderStep,
    builderHref: buildBuilderHref(builderStep, orderId, milestoneId),
    disputeBuilderHref:
      currentStep === "accepted" ? buildDisputeBuilderHref(orderId, "dispute", milestoneId) : null
  };
}

function deriveDeadlineHintForMilestone(
  exchange: NormalizedOrderExchange,
  milestone: NormalizedMilestone | null,
  dueWindow?: string | null
): OrderDeadlineHint | null {
  return deriveOrderDeadlineHint(exchange.orderExpiresAt, dueWindow ?? null, {
    milestoneFunded: milestone ? milestoneFunded(milestone) : false
  });
}

function withBuilderHandoff(
  progress: Omit<
    TransactionProgress,
    | "builderStep"
    | "builderHref"
    | "disputeBuilderHref"
    | "activeMilestoneId"
    | "activeMilestoneIndex"
    | "milestoneTotal"
    | "milestoneSummaries"
    | "deadlineHint"
  >,
  currentStep: TransactionProgressStep["id"] | null,
  orderId: string,
  exchange: NormalizedOrderExchange,
  activeIndex: number
): TransactionProgress {
  const activeMilestone = exchange.milestones[activeIndex] ?? null;
  return {
    ...progress,
    ...resolveBuilderHandoff(
      currentStep,
      progress.needsViewerAction,
      orderId,
      activeMilestone?.id
    ),
    activeMilestoneId: activeMilestone?.id ?? null,
    activeMilestoneIndex: activeIndex + 1,
    milestoneTotal: exchange.milestones.length,
    milestoneSummaries: buildMilestoneSummaries(exchange),
    deadlineHint: deriveDeadlineHintForMilestone(exchange, activeMilestone)
  };
}

function allMilestonesAccepted(exchange: NormalizedOrderExchange): boolean {
  if (exchange.milestones.length === 0) {
    return exchange.status === "closed";
  }
  return exchange.milestones.every((milestone) =>
    milestoneAccepted(milestone, exchange.status)
  );
}

export function deriveTransactionProgress(
  exchange: NormalizedOrderExchange,
  viewerRole: "buyer" | "provider"
): TransactionProgress {
  const { milestone, index: activeIndex } = findActiveMilestone(exchange);
  const scope = milestoneScopeLabel(exchange, activeIndex);
  const disputed = milestone ? milestoneDisputed(milestone) : false;

  if (disputed && milestone) {
    const steps: TransactionProgressStep[] = [
      { id: "placed", label: "Order placed", state: "done" },
      { id: "funded", label: "Escrow funded", state: "done" },
      { id: "delivered", label: "Work delivered", state: "done" },
      { id: "accepted", label: "Completion accepted", state: "current" }
    ];

    return {
      steps,
      headline: "Dispute open",
      detail: `${scope}This milestone is in dispute. File or review settlement in the guided dispute branch.`,
      nextActionLabel: "Resolve dispute",
      needsViewerAction: true,
      isComplete: false,
      isDisputed: true,
      builderStep: null,
      builderHref: null,
      disputeBuilderHref: buildDisputeBuilderHref(exchange.orderId, "settle", milestone.id),
      activeMilestoneId: milestone.id,
      activeMilestoneIndex: activeIndex + 1,
      milestoneTotal: exchange.milestones.length,
      milestoneSummaries: buildMilestoneSummaries(exchange),
      deadlineHint: deriveDeadlineHintForMilestone(exchange, milestone)
    };
  }

  const placedDone = true;
  const fundedDone = milestone ? milestoneFunded(milestone) : false;
  const deliveredDone = milestone ? milestoneDelivered(milestone) : false;
  const acceptedDone = milestone
    ? milestoneAccepted(milestone, exchange.status)
    : exchange.status === "closed";

  let currentStep: TransactionProgressStep["id"] | null = null;
  if (!fundedDone) {
    currentStep = "funded";
  } else if (!deliveredDone) {
    currentStep = "delivered";
  } else if (!acceptedDone) {
    currentStep = "accepted";
  }

  const steps: TransactionProgressStep[] = [
    {
      id: "placed",
      label: "Order placed",
      state: placedDone ? "done" : "current"
    },
    {
      id: "funded",
      label: exchange.milestones.length > 1 ? "Escrow funded (active)" : "Escrow funded",
      state: fundedDone ? "done" : currentStep === "funded" ? "current" : "upcoming"
    },
    {
      id: "delivered",
      label: exchange.milestones.length > 1 ? "Work delivered (active)" : "Work delivered",
      state: deliveredDone ? "done" : currentStep === "delivered" ? "current" : "upcoming"
    },
    {
      id: "accepted",
      label: exchange.milestones.length > 1 ? "Completion accepted (active)" : "Completion accepted",
      state: acceptedDone ? "done" : currentStep === "accepted" ? "current" : "upcoming"
    }
  ];

  let nextActionLabel: string | null = null;
  let needsViewerAction = false;

  if (milestone && !acceptedDone) {
    if (viewerRole === "buyer" && milestoneNeedsFunding(milestone)) {
      nextActionLabel = "Fund escrow";
      needsViewerAction = true;
    } else if (viewerRole === "provider" && milestoneReadyForDelivery(milestone.status)) {
      nextActionLabel = "Submit delivery";
      needsViewerAction = true;
    } else if (viewerRole === "buyer" && milestoneReadyForAccept(milestone.status)) {
      nextActionLabel = "Accept completion";
      needsViewerAction = true;
    }
  }

  const isComplete = allMilestonesAccepted(exchange);

  if (isComplete) {
    return withBuilderHandoff(
      {
        steps,
        headline: "Exchange complete",
        detail: "All milestones on this order are settled.",
        nextActionLabel: "View order",
        needsViewerAction: false,
        isComplete: true,
        isDisputed: false
      },
      currentStep,
      exchange.orderId,
      exchange,
      activeIndex
    );
  }

  if (needsViewerAction && nextActionLabel) {
    return withBuilderHandoff(
      {
        steps,
        headline: "Your turn",
        detail: `${scope}${nextActionLabel} to keep this exchange moving.`,
        nextActionLabel,
        needsViewerAction: true,
        isComplete: false,
        isDisputed: false
      },
      currentStep,
      exchange.orderId,
      exchange,
      activeIndex
    );
  }

  if (!fundedDone) {
    return withBuilderHandoff(
      {
        steps,
        headline: viewerRole === "buyer" ? "Fund escrow next" : "Waiting for buyer",
        detail:
          viewerRole === "buyer"
            ? `${scope}Lock credits for the milestone before work can begin.`
            : `${scope}The buyer still needs to fund escrow for this milestone.`,
        nextActionLabel: viewerRole === "buyer" ? "Fund escrow" : "View order",
        needsViewerAction: viewerRole === "buyer",
        isComplete: false,
        isDisputed: false
      },
      currentStep,
      exchange.orderId,
      exchange,
      activeIndex
    );
  }

  if (!deliveredDone) {
    return withBuilderHandoff(
      {
        steps,
        headline: viewerRole === "provider" ? "Deliver work next" : "Waiting for provider",
        detail:
          viewerRole === "provider"
            ? `${scope}Submit delivery evidence when the milestone work is ready.`
            : `${scope}Escrow is funded — waiting for the provider to deliver.`,
        nextActionLabel: viewerRole === "provider" ? "Submit delivery" : "View order",
        needsViewerAction: viewerRole === "provider",
        isComplete: false,
        isDisputed: false
      },
      currentStep,
      exchange.orderId,
      exchange,
      activeIndex
    );
  }

  return withBuilderHandoff(
    {
      steps,
      headline: viewerRole === "buyer" ? "Review delivery" : "Waiting for buyer",
      detail:
        viewerRole === "buyer"
          ? `${scope}Review the submitted work and accept when it meets the terms.`
          : `${scope}Delivery is in — waiting for the buyer to accept.`,
      nextActionLabel: viewerRole === "buyer" ? "Accept completion" : "View order",
      needsViewerAction: viewerRole === "buyer",
      isComplete: false,
      isDisputed: false
    },
    currentStep,
    exchange.orderId,
    exchange,
    activeIndex
  );
}
