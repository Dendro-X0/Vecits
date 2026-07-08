#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";

const WORKSPACE_ROOT = process.cwd();

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: WORKSPACE_ROOT,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

async function main() {
  run("docker", ["compose", "build"]);
  run("docker", ["compose", "up", "-d"]);

  let healthy = false;
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const probe = spawnSync(
      "curl",
      ["-fsS", "http://127.0.0.1:7878/health"],
      { cwd: WORKSPACE_ROOT, encoding: "utf8" },
    );
    if (probe.status === 0) {
      healthy = true;
      console.log(probe.stdout.trim());
      break;
    }
    await sleep(2000);
  }

  if (!healthy) {
    run("docker", ["compose", "logs", "--no-color"]);
    run("docker", ["compose", "down"]);
    throw new Error("vectis-node health check failed");
  }

  console.log("Docker smoke passed (RDG-4).");
  run("docker", ["compose", "down"]);
}

try {
  await main();
} catch (error) {
  console.error(error);
  spawnSync("docker", ["compose", "down"], {
    cwd: WORKSPACE_ROOT,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  process.exit(1);
}
