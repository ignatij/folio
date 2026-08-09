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
CADDY_CONFIG="/etc/caddy/Caddyfile"
CADDY_SITES_DIR="/etc/caddy/sites"
CADDY_SITE_FILE="${CADDY_SITES_DIR}/folio-pianist.caddy"

SSH_OPTS=(-o "StrictHostKeyChecking=${STRICT_HOST_KEY_CHECKING:-accept-new}")
[[ -n "$SSH_KEY_FILE" ]] && SSH_OPTS+=(-i "$SSH_KEY_FILE")

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="${SCRIPT_DIR}/.."

echo "==> Building Go binary and admin UI..."
cd "${REPO_DIR}"
mkdir -p dist
CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -C backend -o ../dist/folio-server ./cmd/server/main.go
CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -C backend -o ../dist/create-admin ./cmd/create-admin/main.go
cd "${REPO_DIR}/admin" && npm ci && npm run build
cd "${REPO_DIR}"

echo "==> Creating remote directories..."
ssh "${SSH_OPTS[@]}" "${REMOTE_USER}@${HOST}" \
  "mkdir -p ${REMOTE_DIR}/admin/dist ${REMOTE_DIR}/site/dist ${REMOTE_DIR}/uploads ${REMOTE_DIR}/data"

echo "==> Uploading binary to ${REMOTE_USER}@${HOST}:${REMOTE_BINARY} ..."
scp "${SSH_OPTS[@]}" dist/folio-server "${REMOTE_USER}@${HOST}:/tmp/folio-server"
scp "${SSH_OPTS[@]}" dist/create-admin "${REMOTE_USER}@${HOST}:/tmp/create-admin"
ssh "${SSH_OPTS[@]}" "${REMOTE_USER}@${HOST}" \
  "mv /tmp/folio-server ${REMOTE_BINARY} && mv /tmp/create-admin ${REMOTE_DIR}/create-admin && chmod +x ${REMOTE_BINARY} ${REMOTE_DIR}/create-admin"

echo "==> Uploading config files..."
scp "${SSH_OPTS[@]}" config.yaml theme.json "${REMOTE_USER}@${HOST}:${REMOTE_DIR}/"

echo "==> Uploading pianist Caddy site config..."
scp "${SSH_OPTS[@]}" deploy/Caddyfile.server "${REMOTE_USER}@${HOST}:/tmp/folio-pianist.caddy"
ssh "${SSH_OPTS[@]}" "${REMOTE_USER}@${HOST}" \
  "CADDY_CONFIG='${CADDY_CONFIG}' CADDY_SITES_DIR='${CADDY_SITES_DIR}' CADDY_SITE_FILE='${CADDY_SITE_FILE}' bash -s" <<'REMOTE'
set -euo pipefail

if ! grep -Eq '^[[:space:]]*import[[:space:]]+/etc/caddy/sites/\*\.caddy([[:space:]]|$)' "${CADDY_CONFIG}"; then
  echo "ERROR: ${CADDY_CONFIG} must contain: import /etc/caddy/sites/*.caddy" >&2
  rm -f /tmp/folio-pianist.caddy
  exit 1
fi

mkdir -p "${CADDY_SITES_DIR}"
caddy fmt --overwrite /tmp/folio-pianist.caddy

backup=""
if [[ -f "${CADDY_SITE_FILE}" ]]; then
  backup="$(mktemp)"
  cp "${CADDY_SITE_FILE}" "${backup}"
fi

install -m 0644 /tmp/folio-pianist.caddy "${CADDY_SITE_FILE}"
rm -f /tmp/folio-pianist.caddy

restore_previous_config() {
  if [[ -n "${backup}" ]]; then
    install -m 0644 "${backup}" "${CADDY_SITE_FILE}"
  else
    rm -f "${CADDY_SITE_FILE}"
  fi
}

if ! caddy validate --config "${CADDY_CONFIG}"; then
  restore_previous_config
  rm -f "${backup}"
  echo "ERROR: Caddy configuration is invalid; restored the previous pianist site config." >&2
  exit 1
fi

if ! systemctl reload caddy; then
  restore_previous_config
  caddy validate --config "${CADDY_CONFIG}" && systemctl reload caddy || true
  rm -f "${backup}"
  echo "ERROR: Caddy reload failed; restored the previous pianist site config." >&2
  exit 1
fi

rm -f "${backup}"
REMOTE

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
