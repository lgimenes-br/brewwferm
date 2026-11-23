# Breww — site e servidor

Site [breww.live](https://breww.live) e a API que o site, o app e os controladores usam.
O Breww controla a temperatura da fermentação de cerveja caseira com um controlador ESP32.

| Parte | Pasta | Tecnologia |
| --- | --- | --- |
| Site (home, área logada, instalador pelo navegador, admin) | raiz | React 19 + Vite, PWA |
| API, MQTT, notificações, rotinas | [`backend/`](backend) | Node 22 + Express 5, MariaDB, Mosquitto |

Projetos irmãos: o app iOS/Android (`breww-app`) e o firmware do controlador
([`breww-firmware`](https://github.com/lgimenes-br/breww-firmware), código aberto).

## Rodar no computador

**Site**

```sh
npm install
npm run dev        # http://localhost:5173
```

Variáveis em `.env` (todas opcionais no desenvolvimento): `VITE_API_URL` (padrão: a API de produção),
`VITE_GOOGLE_CLIENT_ID`, `VITE_APPLE_SERVICE_ID`, `VITE_VAPID_PUBLIC_KEY`, `VITE_SENTRY_DSN`.
Tudo que começa com `VITE_` vai para o JavaScript público: nunca ponha segredos nelas.

**API**

```sh
cd backend
npm install
npm start          # porta 3000
```

Precisa de um MariaDB e de um `.env` em `backend/` com:

| Variável | Para quê |
| --- | --- |
| `DB_HOST`, `DB_USER`, `DB_PASS`, `DB_NAME`, `DB_INGREDIENTS_NAME` | Banco (as tabelas são criadas na primeira execução) |
| `JWT_SECRET` | Login |
| `MQTT_USER`, `MQTT_PASSWORD`, `MOSQUITTO_PASSWD_FILE` | Broker dos controladores |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` | Notificações no navegador |
| `FIRMWARE_UPLOAD_TOKEN` | Publicação do firmware pelo GitHub Actions |
| `GROQ_API_KEY` (opcional) | Texto do Breww.AI; sem ela, a análise sai só por regras |
| `SENTRY_DSN` (opcional) | Monitor de erros |

## Testes

```sh
npm test                    # site (Vitest)
cd backend && npm test      # API (node:test)
```

## Publicação

Cada push na `main` roda o [deploy](.github/workflows/deploy.yml): compila o site, copia site e API
para a VPS e reinicia a API com o pm2 ([`ecosystem.config.cjs`](backend/ecosystem.config.cjs)).
Configuração da VPS e restauração do backup: [`backend/deploy/`](backend/deploy).

## Mais

- [`PRODUCT.md`](PRODUCT.md): para quem é o produto e o que ele promete
- [`DESIGN.md`](DESIGN.md): identidade visual (cores, tipos, componentes)

Repositório público: nada de segredos, senhas ou dados de clientes nos arquivos versionados.
