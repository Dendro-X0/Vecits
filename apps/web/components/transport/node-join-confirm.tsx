"use client";

import { AlertTriangle, Server } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  HALO_JOIN_CONFIRM_HINT,
  HALO_LOCAL_OPERATOR_FULL,
  HALO_LOCAL_OPERATOR_SHORT
} from "@/lib/halo/honesty-copy";
import { parseNodeHost } from "@/lib/halo/local-operator-node";
import { validateMobilePinnedNodeUrl } from "@/lib/node-client-base-url";

type NodeJoinConfirmProps = {
  nodeUrl: string;
  confirmLabel?: string;
  onConfirm: (normalizedUrl: string) => void;
  onCancel?: () => void;
};

export function NodeJoinConfirm({
  nodeUrl,
  confirmLabel = "Pin and use this node",
  onConfirm,
  onCancel
}: NodeJoinConfirmProps) {
  const host = parseNodeHost(nodeUrl);
  const validationError =
    host.class === "invalid" || host.class === "relative"
      ? "Enter an absolute http(s) node URL."
      : validateMobilePinnedNodeUrl(host.href);

  const isLocal = host.class === "local-operator";

  return (
    <div className="space-y-4 rounded-xl border border-primary/30 bg-primary/5 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Server className="size-4 text-primary" />
        <p className="text-sm font-medium text-foreground">Confirm node before pinning</p>
        {isLocal ? (
          <Badge variant="outline">{HALO_LOCAL_OPERATOR_SHORT}</Badge>
        ) : host.class === "public" ? (
          <Badge variant="muted">Public host</Badge>
        ) : (
          <Badge variant="outline" className="border-destructive/40 text-destructive">
            Invalid
          </Badge>
        )}
      </div>

      <dl className="grid gap-2 text-sm sm:grid-cols-3">
        <div className="rounded-lg border border-border/70 bg-background px-3 py-2">
          <dt className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Protocol</dt>
          <dd className="mt-1 font-mono text-xs text-foreground">{host.protocol ?? "—"}</dd>
        </div>
        <div className="rounded-lg border border-border/70 bg-background px-3 py-2 sm:col-span-1">
          <dt className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Hostname / IP</dt>
          <dd className="mt-1 break-all font-mono text-sm font-semibold text-foreground">
            {host.hostname ?? "—"}
          </dd>
        </div>
        <div className="rounded-lg border border-border/70 bg-background px-3 py-2">
          <dt className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Port</dt>
          <dd className="mt-1 font-mono text-xs text-foreground">{host.port ?? "—"}</dd>
        </div>
      </dl>

      <p className="break-all font-mono text-xs text-muted-foreground">{host.href || nodeUrl}</p>

      <p className="flex items-start gap-2 text-sm text-muted-foreground">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
        {HALO_JOIN_CONFIRM_HINT}
      </p>

      {isLocal ? (
        <p className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-foreground">
          {HALO_LOCAL_OPERATOR_FULL}
        </p>
      ) : null}

      {validationError ? <p className="text-sm text-destructive">{validationError}</p> : null}

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          disabled={Boolean(validationError)}
          onClick={() => onConfirm(host.href)}
        >
          {confirmLabel}
        </Button>
        {onCancel ? (
          <Button type="button" size="sm" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
      </div>
    </div>
  );
}
