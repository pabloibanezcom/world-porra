#!/bin/bash
# Copy reference data from test DB to production and staging databases.
# Drops user-generated collections (users, leagues, predictions, etc.) after restore.
# Usage: ./scripts/setup-db.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="$SCRIPT_DIR/../api/.env"

if [ ! -f "$ENV_FILE" ]; then
  echo "Error: api/.env not found"
  exit 1
fi

# Load MONGODB_URI from api/.env
MONGODB_URI=$(grep '^MONGODB_URI=' "$ENV_FILE" | cut -d'=' -f2-)
if [ -z "$MONGODB_URI" ]; then
  echo "Error: MONGODB_URI not found in api/.env"
  exit 1
fi

# Extract base URI (strip database name and query params)
BASE_URI=$(echo "$MONGODB_URI" | sed 's|/[^/?]*?|/?|' | sed 's|/?$||')
# Rebuild clean base: scheme + credentials + host
BASE_URI=$(echo "$MONGODB_URI" | grep -oE 'mongodb\+srv://[^/]+')

SOURCE_DB="test"
PROD_DB="world-porra"
STG_DB="world-porra-stg"
DUMP_DIR="/tmp/world-porra-dump"

# Collections to drop after restore (user-generated data)
USER_COLLECTIONS="users leagues predictions grouppredictions tournamentpredictions pushsubscriptions"

echo "==> Dumping source database: $SOURCE_DB"
rm -rf "$DUMP_DIR"
mongodump \
  --uri="$MONGODB_URI" \
  --db="$SOURCE_DB" \
  --out="$DUMP_DIR"

restore_and_clean() {
  local TARGET_DB=$1
  echo ""
  echo "==> Restoring to: $TARGET_DB"
  mongorestore \
    --uri="$BASE_URI/$TARGET_DB?appName=Cluster0" \
    --nsFrom="${SOURCE_DB}.*" \
    --nsTo="${TARGET_DB}.*" \
    --drop \
    "$DUMP_DIR"

  echo "==> Dropping user-generated collections from $TARGET_DB"
  for col in $USER_COLLECTIONS; do
    echo "    Dropping $col..."
    mongosh "$BASE_URI/$TARGET_DB?appName=Cluster0" \
      --quiet \
      --eval "db.${col}.drop()" 2>/dev/null || true
  done
  echo "    Done."
}

restore_and_clean "$PROD_DB"
restore_and_clean "$STG_DB"

rm -rf "$DUMP_DIR"

echo ""
echo "==> Done! Databases populated:"
echo "    - $PROD_DB (production)"
echo "    - $STG_DB  (staging)"
echo ""
echo "Next: add these MONGODB_URI values to Vercel environment variables:"
echo "    Production: $BASE_URI/$PROD_DB?appName=Cluster0"
echo "    Staging:    $BASE_URI/$STG_DB?appName=Cluster0"
