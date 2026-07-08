"use client";

import type { QueryParams } from "@/app/explorer/lib";
import { NodeApiError, NodeClient, signUnsignedEnvelope, type IngestResult } from "@new-start/sdk-ts";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { MobilePinnedNodeNotice } from "@/components/mobile/mobile-pinned-node-notice";
import { loadActiveSession } from "@/lib/auth/session";
import {
  resolveNodeClientBaseUrl,
  resolveMobilePinnedNodeError
} from "@/lib/node-client-base-url";
import type { NormalizedOfferTerms } from "@/lib/marketplace/offer-normalize";
import { buildMarketplaceHref } from "@/lib/marketplace/node";
import { resolvePolicyVersion } from "@/lib/marketplace/policy";
import {
  buildServiceOrderUnsigned,
  defaultOrderExpiresAt,
  generateOrderId
} from "@/lib/marketplace/service-order";
import { formatCredits, truncatePubkey } from "@/lib/utils";

type StartExchangePanelProps = {
  offerId: string;
  baseUrl: string;
  terms: NormalizedOfferTerms | null;
  isShowcase: boolean;
  searchParams: QueryParams;
};

export function StartExchangePanel({
  offerId,
  baseUrl,
  terms,
  isShowcase,
  searchParams
}: StartExchangePanelProps) {
  const router = useRouter();
  const [publicKeyHex, setPublicKeyHex] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [ingestResult, setIngestResult] = useState<IngestResult | null>(null);
  const mobilePinnedNodeError = resolveMobilePinnedNodeError();

  useEffect(() => {
    setPublicKeyHex(loadActiveSession()?.publicKeyHex ?? null);
  }, []);

  const signInHref = useMemo(() => {
    const next = buildMarketplaceHref(`/marketplace/offers/${offerId}`, searchParams);
    return `/sign-in?next=${encodeURIComponent(next)}`;
  }, [offerId, searchParams]);

  const isOwnOffer =
    Boolean(publicKeyHex && terms?.providerPubKey) && publicKeyHex === terms?.providerPubKey;
  const canSubmit =
    Boolean(publicKeyHex && terms && !isShowcase && !isOwnOffer && terms.status !== "expired");

  async function handleStartExchange() {
    if (!canSubmit || !terms) {
      return;
    }

    if (mobilePinnedNodeError) {
      setErrorMessage(mobilePinnedNodeError);
      return;
    }

    const session = loadActiveSession();
    if (!session) {
      router.push(signInHref);
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    setIngestResult(null);

    try {
      const client = new NodeClient({ baseUrl: resolveNodeClientBaseUrl(baseUrl) });
      const policyVersion = await resolvePolicyVersion(client);

      const orderId = generateOrderId(terms.offerId);
      const unsigned = buildServiceOrderUnsigned({
        authorPubKey: session.publicKeyHex,
        buyerPubKey: session.publicKeyHex,
        orderId,
        offerId: terms.offerId,
        providerPubKey: terms.providerPubKey,
        milestoneAmountCredits: terms.pricePerUnitCredits,
        milestoneEvidenceFormat: terms.defaultEvidenceFormat,
        offerReferenceEventId: terms.offerReferenceEventId,
        orderExpiresAt: defaultOrderExpiresAt(terms.offerExpiresAt),
        policyVersion
      });

      const signed = await signUnsignedEnvelope(unsigned, session.secretKeyHex);
      const result = await client.submitSignedEnvelope(signed);
      setIngestResult(result);

      if (result.accepted) {
        const orderHref = buildMarketplaceHref(`/marketplace/orders/${orderId}`, searchParams);
        router.push(orderHref);
      } else {
        setErrorMessage(result.message ?? "The node rejected this ServiceOrder event.");
      }
    } catch (error) {
      if (error instanceof NodeApiError) {
        setErrorMessage(error.message);
      } else if (error instanceof Error) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage("Failed to submit ServiceOrder to the node.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!publicKeyHex) {
    return (
      <div className="flex flex-col gap-3 p-6 pt-0">
        <Link
          href={signInHref}
          className="inline-flex h-10 w-full items-center justify-center rounded-lg bg-primary text-sm font-medium text-primary-foreground transition hover:opacity-90"
        >
          Sign in to start exchange
        </Link>
        <ExplorerLink offerId={offerId} searchParams={searchParams} />
      </div>
    );
  }

  if (isShowcase) {
    return (
      <div className="flex flex-col gap-3 p-6 pt-0">
        <p className="rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
          Showcase listings are preview-only. Connect a live node with kernel-backed offers to place
          an order.
        </p>
        <ExplorerLink offerId={offerId} searchParams={searchParams} />
      </div>
    );
  }

  if (!terms) {
    return (
      <div className="flex flex-col gap-3 p-6 pt-0">
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-foreground">
          This offer is missing kernel reference data needed to create a ServiceOrder.
        </p>
        <ExplorerLink offerId={offerId} searchParams={searchParams} />
      </div>
    );
  }

  if (isOwnOffer) {
    return (
      <div className="flex flex-col gap-3 p-6 pt-0">
        <p className="rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
          You are the provider for this offer. Buyers place orders against your listing.
        </p>
        <ExplorerLink offerId={offerId} searchParams={searchParams} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 p-6 pt-0">
      <div className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
        <p>
          Buyer: <span className="font-mono text-foreground">{truncatePubkey(publicKeyHex, 8, 8)}</span>
        </p>
        <p className="mt-1">
          Escrow milestone: {formatCredits(terms.pricePerUnitCredits)} ·{" "}
          {terms.defaultEvidenceFormat}
        </p>
      </div>

      <MobilePinnedNodeNotice />

      {errorMessage ? (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm">
          {errorMessage}
        </p>
      ) : null}

      {ingestResult && !ingestResult.accepted ? (
        <p className="text-xs text-muted-foreground">
          Code: {ingestResult.code ?? "unknown"} · Event id: {ingestResult.event_id ?? "none"}
        </p>
      ) : null}

      <Button
        type="button"
        className="h-10 w-full"
        disabled={!canSubmit || Boolean(mobilePinnedNodeError) || isSubmitting}
        onClick={() => void handleStartExchange()}
      >
        {isSubmitting ? "Submitting order…" : "Start exchange"}
      </Button>

      <p className="text-xs text-muted-foreground">
        Submits a signed <span className="font-mono">ServiceOrder</span> to the node. Fund escrow
        from the order page or operator tools next.
      </p>

      <ExplorerLink offerId={offerId} searchParams={searchParams} />
    </div>
  );
}

function ExplorerLink({
  offerId,
  searchParams
}: {
  offerId: string;
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const href = buildMarketplaceHref(`/explorer/offers`, searchParams, { id: offerId });
  return (
    <Link
      href={href}
      className="inline-flex h-10 w-full items-center justify-center rounded-lg border border-border bg-muted text-sm font-medium text-foreground transition hover:bg-accent"
    >
      Open in explorer
    </Link>
  );
}
