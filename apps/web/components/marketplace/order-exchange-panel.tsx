"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { NodeApiError, NodeClient, signUnsignedEnvelope, type IngestResult } from "@new-start/sdk-ts";
import { useEffect, useState } from "react";

import type { QueryParams } from "@/app/explorer/lib";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MobilePinnedNodeNotice } from "@/components/mobile/mobile-pinned-node-notice";
import { loadActiveSession } from "@/lib/auth/session";
import { HALO_ACCEPTED_BY_LOCAL } from "@/lib/halo/honesty-copy";
import { isLocalOperatorNodeUrl } from "@/lib/halo/local-operator-node";
import {
  resolveNodeClientBaseUrl,
  resolveMobilePinnedNodeError
} from "@/lib/node-client-base-url";
import {
  buildEscrowSpendUnsigned,
  generateEscrowNonce,
  milestoneNeedsFunding
} from "@/lib/marketplace/escrow-spend";
import { buildMarketplaceHref } from "@/lib/marketplace/node";
import type { NormalizedMilestone, NormalizedOrderExchange } from "@/lib/marketplace/order-normalize";
import { resolvePolicyVersion } from "@/lib/marketplace/policy";
import {
  buildServiceAcceptUnsigned,
  milestoneReadyForAccept
} from "@/lib/marketplace/service-accept";
import {
  buildServiceDeliveryUnsigned,
  milestoneReadyForDelivery
} from "@/lib/marketplace/service-delivery";
import { formatCredits, truncatePubkey } from "@/lib/utils";

type OrderExchangePanelProps = {
  baseUrl: string;
  exchange: NormalizedOrderExchange | null;
  searchParams: QueryParams;
};

type BusyAction = {
  milestoneId: string;
  kind: "fund" | "deliver" | "accept";
};

