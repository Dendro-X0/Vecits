#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

npm run v1:build-release

TARGET="$(node -p "const fs=require('fs');const p='dist/release';fs.readdirSync(p).find(n=>n.startsWith('vectis-node-'))")"
NODE_BIN="$(node ./scripts/resolve-release-binary.mjs)"

DATA_DIR="${1:-$ROOT/.data/default}"

"$NODE_BIN" node init --data-dir "$DATA_DIR"

cat <<EOF

Vectis node initialized.

Next:
  $NODE_BIN node serve --data-dir $DATA_DIR --bind 127.0.0.1:7878
  curl http://127.0.0.1:7878/health

EOF
