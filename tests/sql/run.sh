#!/bin/bash
# Lokale RLS-/Migrations-Tests gegen Postgres 16 mit Supabase-Stub.
# Nutzung: PGHOST=/var/tmp/pgtest PGPORT=5433 tests/sql/run.sh
set -e
DIR=$(cd "$(dirname "$0")" && pwd)
P="psql -v ON_ERROR_STOP=1 -q -U ${PGUSER:-postgres}"
$P -c "drop database if exists werkplan_test" && $P -c "create database werkplan_test"
$P -d werkplan_test -f "$DIR/supabase-stub.sql"
for f in "$DIR"/../../supabase/migrations/*.sql; do $P -d werkplan_test -f "$f"; done
echo "Migrationen OK"
for t in "$DIR"/[0-9]*.sql; do
  echo "== $(basename "$t")"
  psql -q -U ${PGUSER:-postgres} -d werkplan_test -f "$t" 2>&1 | grep -v '^\s*$' || true
done
