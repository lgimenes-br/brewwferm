#!/usr/bin/env bash
# ============================================================================
# BREWW Platform — Script Idempotente de Provisionamento Mosquitto ACL na VPS
# Executado automaticamente pelo GitHub Actions (.github/workflows/deploy.yml)
# ============================================================================
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
ENV_FILE="${BACKEND_DIR}/.env"
ACL_SRC="${SCRIPT_DIR}/acl.conf"
ACL_DEST="/etc/mosquitto/acl.conf"
MOSQ_CONF="/etc/mosquitto/mosquitto.conf"

if [ ! -d "/etc/mosquitto" ] || [ ! -f "${ACL_SRC}" ]; then
  echo "[Mosquitto ACL] /etc/mosquitto ou acl.conf não encontrado. Ignorando."
  exit 0
fi

SUDO=""
if [ "$(id -u)" -ne 0 ] && command -v sudo >/dev/null 2>&1; then
  SUDO="sudo -n"
fi


# Detecta arquivo de senhas configurado no Mosquitto (padrão: /etc/mosquitto/passwd)
PASSWD_FILE=$(grep -h -E "^\s*password_file\s+" /etc/mosquitto/mosquitto.conf /etc/mosquitto/conf.d/*.conf 2>/dev/null | head -n 1 | awk '{print $2}' || true)
if [ -z "${PASSWD_FILE}" ] && [ -f "/etc/mosquitto/passwd" ]; then
  PASSWD_FILE="/etc/mosquitto/passwd"
fi

# Provisiona usuário exclusivo breww_server para o backend Node.js se mosquitto_passwd e arquivo de senhas existirem
if [ -n "${PASSWD_FILE}" ] && [ -f "${PASSWD_FILE}" ] && command -v mosquitto_passwd >/dev/null 2>&1; then
  if ! ${SUDO} grep -q "^breww_server:" "${PASSWD_FILE}" 2>/dev/null; then
    NEW_MQTT_PASS=$(openssl rand -hex 16 2>/dev/null || head -c 16 /dev/urandom | od -An -tx1 | tr -d ' \n')
    if ${SUDO} mosquitto_passwd -b "${PASSWD_FILE}" breww_server "${NEW_MQTT_PASS}" 2>/dev/null; then
      echo "[Mosquitto ACL] Usuário exclusivo 'breww_server' criado em ${PASSWD_FILE}."
      touch "${ENV_FILE}"
      if grep -q "^MQTT_USER=" "${ENV_FILE}"; then
        sed -i "s|^MQTT_USER=.*|MQTT_USER=breww_server|" "${ENV_FILE}"
      else
        echo "MQTT_USER=breww_server" >> "${ENV_FILE}"
      fi
      if grep -q "^MQTT_PASSWORD=" "${ENV_FILE}"; then
        sed -i "s|^MQTT_PASSWORD=.*|MQTT_PASSWORD=${NEW_MQTT_PASS}|" "${ENV_FILE}"
      else
        echo "MQTT_PASSWORD=${NEW_MQTT_PASS}" >> "${ENV_FILE}"
      fi
    fi
  else
    echo "[Mosquitto ACL] Usuário 'breww_server' já existe em ${PASSWD_FILE}."
  fi
fi

# O ACL restringe esp32user a SO LER comandos. Ele so pode ser instalado se o backend ja
# estiver usando a credencial propria (breww_server); senao o backend perderia a capacidade
# de enviar comandos aos aparelhos.
if ! grep -q "^MQTT_USER=breww_server$" "${ENV_FILE}" 2>/dev/null; then
  echo "[Mosquitto ACL] AVISO: backend ainda nao usa breww_server (${ENV_FILE}). ACL NAO atualizado para nao bloquear comandos."
  exit 0
fi

echo "[Mosquitto ACL] Instalando ${ACL_DEST}..."
${SUDO} cp "${ACL_SRC}" "${ACL_DEST}" 2>/dev/null || {
  echo "[Mosquitto ACL] Sem permissão de escrita em /etc/mosquitto. Ignorando."
  exit 0
}
${SUDO} chmod 644 "${ACL_DEST}" 2>/dev/null || true

# Ativa acl_file no mosquitto.conf se ainda não estiver ativo em nenhum arquivo de configuração
ADDED_ACL_LINE=0
if [ -f "${MOSQ_CONF}" ]; then
  if ! grep -q -E "^\s*acl_file\s+" /etc/mosquitto/mosquitto.conf /etc/mosquitto/conf.d/*.conf 2>/dev/null; then
    echo "[Mosquitto ACL] Adicionando acl_file ${ACL_DEST} em ${MOSQ_CONF}..."
    echo "" | ${SUDO} tee -a "${MOSQ_CONF}" >/dev/null
    echo "acl_file ${ACL_DEST}" | ${SUDO} tee -a "${MOSQ_CONF}" >/dev/null
    ADDED_ACL_LINE=1
  else
    echo "[Mosquitto ACL] acl_file já está configurado no Mosquitto."
  fi
fi

# Recarrega o serviço Mosquitto com rollback automático caso haja qualquer incompatibilidade de listener
if command -v systemctl >/dev/null 2>&1 && systemctl is-active --quiet mosquitto; then
  echo "[Mosquitto ACL] Recarregando serviço mosquitto..."
  ${SUDO} systemctl reload mosquitto 2>/dev/null || ${SUDO} systemctl restart mosquitto 2>/dev/null || true
  sleep 1
  if ! systemctl is-active --quiet mosquitto; then
    echo "[Mosquitto ACL] AVISO: Mosquitto não iniciou com acl_file; revertendo linha para manter disponibilidade..."
    if [ "${ADDED_ACL_LINE}" -eq 1 ]; then
      ${SUDO} sed -i '\|acl_file /etc/mosquitto/acl.conf|d' "${MOSQ_CONF}" 2>/dev/null || true
      ${SUDO} systemctl restart mosquitto 2>/dev/null || true
    fi
  else
    echo "[Mosquitto ACL] Serviço mosquitto online e operando com ACL ativa!"
  fi
fi
