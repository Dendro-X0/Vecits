"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type OperationsCommandRunnableAction =
  | "refresh_evidence_manifest"
  | "refresh_artifact_prune_plan"
  | "refresh_export_audit_log_plan"
  | "run_lane_fixture_checks";

export type OperationsCommandToolItem = {
  label: string;
  command: string;
  runnableAction?: OperationsCommandRunnableAction;
};

type OperationsCommandToolsProps = {
  title: string;
  commands: OperationsCommandToolItem[];
  showReloadButton?: boolean;
  refreshAfterRun?: boolean;
  collapsedByDefault?: boolean;
};

const SINGLE_LINE_COMPACT_THRESHOLD = 160;

function compactCommandPreview(command: string): string {
  if (command.includes("\n")) {
    return command;
  }
  if (command.length <= SINGLE_LINE_COMPACT_THRESHOLD) {
    return command;
  }
  const head = command.slice(0, 92).trimEnd();
  const tail = command.slice(-56).trimStart();
  return `${head} ... ${tail}`;
}

export function OperationsCommandTools(props: OperationsCommandToolsProps) {
  const {
    title,
    commands,
    showReloadButton = false,
    refreshAfterRun = false,
    collapsedByDefault = false
  } = props;
  const router = useRouter();
  const [isRefreshing, startRefreshTransition] = useTransition();
  const [runningAction, setRunningAction] = useState<OperationsCommandRunnableAction | null>(null);
  const [showFullCommands, setShowFullCommands] = useState(false);
  const [collapsed, setCollapsed] = useState(collapsedByDefault);
  const [status, setStatus] = useState<string>("");
  const [statusTone, setStatusTone] = useState<"ok" | "error">("ok");
  const hasCompactedCommands = commands.some(
    (item) => !item.command.includes("\n") && item.command.length > SINGLE_LINE_COMPACT_THRESHOLD
  );

  async function copyCommand(command: string, label: string) {
    try {
      if (!navigator.clipboard) {
        throw new Error("Clipboard API unavailable");
      }
      await navigator.clipboard.writeText(command);
      setStatusTone("ok");
      setStatus(`Copied: ${label}`);
      setTimeout(() => setStatus(""), 1500);
    } catch {
      setStatusTone("error");
      setStatus("Copy failed");
      setTimeout(() => setStatus(""), 1800);
    }
  }

  async function runWorkflowCommand(action: OperationsCommandRunnableAction, label: string) {
    try {
      setRunningAction(action);
      const response = await fetch("/api/operations/exports", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action })
      });
      const result = (await response.json()) as {
        ok?: boolean;
        durationMs?: number;
        stderrTail?: string;
        error?: string;
        auditWriteError?: string | null;
      };
      if (!response.ok || result.ok !== true) {
        const reason =
          typeof result.stderrTail === "string" && result.stderrTail.trim().length > 0
            ? result.stderrTail.trim().slice(-180)
            : typeof result.error === "string" && result.error.trim().length > 0
              ? result.error.trim().slice(0, 180)
              : "request failed";
        setStatusTone("error");
        setStatus(`Run failed: ${label} (${reason})`);
        return;
      }
      const durationSeconds =
        typeof result.durationMs === "number" ? (result.durationMs / 1000).toFixed(1) : "0.0";
      setStatusTone("ok");
      if (typeof result.auditWriteError === "string" && result.auditWriteError.trim().length > 0) {
        setStatus(`Completed: ${label} (${durationSeconds}s, audit write warning)`);
      } else {
        setStatus(`Completed: ${label} (${durationSeconds}s)`);
      }
      if (refreshAfterRun) {
        startRefreshTransition(() => {
          router.refresh();
        });
      }
    } catch {
      setStatusTone("error");
      setStatus(`Run failed: ${label} (network error)`);
    } finally {
      setRunningAction(null);
    }
  }

  return (
    <section className="surface-inset rounded-xl p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-sm font-medium">{title}</h4>
        {hasCompactedCommands ? (
          <Button type="button" variant="outline" size="sm" onClick={() => setShowFullCommands((value) => !value)}>
            {showFullCommands ? "Compact commands" : "Show full commands"}
          </Button>
        ) : null}
      </div>

      {collapsed ? (
        <Button type="button" variant="outline" size="sm" onClick={() => setCollapsed(false)}>
          Show commands ({commands.length})
        </Button>
      ) : commands.length > 0 ? (
        <ul className="space-y-4">
          {commands.map((item) => {
            const runnableAction = item.runnableAction;
            const compactPreview = showFullCommands ? item.command : compactCommandPreview(item.command);
            return (
              <li key={`${item.label}-${item.command}`} className="space-y-2">
                <p className="text-sm font-medium">{item.label}</p>
                <pre
                  title={!showFullCommands && compactPreview !== item.command ? item.command : undefined}
                  className="surface-code overflow-x-auto rounded-lg px-3 py-2 font-mono text-xs leading-relaxed whitespace-pre-wrap"
                >
                  {compactPreview}
                </pre>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => copyCommand(item.command, item.label)}
                  >
                    Copy command
                  </Button>
                  {runnableAction ? (
                    <Button
                      type="button"
                      size="sm"
                      className="border-success/30 bg-success/10 text-success hover:bg-success/20"
                      disabled={runningAction !== null}
                      onClick={() => runWorkflowCommand(runnableAction, item.label)}
                    >
                      {runningAction === runnableAction ? "Running…" : "Run now"}
                    </Button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">No commands available.</p>
      )}

      {!collapsed && commands.length > 0 && collapsedByDefault ? (
        <Button type="button" variant="ghost" size="sm" className="mt-3" onClick={() => setCollapsed(true)}>
          Collapse commands
        </Button>
      ) : null}

      {showReloadButton ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-3"
          onClick={() => window.location.reload()}
        >
          {isRefreshing ? "Refreshing…" : "Refresh status view"}
        </Button>
      ) : null}

      {status ? (
        <p
          className={cn(
            "mt-3 text-sm",
            statusTone === "ok" ? "text-[var(--status-ok)]" : "text-[var(--status-error)]"
          )}
        >
          {status}
        </p>
      ) : null}
    </section>
  );
}
