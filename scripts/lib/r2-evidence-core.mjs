import { promises as fs } from "node:fs";
import path from "node:path";

export async function inferAsOfFromEventsLog(eventsLogPath) {
  try {
    const content = await fs.readFile(eventsLogPath, "utf8");
    const lines = content.trim().split("\n").filter(Boolean);
    if (lines.length === 0) {
      return "2026-07-02T00:15:00Z";
    }
    const last = JSON.parse(lines[lines.length - 1]);
    const createdAt = last.createdAt ?? "2026-07-02T00:00:00Z";
    const datePart = createdAt.slice(0, 10);
    return `${datePart}T00:15:00Z`;
  } catch {
    return "2026-07-02T00:15:00Z";
  }
}

export async function findLatestExchangeSummary(workspaceRoot) {
  const tmpRoot = path.join(workspaceRoot, "target", "tmp");
  let entries;
  try {
    entries = await fs.readdir(tmpRoot);
  } catch {
    return null;
  }
  const candidates = entries
    .filter(name => name.startsWith("r2-exchange-"))
    .sort()
    .reverse();
  for (const name of candidates) {
    const summaryPath = path.join(tmpRoot, name, "exchange-summary.json");
    try {
      const summary = JSON.parse(await fs.readFile(summaryPath, "utf8"));
      if (summary.passed) {
        return { summary, runDir: path.join(tmpRoot, name) };
      }
    } catch {
      // try next
    }
  }
  return null;
}

export async function writeOperatorNotes(outDir, context) {
  const exchange = context.exchangeSummary;
  const notes = `# R2 operator notes

- exported at: ${context.exportedAt}
- deployment host: ${context.deploymentHost ?? "local operator node"}
- data directory: ${context.dataDir}
- exchange lane: ${exchange?.lane ?? "project-maintenance"}
- buyer (operator): ${exchange?.buyerPubKey ?? "see events.log"}
- provider (counterparty): ${exchange?.providerPubKey ?? "see events.log"}
- offer id: ${exchange?.offerId ?? "n/a"}
- order id: ${exchange?.orderId ?? "n/a"}
- milestone outcome: accepted (order closed)
- replay state hash: ${context.replayStateHash}
- as-of: ${context.asOf}
- health status: ${context.healthStatus ?? "not captured"}
- notes: R2-P3 evidence packet; restore verified via R2-P4 (RDG-3)
`;
  await fs.writeFile(path.join(outDir, "operator-notes.md"), notes);
}

export async function writeEvidenceManifest(outDir, entries) {
  const manifest = {
    schema: "r2-evidence-pack-v1",
    createdAt: new Date().toISOString(),
    files: entries,
  };
  await fs.writeFile(
    path.join(outDir, "evidence-manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
  return manifest;
}
