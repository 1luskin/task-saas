#!/bin/bash
# Lokale RLS-/Migrations-Tests gegen Postgres 16 mit Supabase-Stub.
# Jede Testdatei läuft auf einer frischen Datenbank (alle Migrationen).
# Nutzung: PGHOST=/var/tmp/pgtest PGPORT=5433 tests/sql/run.sh [datei.sql ...]
set -e
DIR=$(cd "$(dirname "$0")" && pwd)
P="psql -v ON_ERROR_STOP=1 -q -U ${PGUSER:-postgres}"
fresh() {
  $P -c "drop database if exists werkplan_test" >/dev/null && $P -c "create database werkplan_test" >/dev/null
  $P -d werkplan_test -f "$DIR/supabase-stub.sql" >/dev/null
  for f in "$DIR"/../../supabase/migrations/*.sql; do $P -d werkplan_test -f "$f" >/dev/null; done
}
fresh && echo "Migrationen OK"
TESTS=("$@"); [ ${#TESTS[@]} -eq 0 ] && TESTS=("$DIR"/[0-9]*.sql)
for t in "${TESTS[@]}"; do
  echo "== $(basename "$t")"
  fresh
  psql -q -U ${PGUSER:-postgres} -d werkplan_test -f "$t" 2>&1 | grep -v '^\s*$' || true
done
