#!/usr/bin/env node
/**
 * Start Next.js dev server on the port assigned by ensure-dev-web-port.mjs.
 */
import { readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const WORKSPACE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT_FILE = path.join(WORKSPACE_ROOT, ".dev", "web-port");
const WEB_DIR = path.join(WORKSPACE_ROOT, "apps", "web");

const port = Number((await readFile(PORT_FILE, "utf8")).trim());
if (!Number.isInteger(port) || port < 1024) {
	throw new Error(`Invalid dev port in ${PORT_FILE}`);
}

const child = spawn("pnpm", ["exec", "next", "dev", "--port", String(port)], {
	cwd: WEB_DIR,
	stdio: "inherit",
	shell: true,
});

child.on("exit", code => process.exit(code ?? 1));
