# BRANDTRACE Production Deployment Guide

**Tagline:** Follow the Identity. Find the Risk.  
**Version:** 1.0.0 Enterprise Release  
**Target Environment:** Linux / Docker / Cloud (Vercel, Render, Railway, AWS, DigitalOcean)

---

## 1. Architecture Overview

BRANDTRACE is composed of three decoupled runtime components and a persistent document database:

```
┌─────────────────────────────────────────────────────────────┐
│                    Client (React 18 + Vite)                │
│                 Hosted on Vercel / Netlify / Nginx          │
└──────────────────────────────┬──────────────────────────────┘
                               │ HTTPS / REST (JWT)
┌──────────────────────────────▼──────────────────────────────┐
│                  API Server (Node.js Express)               │
│               Hosted on Render / Railway / VPS PM2          │
└──────────────┬───────────────────────────────┬──────────────┘
               │ Internal HTTP (Port 8001)     │ Mongoose ODM
┌──────────────▼──────────────┐ ┌──────────────▼──────────────┐
│  Detection Microservice     │ │       MongoDB Database      │
│  (Python 3 / FastAPI)       │ │     Local or MongoDB Atlas  │
└─────────────────────────────┘ └─────────────────────────────┘
```

---

## 2. Environment Configuration

### A. Backend Server (`server/.env`)

```env
PORT=5000
NODE_ENV=production
MONGODB_URI=mongodb+srv://brandtrace_admin:<PASSWORD>@cluster0.mongodb.net/brandtrace?retryWrites=true&w=majority
JWT_SECRET=super_secure_random_64_character_hex_string_here
DETECTION_SERVICE_URL=http://detection-service:8001
CORS_ORIGIN=https://brandtrace.yourdomain.com
RATE_LIMIT_MAX=100
UPLOAD_DIR=uploads
```

### B. Python Detection Service (`detection-service/.env`)

```env
HOST=0.0.0.0
PORT=8001
ENVIRONMENT=production
LOG_LEVEL=info
```

### C. Frontend Client (`client/.env.production`)

```env
VITE_API_BASE_URL=https://api.brandtrace.yourdomain.com/api
```

---

## 3. Option 1: Containerized Deployment (Docker & Docker Compose)

The cleanest production deployment uses `docker-compose` to run all services with automatic restart policies and internal networking.

### `docker-compose.yml`

```yaml
version: '3.8'

services:
  mongodb:
    image: mongo:6.0
    container_name: brandtrace_mongo
    restart: always
    environment:
      MONGO_INITDB_DATABASE: brandtrace
    volumes:
      - mongo_data:/data/db
    networks:
      - brandtrace_net

  detection-service:
    build:
      context: ./detection-service
      dockerfile: Dockerfile
    container_name: brandtrace_detection
    restart: always
    environment:
      - PORT=8001
    networks:
      - brandtrace_net
    expose:
      - "8001"

  server:
    build:
      context: ./server
      dockerfile: Dockerfile
    container_name: brandtrace_server
    restart: always
    environment:
      - PORT=5000
      - NODE_ENV=production
      - MONGODB_URI=mongodb://mongodb:27017/brandtrace
      - JWT_SECRET=change_this_to_a_production_random_secret_key
      - DETECTION_SERVICE_URL=http://detection-service:8001
    depends_on:
      - mongodb
      - detection-service
    networks:
      - brandtrace_net
    expose:
      - "5000"

  frontend:
    build:
      context: ./client
      dockerfile: Dockerfile
    container_name: brandtrace_frontend
    restart: always
    ports:
      - "80:80"
      - "443:443"
    depends_on:
      - server
    networks:
      - brandtrace_net

volumes:
  mongo_data:

networks:
  brandtrace_net:
    driver: bridge
```

---

## 4. Option 2: Managed Cloud Platforms (Render, Railway, Vercel)

