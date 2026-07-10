import Link from "next/link";
import { ArrowRight, AlertTriangle } from "lucide-react";

import type { QueryParams } from "@/app/explorer/lib";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  COMMUNITY_LANE_TEMPLATES,
  EXPERIMENTAL_LANE_TEMPLATES,
  type ServiceLaneTemplate
} from "@/lib/marketplace/lane-templates";
import { buildMarketplaceHref } from "@/lib/marketplace/node";
import { cn } from "@/lib/utils";

type MarketplaceLaneCatalogProps = {
  searchParams: QueryParams;
  compact?: boolean;
};

export function MarketplaceLaneCatalog({ searchParams, compact = false }: MarketplaceLaneCatalogProps) {
  if (compact) {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        {COMMUNITY_LANE_TEMPLATES.slice(0, 4).map((template) => (
          <LaneCatalogCard
            key={template.id}
            template={template}
            href={buildMarketplaceHref(`/marketplace/lanes/${template.serviceType}`, searchParams)}
            compact
          />
        ))}
        <Link
          href={buildMarketplaceHref("/marketplace/lanes", searchParams)}
          className="flex items-center justify-center rounded-xl border border-dashed border-border bg-muted/20 px-4 py-6 text-sm font-medium text-primary hover:bg-muted/40"
        >
          View all lanes
          <ArrowRight className="ml-2 size-4" />
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Community lanes</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Seven deployable artifact lanes for everyday marketplace work. Each maps to fixtures,
            drills, and discovery classifier output.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {COMMUNITY_LANE_TEMPLATES.map((template) => (
            <LaneCatalogCard
              key={template.id}
              template={template}
              href={buildMarketplaceHref(`/marketplace/lanes/${template.serviceType}`, searchParams)}
            />
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Specialized lanes</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Strict evidence requirements for compute and offline handoff scenarios. Experimental in
            the guided client — confirm operator runbooks before publishing.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {EXPERIMENTAL_LANE_TEMPLATES.map((template) => (
            <LaneCatalogCard
              key={template.id}
              template={template}
              href={buildMarketplaceHref("/dashboard/builder", searchParams, {
                step: "offer"
              })}
              publishHref
            />
          ))}
        </div>
      </section>

      <div className="flex flex-wrap gap-3">
        <Button
          nativeButton={false}
          render={
            <Link
              href={buildMarketplaceHref("/dashboard/builder", searchParams, {
                step: "offer"
              })}
            />
          }
        >
          Publish an offer
        </Button>
        <Button
          nativeButton={false}
          render={
            <Link
              href={buildMarketplaceHref("/dashboard/builder", searchParams, {
                step: "offer",
                import: "discovery"
              })}
            />
          }
          variant="outline"
        >
          Import discovery draft
        </Button>
      </div>
    </div>
  );
}

function LaneCatalogCard({
  template,
  href,
  compact = false,
  publishHref = false
}: {
  template: ServiceLaneTemplate;
  href: string;
  compact?: boolean;
  publishHref?: boolean;
}) {
  return (
    <Card className={cn(compact ? "border-border/70" : undefined)}>
      <CardHeader className="space-y-2 pb-2">
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className={compact ? "text-base" : "text-lg"}>{template.label}</CardTitle>
          {template.strict ? (
            <Badge variant="outline" className="border-amber-500/40 text-amber-700 dark:text-amber-300">
              <AlertTriangle className="mr-1 size-3" />
              Experimental
            </Badge>
          ) : null}
        </div>
        {!compact ? (
          <p className="text-sm text-muted-foreground">{template.description}</p>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-3">
        {!compact ? (
          <dl className="grid gap-2 text-xs text-muted-foreground">
            <div>
              <dt className="uppercase tracking-[0.12em]">Unit</dt>
              <dd className="mt-0.5 text-foreground">{template.unitDefinition}</dd>
            </div>
            <div>
              <dt className="uppercase tracking-[0.12em]">Delivery</dt>
              <dd className="mt-0.5 font-mono text-foreground">{template.deliveryMode}</dd>
            </div>
            <div>
              <dt className="uppercase tracking-[0.12em]">Evidence</dt>
              <dd className="mt-0.5 font-mono text-foreground">
                {template.allowedEvidenceFormats.join(", ")}
              </dd>
            </div>
          </dl>
        ) : (
          <p className="text-xs text-muted-foreground">{template.unitDefinition}</p>
        )}
        <Link href={href} className="inline-flex text-sm font-medium text-primary hover:underline">
          {publishHref ? "Publish in this lane" : "Browse listings"}
          <ArrowRight className="ml-1 size-4" />
        </Link>
      </CardContent>
    </Card>
  );
}
