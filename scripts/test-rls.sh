#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
exec node --experimental-strip-types scripts/test-rls.ts