### Step 1: Database (MongoDB Atlas)
1. Log in to [MongoDB Atlas](https://www.mongodb.com/atlas).
2. Create a free or dedicated cluster (e.g., AWS us-east-1).
3. Under **Database Access**, create a user `brandtrace_user` with read/write privileges.
4. Under **Network Access**, add `0.0.0.0/0` (or your cloud hosting egress IPs).
5. Copy your connection string:
   `mongodb+srv://brandtrace_user:<password>@cluster.mongodb.net/brandtrace?retryWrites=true&w=majority`

### Step 2: Python Detection Microservice (Render / Railway)
1. Deploy as a Web Service from the `detection-service` directory.
2. Build Command: `pip install -r requirements.txt`
3. Start Command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
4. Copy the public or private URL (e.g., `https://brandtrace-detection.onrender.com`).

### Step 3: Backend API Server (Render / Railway)
1. Deploy as a Web Service from the `server` directory.
2. Build Command: `npm install`
3. Start Command: `node src/server.js`
4. Configure Environment Variables:
   - `MONGODB_URI`: (MongoDB Atlas string)
   - `JWT_SECRET`: (Random 32+ character key)
   - `DETECTION_SERVICE_URL`: (URL from Step 2)
   - `NODE_ENV`: `production`
5. Seed data: Run `node scripts/seed.js` using the cloud terminal or one-off job.

### Step 4: Frontend (Vercel / Netlify)
1. Connect Git repository and choose `client` as Root Directory.
2. Build Command: `npm run build`
3. Output Directory: `dist`
4. Configure rewrites (`vercel.json`) to route `/api/*` to your backend URL:
```json
{
  "rewrites": [
    {
      "source": "/api/:path*",
      "destination": "https://brandtrace-backend.onrender.com/api/:path*"
    },
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

---

## 5. Option 3: Traditional Linux VPS Deployment (Ubuntu 22.04 + PM2 + Nginx)

### 1. Install Prerequisites
```bash
sudo apt update && sudo apt install -y curl git nginx python3-pip python3-venv
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install -g pm2
```

### 2. Configure Python Detection Microservice
```bash
cd /var/www/brandtrace/detection-service
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
pm2 start "venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8001" --name "brandtrace-detection"
```

### 3. Configure Node.js Backend
```bash
cd /var/www/brandtrace/server
npm install --production
pm2 start src/server.js --name "brandtrace-api"
pm2 save
pm2 startup
```

### 4. Build Frontend & Configure Nginx
```bash
cd /var/www/brandtrace/client
npm install
npm run build
sudo cp -r dist/* /var/www/brandtrace-client/
```

### 5. Nginx Reverse Proxy Configuration (`/etc/nginx/sites-available/brandtrace`)
```nginx
server {
    listen 80;
    server_name brandtrace.yourdomain.com;

    # Static Frontend SPA
    location / {
        root /var/www/brandtrace-client;
        try_files $uri $uri/ /index.html;
    }

    # API Proxy to Express
    location /api/ {
        proxy_pass http://127.0.0.1:5000/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
    }

    # Uploads Proxy
    location /uploads/ {
        proxy_pass http://127.0.0.1:5000/uploads/;
    }
}
```
Enable and reload Nginx:
```bash
sudo ln -s /etc/nginx/sites-available/brandtrace /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d brandtrace.yourdomain.com
```

---

## 6. Production Security Checklist

- [x] **Password Protection:** Passwords securely hashed with `bcryptjs` (salt rounds = 10).
- [x] **Rate Limiting:** Express API guarded against brute-force and DDoS using sliding window rate limiter.
- [x] **CWE-1236 Defense:** CSV report exports strictly sanitized against spreadsheet formula injection.
- [x] **Data Isolation:** All database queries strictly scoped by `organization` to enforce multi-tenant isolation.
- [x] **Failover Resilience:** Deterministic JavaScript detection fallback runs automatically if the Python microservice is unavailable.
- [x] **File Upload Security:** Multer restricted to image MIME types with size limits and unique filenames.
- [x] **Environment Separation:** Production secrets stored in environment variables; zero hardcoded secrets.

---

## 7. Health & Monitoring Endpoints

- API Server Health: `GET https://your-domain.com/api/health`
- Source Adapter Telemetry: `GET https://your-domain.com/api/sources/health`
- Python Microservice Health: `GET http://127.0.0.1:8001/health`
