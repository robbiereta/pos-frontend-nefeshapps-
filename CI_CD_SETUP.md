# GitHub Actions CI/CD Setup

## What's configured

Auto-deploy to production on every push to `master` branch:

1. Build Node.js + npm dependencies
2. Build Vite frontend
3. Build Docker image
4. Push to Hetzner
5. Restart container

## Setup (one-time)

### 1. Add GitHub Secrets

Go to: **Settings → Secrets and variables → Actions → New repository secret**

Add these secrets:

| Secret | Value |
|--------|-------|
| `HETZNER_IP` | `204.168.163.106` (or your current IP) |
| `HETZNER_SSH_KEY` | Private SSH key content (from your local machine) |

**To get the SSH key:**

```bash
# On your local machine, if you have the key:
cat ~/.ssh/id_rsa  # or wherever your private key is
# Copy the entire content (-----BEGIN ... -----END-----) to the secret
```

If you don't have a key on Hetzner yet:

```bash
# Generate a new key locally
ssh-keygen -t rsa -b 4096 -f ~/.ssh/hetzner_deploy -C "github-actions"

# Add public key to Hetzner root's authorized_keys
cat ~/.ssh/hetzner_deploy.pub | ssh root@204.168.163.106 "cat >> ~/.ssh/authorized_keys"

# Copy private key to GitHub secret
cat ~/.ssh/hetzner_deploy
```

### 2. Verify `.env.production` exists on Hetzner

The workflow mounts it as `env_file` in docker-compose.yml. Make sure:

```bash
ssh root@204.168.163.106 "cat /nefeshapps/.env.production"
```

If missing, create it:

```bash
ssh root@204.168.163.106 "cat > /nefeshapps/.env.production" << 'EOF'
VITE_API_URL=https://cfdis.nefeshapps.site
NODE_ENV=production
EOF
```

### 3. Verify docker-compose.yml on Hetzner

Check it matches your local version or adjust paths as needed.

## Usage

### Deploy to production

```bash
git push origin master
```

The workflow runs automatically. Watch progress:
- GitHub → Actions tab
- Or get real-time logs via CLI:
  ```bash
  gh run list --branch master --limit 1
  gh run view <run-id> --log
  ```

### Manual rollback

If deployment fails and you need to rollback:

```bash
ssh root@204.168.163.106
cd /nefeshapps
docker compose down
docker load -i /tmp/frontend-image.tar.gz  # old image, if still there
docker compose up -d
```

## Troubleshooting

**"Permission denied (publickey)" error:**
- SSH key not on Hetzner, or wrong permissions
- Test manually: `ssh -i ~/.ssh/hetzner_deploy root@204.168.163.106 "echo OK"`

**"docker compose: command not found":**
- Hetzner needs Docker Compose v2
- Install: `docker compose version` or `apt-get install docker-compose`

**"Cannot connect to Docker daemon":**
- Docker not running on Hetzner
- Check: `ssh root@204.168.163.106 "systemctl status docker"`

**Build takes too long:**
- Docker layer caching should help after first run
- If still slow, consider caching npm dependencies in GitHub Actions

## Next steps

- Add Slack/Discord notifications on deploy success/failure
- Add smoke tests after deploy
- Consider staging environment with same workflow pattern
