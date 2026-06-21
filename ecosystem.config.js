module.exports = {
  apps: [
    {
      name: 'agni-backend',
      script: './venv/Scripts/pythonw.exe',
      args: '-m uvicorn app.main:app --host 0.0.0.0 --port 8000',
      cwd: './backend',
      windowsHide: true,
      env: {
        NODE_ENV: 'production',
        PYTHONUNBUFFERED: '1'
      }
    },
    {
      name: 'agni-frontend',
      script: './node_modules/serve/build/main.js',
      args: '-s dist -l 5173',
      cwd: './web',
      windowsHide: true
    }
  ]
};

