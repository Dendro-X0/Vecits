"use client";

import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Circle,
  Copy,
  RefreshCw,
  Shield,
  Wallet
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { TrustPhaseLabel } from "@/components/dashboard/trust-phase-label";
import { TransportQrPanel } from "@/components/transport/transport-qr-panel";
import { TransportBundleSharePanel } from "@/components/transport/transport-bundle-share-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buildBuilderHref } from "@/lib/dashboard/builder-handoff";
import {
  buildSponsorRequestMessage,
  loadTrustBootstrapSnapshot,
  parseSponsorPubKeys,
  type TrustBootstrapSnapshot
} from "@/lib/dashboard/trust-bootstrap";
import { buildVouchRequestBundle } from "@/lib/transport/bundle";
import { resolveNodeConnectionInfo } from "@/lib/node-client-base-url";
import { truncatePubkey } from "@/lib/utils";
import { cn } from "@/lib/utils";

const SPONSOR_STORAGE_KEY = "new-start.trust-bootstrap.sponsors";

const CREDITS_PATH_STEPS = [
  {
    id: "claim",
    label: "File a contribution claim",
    detail: "Describe verifiable work you did for the network (maintenance, docs, ops).",
    href: "/help/credits-path#claim"
  },
  {
    id: "attest",
    label: "Collect attestations",
    detail: "Independent sponsors approve the claim on-node — no admin mint button.",
    href: "/help/credits-path#attest"
  },
  {
    id: "mint",
    label: "Mint credits",
    detail: "After enough approvals, mint non-transferable credits tied to the claim.",
    href: "/help/credits-path#mint"
  },
  {
    id: "fund",
    label: "Fund escrow",
    detail: "Spend minted credits on your first marketplace order.",
    href: buildBuilderHref("escrowSpend")
  }
] as const;

type TrustBootstrapPanelProps = {
  publicKeyHex: string;
  compact?: boolean;
};

