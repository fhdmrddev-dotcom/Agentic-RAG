# VPS Deployment Guide -- Agentic RAG

Tested on: **Ubuntu 25.04**, **Hostinger VPS**, **Node.js 22**, **Python 3.13**

---

## Prerequisites

- A VPS with Ubuntu (root SSH access)
- Docker installed (for Redis + optional code sandbox)
- Supabase cloud project already set up with migrations run
- All API keys ready: Supabase, OpenAI, OpenRouter, LangSmith

---

## Step 1 -- SSH into server

```bash
ssh root@your-server-ip
```

---

## Step 2 -- Install system packages

```bash
apt update && apt upgrade -y
apt install -y nginx python3-venv python3-pip python3-full nodejs npm git certbot python3-certbot-nginx ufw unzip docker.io
```

> **Note:** Do NOT install `python3.11` or `python3.11-venv` -- Ubuntu 25.04 ships Python 3.13. Use `python3` instead.

---

## Step 3 -- Configure firewall

```bash
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw enable
```

---

## Step 4 -- Upgrade Node.js to v22

The default Node.js from apt is too old for Vite. Use nvm:

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
export NVM_DIR="$HOME/.nvm" && source "$NVM_DIR/nvm.sh"
nvm install 22
nvm use 22
node --version  # should show v22.x
```

---

## Step 5 -- Upload your code

On your **local Windows machine**, stage the files (PowerShell):

```powershell
New-Item -ItemType Directory -Force -Path "C:\deploy\backend"
New-Item -ItemType Directory -Force -Path "C:\deploy\frontend"
Copy-Item -Recurse "C:\Vibe Apps\Agentic RAG\backend\app" "C:\deploy\backend\app"
Copy-Item "C:\Vibe Apps\Agentic RAG\backend\requirements.txt" "C:\deploy\backend\"
Copy-Item -Recurse "C:\Vibe Apps\Agentic RAG\frontend\src" "C:\deploy\frontend\src"
Copy-Item -Recurse "C:\Vibe Apps\Agentic RAG\frontend\public" "C:\deploy\frontend\public" -ErrorAction SilentlyContinue
Copy-Item "C:\Vibe Apps\Agentic RAG\frontend\package.json" "C:\deploy\frontend\"
Copy-Item "C:\Vibe Apps\Agentic RAG\frontend\package-lock.json" "C:\deploy\frontend\"
Copy-Item "C:\Vibe Apps\Agentic RAG\frontend\index.html" "C:\deploy\frontend\"
Copy-Item "C:\Vibe Apps\Agentic RAG\frontend\vite.config.*" "C:\deploy\frontend\"
Copy-Item "C:\Vibe Apps\Agentic RAG\frontend\tsconfig*" "C:\deploy\frontend\"
Copy-Item "C:\Vibe Apps\Agentic RAG\frontend\tailwind.config.*" "C:\deploy\frontend\" -ErrorAction SilentlyContinue
Copy-Item "C:\Vibe Apps\Agentic RAG\frontend\postcss.config.*" "C:\deploy\frontend\" -ErrorAction SilentlyContinue
Copy-Item "C:\Vibe Apps\Agentic RAG\frontend\components.json" "C:\deploy\frontend\" -ErrorAction SilentlyContinue
Compress-Archive -Force -Path "C:\deploy\backend" -DestinationPath "C:\deploy\backend.zip"
Compress-Archive -Force -Path "C:\deploy\frontend" -DestinationPath "C:\deploy\frontend.zip"
```

Upload via **WinSCP**:
- Protocol: SCP
- Host: your server IP
- Username: root
- Enable "Show hidden files" (`Ctrl+Alt+H`) if needed
- Create `/var/www/agentic-rag/` on the server
- Drag both zip files into it

Also upload `backend/.env` via WinSCP (enable hidden files to see it).

Extract on the server:

```bash
cd /var/www/agentic-rag
unzip backend.zip
unzip frontend.zip
```

---

## Step 6 -- Set up backend

```bash
cd /var/www/agentic-rag/backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

Edit the `.env` file -- update these values for production:

