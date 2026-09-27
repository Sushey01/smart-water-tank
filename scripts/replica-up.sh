#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p mongodb/node1/data mongodb/node2/data mongodb/node3/data mongodb/logs
mongod --replSet rs0 --port 27017 --dbpath ./mongodb/node1/data --logpath ./mongodb/logs/node1.log --fork --bind_ip 127.0.0.1
mongod --replSet rs0 --port 27018 --dbpath ./mongodb/node2/data --logpath ./mongodb/logs/node2.log --fork --bind_ip 127.0.0.1
mongod --replSet rs0 --port 27019 --dbpath ./mongodb/node3/data --logpath ./mongodb/logs/node3.log --fork --bind_ip 127.0.0.1
echo "Three mongod processes started. Initiate once with: mongosh --port 27017 --eval 'rs.initiate({_id:\"rs0\", members:[{_id:0,host:\"127.0.0.1:27017\"},{_id:1,host:\"127.0.0.1:27018\"},{_id:2,host:\"127.0.0.1:27019\"}]})'"
