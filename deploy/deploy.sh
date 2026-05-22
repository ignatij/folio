#!/usr/bin/env bash
# Manual deploy script for the Folio blog (folio.mk).
# Usage: DEPLOY_HOST=<vm-ip-or-hostname> bash deploy/deploy.sh
#
# Requires:
#   - DEPLOY_HOST env var set to the VM's IP or hostname
#   - SSH access to root@$DEPLOY_HOST (key-based)
#   - Optional: SSH_KEY_FILE path to a specific private key
#
# The blog runs at /opt/folio/ on port 8082, keeping it separate from the
# Folio Platform which lives at /opt/platform/ on port 8080.
set -euo pipefail

HOST="${DEPLOY_HOST:?Set DEPLOY_HOST to the VM IP or hostname}"
SSH_KEY_FILE="${SSH_KEY_FILE:-}"
REMOTE_USER="root"
REMOTE_DIR="/opt/folio"
REMOTE_BINARY="${REMOTE_DIR}/folio-server"

SSH_OPTS=(-o StrictHostKeyChecking=accept-new)
[[ -n "$SSH_KEY_FILE" ]] && SSH_OPTS+=(-i "$SSH_KEY_FILE")

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="${SCRIPT_DIR}/.."

echo "==> Building Go binary and admin UI..."
cd "${REPO_DIR}"
mkdir -p dist
CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -C backend -o ../dist/folio-server ./cmd/server/main.go
cd "${REPO_DIR}/admin" && npm run build
cd "${REPO_DIR}"

echo "==> Creating remote directories..."
ssh "${SSH_OPTS[@]}" "${REMOTE_USER}@${HOST}" \
  "mkdir -p ${REMOTE_DIR}/admin/dist ${REMOTE_DIR}/site/dist ${REMOTE_DIR}/uploads ${REMOTE_DIR}/data"

echo "==> Uploading binary to ${REMOTE_USER}@${HOST}:${REMOTE_BINARY} ..."
scp "${SSH_OPTS[@]}" dist/folio-server "${REMOTE_USER}@${HOST}:${REMOTE_BINARY}"
ssh "${SSH_OPTS[@]}" "${REMOTE_USER}@${HOST}" "chmod +x ${REMOTE_BINARY}"

echo "==> Uploading config files..."
scp "${SSH_OPTS[@]}" config.yaml theme.json "${REMOTE_USER}@${HOST}:${REMOTE_DIR}/"

echo "==> Uploading admin UI..."
ssh "${SSH_OPTS[@]}" "${REMOTE_USER}@${HOST}" "rm -rf ${REMOTE_DIR}/admin/dist && mkdir -p ${REMOTE_DIR}/admin/dist"
scp -r "${SSH_OPTS[@]}" admin/dist/. "${REMOTE_USER}@${HOST}:${REMOTE_DIR}/admin/dist/"

echo "==> Uploading site source..."
ssh "${SSH_OPTS[@]}" "${REMOTE_USER}@${HOST}" "mkdir -p ${REMOTE_DIR}/site/src ${REMOTE_DIR}/site/dist"
scp "${SSH_OPTS[@]}" site/build.sh "${REMOTE_USER}@${HOST}:${REMOTE_DIR}/site/build.sh"
scp "${SSH_OPTS[@]}" site/package.json site/package-lock.json site/eleventy.config.js site/tailwind.config.js "${REMOTE_USER}@${HOST}:${REMOTE_DIR}/site/"
scp -r "${SSH_OPTS[@]}" site/src/. "${REMOTE_USER}@${HOST}:${REMOTE_DIR}/site/src/"

echo "==> Fixing ownership..."
ssh "${SSH_OPTS[@]}" "${REMOTE_USER}@${HOST}" "chown -R folio:folio ${REMOTE_DIR}"

echo "==> Installing site dependencies and building on server..."
ssh "${SSH_OPTS[@]}" "${REMOTE_USER}@${HOST}" \
  "chmod +x ${REMOTE_DIR}/site/build.sh && cd ${REMOTE_DIR}/site && npm ci && SITE_DIST=${REMOTE_DIR}/site/dist BACKEND_URL=http://localhost:8082 bash build.sh"

echo "==> Restarting service..."
ssh "${SSH_OPTS[@]}" "${REMOTE_USER}@${HOST}" "systemctl restart folio"

echo ""
echo "Deploy complete."
echo "Check status: ssh ${REMOTE_USER}@${HOST} 'systemctl status folio'"
echo "Check logs:   ssh ${REMOTE_USER}@${HOST} 'journalctl -u folio -n 50'"
