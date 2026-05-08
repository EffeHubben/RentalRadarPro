#!/usr/bin/env bash

set -u -o pipefail

WEB_BASE_URL="${WEB_BASE_URL:-https://rentscout.nl}"
API_BASE_URL="${API_BASE_URL:-https://api.rentscout.nl}"
CURL_BIN="${CURL_BIN:-curl}"

endpoints=(
  "$WEB_BASE_URL"
  "$WEB_BASE_URL/privacy"
  "$WEB_BASE_URL/terms"
  "$WEB_BASE_URL/contact"
  "$API_BASE_URL/health"
  "$API_BASE_URL/api/billing/config"
  "$API_BASE_URL/api/listings/?limit=1"
)

failures=0

check_endpoint() {
  local url="$1"
  local status http_code error_file error_message

  error_file="$(mktemp)"
  http_code="$("$CURL_BIN" -sS -L -o /dev/null -w '%{http_code}' "$url" 2>"$error_file")"
  status=$?
  error_message="$(tr -d '\n' < "$error_file")"
  rm -f "$error_file"

  if [ "$status" -eq 0 ] && [ "$http_code" -ge 200 ] && [ "$http_code" -lt 400 ]; then
    printf 'PASS %s (%s)\n' "$url" "$http_code"
    return 0
  fi

  if [ -n "$error_message" ]; then
    printf 'FAIL %s (%s) %s\n' "$url" "$http_code" "$error_message" >&2
  else
    printf 'FAIL %s (%s)\n' "$url" "$http_code" >&2
  fi
  failures=$((failures + 1))
  return 1
}

printf 'Running RentScout smoke test\n'
printf 'Web base: %s\n' "$WEB_BASE_URL"
printf 'API base: %s\n' "$API_BASE_URL"

for endpoint in "${endpoints[@]}"; do
  check_endpoint "$endpoint"
done

if [ "$failures" -ne 0 ]; then
  printf 'Smoke test failed: %s endpoint(s) failed\n' "$failures" >&2
  exit 1
fi

printf 'Smoke test passed\n'
