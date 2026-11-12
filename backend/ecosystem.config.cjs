// Configuracao do PM2 na VPS (o deploy roda `pm2 startOrRestart ecosystem.config.cjs`).
// As variaveis de ambiente vem do .env (dotenv no server.js), nao daqui.
module.exports = {
  apps: [
    {
      name: 'breww-server',
      script: 'server.js',
      cwd: __dirname,
      exec_mode: 'fork',
      // A VPS tem ~417 MB de RAM, dividida com MariaDB, Mosquitto e nginx. O heap (170 MB) fica
      // abaixo do reinicio do PM2 (200 MB de RSS): o coletor de lixo trabalha antes de chegar no
      // reinicio. Com 256 MB de heap, o teste de carga (800 apps ao vivo) chegou a 197 MB de RSS.
      // VPS de 2 GB: subir os dois (ex.: heap 384 MB, reinicio 450 MB).
      node_args: '--max-old-space-size=170',
      // Reinicio controlado (SIGINT + desligamento rapido) se a memoria passar disso
      max_memory_restart: '200M',
      // O server.js fecha tudo em ~1,2 s; margem para nao cair no SIGKILL
      kill_timeout: 3000,
      autorestart: true,
      watch: false,
      merge_logs: true,
    },
  ],
};
