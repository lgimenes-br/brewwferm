#!/usr/bin/env bash
# ============================================================================
# BREWW Platform — Script Idempotente de Provisionamento Mosquitto ACL na VPS
# ============================================================================
# Uso na VPS:
#   sudo bash /var/www/breww-backend/mosquitto/setup-vps-mosquitto.sh
# ============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ACL_SRC="${SCRIPT_DIR}/acl.conf"
ACL_DEST="/etc/mosquitto/acl.conf"
MOSQ_CONF="/etc/mosquitto/mosquitto.conf"

if [ ! -d "/etc/mosquitto" ]; then
  echo "[Mosquitto ACL] Diretório /etc/mosquitto não encontrado nesta máquina. Abortando."
  exit 0
fi

echo "[Mosquitto ACL] Copiando ${ACL_SRC} para ${ACL_DEST}..."
cp "${ACL_SRC}" "${ACL_DEST}"
chmod 644 "${ACL_DEST}"

if [ -f "${MOSQ_CONF}" ]; then
  if ! grep -q "^acl_file /etc/mosquitto/acl.conf" "${MOSQ_CONF}"; then
    echo "[Mosquitto ACL] Adicionando acl_file /etc/mosquitto/acl.conf ao ${MOSQ_CONF}..."
    echo "" >> "${MOSQ_CONF}"
    echo "acl_file /etc/mosquitto/acl.conf" >> "${MOSQ_CONF}"
  else
    echo "[Mosquitto ACL] acl_file já está configurado em ${MOSQ_CONF}."
  fi
fi

if command -v systemctl >/dev/null 2>&1 && systemctl is-active --quiet mosquitto; then
  echo "[Mosquitto ACL] Recarregando serviço mosquitto (SIGHUP)..."
  systemctl reload mosquitto || systemctl restart mosquitto
  echo "[Mosquitto ACL] Mosquitto atualizado com sucesso!"
fi