export function TrustBootstrapPanel({ publicKeyHex, compact = false }: TrustBootstrapPanelProps) {
  const [snapshot, setSnapshot] = useState<TrustBootstrapSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [sponsorInput, setSponsorInput] = useState("");
  const [copyMessage, setCopyMessage] = useState<string | null>(null);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(SPONSOR_STORAGE_KEY);
      if (stored) {
        setSponsorInput(stored);
      }
    } catch {
      // ignore storage read failures
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(SPONSOR_STORAGE_KEY, sponsorInput);
    } catch {
      // ignore storage write failures
    }
  }, [sponsorInput]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void loadTrustBootstrapSnapshot(publicKeyHex).then((next) => {
      if (!cancelled) {
        setSnapshot(next);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [publicKeyHex]);

  const sponsorParse = useMemo(() => parseSponsorPubKeys(sponsorInput), [sponsorInput]);
  const requestedSponsors = useMemo(
    () => sponsorParse.valid.filter((key) => key !== publicKeyHex.toLowerCase()),
    [publicKeyHex, sponsorParse.valid]
  );

  const activeVoucherSet = useMemo(() => {
    if (snapshot?.kind !== "live") {
      return new Set<string>();
    }
    return new Set(snapshot.provider.activeIncomingVouches.map((vouch) => vouch.voucherPubKey));
  }, [snapshot]);

  const sponsorsWithVouch = requestedSponsors.filter((sponsor) => activeVoucherSet.has(sponsor));
  const sponsorsMissingVouch = requestedSponsors.filter((sponsor) => !activeVoucherSet.has(sponsor));

  const shareMessage = useMemo(() => {
    if (snapshot?.kind !== "live") {
      return "";
    }
    return buildSponsorRequestMessage({
      identityPubKey: publicKeyHex,
      identityEventId: snapshot.provider.identityEventId,
      sponsorPubKeys: requestedSponsors,
      baseUrl: snapshot.nodeLabel
    });
  }, [publicKeyHex, requestedSponsors, snapshot]);

  const vouchRequestBundle = useMemo(() => {
    if (snapshot?.kind !== "live" || requestedSponsors.length === 0) {
      return null;
    }
    const nodeUrl = resolveNodeConnectionInfo().baseUrl;
    if (!nodeUrl.trim()) {
      return null;
    }
    return buildVouchRequestBundle({
      subjectPubKey: publicKeyHex,
      nodeUrl,
      identityEventId: snapshot.provider.identityEventId,
      displayLabel: undefined
    });
  }, [publicKeyHex, requestedSponsors.length, snapshot]);

  async function handleRefresh() {
    setLoading(true);
    const next = await loadTrustBootstrapSnapshot(publicKeyHex);
    setSnapshot(next);
    setLoading(false);
  }

  async function handleCopyRequest() {
    if (!shareMessage.trim()) {
      return;
    }
    try {
      await navigator.clipboard.writeText(shareMessage);
      setCopyMessage("Sponsor request copied.");
      window.setTimeout(() => setCopyMessage(null), 1600);
    } catch {
      setCopyMessage("Could not copy — select and copy manually.");
    }
  }

  if (loading && !snapshot) {
    return (
      <Card className="border-border/70">
        <CardContent className="px-5 py-8 text-sm text-muted-foreground">
          Loading trust bootstrap status from your node…
        </CardContent>
      </Card>
    );
  }

  if (!snapshot || snapshot.kind === "error") {
    return (
      <Card className="border-border/70">
        <CardContent className="space-y-3 px-5 py-6">
          <TrustPhaseLabel />
          <p className="text-sm text-muted-foreground">
            {snapshot?.kind === "error"
              ? snapshot.message
              : "Could not load trust bootstrap status."}
          </p>
          <Button type="button" variant="outline" size="sm" onClick={() => void handleRefresh()}>
            <RefreshCw className="size-4" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  const { provider, buyer } = snapshot;
  const showProviderPanel = !provider.thresholdMet || !compact;
  const showBuyerPanel = buyer.needsCredits || !compact;

  return (
    <div className="space-y-4">
      <Card className="border-border/70 bg-muted/15">
        <CardContent className="flex flex-wrap items-start justify-between gap-4 p-5">
          <div className="space-y-2">
            <TrustPhaseLabel />
            <p className="max-w-2xl text-sm text-muted-foreground">
              This network is in a founding phase. Sponsor-weighted admission lets new providers
              publish offers; milestone escrow and accept events still settle on locked terms — not
              sponsor discretion.
            </p>
            <Link
              href="/help/trust-bootstrap"
              className="inline-flex text-sm text-primary hover:underline"
            >
              Read trust bootstrap guide
              <ArrowRight className="ml-1 size-4" />
            </Link>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => void handleRefresh()}>
            <RefreshCw className={cn("size-4", loading ? "animate-spin" : undefined)} />
            Refresh
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {showProviderPanel ? (
          <Card className={provider.thresholdMet ? "border-border/70" : "border-amber-500/35"}>
            <CardHeader className="pb-2">
              <div className="flex flex-wrap items-center gap-2">
                <Shield className="size-4 text-primary" />
                <CardTitle className="text-base">Provider admission</CardTitle>
                {provider.thresholdMet ? (
                  <Badge variant="success">Eligible to publish</Badge>
                ) : (
                  <Badge variant="outline" className="border-amber-500/40 text-amber-700 dark:text-amber-300">
                    Needs sponsor weight
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2 sm:grid-cols-3">
                <MetricTile
                  label="Vouch weight"
                  value={String(provider.incomingActiveVouchWeight)}
                  hint={`${provider.incomingActiveVouches} active vouch${provider.incomingActiveVouches === 1 ? "" : "es"}`}
                />
                <MetricTile
                  label="Admission threshold"
                  value={String(provider.threshold)}
                  hint="Policy minimum to publish offers"
                />
                <MetricTile
                  label="Identity on-node"
                  value={provider.identityExists ? "Yes" : "No"}
                  hint={
                    provider.identityExists
                      ? truncatePubkey(publicKeyHex, 6, 6)
                      : "Create identity first"
                  }
                />
              </div>

              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">Admission</span> (sponsor vouches) is
                separate from <span className="font-medium text-foreground">settlement</span>{" "}
                (escrow, delivery, accept on each order). Meeting the threshold only unlocks offer
                publish — it does not bypass milestone rules.
              </p>

              {!provider.thresholdMet ? (
                <div className="space-y-3 rounded-xl border border-border/70 bg-muted/20 p-4">
                  <p className="text-sm font-medium text-foreground">Ask sponsors for vouches</p>
                  <label className="block space-y-1.5 text-sm">
                    <span className="text-muted-foreground">Sponsor public keys</span>
                    <textarea
                      value={sponsorInput}
                      onChange={(event) => setSponsorInput(event.target.value)}
                      className="min-h-[5rem] w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                      placeholder="One sponsor pubkey per line or comma-separated"
                    />
                  </label>
                  {sponsorParse.invalid.length > 0 ? (
                    <p className="text-xs text-destructive">
                      Invalid keys skipped: {sponsorParse.invalid.length}
                    </p>
                  ) : null}
                  {requestedSponsors.length > 0 ? (
                    <div className="space-y-2">
                      <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
                        Sponsor progress
                      </p>
                      <ul className="space-y-1.5 text-sm">
                        {requestedSponsors.map((sponsor) => (
                          <li key={sponsor} className="flex items-center gap-2">
                            {activeVoucherSet.has(sponsor) ? (
                              <CheckCircle2 className="size-3.5 shrink-0 text-primary" />
                            ) : (
                              <Circle className="size-3.5 shrink-0 text-muted-foreground" />
                            )}
                            <span className="font-mono text-xs">{truncatePubkey(sponsor, 8, 8)}</span>
                          </li>
                        ))}
                      </ul>
                      <p className="text-xs text-muted-foreground">
                        {sponsorsWithVouch.length} of {requestedSponsors.length} requested sponsors
                        have active vouches
                        {sponsorsMissingVouch.length > 0
                          ? ` · waiting on ${sponsorsMissingVouch.length}`
                          : ""}
                        .
                      </p>
                    </div>
                  ) : null}
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => void handleCopyRequest()}
                      disabled={!shareMessage.trim() || requestedSponsors.length === 0}
                    >
                      <Copy className="size-4" />
                      Copy vouch request
                    </Button>
                    {!provider.identityExists ? (
                      <Button
                        nativeButton={false}
                        render={<Link href="/dashboard/settings?advanced=1" />}
                        variant="outline"
                        size="sm"
                      >
                        Create identity (advanced)
                      </Button>
                    ) : null}
                  </div>
                  {copyMessage ? (
                    <p className="text-xs text-primary">{copyMessage}</p>
                  ) : null}
                  {shareMessage.trim() && requestedSponsors.length > 0 ? (
                    <TransportQrPanel
                      value={shareMessage}
                      title="Share vouch request (text)"
                      description="Sponsors can scan to copy the same request text you would paste manually."
                      mode="text"
                      downloadFilename="vectis-vouch-request-qr.svg"
                    />
                  ) : null}
                  {vouchRequestBundle ? (
                    <TransportBundleSharePanel
                      bundle={vouchRequestBundle}
                      title="Share vouch request (bundle)"
                      description="Structured Tier 1 bundle — sponsors import on /dashboard/import to review before signing."
                      downloadFilename="vectis-vouch-request-bundle-qr.svg"
                    />
                  ) : null}
                </div>
              ) : null}
            </CardContent>
          </Card>
        ) : null}

        {showBuyerPanel ? (
          <Card className={buyer.needsCredits ? "border-amber-500/35" : "border-border/70"}>
            <CardHeader className="pb-2">
              <div className="flex flex-wrap items-center gap-2">
                <Wallet className="size-4 text-primary" />
                <CardTitle className="text-base">Buyer credits path</CardTitle>
                {buyer.needsCredits ? (
                  <Badge variant="outline" className="border-amber-500/40 text-amber-700 dark:text-amber-300">
                    No spendable credits
                  </Badge>
                ) : (
                  <Badge variant="success">
                    {buyer.effectiveBalance} credit{buyer.effectiveBalance === 1 ? "" : "s"} available
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Credits are in-protocol coordination units — not fiat money and not withdrawable.
                During the founding phase, buyers typically earn first credits through contribution
                claims, then spend them on escrow.
              </p>

              <ol className="space-y-3">
                {CREDITS_PATH_STEPS.map((step, index) => (
                  <li key={step.id} className="flex gap-3 rounded-lg border border-border/70 px-3 py-2.5">
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border bg-muted/40 text-xs font-medium">
                      {index + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <Link href={step.href} className="text-sm font-medium text-foreground hover:underline">
                        {step.label}
                      </Link>
                      <p className="mt-0.5 text-xs text-muted-foreground">{step.detail}</p>
                    </div>
                  </li>
                ))}
              </ol>

              <div className="flex flex-wrap gap-2">
                <Button nativeButton={false} render={<Link href="/help/credits-path" />} size="sm">
                  Credits path guide
                </Button>
                <Button
                  nativeButton={false}
                  render={<Link href="/dashboard/builder?step=escrowSpend" />}
                  variant="outline"
                  size="sm"
                >
                  Fund escrow
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
}

function MetricTile({
  label,
  value,
  hint
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-lg border border-border/70 bg-background/70 px-3 py-2">
      <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold text-foreground">{value}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}
