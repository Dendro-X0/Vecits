#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { spawnPnpm } from "./lib/spawn-pnpm.mjs";

const WORKSPACE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT_FILE = path.join(WORKSPACE_ROOT, ".dev", "desktop-web-port");
const WEB_DIR = path.join(WORKSPACE_ROOT, "apps", "web");

const port = Number((await readFile(PORT_FILE, "utf8")).trim());
if (!Number.isInteger(port) || port < 1024) {
  throw new Error(`Invalid desktop dev port in ${PORT_FILE}. Run pnpm dev:desktop from repo root.`);
}

const child = spawnPnpm(["exec", "next", "dev", "--port", String(port)], {
  cwd: WEB_DIR,
  stdio: "inherit",
});

child.on("exit", (code) => {
  process.exit(code ?? 1);
});
