#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const WORKSPACE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function runStep({ name, command, args, shell = process.platform === "win32" }) {
  console.log(`\n[local-ci-verify] ${name}`);
  console.log(`$ ${command} ${args.join(" ")}`.trim());

  const result = spawnSync(command, args, {
    cwd: WORKSPACE_ROOT,
    stdio: "inherit",
    shell,
  });

  if (result.status !== 0) {
    throw new Error(`step failed: ${name}`);
  }
}

function hasDockerCompose() {
  const probe = spawnSync("docker", ["compose", "version"], {
    cwd: WORKSPACE_ROOT,
    stdio: "ignore",
    shell: process.platform === "win32",
  });
  return probe.status === 0;
}

async function main() {
  const steps = [
    {
      name: "CI readiness bundle",
      command: process.execPath,
      args: ["./scripts/ci-readiness.mjs"],
    },
    {
      name: "Static web shell build",
      command: process.execPath,
      args: ["./scripts/build-web-static.mjs"],
    },
  ];

  for (const step of steps) {
    runStep(step);
  }

  if (hasDockerCompose()) {
    runStep({
      name: "Docker node smoke (RDG-4)",
      command: process.execPath,
      args: ["./scripts/docker-smoke.mjs"],
    });
  } else {
    console.log("\n[local-ci-verify] Skipping Docker smoke — `docker compose` not available.");
    console.log("  GitHub Actions still runs RDG-4 on ubuntu-latest with Docker preinstalled.");
  }

  console.log("\nLocal CI verification passed.");
}

main().catch((error) => {
  console.error("Local CI verification failed:");
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
