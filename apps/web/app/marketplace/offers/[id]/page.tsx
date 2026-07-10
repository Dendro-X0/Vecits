import Link from "next/link";
import type { ComponentType } from "react";
import { NodeClient } from "@new-start/sdk-ts";
import {
  ArrowLeft,
  BadgeCheck,
  CalendarClock,
  Coins,
  FileCode2,
  Shield
} from "lucide-react";

import type { QueryParams } from "@/app/explorer/lib";
import { getNodeBaseUrl, getOptionalParam, toErrorMessage } from "@/app/explorer/lib";
import { KernelTruthBanner } from "@/components/marketplace/kernel-truth-banner";
import { ProviderTrustSignalsCard } from "@/components/marketplace/provider-trust-signals";
import { StartExchangePanel } from "@/components/marketplace/start-exchange-panel";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { normalizeOfferTerms } from "@/lib/marketplace/offer-normalize";
import { SHOWCASE_LISTINGS } from "@/lib/marketplace/listings";
import { buildMarketplaceHref } from "@/lib/marketplace/node";
import {
  loadProviderTrustSignals,
  type ProviderTrustSignals
} from "@/lib/marketplace/trust-signals";
import { marketplaceOfferStaticParams } from "@/lib/desktop-static-params";
import { STATIC_QUERY_PARAMS } from "@/lib/static-query-params";
import { formatCredits, formatServiceType } from "@/lib/utils";

export function generateStaticParams() {
  return marketplaceOfferStaticParams();
}

export const dynamicParams = false;
const MOCK_MODE_ENABLED = process.env.NEXT_PUBLIC_VECTIS_MOCK_MODE === "1";

type OfferDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function OfferDetailPage({ params }: OfferDetailPageProps) {
  const { id } = await params;
  const query = STATIC_QUERY_PARAMS;
  const baseUrl = getNodeBaseUrl(query);
  const asOf = getOptionalParam(query, "as_of");
  const showcase = MOCK_MODE_ENABLED
    ? SHOWCASE_LISTINGS.find((listing) => listing.offer_id === id)
    : undefined;

  let offer: Record<string, unknown> | null = null;
  let error: string | null = null;
  let replayAsOf: string | undefined;
  let providerTrustSignals: ProviderTrustSignals | null = null;

  if (!showcase) {
    try {
      const client = new NodeClient({ baseUrl });
      const view = await client.getOffer(id, asOf);
      offer = (view.data as Record<string, unknown> | null) ?? null;
      replayAsOf = view.as_of;
      if (!offer) {
        error = "Offer not found on this node at the requested replay point.";
      }
    } catch (caught) {
      error = toErrorMessage(caught);
    }
  }

  const listing = showcase ?? null;
  const serviceType =
    (offer?.serviceType as string | undefined) ??
    (offer?.service_type as string | undefined) ??
    listing?.service_type ??
    "service";
  const price =
    Number(offer?.pricePerUnitCredits ?? offer?.price_per_unit_credits ?? listing?.price_per_unit_credits ?? 0);
  const provider =
    (offer?.providerPubKey as string | undefined) ??
    (offer?.provider_pub_key as string | undefined) ??
    listing?.provider_pub_key ??
    "unknown";
  const unitDefinition =
    (offer?.unitDefinition as string | undefined) ??
    (offer?.unit_definition as string | undefined) ??
    listing?.subtitle ??
    "In-protocol service unit";
  const deliveryMode =
    (offer?.deliveryMode as string | undefined) ??
    (offer?.delivery_mode as string | undefined) ??
    listing?.deliveryMode ??
    "artifact";
  const expiresAt =
    (offer?.offerExpiresAt as string | undefined) ??
    (offer?.offer_expires_at as string | undefined) ??
    listing?.offer_expires_at;
  const evidenceFormats = Array.isArray(offer?.allowedEvidenceFormats)
    ? (offer?.allowedEvidenceFormats as string[])
    : ["artifactHash"];

  const backHref = buildMarketplaceHref("/marketplace", query);
  const exchangeTerms = showcase ? null : normalizeOfferTerms(id, offer);

  if (!showcase && !error) {
    providerTrustSignals = await loadProviderTrustSignals(baseUrl, provider, serviceType, asOf);
  }

  return (
    <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <Link
        href={backHref}
        className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground transition hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to marketplace
      </Link>

      <div className="mb-6 space-y-4">
        <KernelTruthBanner variant="offProtocol" />
        {showcase ? (
          <div className="rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-foreground">
            Mock mode enabled — showing showcase listing preview.
          </div>
        ) : null}
        {error ? (
          <div className="rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-100">
            {error}
          </div>
        ) : null}
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <div className="space-y-6">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="lane">{formatServiceType(serviceType)}</Badge>
              {showcase ? <Badge variant="muted">Showcase</Badge> : <Badge variant="success">Kernel</Badge>}
            </div>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
              {listing?.title ?? `${formatServiceType(serviceType)} — ${id}`}
            </h1>
            <p className="mt-3 max-w-2xl text-muted-foreground">{unitDefinition}</p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Scope & delivery</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <DetailRow icon={FileCode2} label="Delivery mode" value={deliveryMode} />
              <DetailRow
                icon={Shield}
                label="Evidence formats"
                value={evidenceFormats.join(", ")}
              />
              {expiresAt ? (
                <DetailRow icon={CalendarClock} label="Offer expires" value={expiresAt} />
              ) : null}
              {replayAsOf ? (
                <DetailRow icon={BadgeCheck} label="Kernel as_of" value={replayAsOf} />
              ) : null}
            </CardContent>
          </Card>

          <ProviderTrustSignalsCard
            providerPubKey={provider}
            serviceType={serviceType}
            signals={providerTrustSignals}
            showcase={Boolean(showcase)}
          />
        </div>

        <div className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <Card>
            <CardHeader>
              <CardTitle>Exchange terms</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="surface-panel rounded-xl p-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Coins className="h-4 w-4" />
                  Price
                </div>
                <p className="mt-2 text-3xl font-semibold">{formatCredits(price)}</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Escrow-funded milestones settle in-protocol. Credits are not fiat money.
                </p>
              </div>

              {listing ? (
                <div className="rounded-xl border border-sky-400/20 bg-sky-400/10 p-4 text-sm">
                  <p className="font-medium text-foreground">Alignment signal</p>
                  <p className="mt-1 text-muted-foreground">
                    Discovery fit score {listing.discovery_score} · lane score {listing.lane_score}{" "}
                    — informational kernel replay ranking, not a promoted placement.
                  </p>
                </div>
              ) : null}
            </CardContent>
            <StartExchangePanel
              offerId={id}
              baseUrl={baseUrl}
              terms={exchangeTerms}
              isShowcase={Boolean(showcase)}
              searchParams={query}
            />
          </Card>
        </div>
      </div>
    </section>
  );
}

function DetailRow({
  icon: Icon,
  label,
  value
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-sky-300" />
      <div>
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="mt-1 text-foreground">{value}</p>
      </div>
    </div>
  );
}
