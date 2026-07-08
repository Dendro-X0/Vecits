#!/bin/sh
set -eu

DATA_DIR="${VECTIS_DATA_DIR:-/data}"
mkdir -p "$DATA_DIR"

vectis-node node init --data-dir "$DATA_DIR" >/dev/null

exec vectis-node "$@"
