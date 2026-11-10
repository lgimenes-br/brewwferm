#!/usr/bin/env bash
# ============================================================================
# Ajustes idempotentes do nginx na VPS (rodado pelo deploy)
#  - client_max_body_size 8m: o GitHub Actions do firmware envia o .bin (~1.6 MB)
#    para POST /api/firmware/release; o padrao do nginx (1 MB) devolvia 413.
# Valida com "nginx -t" antes de recarregar e desfaz se a configuracao nao passar.
# ============================================================================
set -uo pipefail

log() { echo "[nginx] $*"; }
CONF="/etc/nginx/conf.d/breww-upload.conf"
WANT="client_max_body_size 8m;"

if [ "$(id -u)" -ne 0 ] || ! command -v nginx >/dev/null 2>&1 || [ ! -d /etc/nginx/conf.d ]; then
  log "nginx/conf.d indisponivel ou sem root. Ignorando."
  exit 0
fi

# Diretivas definidas dentro de server{} sobrescrevem a do http{}; so avisamos
OVERRIDES=$(grep -rn "client_max_body_size" /etc/nginx/sites-enabled /etc/nginx/nginx.conf 2>/dev/null || true)
if [ -n "${OVERRIDES}" ]; then
  log "AVISO: client_max_body_size tambem definido em:"
  echo "${OVERRIDES}" | sed 's/^/[nginx]   /'
fi

if [ -f "${CONF}" ] && grep -qF "${WANT}" "${CONF}"; then
  log "Limite de upload ja configurado."
  exit 0
fi

BACKUP=""
[ -f "${CONF}" ] && BACKUP="$(cat "${CONF}")"
cat > "${CONF}" <<EOF
# Gerenciado por backend/deploy/setup-nginx.sh
# Upload do firmware (.bin) pelo GitHub Actions
${WANT}
EOF

if nginx -t 2>/tmp/breww-nginx-test.log; then
  systemctl reload nginx 2>/dev/null || nginx -s reload
  log "Limite de upload ajustado para 8 MB e nginx recarregado."
else
  log "ERRO: configuracao invalida, desfazendo:"
  sed 's/^/[nginx]   /' /tmp/breww-nginx-test.log
  if [ -n "${BACKUP}" ]; then printf '%s\n' "${BACKUP}" > "${CONF}"; else rm -f "${CONF}"; fi
fi
exit 0
