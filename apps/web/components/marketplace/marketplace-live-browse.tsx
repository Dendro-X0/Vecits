"use client";

import { useSearchParams } from "next/navigation";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { LoaderCircle } from "lucide-react";

import type { QueryParams } from "@/app/explorer/lib";
import { MarketplaceConnectionRecovery } from "@/components/marketplace/marketplace-connection-recovery";
import { MarketplaceListingsSection } from "@/components/marketplace/marketplace-listings-section";
import { MarketplaceStatusPanel } from "@/components/marketplace/marketplace-status-panel";
import { MarketplaceTrustBarLive } from "@/components/shell/marketplace-trust-bar-live";
import { useDesktopNodeReady } from "@/lib/desktop/use-desktop-node-ready";
import { useDesktopNodeRetry } from "@/lib/desktop/use-desktop-node-retry";
import {
  loadLiveMarketplaceListings,
  prepareListings,
  type MarketplaceListingsLoad
} from "@/lib/marketplace/load";
import { resolveNodeClientBaseUrl } from "@/lib/node-client-base-url";
import {
  humanizeMarketplaceError,
  isMarketplaceConnectionError
} from "@/lib/marketplace/status-message";

type MarketplaceLiveBrowseProps = {
  children?: ReactNode;
  serviceType?: string;
  mutualAidOnly?: boolean;
  activeSection?: "all" | "mutual-aid";
  activeLane?: string;
  toolbarPathname?: string;
  emptyMessage?: string;
};

function MarketplaceLoadingPanel() {
  return (
    <div className="surface-card flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
        <span>Loading live listings from your node…</span>
      </div>
    </div>
  );
}

export function MarketplaceLiveBrowse({
  children,
  serviceType,
  mutualAidOnly = false,
  activeSection,
  activeLane,
  toolbarPathname,
  emptyMessage
}: MarketplaceLiveBrowseProps) {
  const urlSearchParams = useSearchParams();
  const searchKey = urlSearchParams.toString();
  const searchParams = useMemo(() => {
    const query: QueryParams = {};
    urlSearchParams.forEach((value, key) => {
      query[key] = value;
    });
    return query;
  }, [searchKey, urlSearchParams]);
  const nodeReady = useDesktopNodeReady();
  const [loaded, setLoaded] = useState<MarketplaceListingsLoad | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = () => {
    if (!nodeReady) {
      return;
    }
    setLoading(true);
    void loadLiveMarketplaceListings(searchParams, { serviceType, mutualAidOnly }).then(
      (result) => {
        setLoaded(result);
        setLoading(false);
      }
    );
  };

  useEffect(() => {
    if (!nodeReady) {
      setLoading(true);
      return;
    }

    let cancelled = false;
    setLoading(true);
    void loadLiveMarketplaceListings(searchParams, { serviceType, mutualAidOnly }).then(
      (result) => {
        if (!cancelled) {
          setLoaded(result);
          setLoading(false);
        }
      }
    );

    return () => {
      cancelled = true;
    };
  }, [nodeReady, searchKey, searchParams, serviceType, mutualAidOnly]);

  const listings = prepareListings(loaded?.listings ?? [], searchParams);
  const connectionError = loaded
    ? isMarketplaceConnectionError(loaded, listings.length)
    : false;

  useDesktopNodeRetry(connectionError, reload);

  const baseUrl = loaded?.baseUrl ?? resolveNodeClientBaseUrl();

  return (
    <>
      <MarketplaceConnectionRecovery connectionError={connectionError} />
      <MarketplaceTrustBarLive
        nodeLabel={baseUrl}
        asOf={loaded?.asOf}
        mockMode={false}
      />
      {connectionError ? (
        <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <MarketplaceStatusPanel
            variant="connection-error"
            message={humanizeMarketplaceError(loaded?.error)}
          />
        </section>
      ) : (
        <>
          {children}
          <section
            id="listings"
            className="mx-auto max-w-7xl space-y-8 px-4 py-10 sm:px-6 lg:px-8"
          >
            {loading || !loaded ? (
              <MarketplaceLoadingPanel />
            ) : (
              <MarketplaceListingsSection
                searchParams={searchParams}
                listings={listings}
                loaded={loaded}
                activeSection={activeSection}
                activeLane={activeLane}
                toolbarPathname={toolbarPathname}
                emptyMessage={emptyMessage}
              />
            )}
          </section>
        </>
      )}
    </>
  );
}
