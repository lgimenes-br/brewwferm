#!/usr/bin/env bash
# ============================================================================
# Backup diario do banco (rodado pelo deploy; idempotente)
#  - instala /usr/local/bin/breww-db-backup e o cron /etc/cron.d/breww-db-backup (03:30)
#  - copias em /var/backups/breww: diarias por 14 dias + semanais (domingo) por 8 semanas; banco e configuracoes do servidor
#  - restaurar: ver backend/deploy/RESTAURAR-BACKUP.md
# ============================================================================
set -uo pipefail
log() { echo "[backup] $*"; }

if [ "$(id -u)" -ne 0 ] || ! command -v mariadb-dump >/dev/null 2>&1; then
  log "Sem root ou sem mariadb-dump. Ignorando."
  exit 0
fi

BIN=/usr/local/bin/breww-db-backup
cat > "${BIN}" <<'SCRIPT'
#!/usr/bin/env bash
# Gerenciado por backend/deploy/setup-backup.sh
set -uo pipefail
ENV_FILE=/var/www/breww-backend/.env
DEST=/var/backups/breww
DAY=$(date +%F)
LOG=/var/log/breww-backup.log
exec >>"${LOG}" 2>&1
echo "=== $(date '+%F %T') inicio"

val() { grep -E "^$1=" "${ENV_FILE}" | tail -1 | cut -d= -f2- | sed -E "s/^['\"]//; s/['\"]$//"; }
DB_HOST=$(val DB_HOST); DB_USER=$(val DB_USER); DB_PASS=$(val DB_PASS)
DB_NAME=$(val DB_NAME); ING_DB=$(val DB_INGREDIENTS_NAME)
DB_HOST=${DB_HOST:-localhost}; DB_NAME=${DB_NAME:-brewbrother}; ING_DB=${ING_DB:-breww_ingredients}

# Senha num arquivo temporario so do root (nunca na linha de comando)
CNF=$(mktemp); chmod 600 "${CNF}"
trap 'rm -f "${CNF}"' EXIT
printf '[client]\nuser=%s\npassword=%s\nhost=%s\n' "${DB_USER}" "${DB_PASS}" "${DB_HOST}" > "${CNF}"

mkdir -p "${DEST}/diario/${DAY}" && chmod 700 "${DEST}"
ok=1
for DB in "${DB_NAME}" "${ING_DB}"; do
  OUT="${DEST}/diario/${DAY}/${DB}.sql.gz"
  if mariadb-dump --defaults-extra-file="${CNF}" --single-transaction --quick --routines --triggers --databases "${DB}" | gzip -9 > "${OUT}.tmp" \
     && gzip -t "${OUT}.tmp" && [ "$(stat -c %s "${OUT}.tmp")" -gt 1000 ]; then
    mv "${OUT}.tmp" "${OUT}"
    echo "ok ${DB}: $(du -h "${OUT}" | cut -f1)"
  else
    rm -f "${OUT}.tmp"; ok=0
    echo "ERRO ao copiar ${DB}"
  fi
done

# Configuracoes do servidor: sem elas, remontar a VPS do zero levaria horas. Vao junto com o banco
# (e para o Drive, criptografadas). So entra o que existe; falhar aqui nao impede o backup do banco.
CONF_PATHS=(etc/nginx etc/mosquitto etc/ssh/sshd_config etc/fail2ban/jail.d etc/cron.d etc/letsencrypt
            etc/systemd/journald.conf.d etc/apt/apt.conf.d/20auto-upgrades usr/local/bin/breww-db-backup
            var/www/breww-backend/.env var/www/breww-backend/ecosystem.config.cjs root/.pm2/dump.pm2)
CONF_LIST=()
for p in "${CONF_PATHS[@]}"; do [ -e "/${p}" ] && CONF_LIST+=("${p}"); done
CONF="${DEST}/diario/${DAY}/configuracoes.tar.gz"
if tar czf "${CONF}.tmp" -C / "${CONF_LIST[@]}" 2>/dev/null && gzip -t "${CONF}.tmp"; then
  mv "${CONF}.tmp" "${CONF}"
  echo "ok configuracoes: $(du -h "${CONF}" | cut -f1) (${#CONF_LIST[@]} itens)"
else
  rm -f "${CONF}.tmp"
  echo "ERRO ao copiar as configuracoes (o banco segue)"
fi

# Domingo: copia semanal
if [ "$(date +%u)" = "7" ] && [ "${ok}" = "1" ]; then
  mkdir -p "${DEST}/semanal" && cp -r "${DEST}/diario/${DAY}" "${DEST}/semanal/${DAY}"
fi
# Retencao: 14 dias de diarios, 56 dias de semanais
find "${DEST}/diario" -mindepth 1 -maxdepth 1 -type d -mtime +14 -exec rm -rf {} + 2>/dev/null
find "${DEST}/semanal" -mindepth 1 -maxdepth 1 -type d -mtime +56 -exec rm -rf {} + 2>/dev/null

# Copia fora da VPS: Google Drive, criptografada (rclone crypt "breww-offsite" em /root/.config/rclone).
# Sem o remoto configurado, pula. Retencao no Drive: 60 dias.
if [ "${ok}" = "1" ] && command -v rclone >/dev/null 2>&1 && rclone listremotes 2>/dev/null | grep -x 'breww-offsite:' >/dev/null; then # sem -q: com pipefail, o -q fecha o cano cedo e o rclone falha
  if rclone copy "${DEST}/diario/${DAY}" "breww-offsite:diario/${DAY}" --retries 3 --low-level-retries 10; then
    echo "ok fora da VPS: diario/${DAY}"
    rclone delete "breww-offsite:diario" --min-age 60d 2>/dev/null
    rclone rmdirs "breww-offsite:diario" --leave-root 2>/dev/null
  else
    ok=0
    echo "ERRO ao enviar para fora da VPS"
  fi
fi
echo "=== $(date '+%F %T') fim (status ${ok})"

# Aviso por e-mail (healthchecks.io): sucesso = ping; falha = ping em /fail; sem ping ate o fim do prazo
# (o cron nem rodou, VPS fora do ar) = o servico tambem avisa. A URL fica so na VPS (/root, chmod 600).
HC_FILE=/root/.breww-healthcheck-url
if [ -s "${HC_FILE}" ]; then
  HC_URL=$(head -1 "${HC_FILE}")
  [ "${ok}" = "1" ] || HC_URL="${HC_URL}/fail"
  curl -fsS -m 10 --retry 3 -o /dev/null --data-raw "$(tail -8 "${LOG}")" "${HC_URL}" && echo "aviso enviado (healthchecks)" || echo "aviso NAO enviado (healthchecks)"
fi
[ "${ok}" = "1" ]
SCRIPT
chmod 700 "${BIN}"

CRON=/etc/cron.d/breww-db-backup
WANT="30 3 * * * root ${BIN}"
if ! grep -qF "${WANT}" "${CRON}" 2>/dev/null; then
  printf '# Gerenciado por backend/deploy/setup-backup.sh\nSHELL=/bin/bash\nPATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin\n%s\n' "${WANT}" > "${CRON}"
  chmod 644 "${CRON}"
  log "Cron do backup instalado (03:30 diario)."
else
  log "Cron do backup ja configurado."
fi
mkdir -p /var/backups/breww && chmod 700 /var/backups/breww
# rclone para a copia fora da VPS (o remoto e a senha ficam so no servidor, nunca no repositorio)
command -v rclone >/dev/null 2>&1 || DEBIAN_FRONTEND=noninteractive apt-get install -y -qq rclone >/dev/null 2>&1 || log "Nao instalou o rclone."
exit 0