```bash
nano /var/www/agentic-rag/backend/.env
```

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_PROJECT_URL=https://your-project.supabase.co
SUPABASE_REST_URL=https://your-project.supabase.co/rest/v1
SUPABASE_GRAPHQL_URL=https://your-project.supabase.co/graphql/v1
SUPABASE_FUNCTIONS_URL=https://your-project.supabase.co/functions/v1
SUPABASE_ANON_KEY=your-cloud-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-cloud-service-role-key
FRONTEND_URL=http://your-server-ip-or-domain
OPENAI_API_KEY=sk-...
OPENROUTER_API_KEY=...
LANGSMITH_API_KEY=...
LANGSMITH_PROJECT=your-project-name
ENVIRONMENT=production
REDIS_URL=redis://localhost:6379
WORKER_COUNT=2
POSTGRES_DSN=postgresql://postgres:<db-password>@db.<your-project-ref>.supabase.co:5432/postgres
```

> Get Supabase keys from: **Supabase dashboard > Settings > API**

> The local `127.0.0.1:54321` URLs and local DB connection vars are unused by the app -- leave or delete them.

> **Redis:** Required since v2.5. See the Redis section below (Step 7). If using Upstash cloud Redis, use `rediss://` (double s for TLS) -- see Upstash setup below.

> **POSTGRES_DSN:** Direct Postgres connection for asyncpg pool. Use port `5432` (direct), NOT port `6543` (Supavisor pooler). See the pool tuning section below.

> **WORKER_COUNT:** Number of uvicorn workers. Default `2` is sufficient for most single-org deployments. See worker count guidance below.

---

## Step 7 -- Install Redis

Redis is required for the backend's real-time streaming system (run-backed SSE via Redis Streams). It must be running before the backend starts.

You have three options:

### Option A: Docker one-liner (recommended)

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

### Option B: Docker Compose

Create a compose file:

```bash
nano /var/www/agentic-rag/docker-compose.yml
```

```yaml
# docker-compose.yml (save to /var/www/agentic-rag/)
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

Start it:

```bash
cd /var/www/agentic-rag
docker compose up -d
```

### Option C: Upstash Cloud (no Docker needed)

If you prefer a managed Redis service instead of running your own container:

1. Go to **upstash.com** and create a free account
2. Click **"Create Database"**
3. Choose a region close to your VPS (e.g., `us-east-1` or `eu-west-1`)
4. After creation, copy the **connection URL** from the dashboard (starts with `rediss://`)
5. Set `REDIS_URL=rediss://default:<password>@<endpoint>.upstash.io:6379` in your backend `.env`

> **Memory:** Default 256MB is sufficient for most deployments. Scale to 512MB-1GB if you expect 50+ concurrent streaming sessions. Adjust `--maxmemory` in the Docker command.

> **No persistence needed:** Redis is used only for ephemeral run-streaming buffers (TTL ~10 min). Data loss on Redis restart is harmless -- active streams reconnect automatically.

> **Security:** The `-p 127.0.0.1:6379:6379` binding ensures Redis is only reachable from localhost. For additional defense-in-depth, add `--requirepass <your-password>` to the redis-server command and update `REDIS_URL=redis://:<your-password>@localhost:6379` in your `.env`.

Verify Redis is running:

```bash
docker exec redis redis-cli ping
# Should print: PONG
```

> **Note:** Earlier versions of this guide included a manual patch for `postgrest-py`'s `maybe_single()` bug (the old Step 7). This is now auto-patched at startup by `_patch_postgrest_maybe_single()` in `backend/app/main.py`. No manual intervention is needed.

---

## Step 8 -- Create systemd service

```bash
nano /etc/systemd/system/agentic-rag.service
```

```ini
[Unit]
Description=Agentic RAG FastAPI Backend
After=network.target

[Service]
User=root
WorkingDirectory=/var/www/agentic-rag/backend
Environment="PATH=/var/www/agentic-rag/backend/venv/bin"
EnvironmentFile=/var/www/agentic-rag/backend/.env
ExecStart=/var/www/agentic-rag/backend/venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000 --workers ${WORKER_COUNT}
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
```

> **Worker count:** `WORKER_COUNT=2` in your `.env` is the validated default, sufficient for most single-org deployments. Rule of thumb: `N = min(CPU_cores, 4)`. For data-driven scaling beyond 4 workers, use the `GET /admin/backpressure` endpoint (see Phase 078 docs).

