#!/usr/bin/env bash
# ============================================================================
# BREWW Platform — Provisionamento idempotente do Mosquitto na VPS
# Executado automaticamente pelo GitHub Actions (.github/workflows/deploy.yml),
# antes do "pm2 restart" do backend.
#
# Estado final:
#   - Autenticacao obrigatoria (allow_anonymous false + password_file)
#   - esp32user    -> placas (senha que o firmware envia); so publica telemetria e le comandos
#   - breww_server -> backend (senha aleatoria gravada no .env); acesso total
#   - Listener unico 1883 (o WebSocket 9001 deixou de ser usado pelo site)
#   - ACL de backend/mosquitto/acl.conf
# Se o Mosquitto nao subir ou a autenticacao nao se comportar como esperado, tudo e
# revertido para o backup feito no inicio.
# ============================================================================
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
ENV_FILE="${BACKEND_DIR}/.env"
ACL_SRC="${SCRIPT_DIR}/acl.conf"
MOSQ_DIR="/etc/mosquitto"
MOSQ_CONF="${MOSQ_DIR}/mosquitto.conf"
CONF_D="${MOSQ_DIR}/conf.d"
BREWW_CONF="${CONF_D}/breww.conf"
PASSWD_FILE="${MOSQ_DIR}/passwd"
ACL_DEST="${MOSQ_DIR}/acl.conf"
DEVICE_USER="esp32user"
DEVICE_PASS="esp32"   # credencial que o firmware atual envia (config.h)
SERVER_USER="breww_server"
LOCAL_BROKER_URL="mqtt://127.0.0.1:1883"

log() { echo "[Mosquitto] $*"; }

if [ ! -d "${MOSQ_DIR}" ] || [ ! -f "${ACL_SRC}" ]; then
  log "/etc/mosquitto ou acl.conf nao encontrado. Ignorando."
  exit 0
fi
if [ "$(id -u)" -ne 0 ]; then
  log "Precisa rodar como root (usuario atual: $(id -un)). Ignorando."
  exit 0
fi
if ! command -v mosquitto_passwd >/dev/null 2>&1; then
  log "mosquitto_passwd nao encontrado. Ignorando."
  exit 0
fi

# ---------------------------------------------------------------------------
# 1. Backup (config do broker + .env do backend)
# ---------------------------------------------------------------------------
BACKUP_DIR="${MOSQ_DIR}/backup-$(date +%Y%m%d-%H%M%S)"
mkdir -p "${BACKUP_DIR}/conf.d"
cp -a "${MOSQ_CONF}" "${BACKUP_DIR}/" 2>/dev/null || true
cp -a "${CONF_D}/." "${BACKUP_DIR}/conf.d/" 2>/dev/null || true
cp -a "${ACL_DEST}" "${BACKUP_DIR}/" 2>/dev/null || true
cp -a "${PASSWD_FILE}" "${BACKUP_DIR}/" 2>/dev/null || true
touch "${ENV_FILE}"
cp -a "${ENV_FILE}" "${BACKUP_DIR}/backend.env"
chmod 700 "${BACKUP_DIR}"
log "Backup em ${BACKUP_DIR}"

