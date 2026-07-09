"use client";

import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { loadActiveSession } from "@/lib/auth/session";
import { loadTransactions } from "@/lib/dashboard/load-transactions";
import type { WorkspaceRoleSummary } from "@/lib/dashboard/workspace-role";

export function WorkspaceRoleHint() {
  const [summary, setSummary] = useState<WorkspaceRoleSummary | null>(null);

  useEffect(() => {
    const session = loadActiveSession();
    if (!session) {
      setSummary(null);
      return;
    }

    let cancelled = false;
    void loadTransactions(session.publicKeyHex).then((state) => {
      if (!cancelled && state.kind === "live") {
        setSummary(state.roleSummary);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  if (!summary || summary.buyer.total + summary.provider.total === 0) {
    return null;
  }

  const needsYou = summary.buyer.needsAction + summary.provider.needsAction;

  return (
    <div className="hidden max-w-sm text-right lg:block">
      <p className="text-xs font-medium text-foreground">{summary.primaryLabel}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{summary.hint}</p>
      {needsYou > 0 ? (
        <Badge variant="default" className="mt-2">
          {needsYou} need{needsYou === 1 ? "s" : ""} you
        </Badge>
      ) : null}
    </div>
  );
}
