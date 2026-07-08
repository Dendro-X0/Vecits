import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";

type ExportRunAction =
  | "refresh_evidence_manifest"
  | "refresh_artifact_prune_plan"
  | "refresh_export_audit_log_plan"
  | "run_lane_fixture_checks";

type ExportActionConfig = {
  npmScript: string;
  label: string;
  artifactRelativePathHints: string[];
};

type RunResult = {
  ok: boolean;
  command: string;
  action: ExportRunAction;
  actionLabel: string;
  workspaceRoot: string;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  exitCode: number | null;
  artifactPathHints: string[];
  stdoutTail: string;
  stderrTail: string;
};

type ExportExecutionAuditRecord = {
  recorded_at: string;
  action: ExportRunAction;
  action_label: string;
  command: string;
  status: "passed" | "failed";
  started_at: string;
  completed_at: string;
  duration_ms: number;
  exit_code: number | null;
  artifact_path_hints: string[];
};

const ACTION_CONFIG: Record<ExportRunAction, ExportActionConfig> = {
  refresh_evidence_manifest: {
    npmScript: "v1:evidence-manifest",
    label: "Refresh evidence manifest",
    artifactRelativePathHints: [
      path.join("target", "tmp", "operations-evidence-manifest.json"),
      path.join("target", "tmp", "operations-evidence-manifest-asof.json")
    ]
  },
  refresh_artifact_prune_plan: {
    npmScript: "v1:artifact-prune-plan",
    label: "Refresh artifact prune plan",
    artifactRelativePathHints: [
      path.join("target", "tmp", "operations-artifact-prune-plan.json"),
      path.join("target", "tmp", "operations-artifact-prune-plan-asof.json")
    ]
  },
  refresh_export_audit_log_plan: {
    npmScript: "v1:export-audit-log-plan",
    label: "Refresh export audit log plan",
    artifactRelativePathHints: [
      path.join("target", "tmp", "operations-export-audit-log-plan.json"),
      path.join("target", "tmp", "operations-export-audit-log-plan-asof.json"),
      path.join("target", "tmp", "operations-export-execution-log.jsonl")
    ]
  },
  run_lane_fixture_checks: {
    npmScript: "v1:lane-fixtures",
    label: "Run lane fixture checks",
    artifactRelativePathHints: [
      path.join("target", "tmp"),
      path.join("target", "tmp", "operations-evidence-manifest.json")
    ]
  }
};

const OUTPUT_TAIL_LIMIT = 12_000;
const COMMAND_TIMEOUT_MS = 4 * 60 * 1000;
const EXPORT_EXECUTION_AUDIT_LOG_NAME = "operations-export-execution-log.jsonl";
const LANE_FIXTURE_RUN_PREFIX = "lane-fixture-check-";
const LANE_FIXTURE_SUMMARY_NAME = "lane-fixture-check-summary.json";

export const runtime = "nodejs";

function isExportRunAction(value: unknown): value is ExportRunAction {
  return (
    value === "refresh_evidence_manifest" ||
    value === "refresh_artifact_prune_plan" ||
    value === "refresh_export_audit_log_plan" ||
    value === "run_lane_fixture_checks"
  );
}

function appendTail(current: string, chunk: string): string {
  const joined = current + chunk;
  if (joined.length <= OUTPUT_TAIL_LIMIT) {
    return joined;
  }
  return joined.slice(joined.length - OUTPUT_TAIL_LIMIT);
}

async function hasWorkspaceScripts(
  directory: string,
  requiredScripts: string[]
): Promise<boolean> {
  const packageJsonPath = path.join(directory, "package.json");
  try {
    const raw = await fs.readFile(packageJsonPath, "utf8");
    const parsed = JSON.parse(raw) as { scripts?: Record<string, unknown> };
    const scripts = parsed.scripts ?? {};
    return requiredScripts.every(script => typeof scripts[script] === "string");
  } catch {
    return false;
  }
}

async function findWorkspaceRoot(requiredScripts: string[]): Promise<string | null> {
  let current = process.cwd();
  while (true) {
    if (await hasWorkspaceScripts(current, requiredScripts)) {
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current) {
      return null;
    }
    current = parent;
  }
}

function npmExecutable(): string {
  return process.platform === "win32" ? "npm.cmd" : "npm";
}

function exportExecutionAuditLogPath(workspaceRoot: string): string {
  return path.join(workspaceRoot, "target", "tmp", EXPORT_EXECUTION_AUDIT_LOG_NAME);
}

async function appendExportExecutionAudit(
  workspaceRoot: string,
  record: ExportExecutionAuditRecord
): Promise<string> {
  const logPath = exportExecutionAuditLogPath(workspaceRoot);
  await fs.mkdir(path.dirname(logPath), { recursive: true });
  await fs.appendFile(logPath, `${JSON.stringify(record)}\n`, "utf8");
  return logPath;
}

function uniqueArtifactHints(items: string[]): string[] {
  return Array.from(new Set(items.filter(item => item.trim().length > 0)));
}

