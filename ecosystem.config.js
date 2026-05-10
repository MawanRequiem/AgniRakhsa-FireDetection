module.exports = {
  apps: [
    {
      name: 'agni-backend',
      script: 'cmd',
      args: '/c python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4',
      cwd: './Backend',
      env: {
        NODE_ENV: 'production'
      }
    },
    {
      name: 'agni-frontend',
      script: 'cmd',
      args: '/c npx serve -s dist -l 5173',
      cwd: './web'
    }
  ]
};
