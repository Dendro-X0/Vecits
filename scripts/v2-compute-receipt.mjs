#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { canonicalize } from "json-canonicalize";

function usage() {
  console.log(
    [
      "Usage:",
      "  node ./scripts/v2-compute-receipt.mjs --job-id <id> --provider <pubkey> --out-dir <path> --output-hash <hash> --notes <text> [--input-hash <hash> ...] [--url <url> ...]",
      "  node ./scripts/v2-compute-receipt.mjs --smoke"
    ].join("\n")
  );
}

function parseArgs(argv) {
  const result = {
    jobId: "",
    provider: "",
    outDir: "",
    notes: "",
    inputHashes: [],
    outputHashes: [],
    urls: [],
    smoke: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      usage();
      process.exit(0);
    }
    if (arg === "--smoke") {
      result.smoke = true;
      continue;
    }
    if (!arg.startsWith("--")) {
      throw new Error(`unknown argument: ${arg}`);
    }
    const key = arg.slice(2);
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`missing value for --${key}`);
    }
    if (key === "job-id") {
      result.jobId = value;
    } else if (key === "provider") {
      result.provider = value;
    } else if (key === "out-dir") {
      result.outDir = value;
    } else if (key === "notes") {
      result.notes = value;
    } else if (key === "input-hash") {
      result.inputHashes.push(value);
    } else if (key === "output-hash") {
      result.outputHashes.push(value);
    } else if (key === "url") {
      result.urls.push(value);
    } else {
      throw new Error(`unknown argument: --${key}`);
    }
    index += 1;
  }

  return result;
}

function validateArgs(args) {
  if (!args.jobId.trim()) {
    throw new Error("--job-id is required");
  }
  if (!/^[0-9a-fA-F]{64}$/.test(args.provider.trim())) {
    throw new Error("--provider must be a 64-character hex public key");
  }
  if (!args.outDir.trim()) {
    throw new Error("--out-dir is required");
  }
  if (!args.notes.trim()) {
    throw new Error("--notes is required and must be non-empty");
  }
  if (args.outputHashes.length === 0) {
    throw new Error("at least one --output-hash is required");
  }
  validateUniqueNonEmpty("input-hash", args.inputHashes);
  validateUniqueNonEmpty("output-hash", args.outputHashes);
  validateUniqueNonEmpty("url", args.urls);
}

function validateUniqueNonEmpty(label, values) {
  const trimmed = values.map(value => value.trim());
  if (trimmed.some(value => value.length === 0)) {
    throw new Error(`all --${label} values must be non-empty`);
  }
  const unique = new Set(trimmed);
  if (unique.size !== trimmed.length) {
    throw new Error(`all --${label} values must be unique`);
  }
}

async function sha256Hex(input) {
  const bytes =
    typeof input === "string" ? new TextEncoder().encode(input) : new Uint8Array(input);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return Buffer.from(digest).toString("hex");
}

function buildReceipt(args, notesHash) {
  return {
    version: "job-receipt-v1",
    jobId: args.jobId.trim(),
    providerPubKey: args.provider.trim().toLowerCase(),
    generatedAt: new Date().toISOString(),
    inputHashes: args.inputHashes.map(value => value.trim()),
    outputHashes: args.outputHashes.map(value => value.trim()),
    urls: args.urls.map(value => value.trim()),
    notesHash
  };
}

async function writeReceiptArtifacts(args) {
  validateArgs(args);
  const outDir = path.resolve(process.cwd(), args.outDir);
  await mkdir(outDir, { recursive: true });

  const notesText = args.notes.trim();
  const notesHash = await sha256Hex(notesText);
  const receipt = buildReceipt(args, notesHash);
  const canonicalReceipt = canonicalize(receipt);
  const receiptHash = await sha256Hex(canonicalReceipt);

  const deliveryHints = {
    evidenceFormat: "job-receipt-v1",
    artifactHashes: [receiptHash, ...receipt.outputHashes],
    notesHash,
    urls: receipt.urls
  };

  await writeFile(path.join(outDir, "job-receipt-v1.json"), `${canonicalReceipt}\n`, "utf8");
  await writeFile(path.join(outDir, "job-receipt-v1.sha256"), `${receiptHash}\n`, "utf8");
  await writeFile(path.join(outDir, "job-receipt-v1-notes.sha256"), `${notesHash}\n`, "utf8");
  await writeFile(
    path.join(outDir, "job-receipt-v1-delivery-hints.json"),
    `${JSON.stringify(deliveryHints, null, 2)}\n`,
    "utf8"
  );

  console.log(outDir);
  console.log(path.join(outDir, "job-receipt-v1.json"));
  console.log(path.join(outDir, "job-receipt-v1-delivery-hints.json"));
}

async function runSmoke() {
  const smokeOutDir = path.join("target", "tmp", `compute-receipt-smoke-${Date.now()}`);
  await writeReceiptArtifacts({
    jobId: "compute-smoke-job",
    provider: "a09aa5f47a6759802ff955f8dc2d2a14a5c99d23be97f864127ff9383455a4f0",
    outDir: smokeOutDir,
    notes: "deterministic compute receipt smoke",
    inputHashes: ["input-hash-1"],
    outputHashes: ["output-hash-1", "output-hash-2"],
    urls: ["https://example.com/compute/smoke"],
    smoke: true
  });

  const deliveryHintsPath = path.join(process.cwd(), smokeOutDir, "job-receipt-v1-delivery-hints.json");
  const parsed = JSON.parse(await readFile(deliveryHintsPath, "utf8"));
  if (
    parsed.evidenceFormat !== "job-receipt-v1" ||
    !Array.isArray(parsed.artifactHashes) ||
    parsed.artifactHashes.length === 0 ||
    typeof parsed.notesHash !== "string" ||
    parsed.notesHash.length === 0
  ) {
    throw new Error("smoke validation failed for job-receipt-v1-delivery-hints.json");
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.smoke) {
    await runSmoke();
    return;
  }
  await writeReceiptArtifacts(args);
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
