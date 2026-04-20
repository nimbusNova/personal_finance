#!/bin/bash
set -e
cd "$(dirname "$0")/web"
if ! command -v bun &> /dev/null; then
  echo "Bun not found. Install: curl -fsSL https://bun.sh/install | bash"
  exit 1
fi
if [ ! -d "node_modules" ]; then bun install; fi
bun run dev