export function OrderExchangePanel({ baseUrl, exchange, searchParams }: OrderExchangePanelProps) {
  const router = useRouter();
  const [publicKeyHex, setPublicKeyHex] = useState<string | null>(null);
  const [buyerBalance, setBuyerBalance] = useState<number | null>(null);
  const [busy, setBusy] = useState<BusyAction | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const mobilePinnedNodeError = resolveMobilePinnedNodeError();

  useEffect(() => {
    const session = loadActiveSession();
    setPublicKeyHex(session?.publicKeyHex ?? null);
  }, []);

  useEffect(() => {
    if (!exchange || !publicKeyHex || publicKeyHex !== exchange.buyerPubKey) {
      setBuyerBalance(null);
      return;
    }

    if (mobilePinnedNodeError) {
      setBuyerBalance(null);
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const client = new NodeClient({ baseUrl: resolveNodeClientBaseUrl(baseUrl) });
        const balanceView = await client.getBalance(publicKeyHex);
        const data = balanceView.data ?? {};
        const available = Number(
          data.effective_balance ?? data.effectiveBalance ?? data.available_credits ?? 0
        );
        if (!cancelled) {
          setBuyerBalance(Number.isFinite(available) ? available : null);
        }
      } catch {
        if (!cancelled) {
          setBuyerBalance(null);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [baseUrl, exchange, publicKeyHex]);

  if (!exchange) {
    return (
      <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm">
        Order is missing kernel reference data needed for exchange actions.
      </p>
    );
  }

  const isBuyer = publicKeyHex === exchange.buyerPubKey;
  const isProvider = publicKeyHex === exchange.providerPubKey;
  const order = exchange;
  const explorerHref = buildMarketplaceHref("/explorer/orders", searchParams, {
    id: order.orderId
  });

  async function submitSignedEvent(
    milestoneId: string,
    kind: BusyAction["kind"],
    build: (policyVersion: string | undefined) => Parameters<typeof signUnsignedEnvelope>[0]
  ) {
    const session = loadActiveSession();
    if (!session) {
      return;
    }

    if (mobilePinnedNodeError) {
      setErrorMessage(mobilePinnedNodeError);
      return;
    }

    setBusy({ milestoneId, kind });
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const client = new NodeClient({ baseUrl: resolveNodeClientBaseUrl(baseUrl) });
      const policyVersion = await resolvePolicyVersion(client);
      const unsigned = build(policyVersion);
      const signed = await signUnsignedEnvelope(unsigned, session.secretKeyHex);
      const result: IngestResult = await client.submitSignedEnvelope(signed);

      if (result.accepted) {
        const labels = {
          fund: "Escrow funded",
          deliver: "Delivery submitted",
          accept: "Milestone accepted"
        };
        const base = resolveNodeClientBaseUrl(baseUrl);
        const localNote = isLocalOperatorNodeUrl(base) ? ` ${HALO_ACCEPTED_BY_LOCAL}.` : "";
        setSuccessMessage(`${labels[kind]} for ${milestoneId}.${localNote}`);
        router.refresh();
      } else {
        setErrorMessage(result.message ?? `The node rejected this ${kind} event.`);
      }
    } catch (error) {
      if (error instanceof NodeApiError) {
        setErrorMessage(error.message);
      } else if (error instanceof Error) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage("Exchange action failed.");
      }
    } finally {
      setBusy(null);
    }
  }

  function fundMilestone(milestone: NormalizedMilestone) {
    const session = loadActiveSession();
    if (!session || session.publicKeyHex !== order.buyerPubKey) {
      return;
    }

    const remaining = Math.max(0, milestone.amountCredits - milestone.fundedAmount);
    if (remaining <= 0) {
      return;
    }

    void submitSignedEvent(milestone.id, "fund", (policyVersion) =>
      buildEscrowSpendUnsigned({
        authorPubKey: session.publicKeyHex,
        spenderPubKey: session.publicKeyHex,
        orderId: order.orderId,
        milestoneId: milestone.id,
        amount: remaining,
        nonce: generateEscrowNonce(order.orderId, milestone.id),
        orderReferenceEventId: order.orderReferenceEventId,
        policyVersion
      })
    );
  }

  function deliverMilestone(milestone: NormalizedMilestone, artifactHash: string) {
    const session = loadActiveSession();
    if (!session || session.publicKeyHex !== order.providerPubKey) {
      return;
    }

    void submitSignedEvent(milestone.id, "deliver", (policyVersion) =>
      buildServiceDeliveryUnsigned({
        authorPubKey: session.publicKeyHex,
        orderId: order.orderId,
        milestoneId: milestone.id,
        evidenceFormat: milestone.evidenceFormat,
        artifactHash,
        orderReferenceEventId: order.orderReferenceEventId,
        policyVersion
      })
    );
  }

  function acceptMilestone(milestone: NormalizedMilestone) {
    const session = loadActiveSession();
    if (!session || session.publicKeyHex !== order.buyerPubKey || !milestone.deliveryEventId) {
      return;
    }

    void submitSignedEvent(milestone.id, "accept", (policyVersion) =>
      buildServiceAcceptUnsigned({
        authorPubKey: session.publicKeyHex,
        orderId: order.orderId,
        milestoneId: milestone.id,
        deliveryReferenceEventId: milestone.deliveryEventId!,
        policyVersion
      })
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
        {publicKeyHex ? (
          <p>
            Signed in as{" "}
            <span className="font-mono text-foreground">{truncatePubkey(publicKeyHex, 8, 8)}</span>
            {isBuyer ? " · buyer" : null}
            {isProvider ? " · provider" : null}
            {!isBuyer && !isProvider ? " · read-only" : null}
          </p>
        ) : (
          <p>
            <Link href="/sign-in" className="text-primary underline underline-offset-4">
              Sign in
            </Link>{" "}
            to continue this exchange.
          </p>
        )}
        {isBuyer && buyerBalance !== null ? (
          <p className="mt-1">Available balance: {formatCredits(buyerBalance)}</p>
        ) : null}
      </div>

      <MobilePinnedNodeNotice />

      {errorMessage ? (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm">
          {errorMessage}
        </p>
      ) : null}
      {successMessage ? (
        <p className="rounded-lg border border-primary/30 bg-primary/10 px-4 py-3 text-sm">
          {successMessage}
        </p>
      ) : null}

      <div className="space-y-4">
        {order.milestones.map((milestone) => (
          <MilestoneExchangeCard
            key={milestone.id}
            milestone={milestone}
            isBuyer={isBuyer}
            isProvider={isProvider}
            busy={busy}
            onFund={() => fundMilestone(milestone)}
            onDeliver={(artifactHash) => deliverMilestone(milestone, artifactHash)}
            onAccept={() => acceptMilestone(milestone)}
          />
        ))}
      </div>

      <div className="flex flex-wrap gap-3">
        <Link
          href={explorerHref}
          className="inline-flex h-10 items-center justify-center rounded-lg border border-border bg-muted px-4 text-sm font-medium transition hover:bg-accent"
        >
          Open in explorer
        </Link>
        <Link
          href="/dashboard/settings?advanced=1"
          className="inline-flex h-10 items-center justify-center rounded-lg border border-border px-4 text-sm font-medium transition hover:bg-accent"
        >
          Advanced tools
        </Link>
      </div>
    </div>
  );
}

function MilestoneExchangeCard({
  milestone,
  isBuyer,
  isProvider,
  busy,
  onFund,
  onDeliver,
  onAccept
}: {
  milestone: NormalizedMilestone;
  isBuyer: boolean;
  isProvider: boolean;
  busy: BusyAction | null;
  onFund: () => void;
  onDeliver: (artifactHash: string) => void;
  onAccept: () => void;
}) {
  const [artifactHash, setArtifactHash] = useState("");
  const remaining = Math.max(0, milestone.amountCredits - milestone.fundedAmount);
  const isBusy = busy?.milestoneId === milestone.id;

  return (
    <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-medium">{milestone.id}</p>
        <Badge variant="outline">{milestone.status}</Badge>
      </div>
      <p className="mt-2 text-muted-foreground">
        {formatCredits(milestone.amountCredits)} · funded {formatCredits(milestone.fundedAmount)}
        {remaining > 0 ? ` · ${formatCredits(remaining)} remaining` : null}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        Evidence format: {milestone.evidenceFormat}
      </p>

      {isBuyer && milestoneNeedsFunding(milestone) ? (
        <Button
          type="button"
          className="mt-3 h-9"
          disabled={isBusy}
          onClick={onFund}
        >
          {isBusy && busy?.kind === "fund"
            ? "Funding escrow…"
            : `Fund escrow (${formatCredits(remaining)})`}
        </Button>
      ) : null}

      {isProvider && milestoneReadyForDelivery(milestone.status) ? (
        <div className="mt-3 space-y-2">
          <Label htmlFor={`artifact-${milestone.id}`}>Artifact hash</Label>
          <Input
            id={`artifact-${milestone.id}`}
            value={artifactHash}
            onChange={(event) => setArtifactHash(event.target.value)}
            placeholder="SHA-256 or content hash of delivered work"
          />
          <Button
            type="button"
            className="h-9"
            disabled={isBusy || !artifactHash.trim()}
            onClick={() => onDeliver(artifactHash.trim())}
          >
            {isBusy && busy?.kind === "deliver" ? "Submitting delivery…" : "Submit delivery"}
          </Button>
        </div>
      ) : null}

      {isBuyer && milestoneReadyForAccept(milestone.status) ? (
        <Button
          type="button"
          className="mt-3 h-9"
          disabled={isBusy || !milestone.deliveryEventId}
          onClick={onAccept}
        >
          {isBusy && busy?.kind === "accept" ? "Accepting…" : "Accept delivery"}
        </Button>
      ) : null}

      {milestone.status === "Accepted" ? (
        <p className="mt-2 text-xs text-primary">Milestone accepted — exchange step complete.</p>
      ) : null}
      {milestone.status === "Funded" && !isProvider ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Escrow funded — waiting for provider delivery.
        </p>
      ) : null}
      {milestone.status === "Delivered" && !isBuyer ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Delivery submitted — waiting for buyer acceptance.
        </p>
      ) : null}
    </div>
  );
}
