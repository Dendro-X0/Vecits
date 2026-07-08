"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

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
    item => !item.command.includes("\n") && item.command.length > SINGLE_LINE_COMPACT_THRESHOLD
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
    <section
      style={{
        marginTop: "0.6rem",
        border: "1px solid #2a3458",
        borderRadius: 10,
        padding: "0.8rem",
        background: "#0d1633"
      }}
    >
      <div
        style={{
          display: "flex",
          gap: "0.5rem",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap"
        }}
      >
        <h4 style={{ marginTop: 0, marginBottom: "0.45rem" }}>{title}</h4>
        {hasCompactedCommands ? (
          <button
            type="button"
            style={{
              background: "#1a2f66",
              color: "#dbe7ff",
              border: "1px solid #3651a1",
              borderRadius: 8,
              padding: "0.35rem 0.6rem",
              cursor: "pointer",
              marginBottom: "0.35rem"
            }}
            onClick={() => setShowFullCommands(value => !value)}
          >
            {showFullCommands ? "Compact Commands" : "Show Full Commands"}
          </button>
        ) : null}
      </div>
      {collapsed ? (
        <button
          type="button"
          style={{
            background: "#16264f",
            color: "#dbe7ff",
            border: "1px solid #3651a1",
            borderRadius: 8,
            padding: "0.4rem 0.65rem",
            cursor: "pointer"
          }}
          onClick={() => setCollapsed(false)}
        >
          Show Commands ({commands.length})
        </button>
      ) : commands.length > 0 ? (
        <ul style={{ marginTop: 0, marginBottom: 0 }}>
          {commands.map(item => {
            const runnableAction = item.runnableAction;
            const compactPreview = showFullCommands ? item.command : compactCommandPreview(item.command);
            return (
              <li key={`${item.label}-${item.command}`} style={{ marginBottom: "0.55rem" }}>
                <div>{item.label}</div>
                <pre
                  title={!showFullCommands && compactPreview !== item.command ? item.command : undefined}
                  style={{
                    marginTop: "0.35rem",
                    marginBottom: "0.35rem",
                    border: "1px solid #2a3458",
                    borderRadius: 8,
                    padding: "0.5rem 0.65rem",
                    background: "#0b122b",
                    whiteSpace: "pre-wrap"
                  }}
                >
                  {compactPreview}
                </pre>
                <button
                  type="button"
                  style={{
                    background: "#1a2f66",
                    color: "#dbe7ff",
                    border: "1px solid #3651a1",
                    borderRadius: 8,
                    padding: "0.4rem 0.65rem",
                    cursor: "pointer"
                  }}
                  onClick={() => copyCommand(item.command, item.label)}
                >
                  Copy Command
                </button>
                {runnableAction ? (
                  <button
                    type="button"
                    style={{
                      background: "#1f4d2f",
                      color: "#d9ffe4",
                      border: "1px solid #2f7c4a",
                      borderRadius: 8,
                      padding: "0.4rem 0.65rem",
                      cursor: runningAction === runnableAction ? "wait" : "pointer",
                      marginLeft: "0.45rem",
                      opacity: runningAction === runnableAction ? 0.75 : 1
                    }}
                    disabled={runningAction !== null}
                    onClick={() => runWorkflowCommand(runnableAction, item.label)}
                  >
                    {runningAction === runnableAction ? "Running..." : "Run Now"}
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : (
        <p style={{ marginTop: 0, marginBottom: 0, opacity: 0.85 }}>
          No commands available.
        </p>
      )}
      {!collapsed && commands.length > 0 && collapsedByDefault ? (
        <button
          type="button"
          style={{
            background: "#16264f",
            color: "#dbe7ff",
            border: "1px solid #3651a1",
            borderRadius: 8,
            padding: "0.4rem 0.65rem",
            cursor: "pointer",
            marginTop: "0.35rem"
          }}
          onClick={() => setCollapsed(true)}
        >
          Collapse Commands
        </button>
      ) : null}
      {showReloadButton ? (
        <button
          type="button"
          style={{
            background: "#1a2f66",
            color: "#dbe7ff",
            border: "1px solid #3651a1",
            borderRadius: 8,
            padding: "0.4rem 0.65rem",
            cursor: "pointer",
            marginTop: "0.35rem"
          }}
          onClick={() => window.location.reload()}
        >
          {isRefreshing ? "Refreshing..." : "Refresh Status View"}
        </button>
      ) : null}
      {status ? (
        <p style={{ marginBottom: 0, color: statusTone === "ok" ? "#9fe0b1" : "#ffb17a" }}>
          {status}
        </p>
      ) : null}
    </section>
  );
}
