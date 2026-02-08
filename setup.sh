#!/bin/bash

# Silver Fox Setup Script for Homelab

set -e

echo "🦊 Silver Fox Setup"
echo "=================="

# Check if running from correct directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Please run from the silverfox root directory"
    exit 1
fi

# Create data directory
mkdir -p data

# Check for .env
if [ ! -f ".env" ]; then
    echo "⚙️  Creating .env file from template..."
    cp .env.example .env
    echo "✅ Created .env - please edit it with your OpenClaw gateway URL and token"
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Build shared types
echo "🔨 Building shared types..."
npm run build -w packages/shared-types

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Edit .env with your OpenClaw configuration"
echo "2. Run 'npm run dev' to start development"
echo "3. Or 'cd docker && docker-compose up -d' for production"
