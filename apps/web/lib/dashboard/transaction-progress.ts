import { milestoneNeedsFunding } from "@/lib/marketplace/escrow-spend";
import type { NormalizedMilestone, NormalizedOrderExchange } from "@/lib/marketplace/order-normalize";
import { milestoneReadyForAccept } from "@/lib/marketplace/service-accept";
import { milestoneReadyForDelivery } from "@/lib/marketplace/service-delivery";

export type TransactionProgressStep = {
  id: "placed" | "funded" | "delivered" | "accepted";
  label: string;
  state: "done" | "current" | "upcoming";
};

export type TransactionBuilderStep = "escrowSpend" | "delivery" | "accept";

export type TransactionProgress = {
  steps: TransactionProgressStep[];
  headline: string;
  detail: string;
  nextActionLabel: string | null;
  needsViewerAction: boolean;
  isComplete: boolean;
  builderStep: TransactionBuilderStep | null;
  builderHref: string | null;
};

function primaryMilestone(exchange: NormalizedOrderExchange): NormalizedMilestone | null {
  return exchange.milestones[0] ?? null;
}

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

function resolveBuilderHandoff(
  currentStep: TransactionProgressStep["id"] | null,
  needsViewerAction: boolean
): Pick<TransactionProgress, "builderStep" | "builderHref"> {
  if (!needsViewerAction || !currentStep || currentStep === "placed") {
    return { builderStep: null, builderHref: null };
  }

  const builderStep: TransactionBuilderStep =
    currentStep === "funded"
      ? "escrowSpend"
      : currentStep === "delivered"
        ? "delivery"
        : "accept";

  return {
    builderStep,
    builderHref: `/dashboard/builder?step=${builderStep}`
  };
}

function withBuilderHandoff(
  progress: Omit<TransactionProgress, "builderStep" | "builderHref">,
  currentStep: TransactionProgressStep["id"] | null
): TransactionProgress {
  return {
    ...progress,
    ...resolveBuilderHandoff(currentStep, progress.needsViewerAction)
  };
}

export function deriveTransactionProgress(
  exchange: NormalizedOrderExchange,
  viewerRole: "buyer" | "provider"
): TransactionProgress {
  const milestone = primaryMilestone(exchange);
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
      label: "Escrow funded",
      state: fundedDone ? "done" : currentStep === "funded" ? "current" : "upcoming"
    },
    {
      id: "delivered",
      label: "Work delivered",
      state: deliveredDone ? "done" : currentStep === "delivered" ? "current" : "upcoming"
    },
    {
      id: "accepted",
      label: "Completion accepted",
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

  const isComplete = acceptedDone;

  if (isComplete) {
    return withBuilderHandoff(
      {
        steps,
        headline: "Exchange complete",
        detail: "All milestones on this order are settled.",
        nextActionLabel: "View order",
        needsViewerAction: false,
        isComplete: true
      },
      currentStep
    );
  }

  if (needsViewerAction && nextActionLabel) {
    return withBuilderHandoff(
      {
        steps,
        headline: "Your turn",
        detail: `${nextActionLabel} to keep this exchange moving.`,
        nextActionLabel,
        needsViewerAction: true,
        isComplete: false
      },
      currentStep
    );
  }

  if (!fundedDone) {
    return withBuilderHandoff(
      {
        steps,
        headline: viewerRole === "buyer" ? "Fund escrow next" : "Waiting for buyer",
        detail:
          viewerRole === "buyer"
            ? "Lock credits for the milestone before work can begin."
            : "The buyer still needs to fund escrow for this order.",
        nextActionLabel: viewerRole === "buyer" ? "Fund escrow" : "View order",
        needsViewerAction: viewerRole === "buyer",
        isComplete: false
      },
      currentStep
    );
  }

  if (!deliveredDone) {
    return withBuilderHandoff(
      {
        steps,
        headline: viewerRole === "provider" ? "Deliver work next" : "Waiting for provider",
        detail:
          viewerRole === "provider"
            ? "Submit delivery evidence when the milestone work is ready."
            : "Escrow is funded — waiting for the provider to deliver.",
        nextActionLabel: viewerRole === "provider" ? "Submit delivery" : "View order",
        needsViewerAction: viewerRole === "provider",
        isComplete: false
      },
      currentStep
    );
  }

  return withBuilderHandoff(
    {
      steps,
      headline: viewerRole === "buyer" ? "Review delivery" : "Waiting for buyer",
      detail:
        viewerRole === "buyer"
          ? "Review the submitted work and accept when it meets the terms."
          : "Delivery is in — waiting for the buyer to accept.",
      nextActionLabel: viewerRole === "buyer" ? "Accept completion" : "View order",
      needsViewerAction: viewerRole === "buyer",
      isComplete: false
    },
    currentStep
  );
}
