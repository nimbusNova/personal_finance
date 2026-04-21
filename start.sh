#!/bin/bash
set -e
cd "$(dirname "$0")/web"
if ! command -v bun &> /dev/null; then
  echo "Bun not found. Install: curl -fsSL https://bun.sh/install | bash"
  exit 1
fi
if [ ! -d "node_modules" ]; then bun install; fi

LOG_DIR="data/logs"
mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/$(date +%Y-%m-%d_%H-%M-%S).log"

echo "Starting dev server. Logs written to: $LOG_FILE"
bun run dev 2>&1 | tee "$LOG_FILE"
