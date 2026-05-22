# Newton Agent Teaching Platform

An interactive Newton's First Law teaching platform with course editing, classroom playback, uploaded lesson assets, and DeepSeek-powered AI assistants.

## Requirements

- Node.js 18+
- DeepSeek API key if you want AI assistant chat to work

## Local Start

Create `.env`:

```bash
cp .env.example .env
```

Edit `.env` and set:

```bash
DEEPSEEK_API_KEY=your_deepseek_api_key
```

Run:

```bash
npm start
```

Open:

```text
http://localhost:5173/studio_teaching_strict_demo.html?reset=1
```

## Check Syntax

```bash
npm run check
```

On Windows PowerShell, if `npm` is blocked by execution policy, use:

```powershell
npm.cmd run check
```

## Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md).

For Render, this repository includes [render.yaml](render.yaml). After importing the GitHub repository in Render, set `DEEPSEEK_API_KEY` in the Render dashboard.

## Important

- Never commit a real `.env` file or API key.
- Keep `uploads/` available on the server because it contains the teaching PDFs and interactive demo.
