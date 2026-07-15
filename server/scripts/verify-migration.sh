#!/bin/bash
# =============================================================================
# verify-migration.sh
#
# Compares record counts between SQLite and PostgreSQL for every mapped table.
# Exits with code 0 if all match, 1 if any mismatch found.
#
# Usage:
#   ./server/scripts/verify-migration.sh --sqlite ./data/aiops.db
#   DATABASE_URL=postgresql://... ./server/scripts/verify-migration.sh --sqlite ./data/aiops.db
#
# Environment:
#   DATABASE_URL    — PostgreSQL connection string (required)
# =============================================================================

set -euo pipefail

# ── Parse arguments ──────────────────────────────────────────────────────────
SQLITE_DB=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --sqlite)
      SQLITE_DB="$2"
      shift 2
      ;;
    --help|-h)
      echo "Usage: $0 --sqlite <path>"
      echo "  DATABASE_URL must be set in environment."
      exit 0
      ;;
    *)
      echo "Unknown argument: $1"
      exit 1
      ;;
  esac
done

if [[ -z "$SQLITE_DB" ]]; then
  SQLITE_DB="$(dirname "$0")/../data/aiops.db"
fi

if [[ ! -f "$SQLITE_DB" ]]; then
  echo "ERROR: SQLite database not found: $SQLITE_DB"
  exit 1
fi

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "ERROR: DATABASE_URL environment variable is required."
  echo "Usage: DATABASE_URL=postgresql://user:pass@host:5432/dbname $0 --sqlite <path>"
  exit 1
fi

# Check required commands
for cmd in sqlite3 psql; do
  if ! command -v "$cmd" &>/dev/null; then
    echo "ERROR: '$cmd' not found. Please install it."
    exit 1
  fi
done

# ── Table mappings (SQLite table → PostgreSQL table + column) ────────────────
declare -A TABLES=(
  ["users"]="User"
  ["tenants"]="Tenant"
  ["tenant_members"]="TenantMember"
  ["api_keys"]="ApiKey"
  ["subscriptions"]="Subscription"
  ["usage_records"]="UsageRecord"
  ["contents"]="Content"
  ["accounts"]="Account"
  ["teams"]="Team"
  ["team_tasks"]="TeamTask"
  ["settings"]="Setting"
)

# ── Colors ───────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "═══════════════════════════════════════════════════"
echo "  Migration Verification"
echo "═══════════════════════════════════════════════════"
echo ""
echo "  SQLite:  $SQLITE_DB"
echo "  PG URL:  ${DATABASE_URL//:[^:@]*@/:****@/}"
echo ""

ANY_MISMATCH=false
TOTAL_OK=0
TOTAL_MISMATCH=0
TOTAL_SKIP=0

for SQLITE_TABLE in "${!TABLES[@]}"; do
  PG_TABLE="${TABLES[$SQLITE_TABLE]}"

  # Check if SQLite table exists
  SQLITE_EXISTS=$(sqlite3 "$SQLITE_DB" "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='$SQLITE_TABLE';" 2>/dev/null)
  if [[ "$SQLITE_EXISTS" -eq 0 ]]; then
    echo -e "  ${YELLOW}~${NC} ${SQLITE_TABLE} → ${PG_TABLE}: SQLite table not found, skipping"
    TOTAL_SKIP=$((TOTAL_SKIP + 1))
    continue
  fi

  # Get counts
  SQLITE_COUNT=$(sqlite3 "$SQLITE_DB" "SELECT COUNT(*) FROM \"${SQLITE_TABLE}\";" 2>/dev/null)
  PG_COUNT=$(psql "$DATABASE_URL" -t -A -c "SELECT COUNT(*) FROM \"${PG_TABLE}\";" 2>/dev/null || echo "ERROR")

  if [[ "$SQLITE_COUNT" -eq "$PG_COUNT" ]]; then
    echo -e "  ${GREEN}✓${NC} ${SQLITE_TABLE} → ${PG_TABLE}: ${SQLITE_COUNT} = ${PG_COUNT}"
    TOTAL_OK=$((TOTAL_OK + 1))
  else
    echo -e "  ${RED}✗${NC} ${SQLITE_TABLE} → ${PG_TABLE}: ${SQLITE_COUNT} (SQLite) ≠ ${PG_COUNT} (PG)"
    ANY_MISMATCH=true
    TOTAL_MISMATCH=$((TOTAL_MISMATCH + 1))
  fi
done

echo ""
echo "─────────────────────────────────────────────────"
echo -e "  ${GREEN}${TOTAL_OK}${NC} matched  |  ${RED}${TOTAL_MISMATCH}${NC} mismatched  |  ${YELLOW}${TOTAL_SKIP}${NC} skipped"
echo ""

if [[ "$ANY_MISMATCH" == "true" ]]; then
  echo -e "  ${RED}VERIFICATION FAILED${NC} — Data count mismatch detected."
  exit 1
else
  echo -e "  ${GREEN}VERIFICATION PASSED${NC} — All tables match."
  exit 0
fi
