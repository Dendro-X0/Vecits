import { AlertTriangle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  isExperimentalLaneTemplate,
  type ServiceLaneTemplate
} from "@/lib/marketplace/lane-templates";

type LanePublishFitPanelProps = {
  template: ServiceLaneTemplate | null;
  customLane?: boolean;
};

export function LanePublishFitPanel({ template, customLane = false }: LanePublishFitPanelProps) {
  if (customLane || !template) {
    return (
      <div className="mb-4 rounded-xl border border-border/70 bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
        <p className="font-medium text-foreground">Custom lane</p>
        <p className="mt-1">
          Delivery mode and evidence formats must match your node policy. Validate manually before
          signing the offer.
        </p>
      </div>
    );
  }

  const experimental = isExperimentalLaneTemplate(template);

  return (
    <div
      className={
        experimental
          ? "mb-4 space-y-3 rounded-xl border border-amber-500/35 bg-amber-500/10 px-4 py-3 text-sm"
          : "mb-4 space-y-3 rounded-xl border border-border/70 bg-muted/20 px-4 py-3 text-sm"
      }
    >
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-medium text-foreground">Lane fit — {template.label}</p>
        {experimental ? (
          <Badge variant="outline" className="border-amber-500/40 text-amber-700 dark:text-amber-300">
            <AlertTriangle className="mr-1 size-3" />
            Experimental lane
          </Badge>
        ) : (
          <Badge variant="outline">Community lane</Badge>
        )}
      </div>

      <p className="text-muted-foreground">{template.description}</p>

      <dl className="grid gap-2 sm:grid-cols-2">
        <div className="rounded-lg border border-border/70 bg-background/70 px-3 py-2">
          <dt className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Delivery mode</dt>
          <dd className="mt-1 font-mono text-sm text-foreground">{template.deliveryMode}</dd>
        </div>
        <div className="rounded-lg border border-border/70 bg-background/70 px-3 py-2">
          <dt className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Evidence formats</dt>
          <dd className="mt-1 font-mono text-sm text-foreground">
            {template.allowedEvidenceFormats.join(", ")}
          </dd>
        </div>
        <div className="rounded-lg border border-border/70 bg-background/70 px-3 py-2 sm:col-span-2">
          <dt className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Milestone evidence</dt>
          <dd className="mt-1 font-mono text-sm text-foreground">
            {template.defaultMilestoneEvidenceFormat}
          </dd>
        </div>
      </dl>

      {experimental ? (
        <p className="text-xs text-muted-foreground">
          Strict lanes require exact delivery and evidence fields. Review operator runbooks before
          publishing — kernel rejects mismatched formats.
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">
          Guided defaults prefill delivery mode and evidence for this lane. Buyers verify proof
          against these formats at delivery time.
        </p>
      )}
    </div>
  );
}
