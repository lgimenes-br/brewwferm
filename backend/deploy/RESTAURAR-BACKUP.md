# Restaurar o banco a partir do backup

Os backups ficam na VPS em `/var/backups/breww`:

- `diario/AAAA-MM-DD/` — últimos 14 dias
- `semanal/AAAA-MM-DD/` — domingos das últimas 8 semanas

Cada pasta tem `brewbrother.sql.gz` (banco principal) e `breww_ingredients.sql.gz`.
Registro das execuções: `/var/log/breww-backup.log`. Rodar na hora: `sudo breww-db-backup`.

## Recuperar só uma conta ou alguns dados (recomendado)

Restaure numa **cópia** e copie o que precisa, sem mexer no banco em uso:

```bash
cd /var/backups/breww/diario/2026-11-12
mariadb -e "CREATE DATABASE brewbrother_restaurado"
zcat brewbrother.sql.gz | sed 's/`brewbrother`/`brewbrother_restaurado`/g' | mariadb
# ex.: ver a conta apagada
mariadb -e "SELECT id, name, email FROM brewbrother_restaurado.users"
# depois de copiar o necessário:
mariadb -e "DROP DATABASE brewbrother_restaurado"
```

## Restaurar o banco inteiro (último recurso)

Apaga tudo o que mudou depois do backup. Pare o servidor antes:

```bash
pm2 stop breww-server
zcat /var/backups/breww/diario/2026-11-12/brewbrother.sql.gz | mariadb
pm2 start breww-server
```
