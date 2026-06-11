#!/bin/bash
set -e
apt-get update -qq
apt-get install -y -qq curl gnupg lsb-release > /dev/null
curl -fsSL https://packages.redis.io/gpg | gpg --dearmor --yes -o /usr/share/keyrings/redis-archive-keyring.gpg
echo "deb [signed-by=/usr/share/keyrings/redis-archive-keyring.gpg] https://packages.redis.io/deb $(lsb_release -cs) main" > /etc/apt/sources.list.d/redis.list
apt-get update -qq
apt-get install -y -qq redis > /dev/null
redis-server --version
service redis-server restart || true
sleep 1
redis-cli ping
