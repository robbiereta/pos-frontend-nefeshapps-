#!/bin/bash
set -e

# Configuration
HETZNER_IP="${HETZNER_IP:-204.168.163.106}"
HETZNER_USER="root"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}🔨 Building Docker image...${NC}"
docker build -f Dockerfile -t nefeshapps-pos-frontend:latest .
echo -e "${GREEN}✅ Frontend image built${NC}"

echo -e "${BLUE}📤 Transferring to Hetzner ($HETZNER_IP)...${NC}"

# Create deployment script
DEPLOY_SCRIPT=$(cat <<'DEPLOY_EOF'
#!/bin/bash
set -e

REPO_PATH="/nefeshapps"

echo "📁 Creating directory..."
mkdir -p $REPO_PATH
cd $REPO_PATH

echo "🐳 Stopping existing containers..."
docker compose -f docker-compose.frontend.yml down 2>/dev/null || true

echo "📥 Loading Docker image..."
docker load -i /tmp/frontend-image.tar.gz

echo "🚀 Starting frontend container..."
docker compose -f docker-compose.frontend.yml up -d

echo ""
echo "✅ Container running:"
docker compose -f docker-compose.frontend.yml ps

echo ""
echo "📍 Frontend listening on: 127.0.0.1:3002"
echo "📍 Cloudflare Tunnel routes pos.nefeshapps.site to this port"
DEPLOY_EOF
)

# Build and transfer image
echo "💾 Saving Docker image..."
docker save nefeshapps-pos-frontend:latest | gzip > /tmp/frontend-image.tar.gz

echo "📦 Transferring to Hetzner..."
ssh "$HETZNER_USER@$HETZNER_IP" "mkdir -p $REPO_PATH"
scp /tmp/frontend-image.tar.gz "$HETZNER_USER@$HETZNER_IP:/tmp/"
scp docker-compose.frontend.yml "$HETZNER_USER@$HETZNER_IP:$REPO_PATH/"

# Execute deployment
echo "$DEPLOY_SCRIPT" | ssh "$HETZNER_USER@$HETZNER_IP" 'bash -s'

# Cleanup
rm -f /tmp/frontend-image.tar.gz

echo ""
echo -e "${GREEN}🎉 Frontend deployed!${NC}"
echo -e "${BLUE}📍 Frontend URL: https://pos.nefeshapps.site${NC}"
echo -e "${BLUE}📍 API URL: https://cfdis.nefeshapps.site${NC}"
echo ""
echo -e "${YELLOW}✅ Cloudflare Tunnel handles routing${NC}"
