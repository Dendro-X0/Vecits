"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowRight, CheckCircle2, ChevronDown, ChevronUp, Scale, Sparkles, Wrench } from "lucide-react";
import { useEffect, useState } from "react";

import {
  MarketplaceEventBuilder,
  type MarketplaceBuilderMode
} from "@/app/components/marketplace-event-builder";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { loadActiveSession } from "@/lib/auth/session";
import { buildDisputeBuilderHref } from "@/lib/dashboard/builder-handoff";
import {
  loadTrustBootstrapSnapshot,
  type ProviderEligibility
} from "@/lib/dashboard/trust-bootstrap";
import { cn } from "@/lib/utils";

const TRANSACTION_STEPS: Array<{
  mode: MarketplaceBuilderMode;
  label: string;
  description: string;
}> = [
  {
    mode: "offer",
    label: "Publish offer",
    description: "List a service with price and delivery terms."
  },
  {
    mode: "order",
    label: "Place order",
    description: "Buyer commits to an offer and defines the milestone."
  },
  {
    mode: "escrowSpend",
    label: "Fund escrow",
    description: "Buyer locks credits for the milestone."
  },
  {
    mode: "delivery",
    label: "Deliver work",
    description: "Provider submits evidence that work is complete."
  },
  {
    mode: "accept",
    label: "Accept completion",
    description: "Buyer accepts delivery and releases payout."
  }
];

const DISPUTE_STEPS: Array<{
  mode: MarketplaceBuilderMode;
  label: string;
  description: string;
}> = [
  {
    mode: "dispute",
    label: "Open dispute",
    description: "Record why delivery does not meet the locked terms."
  },
  {
    mode: "settle",
    label: "Settle outcome",
    description: "Propose refund and reward credits under protocol rules."
  }
];

const TRANSACTION_STEP_MODES = new Set<MarketplaceBuilderMode>(
  TRANSACTION_STEPS.map((step) => step.mode)
);

const DISPUTE_STEP_MODES = new Set<MarketplaceBuilderMode>(DISPUTE_STEPS.map((step) => step.mode));

type BuilderFlow = "happy" | "dispute";

function isTransactionStepMode(value: string | null): value is MarketplaceBuilderMode {
  return value !== null && TRANSACTION_STEP_MODES.has(value as MarketplaceBuilderMode);
}

function isDisputeStepMode(value: string | null): value is MarketplaceBuilderMode {
  return value !== null && DISPUTE_STEP_MODES.has(value as MarketplaceBuilderMode);
}

function nextTransactionStep(mode: MarketplaceBuilderMode): MarketplaceBuilderMode | null {
  const index = TRANSACTION_STEPS.findIndex((step) => step.mode === mode);
  if (index < 0 || index >= TRANSACTION_STEPS.length - 1) {
    return null;
  }
  return TRANSACTION_STEPS[index + 1].mode;
}

function nextDisputeStep(mode: MarketplaceBuilderMode): MarketplaceBuilderMode | null {
  if (mode === "dispute") {
    return "settle";
  }
  return null;
}

