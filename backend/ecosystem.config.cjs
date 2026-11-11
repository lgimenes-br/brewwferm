// Configuracao do PM2 na VPS (o deploy roda `pm2 startOrRestart ecosystem.config.cjs`).
// As variaveis de ambiente vem do .env (dotenv no server.js), nao daqui.
module.exports = {
  apps: [
    {
      name: 'breww-server',
      script: 'server.js',
      cwd: __dirname,
      exec_mode: 'fork',
      // A VPS tem ~417 MB de RAM, dividida com MariaDB, Mosquitto e nginx. Com 256 MB de heap
      // o Node cai antes de jogar a maquina inteira na swap.
      node_args: '--max-old-space-size=256',
      // Reinicio controlado (SIGINT + desligamento rapido) antes de chegar no limite do heap
      max_memory_restart: '200M',
      // O server.js fecha tudo em ~1,2 s; margem para nao cair no SIGKILL
      kill_timeout: 3000,
      autorestart: true,
      watch: false,
      merge_logs: true,
    },
  ],
};
