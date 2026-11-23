// Configuracao do PM2 na VPS (o deploy roda `pm2 startOrRestart ecosystem.config.cjs`).
// As variaveis de ambiente vem do .env (dotenv no server.js), nao daqui.
module.exports = {
  apps: [
    {
      name: 'breww-server',
      script: 'server.js',
      cwd: __dirname,
      exec_mode: 'fork',
      // VPS de 1 GB desde 19/11/2026 (antes 417 MB), dividida com MariaDB (~55 MB), Mosquitto e nginx.
      // O heap (256 MB) fica abaixo do reinicio do PM2 (320 MB de RSS): o coletor de lixo trabalha antes
      // de chegar no reinicio. Em repouso com 5 aparelhos a API usa ~145 MB de RSS; o teste de carga
      // (800 apps ao vivo) chegou a 197 MB com 256 MB de heap. VPS de 2 GB: heap 384 MB, reinicio 450 MB.
      // --import: o Sentry inicia antes do Express ser carregado (senao ele nao instrumenta o Express)
      node_args: '--max-old-space-size=256 --import ./instrument.js',
      // Reinicio controlado (SIGINT + desligamento rapido) se a memoria passar disso
      max_memory_restart: '320M',
      // O server.js fecha tudo em ~1,2 s; margem para nao cair no SIGKILL
      kill_timeout: 3000,
      autorestart: true,
      watch: false,
      merge_logs: true,
    },
  ],
};
