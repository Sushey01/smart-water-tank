#!/usr/bin/env bash
set -euo pipefail
mongosh --port 27017 --quiet --eval 'rs.status().members.forEach(m => print(m.name + " " + m.stateStr))'
