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

## Cópia fora da VPS (Google Drive)

Todo dia, depois do backup local, o script envia a pasta do dia para o Google Drive do dono, na
pasta `breww-backups/diario/AAAA-MM-DD`, **criptografada** (rclone crypt, remoto `breww-offsite`).
No Drive os arquivos aparecem como `.bin` e não podem ser lidos sem a senha. Retenção: 60 dias.

- A configuração (acesso ao Drive e senha) fica só em `/root/.config/rclone/rclone.conf` na VPS.
- O dono guarda uma cópia da senha fora da VPS. Sem ela, os backups do Drive não podem ser lidos.
- O acesso ao Drive é `drive.file`: o rclone só enxerga os arquivos que ele mesmo criou.

Se a VPS se perder, numa máquina nova com rclone:

```bash
rclone config   # crie "gdrive" (Google Drive, scope drive.file) e "breww-offsite"
                # (crypt, remote = gdrive:breww-backups, filename_encryption = off,
                #  directory_name_encryption = false, password = a senha guardada)
rclone lsd breww-offsite:diario
rclone copy breww-offsite:diario/2026-11-19 ./restaurar
zcat ./restaurar/brewbrother.sql.gz | mariadb
```

Para ver se o envio está funcionando: `grep "fora da VPS" /var/log/breww-backup.log | tail`.
