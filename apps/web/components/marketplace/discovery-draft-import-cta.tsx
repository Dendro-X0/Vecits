import Link from "next/link";
import { Upload } from "lucide-react";

import type { QueryParams } from "@/app/explorer/lib";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { discoveryDraftImportNote } from "@/lib/marketplace/discovery-draft-import";
import { buildMarketplaceHref } from "@/lib/marketplace/node";
import { cn } from "@/lib/utils";

type DiscoveryDraftImportCtaProps = {
  searchParams?: QueryParams;
  variant?: "inline" | "banner";
  className?: string;
};

export function DiscoveryDraftImportCta({
  searchParams = {},
  variant = "inline",
  className
}: DiscoveryDraftImportCtaProps) {
  const href = buildMarketplaceHref("/dashboard/builder", searchParams, {
    step: "offer",
    import: "discovery"
  });

  if (variant === "banner") {
    return (
      <div
        className={cn(
          "flex flex-col gap-3 rounded-xl border border-border/70 bg-muted/25 p-4 sm:flex-row sm:items-center sm:justify-between",
          className
        )}
      >
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <Upload className="size-4 text-primary" />
            <p className="text-sm font-medium text-foreground">Have a discovery draft?</p>
            <Badge variant="outline">Draft ≠ live offer</Badge>
          </div>
          <p className="text-sm text-muted-foreground">{discoveryDraftImportNote()}</p>
        </div>
        <Button nativeButton={false} render={<Link href={href} />} variant="outline" size="sm">
          Import in builder
        </Button>
      </div>
    );
  }

  return (
    <Button
      nativeButton={false}
      render={<Link href={href} />}
      variant="outline"
      size="sm"
      className={className}
    >
      <Upload className="size-4" />
      Import discovery draft
    </Button>
  );
}