> **EnvironmentFile:** The `EnvironmentFile` directive reads all `KEY=VALUE` lines from your `.env` file. To change worker count, edit `.env` and restart: `systemctl restart agentic-rag`. No need to edit the systemd unit file.

```bash
systemctl daemon-reload
systemctl enable agentic-rag
systemctl start agentic-rag
systemctl status agentic-rag
```

Backend should show `active (running)`.

---

### Connection Pool Tuning (asyncpg + Supabase)

The backend uses asyncpg for direct Postgres connections (not the Supabase client library). Each uvicorn worker maintains its own connection pool (default: min=2, max=10 connections). With 2 workers, the effective maximum is 2 x 10 = 20 connections.

**Key rules:**

1. **Use the direct connection (port 5432), NOT the pooler (port 6543).** asyncpg has its own client-side pooling. Stacking two poolers (asyncpg + Supavisor) causes prepared-statement errors in transaction mode. Your `POSTGRES_DSN` should point to `:5432`.

2. **Supabase Cloud pool sizing:** Check your project's pool limits at **Dashboard > Database > Connection Pooling**. The default depends on your compute tier. For 2 workers with max=10 each, you need at least 20 direct connections available. Supabase free tier allows ~60 direct connections, so this is well within limits.

3. **Tuning `POSTGRES_POOL_MIN` / `POSTGRES_POOL_MAX`:** These env vars control per-worker pool size. Defaults (2/10) are conservative. Only increase if you see connection-wait timeouts in logs. Formula: `total_max = WORKER_COUNT x POSTGRES_POOL_MAX` -- keep this below your Postgres `max_connections` limit.

4. **Scaling beyond 2 workers:** Each additional worker adds up to `POSTGRES_POOL_MAX` connections. With 4 workers and max=10, that's 40 connections. Check your Supabase tier's `max_connections` limit before scaling.

---

## Step 9 -- Build frontend

```bash
cd /var/www/agentic-rag/frontend
```

Create the production env file:

```bash
nano .env.production
```

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-cloud-anon-key
VITE_API_BASE_URL=http://your-server-ip-or-domain/api
```

Install dependencies and build:

```bash
rm -rf node_modules package-lock.json
npm install
npx vite build 2>&1
```

> Use `npx vite build` instead of `npm run build` -- the latter runs TypeScript checks on test files which fail.

A `dist/` folder will be created. Confirm with:

```bash
ls /var/www/agentic-rag/frontend/dist/
```

---

## Step 10 -- Configure Nginx

```bash
nano /etc/nginx/sites-available/agentic-rag
```

```nginx
server {
    listen 80;
    server_name your-server-ip-or-domain;
    client_max_body_size 100m;

    root /var/www/agentic-rag/frontend/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:8000/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 300s;
        chunked_transfer_encoding on;
    }
}
```

> The trailing slash on `proxy_pass http://127.0.0.1:8000/` is critical -- it strips `/api/` before forwarding to FastAPI, since backend routes are at `/folders` not `/api/folders`.

> `client_max_body_size 100m` is required for document uploads -- default is 1MB.

```bash
ln -s /etc/nginx/sites-available/agentic-rag /etc/nginx/sites-enabled/
rm /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx
```

---

## Step 11 -- Fix Supabase table permissions

If you see `permission denied for table X` errors, your tables are not exposed to the PostgREST API. Run this in **Supabase dashboard > SQL Editor**:

```sql
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
```

---

## Step 12 -- (Optional) Add SSL

```bash
certbot --nginx -d your-domain.com
```

After SSL, update `FRONTEND_URL` in backend `.env` and `VITE_API_BASE_URL` in frontend `.env.production` to use `https://`, then rebuild the frontend and restart the backend.

---

## Verification checklist

```bash
# Backend running?
systemctl status agentic-rag

# Redis running?
docker exec redis redis-cli ping

# Backend reachable?
curl http://127.0.0.1:8000/health

# Site accessible?
curl http://your-server-ip
```

---

## Step 13 -- Auto-deploy from GitHub (CI/CD)

Set this up once and every push to `main` will automatically deploy to your server.

### 1. Add a .gitignore

Make sure secrets and build artifacts are never committed:

