module.exports = {
  apps: [
    {
      name: 'mojib-backend',
      script: 'src/index.ts',
      interpreter: './node_modules/.bin/ts-node',
      cwd: __dirname,
      env: {
        NODE_ENV: 'production',
      },
      watch: false,
      max_memory_restart: '500M',
      restart_delay: 3000,
      max_restarts: 10,
    },
  ],
};
