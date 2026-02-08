# Silver Fox - OpenClaw Mission Control

A sleek, real-time web dashboard for OpenClaw — your personal AI assistant's mission control center.

## Features

- 🦊 **Real-time Chat**: WebSocket-powered messaging with your OpenClaw agent
- 📊 **Live Status**: Token usage, model info, runtime stats
- 💜 **Regal Purple Design**: Deep purple aesthetic on void black
- 🔧 **Homelab Native**: Dockerized, ready for Dockge/Caddy deployment

## Quick Start

### Development

```bash
# Install dependencies
npm install

# Start both frontend and backend
npm run dev

# Or start separately
npm run dev:api   # Backend on http://localhost:3001
npm run dev:web   # Frontend on http://localhost:5173
```

### Environment Variables

Create `.env` in the root:

```env
OPENCLAW_URL=http://localhost:8080
SESSION_KEY=agent:main:main
DATABASE_URL=./data/silverfox.db
```

### Production Deployment

```bash
cd docker

# Copy and edit environment
cp .env.example .env

# Build and run
docker-compose up -d --build
```

Access at `http://localhost:3003` (or configure via `SILVERFOX_PORT` in `.env`)

### Caddy Integration

Add to your Caddyfile:

```
silverfox.local {
    reverse_proxy localhost:3003
}
```

## Architecture

```
┌─────────────┐      ┌─────────────┐      ┌─────────────┐
│   Browser   │──────▶│ Silver Fox  │──────▶│  OpenClaw   │
│  (React)    │◀──────│  (Express)  │◀──────│  Gateway    │
└─────────────┘ WebS  └─────────────┘ HTTP  └─────────────┘
```

## Tech Stack

- **Frontend**: React 18 + Vite + Tailwind CSS + Zustand
- **Backend**: Express.js + Socket.io
- **Database**: SQLite (better-sqlite3)
- **Real-time**: WebSocket via Socket.io

## Development Roadmap

- [x] Core chat interface
- [x] Real-time status updates
- [x] Message persistence
- [ ] Multiple conversations
- [ ] Todo list integration
- [ ] Memory browser
- [ ] Session explorer
- [ ] Token analytics

## License

MIT
