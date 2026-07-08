import { spawn, spawnSync } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";

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

async function readVersion(workspaceRoot) {
  const cargoToml = await fs.readFile(
    path.join(workspaceRoot, "Cargo.toml"),
    "utf8",
  );
  const match = cargoToml.match(/^version = "(.+)"$/m);
  return match?.[1] ?? "0.0.0";
}

async function newestExistingBinary(candidates) {
  let best = null;
  let bestMtime = 0;
  for (const candidate of candidates) {
    try {
      const stat = await fs.stat(candidate);
      if (stat.mtimeMs >= bestMtime) {
        bestMtime = stat.mtimeMs;
        best = candidate;
      }
    } catch {
      // skip missing
    }
  }
  return best;
}

export async function resolveReleaseBinary(workspaceRoot, { buildIfMissing = true } = {}) {
  const version = await readVersion(workspaceRoot);
  const triple = targetTriple();
  const nodeName = process.platform === "win32" ? "vectis-node.exe" : "vectis-node";
  const candidates = [
    path.join(workspaceRoot, "target", "release", nodeName),
    path.join(
      workspaceRoot,
      "dist",
      "release",
      `vectis-node-${version}-${triple}`,
      nodeName,
    ),
  ];

  const existing = await newestExistingBinary(candidates);
  if (existing) {
    return existing;
  }

  if (!buildIfMissing) {
    throw new Error(
      `release binary not found; run npm run v1:build-release first (${candidates.join(", ")})`,
    );
  }

  const build = spawnSync("npm", ["run", "v1:build-release"], {
    cwd: workspaceRoot,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (build.status !== 0) {
    throw new Error("npm run v1:build-release failed");
  }

  const built = await newestExistingBinary(candidates);
  if (built) {
    return built;
  }

  throw new Error("release binary missing after build-release");
}

export function createReleaseRunners(workspaceRoot, binaryPath) {
  function runCommand(args, commandLog) {
    const logged = `"${binaryPath}" ${args.join(" ")}`;
    commandLog.push(logged);
    const result = spawnSync(binaryPath, args, {
      cwd: workspaceRoot,
      stdio: "inherit",
    });
    if (result.error) {
      throw new Error(`failed to run ${logged}: ${result.error.message}`);
    }
    if (result.status !== 0) {
      throw new Error(`command failed: ${logged}`);
    }
  }

  function runCli(args, commandLog) {
    runCommand(args, commandLog);
  }

  function spawnNodeServe(dataDir, port, commandLog) {
    const args = [
      "node",
      "serve",
      "--data-dir",
      dataDir,
      "--bind",
      `127.0.0.1:${port}`,
    ];
    commandLog.push(`"${binaryPath}" ${args.join(" ")}`);
    return spawn(binaryPath, args, {
      cwd: workspaceRoot,
      stdio: "inherit",
    });
  }

  return { runCli, spawnNodeServe };
}
