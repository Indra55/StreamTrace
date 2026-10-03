#!/usr/bin/env bash
set -euo pipefail
: "${TEST_DATABASE_URL:?Set TEST_DATABASE_URL to an empty disposable PostgreSQL database (superuser connection).}"
cd "$(dirname "$0")/.."
psql "$TEST_DATABASE_URL" -X -v ON_ERROR_STOP=1 -f supabase/tests/bootstrap.sql
psql "$TEST_DATABASE_URL" -X -v ON_ERROR_STOP=1 -f supabase/migrations/202610030001_core.sql
psql "$TEST_DATABASE_URL" -X -v ON_ERROR_STOP=1 -f supabase/tests/rls.sql
