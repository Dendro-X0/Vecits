"use client";

import { useRef } from "react";

import type { QueryParams } from "@/app/explorer/lib";
import { OrderActionHub } from "@/components/marketplace/order-action-hub";
import { OrderExchangePanel } from "@/components/marketplace/order-exchange-panel";
import { OrderWorkspaceNotesPanel } from "@/components/workspace/order-workspace-notes-panel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { OfferCompensationSummary } from "@/lib/marketplace/offer-normalize";
import type { NormalizedOrderExchange } from "@/lib/marketplace/order-normalize";

type OrderDetailWorkspaceProps = {
  baseUrl: string;
  exchange: NormalizedOrderExchange;
  searchParams: QueryParams;
  compensation: OfferCompensationSummary | null;
  offerHref: string;
  serviceType?: string | null;
};

export function OrderDetailWorkspace({
  baseUrl,
  exchange,
  searchParams,
  compensation,
  offerHref,
  serviceType
}: OrderDetailWorkspaceProps) {
  const exchangeRef = useRef<HTMLDivElement>(null);

  function scrollToActions() {
    exchangeRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="space-y-6">
      <OrderActionHub
        exchange={exchange}
        compensation={compensation}
        offerHref={offerHref}
        serviceType={serviceType}
        onScrollToActions={scrollToActions}
      />

      <div ref={exchangeRef} id="order-exchange" className="scroll-mt-6">
        <Card>
          <CardHeader>
            <CardTitle>Exchange actions</CardTitle>
          </CardHeader>
          <CardContent>
            <OrderExchangePanel baseUrl={baseUrl} exchange={exchange} searchParams={searchParams} />
          </CardContent>
        </Card>
      </div>

      <OrderWorkspaceNotesPanel exchange={exchange} />
    </div>
  );
}
