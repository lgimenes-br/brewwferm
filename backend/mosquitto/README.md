# Configuração de ACL do Mosquitto (S1 — Fase 2)

Com a **Fase 2**, todos os comandos enviados pelo painel web (`setMode`, `setProfile`, `skipStep`, `setTemp`, `setRelay`, `update_firmware`, etc.) passam pelo endpoint autenticado do backend:

- `POST /api/devices/:serial/command` (valida o JWT e garante que o `serial` pertence ao `req.user.id` ou que o usuário é `admin` no banco).

## Como aplicar o isolamento no Broker Mosquitto da VPS

1. Crie a credencial exclusiva do backend no Mosquitto:
   ```bash
   sudo mosquitto_passwd /etc/mosquitto/passwd breww_server
   ```
2. Copie o arquivo `backend/mosquitto/acl.conf` para `/etc/mosquitto/acl.conf` e adicione ao `/etc/mosquitto/mosquitto.conf`:
   ```conf
   allow_anonymous false
   password_file /etc/mosquitto/passwd
   acl_file /etc/mosquitto/acl.conf
   ```
3. Quando atualizar o firmware das placas ESP32 para usar uma credencial própria (`esp32_device`) separada do navegador (`web_reader`), basta restringir `web_reader` no `acl.conf` apenas a `topic read`:
   ```conf
   user web_reader
   topic read brewbrother/+/data
   topic read brewbrother/+/ota
   topic read brewbrother/+/response
   topic read brewbrother/global/update
   ```
   Como o frontend já envia comandos via `POST /api/devices/:serial/command`, bloquear `write` para `web_reader` no Mosquitto impedirá 100% que qualquer cliente web publique comandos ou telemetria falsa diretamente no broker.
