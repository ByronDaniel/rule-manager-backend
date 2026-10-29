export const apps = [{
  name: "mi-node-app",
  script: "./src/server.js",
  instances: "max",
  exec_mode: "cluster",

  env: {
    NODE_ENV: "production",
    PORT: 3000,
    JWT_SECRET: "UnAHeXAdEcImAL_o_FrAsE_UlTrA_SeCrEtA_Y_LaRgA_2026",
    MONGODB_URI: "mongodb+srv://byrondanipm:6Y8uCCOnN26cXWef@cluster0.ytajjgp.mongodb.net/usuarios_db?retryWrites=true&w=majority"
  },

  env_production: {
    NODE_ENV: "production",
    PORT: 3000,
    JWT_SECRET: "UnAHeXAdEcImAL_o_FrAsE_UlTrA_SeCrEtA_Y_LaRgA_2026",
    MONGODB_URI: "mongodb+srv://byrondanipm:6Y8uCCOnN26cXWef@cluster0.ytajjgp.mongodb.net/usuarios_db?retryWrites=true&w=majority"
  },

  error_file: "/var/www/tu-app/logs/err.log",
  out_file: "/var/www/tu-app/logs/out.log",
  log_date_format: "YYYY-MM-DD HH:mm:ss Z",
  merge_logs: true
}];

export const deploy = {
  production: {
    user: "ubuntu",
    host: "100.48.25.37",
    ref: "origin/main",
    repo: "git@github.com:ByronDaniel/rule-manager-backend.git",
    path: "/var/www/tu-app",

    "post-deploy": "mkdir -p logs && npm install && pm2 startOrReload ecosystem.config.js --env production && pm2 save",

    ssh_options: "IdentityFile=/Users/byrondelgado/Downloads/rule-manager-key.pem"
  }
};

export default { apps, deploy };
