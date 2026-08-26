"use client";

import Link from "next/link";
import { Upload } from "lucide-react";

import type { QueryParams } from "@/app/explorer/lib";
import { Button } from "@/components/ui/button";
import { TransportQrPanel } from "@/components/transport/transport-qr-panel";
import { buildMarketplaceHref } from "@/lib/marketplace/node";
import { useAbsoluteClientUrl } from "@/lib/transport/absolute-url";
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
  const shareUrl = useAbsoluteClientUrl(href);

  if (variant === "banner") {
    return (
      <div className={cn("flex flex-wrap items-center gap-x-4 gap-y-3", className)}>
        <div className="min-w-[14rem] flex-1 basis-[16rem] space-y-1 text-left">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground">
              <Upload className="size-3.5 text-primary" aria-hidden="true" />
              Have a discovery draft?
            </span>
            <span className="text-xs text-muted-foreground">Draft ≠ live offer</span>
          </div>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Import an unsigned preview into the builder. Signing and kernel ingest make it live.
          </p>
        </div>

        <Button nativeButton={false} render={<Link href={href} />} size="sm">
          Import in builder
        </Button>
        {shareUrl ? (
          <TransportQrPanel
            value={shareUrl}
            title="Share import link"
            description="Opens the offer builder with discovery import on another device."
            mode="url"
            chrome="plain"
            downloadFilename="vectis-discovery-import-qr.svg"
          />
        ) : null}
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <Button nativeButton={false} render={<Link href={href} />} variant="outline" size="sm">
        <Upload className="size-4" />
        Import discovery draft
      </Button>
      {shareUrl ? (
        <TransportQrPanel
          value={shareUrl}
          title="Share import link"
          description="Opens offer builder with discovery import on another device."
          mode="url"
          downloadFilename="vectis-discovery-import-qr.svg"
        />
      ) : null}
    </div>
  );
}
