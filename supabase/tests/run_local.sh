#!/usr/bin/env bash
# Runs the migrations and database tests against a throwaway local PostgreSQL
# database. Requires psql and a local server you can connect to as a superuser.
#   PGURL=postgres://postgres@localhost/postgres npm run test:db
set -euo pipefail
cd "$(dirname "$0")/../.."
PGURL="${PGURL:-postgres://postgres@localhost/postgres}"
DB="anasa_test_$$"
psql "$PGURL" -qc "create database $DB" >/dev/null
trap 'psql "$PGURL" -qc "drop database if exists $DB" >/dev/null' EXIT
TEST_URL="${PGURL%/*}/$DB"
psql "$TEST_URL" -v ON_ERROR_STOP=1 -q -f supabase/tests/00_local_supabase_stub.sql
for f in supabase/migrations/*.sql; do
  psql "$TEST_URL" -v ON_ERROR_STOP=1 -q -f "$f"
done
psql "$TEST_URL" -v ON_ERROR_STOP=1 -q -f supabase/tests/01_commercial_flow.sql
bash supabase/tests/02_concurrency.sh "$TEST_URL"
echo "All database tests passed."
