module.exports = {
  apps: [{
    name: 'pdv-backend',
    script: './server.js',
    cwd: '/root/pdv-visite-campos/backend',
    instances: 1,
    exec_mode: 'fork',
    
    // Ambiente
    env: {
      NODE_ENV: 'production',
      PORT: 3001
    },
    
    // Restart automático
    autorestart: true,
    watch: false,
    max_memory_restart: '500M',
    
    // Logs
    error_file: '/root/.pm2/logs/pdv-backend-error.log',
    out_file: '/root/.pm2/logs/pdv-backend-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    
    // Restart policy
    min_uptime: '10s',
    max_restarts: 10,
    restart_delay: 4000
  }]
};
