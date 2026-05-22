# Deployment Guide

This project is a Node.js web app. It serves the teaching platform, uploaded files, bootstrap lesson data, and AI chat API from `server.js`.

## 1. Prepare The Project

Do not commit or publish your real API key.

Required environment variables:

```bash
PORT=5173
DEEPSEEK_API_KEY=your_deepseek_api_key
DEEPSEEK_BASE_URL=https://api.deepseek.com/v1
```

`DEEPSEEK_BASE_URL` is optional unless you need a custom endpoint.

You can create a local `.env` file from the example:

```bash
cp .env.example .env
nano .env
```

## 2. Local Check

```bash
npm run check
npm start
```

Open:

```text
http://localhost:5173/studio_teaching_strict_demo.html?reset=1
```

## 3. Ubuntu Server Deployment

Install Node.js 18+ and PM2:

```bash
sudo apt update
sudo apt install -y nodejs npm
sudo npm install -g pm2
node -v
```

Upload this project to the server, for example:

```text
/var/www/newton-agent
```

Start with PM2:

```bash
cd /var/www/newton-agent
cp .env.example .env
nano .env
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
```

Visit:

```text
http://your-server-ip:5173/studio_teaching_strict_demo.html?reset=1
```

## GitHub + Render Deployment

This repository includes `render.yaml`.

1. Push the project to GitHub.
2. Open Render and choose **New** -> **Blueprint**.
3. Select this GitHub repository.
4. In Render, set the secret environment variable:

```text
DEEPSEEK_API_KEY=your_deepseek_api_key
```

5. Deploy.

After deployment, open:

```text
https://your-render-service-url/studio_teaching_strict_demo.html?reset=1
```

Render's free filesystem may not be persistent after redeploys or restarts. Keep important teaching assets in the repository or move user uploads to persistent storage for production use.

## 4. Nginx Reverse Proxy

Install Nginx:

```bash
sudo apt install -y nginx
```

Create `/etc/nginx/sites-available/newton-agent`:

```nginx
server {
    listen 80;
    server_name your-domain.com;

    client_max_body_size 350M;

    location / {
        proxy_pass http://127.0.0.1:5173;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable it:

```bash
sudo ln -s /etc/nginx/sites-available/newton-agent /etc/nginx/sites-enabled/newton-agent
sudo nginx -t
sudo systemctl reload nginx
```

## 5. HTTPS

Point your domain DNS A record to the server IP, then run:

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

Open:

```text
https://your-domain.com/studio_teaching_strict_demo.html?reset=1
```

## 6. Common Commands

```bash
pm2 status
pm2 logs newton-agent
pm2 restart newton-agent
pm2 stop newton-agent
```

## 7. Notes

- Keep `uploads/` on persistent storage. It contains the teaching PDFs and interactive demo assets.
- Use `?reset=1` after updating bootstrap content so browsers reload the latest sample project.
- Never put the real `DEEPSEEK_API_KEY` in `server.js`.
