#!/usr/bin/env bash
# ============================================================================
# Regras idempotentes do ufw na VPS (rodado pelo deploy)
#  - 8883/tcp: MQTT com TLS (placas)
# ============================================================================
set -uo pipefail
log() { echo "[firewall] $*"; }
if [ "$(id -u)" -ne 0 ] || ! command -v ufw >/dev/null 2>&1; then
  log "ufw indisponivel ou sem root. Ignorando."
  exit 0
fi
if ufw status | grep -qE "^8883/tcp\s+ALLOW"; then
  log "8883/tcp ja liberada."
else
  ufw allow 8883/tcp comment 'MQTT TLS (placas)' >/dev/null && log "8883/tcp liberada no ufw."
fi
exit 0
