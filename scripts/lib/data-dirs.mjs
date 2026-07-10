import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPTS_DIR = path.dirname(fileURLToPath(import.meta.url));

/** Repository root (parent of `scripts/`). */
export const WORKSPACE_ROOT = path.resolve(SCRIPTS_DIR, "../..");

/** Local-only node databases and drill output — gitignored. */
export const DATA_ROOT = path.join(WORKSPACE_ROOT, ".data");

/** Resolve a named subdirectory under `.data/`. */
export function dataDir(name) {
  return path.join(DATA_ROOT, name);
}

/** Well-known data directories used by maintainer scripts. */
export const DATA_DIRS = {
  /** Default operator node (fresh init / quickstart). */
  default: dataDir("default"),
  /** Local dev client against a throwaway node. */
  dev: dataDir("dev"),
  /** R2 persistent deployment / exchange proof. */
  r2: dataDir("r2"),
  /** R2 genesis / trust bootstrap drill. */
  r2Genesis: dataDir("r2-genesis"),
  /** R6 compute-job lane drill. */
  r6: dataDir("r6"),
  /** R6-L2 lane template smoke. */
  r6L2: dataDir("r6-l2"),
  /** R6 maintainer test scratch dir. */
  r6Test: dataDir("r6-test"),
  /** R6 documentation lane scratch test. */
  r6DocsTest: dataDir("r6-docs-test"),
  /** Two-node federation drill (source / sink). */
  source: dataDir("source"),
  sink: dataDir("sink"),
  /** R6-PD solo drill default (documentation lane). */
  r6PdDocumentation: dataDir("r6-pd-documentation"),
  /** R6-PD per-lane isolated drill dir. */
  r6PdLane: (lane) => dataDir(`r6-pd-${lane}`),
};
