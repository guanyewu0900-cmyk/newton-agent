module.exports = {
  apps: [
    {
      name: "newton-agent",
      script: "server.js",
      env: {
        NODE_ENV: "production",
        PORT: "5173"
      }
    }
  ]
};
