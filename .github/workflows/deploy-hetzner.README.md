# Deploy to Hetzner — SSH-less setup

This workflow deploys the Vite-built `dist/` to the Hetzner Cloud server
**without ever using SSH from GitHub Actions**. The deploy is signaled
via the Hetzner Cloud API (a server label change), and a tiny Python
agent on the server polls the Hetzner metadata API every 10 seconds
and pulls the new bundle from Hetzner Object Storage (S3-compatible).

## Architecture

```
┌──────────────┐                          ┌──────────────────────────┐
│ GitHub Action│                          │   Hetzner server         │
│  (no SSH)    │                          │   204.168.163.106        │
│              │                          │                          │
│ 1. build     │                          │  ┌──────────────────┐    │
│ 2. upload ───┼──► Hetzner Object ────┼──┼─►│   deploy-agent.py│   │
│    s3 sync   │    Storage (S3)          │  │  (polls every 10s)│   │
│ 3. PATCH ────┼──► Hetzner Cloud API ────┼─►│                  │   │
│    server    │    change_labels         │  │  sees new label,  │   │
│    label     │    "npos.deploy.sha"     │  │  pulls from S3,  │   │
│              │                          │  │  swaps nginx,    │   │
│ 4. health    │────► public URL ◄────────┼──┤  reloads        │   │
│    check     │                          │  └──────────────────┘    │
└──────────────┘                          │           │              │
                                          │           ▼              │
                                          │  ┌──────────────────┐    │
                                          │  │ npos-frontend    │    │
                                          │  │ (nginx container)│   │
                                          │  └──────────────────┘    │
                                          └──────────────────────────┘
```

## One-time setup

### Step 1 — Create a Hetzner Object Storage bucket

In the Hetzner Cloud Console:
- Go to **Object Storage → Create bucket**
- Name: `npos-dist`
- Region: `fsn1` (or wherever the server lives)
- Note the **endpoint URL** (e.g. `https://fsn1.your-objectstorage.com`)
- Create an **access key** + **secret key** with read+write on this bucket

### Step 2 — Add GitHub Secrets

In `robbiereta/pos-frontend-nefeshapps-` → **Settings → Secrets and variables → Actions**:

| Type | Name | Value |
|---|---|---|
| Secret | `HETZNER_API_TOKEN` | Hetzner Cloud API token, Read & Write |
| Secret | `HETZNER_SERVER_ID` | Numeric server ID (not the IP `204.168.163.106`) |
| Secret | `HETZNER_S3_ENDPOINT` | `https://fsn1.your-objectstorage.com` |
| Secret | `HETZNER_S3_BUCKET` | `npos-dist` |
| Secret | `HETZNER_S3_ACCESS_KEY` | from step 1 |
| Secret | `HETZNER_S3_SECRET_KEY` | from step 1 |
| Secret | `HETZNER_HEALTH_URL` | `https://nefeshapps.site/pos/` |
| Secret | `VITE_API_URL` | `https://cfdis.nefeshapps.site` |
| Variable | `HETZNER_S3_REGION` | `fsn1` |
| Variable | `CONTAINER_NAME` | `npos-frontend` |

### Step 3 — Install the deploy-agent on the server (one-time SSH)

This is the **only SSH step** in the entire pipeline, and you only do it once.

```bash
# From your laptop, copy the files to the server
scp server/deploy-agent/deploy-agent.py \
    server/deploy-agent/deploy-agent.service \
    server/deploy-agent/install.sh \
    root@204.168.163.106:/tmp/

ssh root@204.168.163.106

# On the server, run the installer with the same values from step 1+2
HETZNER_API_TOKEN=hcloud_xxxxxxxxxxxxxxxxxxxx \
HETZNER_SERVER_ID=12345 \
S3_ENDPOINT=https://fsn1.your-objectstorage.com \
S3_BUCKET=npos-dist \
S3_ACCESS_KEY=xxxxxxxxxxxxxxxxxxxx \
S3_SECRET_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx \
CONTAINER_NAME=npos-frontend \
bash /tmp/install.sh
```

The installer:
1. Installs `python3` + `boto3` (via apt + pip)
2. Lays out `/opt/npos`, `/etc/npos`, `/var/lib/npos`
3. Drops the agent script and the systemd unit
4. Writes `/etc/npos/deploy-agent.env` (chmod 0600)
5. Sets the initial `npos.deploy.sha` server label so the agent doesn't immediately re-deploy
6. Enables + starts the `deploy-agent.service`

Verify:
```bash
systemctl status deploy-agent.service
journalctl -u deploy-agent.service -f
```

You should see:
```
deploy-agent starting (poll=10s, container=npos-frontend, label=npos.deploy.sha)
initial state: npos.deploy.sha=initial (skipping initial deploy)
```

### Step 4 — (Optional) Create a `production` environment

For an approval gate before each deploy, create a GitHub Environment
named `production` and require reviewers.

## How a deploy runs

1. **Build** — `npm ci && npm run build` (Vite, with `VITE_API_URL` baked in)
2. **Pre-flight** — Hetzner API: `GET /servers/{id}` to confirm `status == "running"`
3. **Upload** — `aws s3 sync dist/ s3://npos-dist/dist/ --delete` to Hetzner Object Storage. `index.html`, `sw.js`, and `manifest.webmanifest` get `no-cache`; assets get `immutable` cache.
4. **Signal** — Hetzner API: `POST /servers/{id}/actions/change_labels` with `{"labels":{"npos.deploy.sha":"<github.sha>"}}`
5. **Agent picks up** — within ~10s the server-side `deploy-agent` sees the new label, runs `boto3` to mirror `s3://npos-dist/dist/` to `/var/lib/npos/staging/`, then `docker cp` into the running nginx container + `nginx -s reload`
6. **Health check** — GitHub Action polls `HETZNER_HEALTH_URL` every 10s for up to 90s, expects HTTP 200
7. **Snapshot** — Hetzner API: `POST /servers/{id}/actions/create_image` for audit trail

## Manual rollback

Set the label back to a previous SHA — the agent will re-pull and redeploy:

```bash
curl -X POST \
  -H "Authorization: Bearer $HETZNER_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"labels":{"npos.deploy.sha":"<previous-sha>"}}' \
  "https://api.hetzner.cloud/v1/servers/$HETZNER_SERVER_ID/actions/change_labels"
```

## Why this design

- **No SSH key in GitHub Secrets.** A leaked GitHub token can't get you a shell on the server.
- **No inbound port on the server.** The agent is purely outbound (HTTPS to Hetzner API + S3). The server's firewall can stay locked down.
- **Idempotent.** The agent only acts when the label changes. Re-running the workflow with the same SHA is a no-op.
- **Recoverable.** The agent's `STATE_FILE` persists the last-applied SHA. After a server reboot, the agent reads the current label, sees it matches the file, and does nothing. After a crash mid-deploy, the next poll retries.
- **No downtime.** `nginx -s reload` is graceful. The new dist is staged in `/var/lib/npos/staging/` before the `docker cp` swap.

## What this does NOT do

- **No DB migrations.** Schema changes have to be coordinated with the backend deploy.
- **No backend deploy.** `nefapi-cfdis` has its own CD workflow; you can mirror this one there.
- **No blue/green.** The brief window between `docker cp` and `nginx -s reload` is a stale-cache window. For a Vite PWA this is invisible because assets are content-hashed and the service worker only checks the manifest, which is `no-cache`.
- **No DNS / TLS management.** Hetzner IP is static, Caddy on the box already routes `nefeshapps.site` to the right internal port, and Let's Encrypt is already wired.
