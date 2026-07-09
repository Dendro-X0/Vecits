"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowRight, CheckCircle2, ChevronDown, ChevronUp, Sparkles, Wrench } from "lucide-react";
import { useEffect, useState } from "react";

import {
  MarketplaceEventBuilder,
  type MarketplaceBuilderMode
} from "@/app/components/marketplace-event-builder";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

const TRANSACTION_STEP_MODES = new Set<MarketplaceBuilderMode>(
  TRANSACTION_STEPS.map((step) => step.mode)
);

function isTransactionStepMode(value: string | null): value is MarketplaceBuilderMode {
  return value !== null && TRANSACTION_STEP_MODES.has(value as MarketplaceBuilderMode);
}

function nextTransactionStep(mode: MarketplaceBuilderMode): MarketplaceBuilderMode | null {
  const index = TRANSACTION_STEPS.findIndex((step) => step.mode === mode);
  if (index < 0 || index >= TRANSACTION_STEPS.length - 1) {
    return null;
  }
  return TRANSACTION_STEPS[index + 1].mode;
}

export function TransactionBuilderPanel() {
  const searchParams = useSearchParams();
  const stepParam = searchParams.get("step");
  const operatorParam = searchParams.get("operator");
  const [step, setStep] = useState<MarketplaceBuilderMode>(() =>
    isTransactionStepMode(stepParam) ? stepParam : "offer"
  );
  const [showAdvanced, setShowAdvanced] = useState(
    () => operatorParam === "1" || operatorParam === "dispute" || stepParam === "dispute" || stepParam === "settle"
  );
  const [operatorInitialMode, setOperatorInitialMode] = useState<MarketplaceBuilderMode | undefined>(() => {
    if (stepParam === "dispute" || stepParam === "settle") {
      return stepParam;
    }
    return operatorParam === "dispute" ? "dispute" : undefined;
  });
  const [showImport, setShowImport] = useState(false);
  const [lastCompletedStep, setLastCompletedStep] = useState<MarketplaceBuilderMode | null>(null);

  useEffect(() => {
    if (isTransactionStepMode(stepParam)) {
      setStep(stepParam);
    }
    if (stepParam === "dispute" || stepParam === "settle" || operatorParam === "1" || operatorParam === "dispute") {
      setShowAdvanced(true);
      if (stepParam === "dispute" || stepParam === "settle") {
        setOperatorInitialMode(stepParam);
      } else if (operatorParam === "dispute") {
        setOperatorInitialMode("dispute");
      }
    }
  }, [operatorParam, stepParam]);

  const activeStep = TRANSACTION_STEPS.find((item) => item.mode === step) ?? TRANSACTION_STEPS[0];
  const activeStepIndex = TRANSACTION_STEPS.findIndex((item) => item.mode === step);
  const nextStep = activeStepIndex >= 0 ? TRANSACTION_STEPS[activeStepIndex + 1] ?? null : null;

  function handleAccepted(mode: MarketplaceBuilderMode) {
    setLastCompletedStep(mode);
    const next = nextTransactionStep(mode);
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
        <MarketplaceEventBuilder variant="full" initialMode={operatorInitialMode} />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="muted">Step {activeStepIndex + 1} of {TRANSACTION_STEPS.length}</Badge>
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <Sparkles aria-hidden="true" className="h-3.5 w-3.5 text-primary" />
              Guided flow
            </span>
          </div>
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
            The current step is <span className="font-medium text-foreground">{activeStep.label}</span>.
            {" "}Complete each stage to move the exchange forward.
          </p>
        </div>

        <div className="surface-card space-y-4 rounded-2xl border border-border/70 p-5 shadow-sm">
          <div>
            <p className="text-sm font-medium text-foreground">What happens next</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {nextStep
                ? `Finish ${activeStep.label.toLowerCase()} to continue into ${nextStep.label.toLowerCase()}.`
                : "You are on the final guided step. After acceptance, track the exchange from Transactions."}
            </p>
          </div>
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>Use a draft import if you already discovered a service idea.</p>
            <p>Use Transactions when you want to continue from live order state.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button nativeButton={false} render={<Link href="/dashboard/transactions" />} variant="outline" size="sm">
              Track transactions
            </Button>
            <Button nativeButton={false} render={<Link href="/marketplace" />} variant="ghost" size="sm">
              Browse marketplace
            </Button>
          </div>
          {lastCompletedStep ? (
            <div className="rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{labelForStep(lastCompletedStep)}</span> completed.
              {nextStep ? ` Continue with ${nextStep.label.toLowerCase()}.` : " Your exchange is ready for follow-up tracking."}
            </div>
          ) : null}
        </div>
      </section>

      <div className="space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-base font-semibold tracking-tight">Step progress</h2>
          <Badge variant="muted">Resumable</Badge>
        </div>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Jump to a step if you are resuming work on an existing exchange.
        </p>
      </div>

      <nav aria-label="Transaction steps" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {TRANSACTION_STEPS.map((item, index) => {
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
        </div>

        <div className="pt-5">
          <MarketplaceEventBuilder
            variant="transaction"
            controlledMode={step}
            onControlledModeChange={setStep}
            onAccepted={handleAccepted}
            showDiscoveryImport={showImport}
          />
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-border/80 bg-muted/[0.18] px-4 py-3">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-muted/50">
            <Wrench className="size-4 text-muted-foreground" />
          </span>
          <div>
            <p className="text-sm font-medium">Need technical or dispute tools?</p>
            <p className="text-xs text-muted-foreground">
              The operator builder keeps fixture presets, dispute paths, and raw event controls out of the main flow.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => {
            setOperatorInitialMode(undefined);
            setShowAdvanced(true);
          }}>
            Operator builder
          </Button>
          <Button
            nativeButton={false}
            render={<Link href="/dashboard/builder?operator=1&step=dispute" />}
            variant="outline"
            size="sm"
          >
            Dispute tools
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

function labelForStep(mode: MarketplaceBuilderMode): string {
  return TRANSACTION_STEPS.find((step) => step.mode === mode)?.label ?? mode;
}