```
backend/.env
frontend/.env.production
backend/venv/
frontend/node_modules/
frontend/dist/
```

### 2. Connect the server to GitHub

On the server, initialize git and link your repo:

```bash
cd /var/www/agentic-rag
git init
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git pull origin main
```

### 3. Create the deploy script on the server

```bash
nano /var/www/agentic-rag/deploy.sh
```

Paste:

```bash
#!/bin/bash
set -e

echo "=== Pulling latest code ==="
cd /var/www/agentic-rag
git pull origin main

echo "=== Checking Redis ==="
if docker exec redis redis-cli ping | grep -q PONG; then
  echo "Redis: OK"
else
  echo "WARNING: Redis is not responding. Backend may fail to start."
  echo "Check: docker ps | grep redis"
fi

echo "=== Updating backend ==="
cd /var/www/agentic-rag/backend
source venv/bin/activate
pip install -r requirements.txt --quiet
systemctl restart agentic-rag

echo "=== Building frontend ==="
cd /var/www/agentic-rag/frontend
export NVM_DIR="$HOME/.nvm"
source "$NVM_DIR/nvm.sh"
npm install --quiet
npx vite build 2>&1

echo "=== Done ==="
```

```bash
chmod +x /var/www/agentic-rag/deploy.sh
```

### 4. Generate an SSH key for GitHub Actions

```bash
ssh-keygen -t ed25519 -C "github-actions-deploy" -f ~/.ssh/github_actions -N ""
cat ~/.ssh/github_actions.pub >> ~/.ssh/authorized_keys
cat ~/.ssh/github_actions
```

Copy the entire private key output (including the `-----BEGIN...` and `-----END...` lines).

### 5. Add secrets to GitHub

In your GitHub repo > **Settings > Secrets and variables > Actions > New repository secret**:

| Secret name | Value |
|---|---|
| `SSH_HOST` | your server IP or domain |
| `SSH_USER` | `root` |
| `SSH_KEY` | the private key from the previous step |

### 6. Create the GitHub Actions workflow

On your **local machine**, create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to VPS

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Deploy via SSH
        uses: appleboy/ssh-action@v1.0.3
        with:
          host: ${{ secrets.SSH_HOST }}
          username: ${{ secrets.SSH_USER }}
          key: ${{ secrets.SSH_KEY }}
          script: /var/www/agentic-rag/deploy.sh
```

Commit and push to `main`. The workflow will trigger automatically on every push.

> **Important:** The `.env` files live only on the server and are never in git. The deploy script does `git pull` to update code but never touches your secrets.

---

## Updating after code changes

**Manual update** (without GitHub Actions):

```bash
# After uploading new backend files via WinSCP:
systemctl restart agentic-rag

# After uploading new frontend files via WinSCP:
cd /var/www/agentic-rag/frontend
npx vite build 2>&1
```

**Automatic update** (with GitHub Actions): just push to `main` -- the workflow handles the rest.

---

## Common errors and fixes

| Error | Cause | Fix |
|-------|-------|-----|
| `Unable to locate package python3.11` | Ubuntu 25.04 ships Python 3.13 | Use `python3-venv` instead |
| `Vite requires Node.js 20.19+` | Default Node too old | Install Node 22 via nvm |
| `Cannot find native binding` | node_modules built on wrong OS | Delete and reinstall on server |
| `Invalid API key` | Wrong Supabase anon key in frontend | Update `.env.production` and rebuild |
| `Unexpected token '<'` | API calls returning Nginx HTML error | Fix `VITE_API_BASE_URL` env var name |
| `Failed to fetch` | CORS blocked (missing `FRONTEND_URL`) | Add `FRONTEND_URL=http://...` to backend `.env` |
| `postgrest APIError code 204` | postgrest-py bug with `maybe_single()` | Auto-patched at startup by `_patch_postgrest_maybe_single()`. If you see this error, ensure you are running the latest codebase version. |
| `permission denied for table X` | Tables not exposed to PostgREST API | Run the SQL grants in Step 11 |
| `413 Request Entity Too Large` | Nginx upload limit | Add `client_max_body_size 100m` to Nginx config |
| `Redis connection refused` | Redis not running or wrong URL | Check `docker ps`, verify `REDIS_URL` in `.env` |
