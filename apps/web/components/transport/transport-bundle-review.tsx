"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowRight, Copy } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  buildVouchPayloadPreview,
  resolveTransportBundleAction
} from "@/lib/transport/bundle-actions";
import type { ParsedTransportBundle } from "@/lib/transport/bundle";
import { transportBundleTypeLabel } from "@/lib/transport/bundle";
import {
  TRANSPORT_BUNDLE_EXPIRED_MESSAGE,
  TRANSPORT_NODE_CONFIRM_WARNING,
  TRANSPORT_QR_WARNING
} from "@/lib/transport/copy";
import { truncatePubkey } from "@/lib/utils";

type TransportBundleReviewProps = {
  bundle: ParsedTransportBundle;
  expired: boolean;
};

export function TransportBundleReview({ bundle, expired }: TransportBundleReviewProps) {
  const router = useRouter();
  const [copyMessage, setCopyMessage] = useState<string | null>(null);
  const action = resolveTransportBundleAction(bundle);

  async function handleCopy(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopyMessage(`${label} copied.`);
      window.setTimeout(() => setCopyMessage(null), 1600);
    } catch {
      setCopyMessage(`Could not copy ${label.toLowerCase()}.`);
    }
  }

  function handleContinue() {
    if (expired) {
      return;
    }
    if (action.kind === "route") {
      router.push(action.href);
      return;
    }
  }

  return (
    <Card className={expired ? "border-destructive/40" : "border-primary/30"}>
      <CardContent className="space-y-4 p-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">{transportBundleTypeLabel(bundle.type)}</Badge>
          {expired ? (
            <Badge variant="outline" className="border-destructive/40 text-destructive">
              Expired
            </Badge>
          ) : (
            <Badge variant="success">Valid until {new Date(bundle.expiresAt).toLocaleString()}</Badge>
          )}
        </div>

        <div className="space-y-2 text-sm">
          <p className="text-muted-foreground">{TRANSPORT_QR_WARNING}</p>
          <p className="text-muted-foreground">{TRANSPORT_NODE_CONFIRM_WARNING}</p>
          {expired ? (
            <p className="flex items-start gap-2 text-destructive">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              {TRANSPORT_BUNDLE_EXPIRED_MESSAGE}
            </p>
          ) : (
            <p className="text-foreground">{action.message}</p>
          )}
        </div>

        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <div className="rounded-lg border border-border/70 bg-muted/15 px-3 py-2">
            <dt className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Node URL</dt>
            <dd className="mt-1 break-all font-mono text-xs">{bundle.nodeUrl}</dd>
          </div>
          <div className="rounded-lg border border-border/70 bg-muted/15 px-3 py-2">
            <dt className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Created</dt>
            <dd className="mt-1 text-foreground">{new Date(bundle.createdAt).toLocaleString()}</dd>
          </div>
        </dl>

        {bundle.type === "identity.intro" ? (
          <IdentityIntroBody bundle={bundle} onCopy={handleCopy} />
        ) : null}

        {bundle.type === "vouch.request" ? (
          <VouchRequestBody bundle={bundle} onCopy={handleCopy} />
        ) : null}

        {bundle.type === "offer.draft" ? <OfferDraftBody bundle={bundle} /> : null}

        {bundle.type === "order.resume" ? <OrderResumeBody bundle={bundle} /> : null}

        {copyMessage ? <p className="text-xs text-primary">{copyMessage}</p> : null}

        {!expired && action.kind === "route" ? (
          <Button type="button" onClick={handleContinue}>
            Continue to builder
            <ArrowRight className="size-4" />
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}

function IdentityIntroBody({
  bundle,
  onCopy
}: {
  bundle: Extract<ParsedTransportBundle, { type: "identity.intro" }>;
  onCopy: (text: string, label: string) => void;
}) {
  return (
    <div className="space-y-2 rounded-xl border border-border/70 bg-muted/15 p-4">
      <p className="text-sm font-medium text-foreground">
        {bundle.payload.displayLabel?.trim() || "Identity intro"}
      </p>
      <p className="font-mono text-xs break-all">{bundle.payload.pubKey}</p>
      {bundle.payload.bio ? (
        <p className="text-sm text-muted-foreground">{bundle.payload.bio}</p>
      ) : null}
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => void onCopy(bundle.payload.pubKey, "Public key")}
      >
        <Copy className="size-4" />
        Copy public key
      </Button>
    </div>
  );
}

function VouchRequestBody({
  bundle,
  onCopy
}: {
  bundle: Extract<ParsedTransportBundle, { type: "vouch.request" }>;
  onCopy: (text: string, label: string) => void;
}) {
  return (
    <div className="space-y-3 rounded-xl border border-border/70 bg-muted/15 p-4">
      <p className="text-sm font-medium text-foreground">
        Subject {bundle.payload.displayLabel ? `· ${bundle.payload.displayLabel}` : ""}
      </p>
      <p className="font-mono text-xs break-all">{bundle.payload.subjectPubKey}</p>
      {bundle.payload.identityEventId ? (
        <p className="text-xs text-muted-foreground">
          Identity event: {truncatePubkey(bundle.payload.identityEventId, 10, 10)}
        </p>
      ) : null}
      <pre className="overflow-x-auto rounded-lg border border-border bg-background p-3 text-xs">
        {buildVouchPayloadPreview(bundle.payload.subjectPubKey)}
      </pre>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() =>
            void onCopy(buildVouchPayloadPreview(bundle.payload.subjectPubKey), "Vouch payload")
          }
        >
          <Copy className="size-4" />
          Copy vouch payload
        </Button>
        <Button
          nativeButton={false}
          render={
            <Link
              href={`/explorer/identity?author_pub_key=${encodeURIComponent(bundle.payload.subjectPubKey)}`}
            />
          }
          size="sm"
          variant="outline"
        >
          View on explorer
        </Button>
      </div>
    </div>
  );
}

function OfferDraftBody({
  bundle
}: {
  bundle: Extract<ParsedTransportBundle, { type: "offer.draft" }>;
}) {
  return (
    <div className="space-y-1 rounded-xl border border-border/70 bg-muted/15 p-4 text-sm">
      <p className="font-medium text-foreground">{bundle.payload.title}</p>
      <p className="text-muted-foreground">Lane / service: {bundle.payload.serviceType}</p>
      {bundle.payload.description ? (
        <p className="text-muted-foreground">{bundle.payload.description}</p>
      ) : null}
    </div>
  );
}

function OrderResumeBody({
  bundle
}: {
  bundle: Extract<ParsedTransportBundle, { type: "order.resume" }>;
}) {
  return (
    <div className="space-y-1 rounded-xl border border-border/70 bg-muted/15 p-4 text-sm">
      <p>
        Order <span className="font-mono text-xs">{bundle.payload.orderId}</span>
      </p>
      {bundle.payload.milestoneId ? (
        <p className="text-muted-foreground">
          Milestone <span className="font-mono text-xs">{bundle.payload.milestoneId}</span>
        </p>
      ) : null}
      {bundle.payload.builderStep ? (
        <p className="text-muted-foreground">Step: {bundle.payload.builderStep}</p>
      ) : null}
    </div>
  );
}
