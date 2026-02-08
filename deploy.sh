#!/bin/bash
# Silver Fox Deployment Script for Homelab

set -e

SILVERFOX_DIR="/opt/stacks/silverfox"
REPO_URL="${1:-}"  # Optional: GitHub repo URL

echo "🦊 Silver Fox Deployment"
echo "========================"

# Check if running as root (shouldn't be for Docker)
if [ "$EUID" -eq 0 ]; then 
   echo "⚠️  Warning: Running as root. Docker commands may have issues."
fi

# Create directory if needed
if [ ! -d "$SILVERFOX_DIR" ]; then
    echo "📁 Creating $SILVERFOX_DIR..."
    sudo mkdir -p "$SILVERFOX_DIR"
    sudo chown $USER:$USER "$SILVERFOX_DIR"
fi

cd "$SILVERFOX_DIR"

# Clone or update
if [ -n "$REPO_URL" ]; then
    if [ ! -d ".git" ]; then
        echo "📥 Cloning from $REPO_URL..."
        git clone "$REPO_URL" .
    else
        echo "🔄 Pulling latest changes..."
        git pull
    fi
else
    echo "📂 Using local files from workspace..."
    rsync -av --exclude='node_modules' --exclude='data' --exclude='.git' \
        /home/ryan/.openclaw/workspace/silverfox/ .
fi

# Create environment file if needed
if [ ! -f ".env" ]; then
    echo "⚙️  Creating .env file..."
    cat > .env <<EOF
OPENCLAW_URL=http://host.docker.internal:8080
SESSION_KEY=agent:main:main
DATABASE_URL=/data/silverfox.db
SILVERFOX_PORT=3003
EOF
    echo "✅ Created .env - review and edit if needed"
fi

# Create data directory
mkdir -p data

# Build and start
echo "🐳 Building Docker containers..."
cd docker
docker compose down 2>/dev/null || true
docker compose up -d --build

# Wait for health check
echo "⏳ Waiting for services to start..."
sleep 5

# Check API health
if curl -s http://localhost:3003/api/health > /dev/null; then
    echo "✅ Silver Fox is running!"
    echo ""
    echo "🌐 Access URLs:"
    echo "   Local: http://localhost:3003"
    echo "   Network: http://$(hostname -I | awk '{print $1}'):3003"
    echo ""
    echo "📝 Next steps:"
    echo "   1. Add to Caddy: silverfox.local → localhost:3003"
    echo "   2. Add to Dockge for management"
    echo "   3. Open http://silverfox.local (after Caddy config)"
else
    echo "⚠️  Service may still be starting. Check logs with:"
    echo "   docker compose logs -f"
fi
