#!/usr/bin/env bash
set -euo pipefail
mongosh --port 27017 --quiet --eval 'db.adminCommand({ shutdown: 1 })' || true
mongosh --port 27018 --quiet --eval 'db.adminCommand({ shutdown: 1 })' || true
mongosh --port 27019 --quiet --eval 'db.adminCommand({ shutdown: 1 })' || true
echo "Shutdown requested for 27017, 27018, and 27019"
