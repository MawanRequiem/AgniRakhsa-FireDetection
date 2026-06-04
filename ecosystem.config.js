module.exports = {
  apps: [
    {
      name: 'agni-backend',
      script: './venv/Scripts/python.exe',
      args: '-m uvicorn app.main:app --host 0.0.0.0 --port 8000',
      cwd: './backend',
      env: {
        NODE_ENV: 'production'
      }
    },
    {
      name: 'agni-frontend',
      script: './node_modules/serve/build/main.js',
      args: '-s dist -l 5173',
      cwd: './web'
    }
  ]
};
