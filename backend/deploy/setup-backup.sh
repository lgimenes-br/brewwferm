#!/usr/bin/env bash
# ============================================================================
# Backup diario do banco (rodado pelo deploy; idempotente)
#  - instala /usr/local/bin/breww-db-backup e o cron /etc/cron.d/breww-db-backup (03:30)
#  - copias em /var/backups/breww: diarias por 14 dias + semanais (domingo) por 8 semanas
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

# Domingo: copia semanal
if [ "$(date +%u)" = "7" ] && [ "${ok}" = "1" ]; then
  mkdir -p "${DEST}/semanal" && cp -r "${DEST}/diario/${DAY}" "${DEST}/semanal/${DAY}"
fi
# Retencao: 14 dias de diarios, 56 dias de semanais
find "${DEST}/diario" -mindepth 1 -maxdepth 1 -type d -mtime +14 -exec rm -rf {} + 2>/dev/null
find "${DEST}/semanal" -mindepth 1 -maxdepth 1 -type d -mtime +56 -exec rm -rf {} + 2>/dev/null
echo "=== $(date '+%F %T') fim (status ${ok})"
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
exit 0
