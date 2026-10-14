#!/bin/sh
set -eu

runner="supabase/tests/run_all_rollback.sql"
failed=0

fail() {
  printf 'FAIL %s\n' "$1"
  failed=1
}

pass() {
  printf 'PASS %s\n' "$1"
}

if grep -Eiq 'commit' "$runner"; then
  fail "runner contains forbidden word"
else
  pass "runner contains no forbidden word"
fi

if grep -Eq '^[[:space:]]*\\' "$runner"; then
  fail "runner contains a psql meta-command"
else
  pass "runner contains no psql meta-command"
fi

begin_count=$(grep -Ec '^begin;$' "$runner" || true)
if [ "$begin_count" -eq 1 ]; then
  pass "runner has exactly one top-level BEGIN"
else
  fail "runner top-level BEGIN count is $begin_count"
fi

if grep -Eiq 'set[[:space:]]+role' "$runner"; then
  fail "runner contains SET ROLE without LOCAL"
else
  pass "runner has no SET ROLE without LOCAL"
fi

do_count=$(grep -Ec '^do \$[a-z_]+\$$' "$runner" || true)
close_count=$(grep -Ec '^\$[a-z_]+\$;$' "$runner" || true)
quote_count=$(grep -Eo '\$[a-z_]+\$' "$runner" | wc -l | tr -d ' ')
if [ "$do_count" -eq "$close_count" ] && [ $((quote_count % 2)) -eq 0 ]; then
  pass "runner dollar quoting is balanced ($do_count DO blocks)"
else
  fail "runner dollar quoting is unbalanced: $do_count opens, $close_count closes, $quote_count markers"
fi

if tail -45 "$runner" | grep -q "errcode = 'RN002'"; then
  pass "runner final DO block raises RN002"
else
  fail "runner final DO block does not raise RN002"
fi

secret_pattern='[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}|sk-[A-Za-z0-9]|AIza|ghp_|gho_|github_pat_|eyJ|-----BEGIN'
if grep -Eiq "$secret_pattern" "$runner"; then
  fail "runner contains a real-looking email, key, or token"
else
  pass "runner contains no real-looking email, key, or token"
fi

for file in supabase/tests/*.sql; do
  if grep -Eiq 'commit' "$file"; then
    fail "$file contains forbidden word"
  else
    pass "$file contains no forbidden word"
  fi

  if grep -Eiq "$secret_pattern" "$file"; then
    fail "$file contains a real-looking email, key, or token"
  else
    pass "$file contains no real-looking email, key, or token"
  fi
done

if [ "$failed" -ne 0 ]; then
  exit 1
fi

printf 'STATIC CHECK SUMMARY: all checks passed\n'
