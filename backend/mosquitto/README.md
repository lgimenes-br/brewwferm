# Configuração de ACL do Mosquitto (S1 — Fase 2)

Com a **Fase 2**, todos os comandos enviados pelo painel web (`setMode`, `setProfile`, `skipStep`, `setTemp`, `setRelay`, `update_firmware`, etc.) passam pelo endpoint autenticado do backend:

- `POST /api/devices/:serial/command` (valida o JWT e garante que o `serial` pertence ao `req.user.id` ou que o usuário é `admin` no banco).

## Aplicação Automatizada na VPS (1 Comando)

O repositório inclui o script idempotente `backend/mosquitto/setup-vps-mosquitto.sh` (copiado automaticamente no deploy para `/var/www/breww-backend/mosquitto/setup-vps-mosquitto.sh`). Para provisionar a conta exclusiva `breww_server`, instalar o `/etc/mosquitto/acl.conf`, atualizar o `.env` do backend e recarregar o Mosquitto + PM2 sem derrubar os controladores ESP32 existentes, basta rodar na VPS:

```bash
sudo bash /var/www/breww-backend/mosquitto/setup-vps-mosquitto.sh
```

## Passo a Passo Manual (Referência)

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
3. O ACL so e instalado quando `MQTT_USER=breww_server` esta no `.env` do backend (o script garante isso). Sem isso, o backend perderia a capacidade de enviar comandos.

## Modelo de acesso (Fase 3)

- **Navegador:** nao acessa mais o broker. Dados ao vivo chegam por `GET /api/live` (Server-Sent Events, autenticado com JWT; o backend so repassa mensagens dos aparelhos do usuario). Comandos vao por `POST /api/devices/:serial/command`. Nenhuma credencial MQTT vai no JavaScript do site.
- **Backend (`breww_server`):** unico cliente com leitura/escrita total; e o unico que publica em `command`/`comando`, depois de validar o dono no banco.
- **Placas (`esp32user`):** so publicam telemetria/respostas e so leem comandos. Mesmo quem extrair essa credencial do firmware nao consegue mandar comandos a nenhum aparelho.
- **Listener WebSocket do Mosquitto (`wss://breww.live/mqtt`):** nao e mais usado pelo site e pode ser desativado (listener `websockets` no `mosquitto.conf` e o `location /mqtt` no nginx).

### Limitacao conhecida
`esp32user` ainda e compartilhado entre todas as placas: quem extrair a credencial do firmware consegue LER a telemetria de outros aparelhos e publicar telemetria falsa. O proximo passo e credencial por aparelho (usuario = serial, senha derivada da chave do aparelho ja registrada em `device_keys`), com ACL `pattern write brewbrother/%u/data` via plugin de autenticacao do Mosquitto.
