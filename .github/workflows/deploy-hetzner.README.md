# Deploy to Hetzner — setup

This workflow deploys the Vite-built `dist/` to the Hetzner Cloud server
where the production frontend (`npos-frontend` container) lives.

## One-time setup

### 1. Add the GitHub Secrets

Go to **Settings → Secrets and variables → Actions** in this repo
(`robbiereta/pos-frontend-nefeshapps-`) and add:

| Secret | Required | Where to get it |
|---|---|---|
| `HETZNER_API_TOKEN` | yes | Hetzner Cloud Console → **Security → API Tokens → Generate API Token**. Scope: **Read & Write**. |
| `HETZNER_SERVER_ID` | yes | Hetzner Cloud Console → **Servers** → click the server → the numeric ID is in the URL (`/servers/<ID>/...`). The IP is `204.168.163.106` but the API needs the numeric ID. |
| `HETZNER_SSH_KEY` | yes | The **private** ed25519 key authorized on the server. The matching public key is in `/root/.ssh/authorized_keys` on the Hetzner box. You can use the Mavis sandbox key (`/workspace/deliverables/hetzner/id_ed25519`) as a starting point but **rotate it before committing to a long-lived secret** — that key has been used across many environments. |
| `HETZNER_SSH_USER` | yes | SSH user. The current setup uses `root` (the only user with docker access). Set to `root`. |
| `HETZNER_HOST` | yes | `204.168.163.106` |
| `HETZNER_HEALTH_URL` | yes | Public URL to health-check after deploy. `https://nefeshapps.site/pos/` works. |
| `VITE_API_URL` | yes | The backend URL that gets baked into the bundle at build time. Production: `https://cfdis.nefeshapps.site`. |
| `CONTAINER_NAME` | no | Override the docker container name. Default: `npos-frontend`. Set as a **variable** (not a secret) since it's not sensitive. |

### 2. Create a `production` environment (recommended)

The workflow references `environment: production`. If you create a GitHub
Environment with the same name, you can require manual approval before
any deploy runs (Settings → Environments → New environment → "production"
→ Required reviewers).

### 3. Verify the server side once

SSH into the Hetzner box and confirm the container exists:

```bash
ssh root@204.168.163.106
docker ps --filter "name=npos-frontend" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
```

If the container is still named `nefeshapps-pos-frontend` (the old name
from before the npos rebrand), rename it:

```bash
docker rename nefeshapps-pos-frontend npos-frontend
```

If you skip the rename, set the `CONTAINER_NAME` variable to the old name
so the deploy still finds it.

## How the deploy works

```
push to master  OR  manual trigger
       │
       ▼
   1. Build (Vite, VITE_API_URL injected)
       │
       ▼
   2. Hetzner API → check server status == "running"
       │
       ▼
   3. Hetzner API → create_image snapshot (pre-deploy)
       │
       ▼
   4. SCP dist/ → /tmp/npos-deploy-<sha> on server
       │
       ▼
   5. SSH → docker exec ... rm -rf html/*
              docker cp ... nginx container
              docker exec ... nginx -s reload
       │
       ▼
   6. HTTP GET on the public URL (retry 5x)
       │
       ▼
   7. Hetzner API → create_image snapshot (post-deploy)
```

If the deploy fails (snapshot step 3, SCP, container swap, OR health check),
the `rollback` job runs and prints the snapshot IDs you can use to rebuild
the server from a previous image via:

```bash
curl -X POST \
  -H "Authorization: Bearer $HETZNER_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"image":<id>,"start_after_create":true}' \
  "https://api.hetzner.cloud/v1/servers/$HETZNER_SERVER_ID/actions/rebuild"
```

## Manual run

The workflow has `workflow_dispatch` with two inputs:

- `force` — skip the pre-deploy server-status check
- `skip_snapshot` — skip the pre/post-deploy image snapshots (faster)

From GitHub: **Actions → Deploy to Hetzner → Run workflow**.

## What this does NOT do

- No DB migrations. Schema changes have to be coordinated with the
  backend deploy.
- No backend deploy. The backend has its own workflow
  (`nefapi-cfdis/.github/workflows/cd.yml`) or you can mirror this one.
- No DNS changes. The Hetzner IP is static; Caddy on the box already
  routes `nefeshapps.site` to the right internal port.
- No zero-downtime blue/green. The nginx reload is graceful but a brief
  cache-flush window exists. For most users this is invisible.
