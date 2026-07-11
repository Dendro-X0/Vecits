import Link from "next/link";
import { NodeClient } from "@new-start/sdk-ts";
import { ArrowLeft, BadgeCheck, Coins, UserRound } from "lucide-react";

import type { QueryParams } from "@/app/explorer/lib";
import { getNodeBaseUrl, getOptionalParam, toErrorMessage } from "@/app/explorer/lib";
import { KernelTruthBanner } from "@/components/marketplace/kernel-truth-banner";
import { OrderDetailWorkspace } from "@/components/marketplace/order-detail-workspace";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { normalizeOrderExchange } from "@/lib/marketplace/order-normalize";
import { readOfferCompensationSummary } from "@/lib/marketplace/offer-normalize";
import { buildMarketplaceHref } from "@/lib/marketplace/node";
import { marketplaceOrderStaticParams } from "@/lib/desktop-static-params";
import { STATIC_QUERY_PARAMS } from "@/lib/static-query-params";
import { truncatePubkey } from "@/lib/utils";

export function generateStaticParams() {
  return marketplaceOrderStaticParams();
}

export const dynamicParams = false;

type OrderDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function OrderDetailPage({ params }: OrderDetailPageProps) {
  const { id } = await params;
  const query = STATIC_QUERY_PARAMS;
  const baseUrl = getNodeBaseUrl(query);
  const asOf = getOptionalParam(query, "as_of");

  let order: Record<string, unknown> | null = null;
  let offer: Record<string, unknown> | null = null;
  let milestones: Array<{ id: string; data: Record<string, unknown> | null; error?: string }> =
    [];
  let error: string | null = null;
  let replayAsOf: string | undefined;

  try {
    const client = new NodeClient({ baseUrl });
    const view = await client.getOrder(id, asOf);
    order = (view.data as Record<string, unknown> | null) ?? null;
    replayAsOf = view.as_of;

    if (!order) {
      error = "Order not found on this node at the requested replay point.";
    } else {
      const milestoneIds = Array.isArray(order.milestone_ids)
        ? (order.milestone_ids as string[])
        : Array.isArray(order.milestoneIds)
          ? (order.milestoneIds as string[])
          : [];

      milestones = await Promise.all(
        milestoneIds.map(async (milestoneId) => {
          try {
            const milestoneView = await client.getMilestone(id, milestoneId, asOf);
            return {
              id: milestoneId,
              data: (milestoneView.data as Record<string, unknown> | null) ?? null
            };
          } catch (caught) {
            return {
              id: milestoneId,
              data: null,
              error: toErrorMessage(caught)
            };
          }
        })
      );

      try {
        const offerView = await client.getOffer(offerIdFromOrder(order), asOf);
        offer = (offerView.data as Record<string, unknown> | null) ?? null;
      } catch {
        offer = null;
      }
    }
  } catch (caught) {
    error = toErrorMessage(caught);
  }

  const offerId =
    (order?.offer_id as string | undefined) ?? (order?.offerId as string | undefined) ?? "unknown";
  const provider =
    (order?.provider_pub_key as string | undefined) ??
    (order?.providerPubKey as string | undefined) ??
    "unknown";
  const buyer =
    (order?.buyer_pub_key as string | undefined) ??
    (order?.buyerPubKey as string | undefined) ??
    "unknown";
  const status = (order?.status as string | undefined) ?? "unknown";
  const expiresAt =
    (order?.order_expires_at as string | undefined) ??
    (order?.orderExpiresAt as string | undefined);

  const exchange = order ? normalizeOrderExchange(id, order, milestones) : null;
  const backHref = buildMarketplaceHref(`/marketplace/offers/${offerId}`, query);
  const compensation = readOfferCompensationSummary(offer);
  const serviceType =
    (offer?.service_type as string | undefined) ??
    (offer?.serviceType as string | undefined) ??
    null;

  return (
    <section className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      <Link
        href={backHref}
        className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground transition hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to offer
      </Link>

      <div className="mb-6 space-y-4">
        <KernelTruthBanner variant="banner" />
        {error ? (
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm">
            {error}
          </div>
        ) : null}
      </div>

      <div className="space-y-6">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="lane">Order</Badge>
            <Badge variant={status === "closed" ? "success" : "default"}>{status}</Badge>
          </div>
          <h1 className="mt-4 font-mono text-2xl font-semibold tracking-tight sm:text-3xl">{id}</h1>
          {replayAsOf ? (
            <p className="mt-2 text-sm text-muted-foreground">Kernel as_of {replayAsOf}</p>
          ) : null}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Parties</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Row icon={UserRound} label="Buyer" value={truncatePubkey(buyer, 10, 10)} />
            <Row icon={UserRound} label="Provider" value={truncatePubkey(provider, 10, 10)} />
            <Row icon={BadgeCheck} label="Offer" value={offerId} />
            {expiresAt ? <Row icon={Coins} label="Expires" value={expiresAt} /> : null}
          </CardContent>
        </Card>

        {exchange ? (
          <OrderDetailWorkspace
            baseUrl={baseUrl}
            exchange={exchange}
            searchParams={query}
            compensation={compensation}
            offerHref={backHref}
            serviceType={serviceType}
          />
        ) : null}
      </div>
    </section>
  );
}

function offerIdFromOrder(order: Record<string, unknown>): string {
  return (
    (order.offer_id as string | undefined) ??
    (order.offerId as string | undefined) ??
    "unknown"
  );
}

function Row({
  icon: Icon,
  label,
  value
}: {
  icon: typeof UserRound;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
      <div>
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="mt-1 font-mono text-foreground">{value}</p>
      </div>
    </div>
  );
}
