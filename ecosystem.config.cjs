// Jalankan: pm2 start ecosystem.config.cjs
// Pastikan sudah: npm run build && npm run setup:browser:linux
// .env dibaca langsung oleh config.ts (process.loadEnvFile), jadi tidak perlu env_file di sini.
module.exports = {
  apps: [
    {
      name: "cookie-vault-web",
      script: "dist/server/server.js",
      cwd: __dirname,
      autorestart: true,
      max_restarts: 10,
      instances: 1,
    },
    {
      name: "cookie-vault-worker",
      script: "dist/server/worker.js",
      cwd: __dirname,
      autorestart: true,
      max_restarts: 20,
      instances: 1,
    },
  ],
};
