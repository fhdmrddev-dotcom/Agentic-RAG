# Deploy to Hostinger VPS + Supabase Cloud

**Medium** -- Split into clear stages. Claude handles infrastructure via MCP; manual steps are simple copy-paste actions explained below.

---

## Overview

| Layer | Where it lives | Who sets it up |
|---|---|---|
| Database + Auth + Storage | Supabase Cloud (free tier works) | You (web UI) |
| Backend (FastAPI) | Hostinger VPS | Claude via MCP + your SSH |
| Frontend (React) | Hostinger VPS (served by Nginx) | Claude via MCP + your SSH |
| Domain + SSL | Hostinger | Claude via MCP |

---

## STAGE 1 -- Supabase Cloud Setup

**Who does it: You (10 minutes, no tech knowledge needed)**

### Step 1.1 -- Create a Supabase project

1. Go to **supabase.com** > Sign in > click **New Project**
2. Give it any name (e.g. `agentic-rag-prod`)
3. Set a **Database Password** -- save it somewhere safe (you won't need it often)
4. Choose a region close to you
5. Click **Create new project** and wait ~2 minutes

### Step 1.2 -- Run database migrations

Your app has SQL migration files that create all the tables. You need to run them once.

1. In your Supabase project, click **SQL Editor** in the left sidebar
2. Open the folder `supabase/migrations/` on your computer
3. Run each `.sql` file **in order** (they're numbered) -- copy the contents, paste into SQL Editor, click **Run**
4. If it says "Success" you're good. Move to the next file.

### Step 1.3 -- Collect your Supabase credentials

You'll need these later. Find them in: **Project Settings > API**

Copy and save these 3 values:
- **Project URL** -- looks like `https://xyzxyz.supabase.co`
- **anon/public key** -- long string starting with `eyJ...`
- **service_role key** -- another long string (keep this secret!)

---

## STAGE 2 -- Hostinger VPS Setup

**Who does it: Claude via MCP (automatic)**

Claude will use the Hostinger MCP to:
- Spin up a VPS (Ubuntu 22.04 recommended)
- Open the right firewall ports (22 for SSH, 80 for web, 443 for HTTPS)
- Point your domain's DNS to the VPS

**You just need to:**
1. Have your Hostinger API token ready
2. Have a domain name pointed at Hostinger (or buy one through Hostinger)
3. Tell Claude: "Set up a VPS for me and point `yourdomain.com` to it"

---

## STAGE 3 -- Server Software Installation

**Who does it: You (SSH into the server -- simple copy-paste commands)**

After Claude creates the VPS, Hostinger will email you the server's **IP address**, **username** (usually `root`), and **password**.

### Step 3.1 -- Connect to your server

Open a terminal (on Windows: press `Win+R`, type `cmd`, press Enter) and type:

```
ssh root@YOUR_SERVER_IP
```

Type your password when asked. You're now inside your server.

### Step 3.2 -- Install everything needed

Copy and paste this entire block (it installs Python, Node, Nginx, Docker, and Git):

```bash
apt update && apt upgrade -y
apt install -y python3 python3-pip python3-venv nodejs npm nginx git certbot python3-certbot-nginx docker.io
```

Wait for it to finish (~3 minutes).

### Step 3.3 -- Clone your app

```bash
cd /var/www
git clone https://github.com/fhdmrddev-dotcom/Agentic-RAG.git app
cd app
```

### Step 3.4 -- Set up the backend

```bash
cd /var/www/app/backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### Step 3.5 -- Install Redis

Redis is required for the backend's real-time streaming system. You have two options:

**Option A: Docker (recommended for VPS)**

```bash
docker run -d \
  --name redis \
  --restart unless-stopped \
  -p 127.0.0.1:6379:6379 \
  redis:7-alpine \
  redis-server \
    --save "" \
    --appendonly no \
    --maxmemory 256mb \
    --maxmemory-policy allkeys-lru
```

Or use Docker Compose -- create `/var/www/app/docker-compose.yml`:

```yaml
services:
  redis:
    image: redis:7-alpine
    container_name: redis
    restart: unless-stopped
    ports:
      - "127.0.0.1:6379:6379"
    command: >
      redis-server
      --save ""
      --appendonly no
      --maxmemory 256mb
      --maxmemory-policy allkeys-lru
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 3s
      retries: 5
```

Then start it:

```bash
cd /var/www/app
docker compose up -d
```

**Option B: Upstash Cloud (no Docker needed)**

If you prefer a managed Redis service:

1. Go to **upstash.com** and create a free account
2. Click **"Create Database"** and choose a region close to your VPS
3. Copy the **connection URL** (starts with `rediss://` -- note the double s)
4. You'll paste this into your `.env` file in the next step as `REDIS_URL`

Verify Redis is running (Docker option only):

```bash
docker exec redis redis-cli ping
# Should print: PONG
```

> **Memory:** Default 256MB works for most deployments. Scale to 512MB-1GB for 50+ concurrent streaming sessions.

> **No persistence needed:** Redis stores only temporary streaming data. Restarting Redis is harmless.

> **Security:** The `127.0.0.1` binding keeps Redis local-only. For extra security, add `--requirepass <password>` and update your `REDIS_URL` accordingly.

### Step 3.6 -- Create the backend environment file

```bash
nano /var/www/app/backend/.env
```

This opens a simple text editor. Paste your values (replace everything in `< >`):

```
SUPABASE_URL=<your Supabase Project URL from Stage 1>
SUPABASE_SERVICE_ROLE_KEY=<your service_role key from Stage 1>
LLM_PROVIDER=openai
OPENAI_API_KEY=<your OpenAI API key>
LLM_MODEL=gpt-4o
EMBEDDING_MODEL=text-embedding-3-small
EMBEDDING_DIMENSIONS=1536
LANGSMITH_TRACING=false
LANGSMITH_PROJECT=agentic-rag-prod
LANGSMITH_API_KEY=
FRONTEND_URL=https://<yourdomain.com>
REDIS_URL=redis://localhost:6379
WORKER_COUNT=2
POSTGRES_DSN=postgresql://postgres:<db-password>@db.<your-project-ref>.supabase.co:5432/postgres
```

Press `Ctrl+X`, then `Y`, then `Enter` to save.

> **REDIS_URL:** If using Upstash, paste the `rediss://` URL from Step 3.5 Option B.

> **POSTGRES_DSN:** Use the direct connection (port 5432), NOT the pooler (port 6543).

### Step 3.7 -- Build the frontend

```bash
cd /var/www/app/frontend
nano .env.production
```

Paste:

```
VITE_SUPABASE_URL=<your Supabase Project URL>
VITE_SUPABASE_ANON_KEY=<your anon/public key from Stage 1>
VITE_API_URL=https://<yourdomain.com>/api
```

Save (Ctrl+X > Y > Enter), then build:

```bash
npm install
npm run build
```

This creates a `dist/` folder with your website files.

---

## STAGE 4 -- Keep the App Running (systemd service)

**Who does it: You (copy-paste)**

This makes the backend restart automatically if the server reboots.

```bash
nano /etc/systemd/system/agentic-rag.service
```

Paste:

```ini
[Unit]
Description=Agentic RAG Backend
After=network.target

[Service]
User=root
WorkingDirectory=/var/www/app/backend
EnvironmentFile=/var/www/app/backend/.env
ExecStart=/var/www/app/backend/venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000 --workers ${WORKER_COUNT}
Restart=always

[Install]
WantedBy=multi-user.target
```

Save, then run:

```bash
systemctl daemon-reload
systemctl enable agentic-rag
systemctl start agentic-rag
```

Check it's running:

```bash
systemctl status agentic-rag
```

Should say **active (running)** in green.

> **Workers:** `WORKER_COUNT=2` in your `.env` is the recommended default. Rule of thumb: `N = min(CPU_cores, 4)`.

> **EnvironmentFile:** Reads settings from your `.env` automatically. Change worker count by editing `.env` and running `systemctl restart agentic-rag`.

---

### Connection Pool Tuning (asyncpg + Supabase)

The backend connects directly to Postgres using asyncpg (not through Supabase's connection pooler). Each worker maintains its own pool of database connections.

**What you need to know:**

1. **Use port 5432 (direct connection), not port 6543 (pooler).** Your `POSTGRES_DSN` in `.env` should end with `:5432/postgres`. Using the pooler port causes errors with asyncpg.

2. **Default pool size is fine for most deployments.** With 2 workers, the app uses up to 20 database connections (2 workers x 10 max per worker). Supabase free tier allows ~60, so you have plenty of headroom.

3. **Tuning (usually not needed):** If you see connection timeout errors in your logs, you can adjust `POSTGRES_POOL_MIN` and `POSTGRES_POOL_MAX` in your `.env`. Keep total connections (`WORKER_COUNT x POSTGRES_POOL_MAX`) below your Supabase tier's limit.

4. **Check your limits:** Go to Supabase **Dashboard > Database > Connection Pooling** to see your project's pool configuration.

---

## STAGE 5 -- Nginx Web Server Config

**Who does it: You (copy-paste)**

Nginx serves the frontend and routes `/api` calls to the backend.

```bash
nano /etc/nginx/sites-available/agentic-rag
```

Paste (replace `yourdomain.com`):

```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    # Serve the React frontend
    root /var/www/app/frontend/dist;
    index index.html;

    # All page routes go to React
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Forward /api calls to FastAPI backend
    location /api/ {
        proxy_pass http://127.0.0.1:8000/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;

        # Required for SSE (streaming chat responses)
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 300s;
    }
}
```

Save, then activate it:

```bash
ln -s /etc/nginx/sites-available/agentic-rag /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx
```

---

## STAGE 6 -- Free SSL Certificate (HTTPS)

**Who does it: You (one command)**

```bash
certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

Follow the prompts -- enter your email, agree to terms. Done. Your site is now HTTPS.

---

## STAGE 7 -- Supabase Auth Redirect URL

**Who does it: You (Supabase web UI -- 1 minute)**

When users click email confirmation links, Supabase needs to know where to send them.

1. Go to your Supabase project > **Authentication > URL Configuration**
2. Set **Site URL** to `https://yourdomain.com`
3. Add to **Redirect URLs**: `https://yourdomain.com/auth/callback`
4. Click **Save**

---

## Final Checklist

- [ ] Supabase project created and migrations run
- [ ] VPS provisioned by Claude (MCP)
- [ ] DNS pointing to VPS IP
- [ ] Server software installed (Stage 3.2)
- [ ] App cloned from GitHub
- [ ] Redis running (Step 3.5)
- [ ] Backend `.env` file filled in
- [ ] Frontend `.env.production` filled in and built
- [ ] systemd service running (green status)
- [ ] Nginx configured and reloaded
- [ ] SSL certificate installed
- [ ] Supabase redirect URL updated

---

## Updating the App in the Future

When you make changes and push to GitHub, log into the server and run:

```bash
cd /var/www/app
git pull
cd frontend && npm run build
systemctl restart agentic-rag

# Verify Redis is still running
docker exec redis redis-cli ping
```

That's it -- your site is updated.

---

## What Claude Can Do via Hostinger MCP

| Task | Via MCP |
|---|---|
| Create VPS | Yes |
| Choose OS (Ubuntu 22.04) | Yes |
| Open firewall ports (22, 80, 443) | Yes |
| Update DNS A record for domain | Yes |
| Monitor CPU/memory/bandwidth | Yes |
| Scan for malware | Yes |
| Restore server backups | Yes |
| Install Python/Node/Nginx | No (needs SSH) |
| Deploy app code | No (needs SSH) |
| Set env variables | No (needs SSH) |
| Configure SSL | No (needs SSH) |