config_fingerprint() {
  cat "${MOSQ_CONF}" "${CONF_D}"/*.conf "${ACL_DEST}" "${PASSWD_FILE}" 2>/dev/null | sha256sum | cut -d' ' -f1
}
BEFORE="$(config_fingerprint)"

rollback() {
  log "ERRO: $1. Revertendo para ${BACKUP_DIR}..."
  cp -a "${BACKUP_DIR}/mosquitto.conf" "${MOSQ_CONF}" 2>/dev/null || true
  find "${CONF_D}" -maxdepth 1 -name '*.conf' -delete 2>/dev/null || true
  cp -a "${BACKUP_DIR}/conf.d/." "${CONF_D}/" 2>/dev/null || true
  if [ -f "${BACKUP_DIR}/acl.conf" ]; then cp -a "${BACKUP_DIR}/acl.conf" "${ACL_DEST}"; else rm -f "${ACL_DEST}"; fi
  if [ -f "${BACKUP_DIR}/passwd" ]; then cp -a "${BACKUP_DIR}/passwd" "${PASSWD_FILE}"; else rm -f "${PASSWD_FILE}"; fi
  cp -a "${BACKUP_DIR}/backend.env" "${ENV_FILE}"
  systemctl restart mosquitto 2>/dev/null || true
  log "Rollback concluido. Estado anterior restaurado."
  exit 0
}

# ---------------------------------------------------------------------------
# 2. Usuarios e senhas
# ---------------------------------------------------------------------------
set_env() {
  local key="$1" value="$2"
  if grep -q "^${key}=" "${ENV_FILE}"; then
    sed -i "s|^${key}=.*|${key}=${value}|" "${ENV_FILE}"
  else
    echo "${key}=${value}" >> "${ENV_FILE}"
  fi
}

SERVER_PASS=""
if grep -q "^MQTT_USER=${SERVER_USER}$" "${ENV_FILE}"; then
  SERVER_PASS="$(grep -E '^MQTT_PASSWORD=' "${ENV_FILE}" | head -n1 | cut -d= -f2-)"
fi
if [ -z "${SERVER_PASS}" ]; then
  SERVER_PASS="$(openssl rand -hex 24 2>/dev/null || head -c 24 /dev/urandom | od -An -tx1 | tr -d ' \n')"
  log "Gerada nova senha para ${SERVER_USER}."
fi

[ -f "${PASSWD_FILE}" ] || touch "${PASSWD_FILE}"
mosquitto_passwd -b "${PASSWD_FILE}" "${DEVICE_USER}" "${DEVICE_PASS}" || rollback "falha ao gravar ${DEVICE_USER}"
mosquitto_passwd -b "${PASSWD_FILE}" "${SERVER_USER}" "${SERVER_PASS}" || rollback "falha ao gravar ${SERVER_USER}"
if getent group mosquitto >/dev/null 2>&1; then chown root:mosquitto "${PASSWD_FILE}"; fi
chmod 640 "${PASSWD_FILE}"

set_env MQTT_USER "${SERVER_USER}"
set_env MQTT_PASSWORD "${SERVER_PASS}"
# Backend fala com o broker local pela porta 1883 (o WebSocket 9001 sera desativado)
set_env VITE_MQTT_BROKER "${LOCAL_BROKER_URL}"
chmod 600 "${ENV_FILE}"

# ---------------------------------------------------------------------------
# 3. Configuracao do broker
# ---------------------------------------------------------------------------
# Remove do arquivo principal as diretivas de listener/autenticacao (passam a viver em breww.conf)
sed -i -E '/^\s*(listener|port|protocol|allow_anonymous|password_file|acl_file|per_listener_settings)\b/d' "${MOSQ_CONF}"
grep -q -E "^\s*include_dir\s+${CONF_D}\s*$" "${MOSQ_CONF}" || echo "include_dir ${CONF_D}" >> "${MOSQ_CONF}"

# Outros arquivos de conf.d (antigos listeners anonimos) saem; ficam no backup
mkdir -p "${CONF_D}"
for f in "${CONF_D}"/*.conf; do
  [ -e "$f" ] || continue
  [ "$f" = "${BREWW_CONF}" ] && continue
  log "Desativando ${f} (copia no backup)"
  rm -f "$f"
done

cat > "${BREWW_CONF}" <<EOF
# Gerenciado por backend/mosquitto/setup-vps-mosquitto.sh — nao editar a mao
per_listener_settings false
allow_anonymous false
password_file ${PASSWD_FILE}
acl_file ${ACL_DEST}

listener 1883
EOF

cp "${ACL_SRC}" "${ACL_DEST}"
chmod 644 "${ACL_DEST}"

AFTER="$(config_fingerprint)"
if [ "${BEFORE}" = "${AFTER}" ] && systemctl is-active --quiet mosquitto; then
  log "Configuracao ja estava atualizada; Mosquitto nao precisa reiniciar."
  rm -rf "${BACKUP_DIR}"
  exit 0
fi

# ---------------------------------------------------------------------------
# 4. Reinicia e valida
# ---------------------------------------------------------------------------
log "Reiniciando Mosquitto..."
systemctl restart mosquitto 2>/dev/null || true
sleep 2
systemctl is-active --quiet mosquitto || rollback "Mosquitto nao iniciou com a nova configuracao"

if command -v mosquitto_pub >/dev/null 2>&1; then
  T="brewbrother/global/ping"
  mosquitto_pub -h 127.0.0.1 -p 1883 -u "${SERVER_USER}" -P "${SERVER_PASS}" -t "${T}" -m setup -q 1 2>/dev/null \
    || rollback "${SERVER_USER} nao conseguiu publicar"
  mosquitto_pub -h 127.0.0.1 -p 1883 -u "${DEVICE_USER}" -P "${DEVICE_PASS}" -t "${T}" -m setup -q 1 2>/dev/null \
    || rollback "${DEVICE_USER} nao conseguiu conectar"
  if mosquitto_pub -h 127.0.0.1 -p 1883 -t "${T}" -m anon -q 1 2>/dev/null; then
    rollback "conexao anonima ainda e aceita"
  fi
  if mosquitto_pub -h 127.0.0.1 -p 1883 -u "${SERVER_USER}" -P "senha-errada" -t "${T}" -m x -q 1 2>/dev/null; then
    rollback "senha errada ainda e aceita"
  fi
  log "Validacao OK: anonimo e senha errada recusados; ${SERVER_USER} e ${DEVICE_USER} conectam."
else
  log "mosquitto_pub nao instalado; validacao de autenticacao pulada (servico esta ativo)."
fi

log "Mosquitto protegido: autenticacao obrigatoria, ACL ativo, WebSocket 9001 desativado."
log "O backend sera reiniciado pelo deploy com MQTT_USER=${SERVER_USER}."
