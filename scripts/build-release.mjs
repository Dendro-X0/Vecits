#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";

const WORKSPACE_ROOT = process.cwd();
const DIST_DIR = path.join(WORKSPACE_ROOT, "dist", "release");

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: WORKSPACE_ROOT,
    stdio: "inherit",
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function targetTriple() {
  const arch = process.arch;
  const platform =
    process.platform === "win32"
      ? "pc-windows-msvc"
      : process.platform === "darwin"
        ? "apple-darwin"
        : "unknown-linux-gnu";
  return `${arch}-${platform}`;
}

async function readVersion() {
  const cargoToml = await fs.readFile(
    path.join(WORKSPACE_ROOT, "Cargo.toml"),
    "utf8",
  );
  const match = cargoToml.match(/^version = "(.+)"$/m);
  return match?.[1] ?? "0.0.0";
}

async function main() {
  const version = await readVersion();
  const triple = targetTriple();
  const outDir = path.join(DIST_DIR, `vectis-node-${version}-${triple}`);
  await fs.mkdir(outDir, { recursive: true });

  run("cargo", ["build", "--release", "--bin", "cli", "--bin", "vectis-node"]);

  const releaseDir = path.join(WORKSPACE_ROOT, "target", "release");
  const cliName = process.platform === "win32" ? "cli.exe" : "cli";
  const nodeName = process.platform === "win32" ? "vectis-node.exe" : "vectis-node";

  await fs.copyFile(path.join(releaseDir, cliName), path.join(outDir, cliName));
  await fs.copyFile(
    path.join(releaseDir, nodeName),
    path.join(outDir, nodeName),
  );

  const manifest = {
    version,
    targetTriple: triple,
    artifacts: [cliName, nodeName],
    builtAt: new Date().toISOString(),
    commands: {
      init: `./${nodeName} node init --data-dir ./vectis-data`,
      serve: `./${nodeName} node serve --data-dir ./vectis-data --bind 127.0.0.1:7878`,
      health: "curl http://127.0.0.1:7878/health",
    },
  };

  await fs.writeFile(
    path.join(outDir, "release-manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );

  console.log(`Release artifacts written to ${outDir}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
