# Deploy shoplit to AWS (single EC2 + docker-compose)

This runs the whole stack — Next.js, both Go services, Postgres, Redis — on
one EC2 instance with Caddy terminating TLS and routing by path. Everything
serves from `https://shoplit.in` (one origin → no CORS/cookie pain).

Cost: ~$15/mo for a `t3.small` (or use Lightsail $5–10 — same compose works).
You can graduate to managed RDS/ElastiCache/ECS later; the Dockerfiles carry over.

```
                         ┌────────────── EC2 instance ──────────────┐
 Internet ── :443 ──▶ Caddy (TLS, Let's Encrypt)                     │
                         │  /api/*  → shoplit-api    :8080            │
                         │  /go/*,/p/* → shoplit-redirect :8081       │
                         │  /*      → shoplit-web (Next) :3000         │
                         │  internal: postgres:5432, redis:6379        │
                         └────────────────────────────────────────────┘
```

---

## 1. Launch the EC2 instance

1. EC2 → **Launch instance**.
   - AMI: **Ubuntu Server 24.04 LTS**.
   - Type: **t3.small** (2 GB RAM; `t3.micro` 1 GB is tight with Postgres+Redis+Node).
   - Key pair: create/download one (for SSH).
   - Storage: **20 GB** gp3.
2. **Security group** — inbound rules:
   | Type  | Port | Source            |
   |-------|------|-------------------|
   | SSH   | 22   | My IP             |
   | HTTP  | 80   | 0.0.0.0/0, ::/0   |
   | HTTPS | 443  | 0.0.0.0/0, ::/0   |

   (80 is required so Caddy can complete the Let's Encrypt HTTP challenge.)
3. Launch.

## 2. Give it a stable IP

EC2 → **Elastic IPs** → Allocate → Associate with the instance. Note this IP
(e.g. `13.234.x.x`) — DNS will point at it. Without an Elastic IP the public IP
changes on every stop/start.

## 3. Point the domain at the box (GoDaddy)

In GoDaddy: **My Products → Domain → DNS → Manage DNS** (or `dns.godaddy.com`).
Add/edit records:

| Type | Name | Value (Data)      | TTL     |
|------|------|-------------------|---------|
| A    | `@`  | `<ELASTIC_IP>`    | 600 sec |
| A    | `www`| `<ELASTIC_IP>`    | 600 sec |

- Delete any conflicting "Parked"/Forwarding A records GoDaddy added by default.
- If DNS is managed at BigRock instead, do the same in cPanel → **Zone Editor**
  (A record `shoplit.in` and `www` → Elastic IP).
- Verify before continuing (takes a few min to ~1 hr):
  `dig +short shoplit.in` → should print the Elastic IP.

> TLS won't issue until DNS resolves to this box, so wait for `dig` to be right.

## 4. Update the Google OAuth client

console.cloud.google.com → your OAuth 2.0 Client → add:
- **Authorized JavaScript origin:** `https://shoplit.in`
- **Authorized redirect URI:** `https://shoplit.in/api/v1/auth/google/callback`

## 5. Install Docker on the instance

```bash
ssh -i your-key.pem ubuntu@<ELASTIC_IP>

sudo apt-get update && sudo apt-get install -y ca-certificates curl git
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" | sudo tee /etc/apt/sources.list.d/docker.list >/dev/null
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker ubuntu
newgrp docker   # or log out/in so `docker` works without sudo
```

## 6. Get the code + configure secrets

```bash
git clone https://github.com/mayur-tolexo/shoplit.git
cd shoplit
cp deploy/.env.prod.example deploy/.env
nano deploy/.env
```

Fill in `deploy/.env`:
- `SITE_DOMAIN=shoplit.in`, `PUBLIC_URL=https://shoplit.in`
- `ACME_EMAIL=` your email
- `POSTGRES_PASSWORD=` a strong password
- `SHOPLIT_SESSION_SECRET=` run `openssl rand -hex 32` and paste
- `GOOGLE_OAUTH_CLIENT_ID` / `GOOGLE_OAUTH_CLIENT_SECRET` from step 4

`deploy/.env` is gitignored — it never leaves the server.

## 7. Build and start

```bash
docker compose -f deploy/compose.prod.yaml --env-file deploy/.env up -d --build
```

- The `migrate` service applies DB migrations automatically, then the API starts.
- Caddy fetches a Let's Encrypt cert on first boot (needs DNS + port 80 — steps 2–3).

Watch it come up:
```bash
docker compose -f deploy/compose.prod.yaml logs -f caddy shoplit-api
```

## 8. Verify

```bash
curl -I https://shoplit.in                         # 200, valid TLS
curl -s https://shoplit.in/api/public/carts/none   # 404 JSON = API reachable
```
Then open `https://shoplit.in`, sign in with Google, create a cart, click a product.

---

## Operations

```bash
# Update to latest code
git pull && docker compose -f deploy/compose.prod.yaml --env-file deploy/.env up -d --build

# Logs / status
docker compose -f deploy/compose.prod.yaml logs -f
docker compose -f deploy/compose.prod.yaml ps

# DB backup (run periodically / before upgrades)
docker compose -f deploy/compose.prod.yaml exec postgres \
  pg_dump -U shoplit shoplit | gzip > shoplit-$(date +%F).sql.gz

# Stop / start
docker compose -f deploy/compose.prod.yaml down      # keeps data volumes
docker compose -f deploy/compose.prod.yaml up -d
```

## Notes & next steps

- **Backups:** the DB lives in the `pg_data` Docker volume on this one box. Set up
  a cron'd `pg_dump` to S3, or move to **RDS** when it matters. A single instance
  has no built-in redundancy.
- **Managed services later:** point `SHOPLIT_DB_DSN` at RDS and `SHOPLIT_REDIS_URL`
  at ElastiCache/Upstash, then drop the `postgres`/`redis` services from compose.
  No app code changes — both are already env-driven (Redis handles `rediss://` TLS).
- **Scaling the web tier:** move Next.js to Vercel and set `PUBLIC_URL` accordingly;
  Caddy then only fronts the two Go services.
