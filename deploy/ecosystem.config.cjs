const path = require("node:path");
module.exports = {
  apps: [{
    name: "sigma-erp",
    cwd: path.join(__dirname, "app"),
    script: path.join(__dirname, "app", "server.js"),
    interpreter: "node",
    node_args: "--env-file=/opt/sigma-erp/.env",
    instances: 1,
    exec_mode: "fork",
    autorestart: true,
    max_memory_restart: "1G",
    time: true,
    env: { NODE_ENV: "production", HOSTNAME: "127.0.0.1", PORT: "3100" },
  }],
};
