#!/usr/bin/env bash
set -euo pipefail

DATA_DIR="${1:-/var/lib/vectis/data}"
BACKUP_ROOT="${2:-/var/backups/vectis}"
STAMP="$(date +%Y-%m-%d)"
DEST="${BACKUP_ROOT}/${STAMP}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

mkdir -p "${DEST}"
node "${REPO_ROOT}/scripts/r2-backup.mjs" --data-dir "${DATA_DIR}" --dest "${DEST}"
