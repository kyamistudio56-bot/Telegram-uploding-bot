# 24/7 Production Deployment Guide
**Telegram Anime Poster & Episode CMS**  
*Developed by KYAMI Studios (Erwin Smith)*

---

## 1. Overview
This service is a self-contained, full-stack Telegram Bot and Episode CMS running on Node.js / Express with TypeScript. It operates 24/7 independently of the owner's phone, laptop, or browser session.

- **Telegram Worker**: Runs continuously in single-worker mode (Polling or Webhook).
- **Persistent Database**: JSON store in `/data/db.json` holding animes, captions, permanent episode links, channels, button configurations, and schedules.
- **Persistent Scheduler**: Runs every 10 seconds, scans for due `PENDING` posts, executes publishing atomically, and transitions state to `COMPLETED` or `FAILED`.
- **Health Checks**: `GET /` and `GET /health` return HTTP 200 `{"status": "ok"}`.
- **Multi-Channel Publishing**: Posts to Channel 1 (`-1004368859064`) and Channel 2 (`-1002835294159`) with channel-specific button configurations.

---

## 2. Environment Variables & Secrets Configuration

Configure the following environment variables in your production container/host:

| Variable | Required | Description | Example |
| :--- | :--- | :--- | :--- |
| `BOT_TOKEN` | **Yes** | Telegram Bot API Token from `@BotFather` | `7123456789:AAH...` |
| `BOT_OWNER_IDS` | **Yes** | Numeric Telegram user IDs authorized to access CMS (comma-separated) | `724118793,123456789` |
| `PORT` | Optional | Port for HTTP server (defaults to 3000) | `3000` |
| `DEFAULT_TIMEZONE` | Optional | Timezone for scheduler input/display | `Asia/Kolkata` |
| `TELEGRAM_WEBHOOK_URL`| Optional | Set if running in Webhook mode (HTTPS URL e.g. `https://your-domain.com/telegram/webhook`) | `https://bot.example.com/telegram/webhook` |
| `TELEGRAM_WEBHOOK_SECRET` | Optional | Optional secret token for Webhook verification | `any-random-secure-string` |

> ⚠️ **Security Warning**: Never commit your real `BOT_TOKEN` to Git or expose it in public repositories or logs.

---

## 3. Build & Run Commands

### Production Build
```bash
npm run build
```
*Compiles the Vite frontend bundle to `dist/` and bundles the Node.js server into `dist/server.cjs` via esbuild.*

### Production Start
```bash
npm start
# which executes: node dist/server.cjs
```

---

## 4. Deployment Options (24/7 Independent Hosting)

### Option A: Replit (Reserved VM — Recommended for Instant 24/7 Uptime)
1. **Import / Open Project in Replit**:
   - Push code to GitHub or import ZIP into your Replit account.
2. **Set Secrets in Replit (Tools > Secrets)**:
   - `BOT_TOKEN`: `YOUR_TELEGRAM_BOT_TOKEN`
   - `BOT_OWNER_IDS`: `YOUR_NUMERIC_TELEGRAM_ID` (e.g. `724118793`)
   - `DEFAULT_TIMEZONE`: `Asia/Kolkata`
3. **Configure Deployment**:
   - Click the **Deploy** button in Replit.
   - Choose **Reserved VM** (ensures continuous 24/7 execution with persistent disk for `/data`).
   - Build Command: `npm run build` (or `pnpm run build`)
   - Run Command: `npm run start` (or `pnpm run start`)
   - Port: `3000`
4. **Launch**: Click **Deploy Now**.
   - Replit boots `dist/server.cjs` and keeps it permanently running 24/7.
   - The bot starts single-worker polling immediately.

### Option B: Google Cloud Run
1. **Container Build**: Deploy directly with Docker or Cloud Run source build:
   ```bash
   gcloud run deploy telegram-anime-cms \
     --source . \
     --port 3000 \
     --allow-unauthenticated \
     --set-env-vars BOT_TOKEN="<YOUR_TOKEN>",BOT_OWNER_IDS="<YOUR_NUMERIC_ID>"
   ```
2. **Persistent Storage**: Mount a Cloud Storage volume or Cloud SQL / persistent disk for the `/data` directory if container restarts frequently.
3. **Webhook Setup (Optional)**: If Cloud Run scale-to-zero is enabled, set `TELEGRAM_WEBHOOK_URL=https://<your-service-url>/telegram/webhook`.

### Option B: VPS / Dedicated Linux Server (Ubuntu / Debian / Docker)
1. **Clone repository on VPS**:
   ```bash
   git clone <your-repo-url> /opt/telegram-anime-cms
   cd /opt/telegram-anime-cms
   ```
2. **Create `.env` file**:
   ```env
   BOT_TOKEN=123456789:ABCdef...
   BOT_OWNER_IDS=724118793
   PORT=3000
   DEFAULT_TIMEZONE=Asia/Kolkata
   ```
3. **Install & Build**:
   ```bash
   npm install --production=false
   npm run build
   ```
4. **Run 24/7 with PM2 (Auto-Restart on Crash/Reboot)**:
   ```bash
   npm install -g pm2
   pm2 start dist/server.cjs --name "anime-telegram-cms"
   pm2 save
   pm2 startup
   ```

### Option C: Docker / Docker Compose
```bash
docker build -t anime-telegram-cms .
docker run -d \
  --name anime-telegram-cms \
  --restart always \
  -p 3000:3000 \
  -v anime_data:/app/data \
  -e BOT_TOKEN="<YOUR_BOT_TOKEN>" \
  -e BOT_OWNER_IDS="<YOUR_TELEGRAM_ID>" \
  anime-telegram-cms
```

---

## 5. Verifying Health & Connectivity

### 1. HTTP Health Check
```bash
curl -I http://localhost:3000/health
# HTTP/1.1 200 OK
# {"status":"ok"}

curl -I http://localhost:3000/api/health
# {"status":"ok","service":"telegram-anime-cms","bot_polling":true,...}
```

### 2. Telegram Bot Smoke Test
1. Open Telegram and search for your bot.
2. Send `/start`.
3. Verify that the **KYAMI Studios Main Menu** loads immediately.
4. Click **📚 My Animes** -> verify all anime titles, captions, and permanent links load.
5. Click **⚡ Post Now** or test single episode / range posting to verify delivery to both Channel 1 and Channel 2.

---

## 6. Zero-Downtime Updates & Worker Collision Prevention
- Telegram strictly allows **only one worker** (polling or webhook) per bot token.
- Before launching a new instance, stop any previous local test instances to prevent `409 Conflict`.
- When switching between Polling and Webhook modes, call `/api/settings/webhook` or delete the webhook to resume polling cleanly.