function parseLaneFixtureSummaryPath(stdoutTail: string): string | null {
  const matches = stdoutTail.match(/Lane fixture summary:\s*(.+)$/m);
  if (!matches) {
    return null;
  }
  const candidate = matches[1]?.trim();
  return candidate && candidate.length > 0 ? candidate : null;
}

async function findLatestLaneFixtureSummary(workspaceRoot: string): Promise<string | null> {
  const runsDir = path.join(workspaceRoot, "target", "tmp");
  try {
    const entries = await fs.readdir(runsDir, { withFileTypes: true });
    const candidate = entries
      .filter(entry => entry.isDirectory() && entry.name.startsWith(LANE_FIXTURE_RUN_PREFIX))
      .sort((left, right) => right.name.localeCompare(left.name))[0];
    if (!candidate) {
      return null;
    }
    const summaryPath = path.join(runsDir, candidate.name, LANE_FIXTURE_SUMMARY_NAME);
    await fs.access(summaryPath);
    return summaryPath;
  } catch {
    return null;
  }
}

async function resolveArtifactPathHints(
  action: ExportRunAction,
  workspaceRoot: string,
  stdoutTail: string
): Promise<string[]> {
  const actionConfig = ACTION_CONFIG[action];
  const baseHints = actionConfig.artifactRelativePathHints.map(relative =>
    path.join(workspaceRoot, relative)
  );

  if (action !== "run_lane_fixture_checks") {
    return uniqueArtifactHints(baseHints);
  }

  const parsedSummaryPath = parseLaneFixtureSummaryPath(stdoutTail);
  const latestSummaryPath = await findLatestLaneFixtureSummary(workspaceRoot);
  return uniqueArtifactHints([
    ...(parsedSummaryPath ? [parsedSummaryPath] : []),
    ...(latestSummaryPath ? [latestSummaryPath] : []),
    ...baseHints
  ]);
}

async function runAction(action: ExportRunAction): Promise<RunResult> {
  const actionConfig = ACTION_CONFIG[action];
  const workspaceRoot = await findWorkspaceRoot(Object.values(ACTION_CONFIG).map(item => item.npmScript));
  if (!workspaceRoot) {
    throw new Error("workspace root with required scripts was not found");
  }

  const command = `npm run ${actionConfig.npmScript}`;
  const startedAtMs = Date.now();
  let stdoutTail = "";
  let stderrTail = "";

  return await new Promise<RunResult>((resolve, reject) => {
    const child = spawn(npmExecutable(), ["run", actionConfig.npmScript], {
      cwd: workspaceRoot,
      env: process.env,
      windowsHide: true
    });

    const timeout = setTimeout(() => {
      child.kill();
    }, COMMAND_TIMEOUT_MS);

    child.stdout.on("data", chunk => {
      stdoutTail = appendTail(stdoutTail, chunk.toString());
    });

    child.stderr.on("data", chunk => {
      stderrTail = appendTail(stderrTail, chunk.toString());
    });

    child.on("error", error => {
      clearTimeout(timeout);
      reject(error);
    });

    child.on("close", code => {
      clearTimeout(timeout);
      const completedAtMs = Date.now();
      const durationMs = completedAtMs - startedAtMs;
      const ok = code === 0;
      void (async () => {
        const artifactPathHints = await resolveArtifactPathHints(action, workspaceRoot, stdoutTail);
        resolve({
          ok,
          command,
          action,
          actionLabel: actionConfig.label,
          workspaceRoot,
          startedAt: new Date(startedAtMs).toISOString(),
          completedAt: new Date(completedAtMs).toISOString(),
          durationMs,
          exitCode: code,
          artifactPathHints,
          stdoutTail,
          stderrTail
        });
      })().catch(reject);
    });
  });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { action?: unknown } | null;
  if (!body || !isExportRunAction(body.action)) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "invalid action; use refresh_evidence_manifest, refresh_artifact_prune_plan, or refresh_export_audit_log_plan"
          + ", or run_lane_fixture_checks"
      },
      { status: 400 }
    );
  }

  const action = body.action;
  try {
    const result = await runAction(action);
    let auditLogPath: string | null = null;
    let auditWriteError: string | null = null;
    try {
      auditLogPath = await appendExportExecutionAudit(result.workspaceRoot, {
        recorded_at: result.completedAt,
        action: result.action,
        action_label: result.actionLabel,
        command: result.command,
        status: result.ok ? "passed" : "failed",
        started_at: result.startedAt,
        completed_at: result.completedAt,
        duration_ms: result.durationMs,
        exit_code: result.exitCode,
        artifact_path_hints: result.artifactPathHints
      });
    } catch (error) {
      auditWriteError = error instanceof Error ? error.message : "unknown audit log write error";
    }

    if (!result.ok) {
      return NextResponse.json(
        {
          ...result,
          auditLogPath,
          auditWriteError,
          error: `command failed for ${ACTION_CONFIG[action].label}`
        },
        { status: 500 }
      );
    }
    return NextResponse.json({
      ...result,
      auditLogPath,
      auditWriteError
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown command execution error";
    return NextResponse.json({ ok: false, action, error: message }, { status: 500 });
  }
}