export function TransactionBuilderPanel() {
  const searchParams = useSearchParams();
  const stepParam = searchParams.get("step");
  const branchParam = searchParams.get("branch");
  const operatorParam = searchParams.get("operator");
  const orderParam = searchParams.get("order");
  const milestoneParam = searchParams.get("milestone");
  const importParam = searchParams.get("import");

  const [flow, setFlow] = useState<BuilderFlow>(() =>
    branchParam === "dispute" ? "dispute" : "happy"
  );
  const [step, setStep] = useState<MarketplaceBuilderMode>(() => {
    if (branchParam === "dispute") {
      return stepParam === "settle" ? "settle" : "dispute";
    }
    return isTransactionStepMode(stepParam) ? stepParam : "offer";
  });
  const [showAdvanced, setShowAdvanced] = useState(
    () =>
      operatorParam === "1" &&
      branchParam !== "dispute" &&
      stepParam !== "dispute" &&
      stepParam !== "settle"
  );
  const [operatorInitialMode, setOperatorInitialMode] = useState<MarketplaceBuilderMode | undefined>(
    () => (operatorParam === "dispute" ? "dispute" : undefined)
  );
  const [showImport, setShowImport] = useState(() => importParam === "discovery");
  const [lastCompletedStep, setLastCompletedStep] = useState<MarketplaceBuilderMode | null>(null);
  const [providerEligibility, setProviderEligibility] = useState<ProviderEligibility | null>(null);

  useEffect(() => {
    const session = loadActiveSession();
    const publicKeyHex = session?.publicKeyHex;
    if (!publicKeyHex) {
      setProviderEligibility(null);
      return;
    }

    let cancelled = false;
    void loadTrustBootstrapSnapshot(publicKeyHex).then((snapshot) => {
      if (!cancelled && snapshot.kind === "live") {
        setProviderEligibility(snapshot.provider);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (importParam !== "discovery" || step !== "offer" || !showImport) {
      return;
    }
    const frame = requestAnimationFrame(() => {
      document.getElementById("discovery-draft-import")?.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [importParam, showImport, step]);

  useEffect(() => {
    if (importParam === "transport-draft") {
      setFlow("happy");
      setStep("offer");
    }
  }, [importParam]);

  useEffect(() => {
    if (branchParam === "dispute") {
      setFlow("dispute");
      if (isDisputeStepMode(stepParam)) {
        setStep(stepParam);
      }
      return;
    }
    if (isTransactionStepMode(stepParam)) {
      setFlow("happy");
      setStep(stepParam);
    }
    if (operatorParam === "1") {
      setShowAdvanced(true);
    }
  }, [branchParam, operatorParam, stepParam]);

  const steps = flow === "dispute" ? DISPUTE_STEPS : TRANSACTION_STEPS;
  const activeStep = steps.find((item) => item.mode === step) ?? steps[0];
  const activeStepIndex = steps.findIndex((item) => item.mode === step);
  const nextStep = activeStepIndex >= 0 ? steps[activeStepIndex + 1] ?? null : null;

  function handleAccepted(mode: MarketplaceBuilderMode) {
    setLastCompletedStep(mode);
    const next =
      flow === "dispute" ? nextDisputeStep(mode) : nextTransactionStep(mode);
    if (next) {
      setStep(next);
    }
  }

  if (showAdvanced) {
    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">Operator event builder</h1>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Full marketplace event surface for drills, dispute paths, and fixture presets.
            </p>
          </div>
          <Button type="button" variant="outline" onClick={() => setShowAdvanced(false)}>
            Back to transaction flow
          </Button>
        </div>
        <MarketplaceEventBuilder
          variant="full"
          initialMode={operatorInitialMode}
          prefillOrderId={orderParam ?? undefined}
          prefillMilestoneId={milestoneParam ?? undefined}
        />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant={flow === "happy" ? "default" : "outline"}
          onClick={() => {
            setFlow("happy");
            setStep("offer");
          }}
        >
          Standard exchange
        </Button>
        <Button
          type="button"
          size="sm"
          variant={flow === "dispute" ? "default" : "outline"}
          onClick={() => {
            setFlow("dispute");
            setStep("dispute");
          }}
        >
          <Scale className="size-4" />
          Resolve a problem
        </Button>
      </div>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="muted">
              Step {activeStepIndex + 1} of {steps.length}
            </Badge>
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              {flow === "dispute" ? (
                <>
                  <Scale aria-hidden="true" className="h-3.5 w-3.5 text-primary" />
                  Dispute branch
                </>
              ) : (
                <>
                  <Sparkles aria-hidden="true" className="h-3.5 w-3.5 text-primary" />
                  Guided flow
                </>
              )}
            </span>
          </div>
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
            {flow === "dispute" ? (
              <>
                The current step is{" "}
                <span className="font-medium text-foreground">{activeStep.label}</span>. Use this
                branch when delivery does not meet locked terms.
              </>
            ) : (
              <>
                The current step is{" "}
                <span className="font-medium text-foreground">{activeStep.label}</span>. Complete
                each stage to move the exchange forward.
              </>
            )}
          </p>
        </div>

        <div className="surface-card space-y-4 rounded-2xl border border-border/70 p-5 shadow-sm">
          <div>
            <p className="text-sm font-medium text-foreground">What happens next</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {nextStep
                ? `Finish ${activeStep.label.toLowerCase()} to continue into ${nextStep.label.toLowerCase()}.`
                : flow === "dispute"
                  ? "Settlement completes the dispute branch. Track the order from Transactions."
                  : "You are on the final guided step. After acceptance, track the exchange from Transactions."}
            </p>
          </div>
          <div className="space-y-2 text-sm text-muted-foreground">
            {flow === "happy" ? (
              <>
                <p>Use a draft import if you already discovered a service idea.</p>
                <p>Use Transactions when you want to continue from live order state.</p>
              </>
            ) : (
              <>
                <p>Reference the delivery event id from the order page when possible.</p>
                <p>
                  Read{" "}
                  <Link href="/help/disputes" className="text-primary hover:underline">
                    disputes and settlement
                  </Link>{" "}
                  for when this path applies.
                </p>
              </>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button nativeButton={false} render={<Link href="/dashboard/transactions" />} variant="outline" size="sm">
              Track transactions
            </Button>
            <Button nativeButton={false} render={<Link href="/help/deal-flow" />} variant="ghost" size="sm">
              Help guides
            </Button>
          </div>
          {lastCompletedStep ? (
            <div className="rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{labelForStep(lastCompletedStep, flow)}</span>{" "}
              completed.
              {nextStep ? ` Continue with ${nextStep.label.toLowerCase()}.` : " Your exchange is ready for follow-up tracking."}
            </div>
          ) : null}
        </div>
      </section>

      <nav
        aria-label={flow === "dispute" ? "Dispute steps" : "Transaction steps"}
        className={cn("grid gap-3", flow === "dispute" ? "sm:grid-cols-2" : "sm:grid-cols-2 xl:grid-cols-5")}
      >
        {steps.map((item, index) => {
          const selected = item.mode === step;
          const completed = activeStepIndex > index;
          return (
            <button
              key={item.mode}
              type="button"
              onClick={() => setStep(item.mode)}
              className={cn(
                "rounded-2xl border px-4 py-4 text-left transition-all",
                selected
                  ? "border-primary/35 bg-primary/10 shadow-sm ring-1 ring-primary/20"
                  : completed
                    ? "border-primary/15 bg-primary/5 hover:border-primary/20 hover:bg-primary/10"
                    : "border-border hover:border-primary/20 hover:bg-muted/40"
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs font-medium text-muted-foreground">Step {index + 1}</p>
                {completed ? <CheckCircle2 aria-hidden="true" className="h-4 w-4 text-primary" /> : null}
              </div>
              <p className="mt-2 text-sm font-medium">{item.label}</p>
              <p className="mt-1 text-xs text-muted-foreground">{item.description}</p>
            </button>
          );
        })}
      </nav>

      <section className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-4">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">{activeStep.label}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{activeStep.description}</p>
          </div>
          {flow === "happy" ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              onClick={() => setShowImport((previous) => !previous)}
            >
              {showImport ? (
                <>
                  Hide draft import
                  <ChevronUp className="size-4" />
                </>
              ) : (
                <>
                  Import discovery draft
                  <ChevronDown className="size-4" />
                </>
              )}
            </Button>
          ) : null}
        </div>

        <div className="pt-5">
          <MarketplaceEventBuilder
            variant="transaction"
            controlledMode={step}
            onControlledModeChange={setStep}
            onAccepted={handleAccepted}
            showDiscoveryImport={flow === "happy" && showImport}
            prefillOrderId={orderParam ?? undefined}
            prefillMilestoneId={milestoneParam ?? undefined}
            providerEligibility={providerEligibility}
          />
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-border/80 bg-muted/[0.18] px-4 py-3">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-muted/50">
            <Wrench className="size-4 text-muted-foreground" />
          </span>
          <div>
            <p className="text-sm font-medium">Operator tools</p>
            <p className="text-xs text-muted-foreground">
              Fixture presets and raw event controls for drills — separate from the guided flows above.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setOperatorInitialMode(undefined);
              setShowAdvanced(true);
            }}
          >
            Operator builder
          </Button>
          <Button
            nativeButton={false}
            render={
              <Link
                href={buildDisputeBuilderHref(orderParam, "dispute", milestoneParam)}
              />
            }
            variant="outline"
            size="sm"
          >
            Dispute deep link
          </Button>
          <Button
            nativeButton={false}
            render={<Link href="/dashboard/settings?advanced=1" />}
            variant="ghost"
            size="sm"
          >
            Advanced settings
            <ArrowRight className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function labelForStep(mode: MarketplaceBuilderMode, flow: BuilderFlow): string {
  const steps = flow === "dispute" ? DISPUTE_STEPS : TRANSACTION_STEPS;
  return steps.find((step) => step.mode === mode)?.label ?? mode;
}
