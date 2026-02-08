# Silver Fox — Master Plan

**Status**: Planning Complete | **Next Phase**: Sprint 1 (MVP)

---

## Project Vision

Silver Fox is a web-based mission control dashboard for OpenClaw — transforming the TUI experience into a sleek, real-time GUI accessible via the homelab network and Tailscale.

**Core Tenets**:
- Chat-first MVP: Get conversational interface working first
- Deep purple, regal aesthetic — sophisticated dark mode
- Real-time: WebSocket-powered live updates
- Homelab-native: Dockerized, Dockge-managed, Caddy-routed

---

## 1. Architecture & Stack

### Tech Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Frontend | React 18 + Vite | Fast dev server, modern React patterns |
| Styling | Tailwind CSS | Rapid UI development, consistent design system |
| State | Zustand | Lightweight state management |
| Realtime | Socket.io | Reliable WebSocket with fallback |
| Backend | Express.js | Lightweight, familiar, easy to extend |
| Database | SQLite + better-sqlite3 | Zero-config, homelab-appropriate, powerful enough |
| API Bridge | OpenClaw Node SDK | Direct integration with sessions_* APIs |

### Project Structure

```
silverfox/
├── apps/
│   ├── web/                    # React frontend
│   │   ├── src/
│   │   │   ├── components/     # Reusable UI
│   │   │   ├── features/       # Chat, Status, Memory modules
│   │   │   ├── stores/          # Zustand stores
│   │   │   └── styles/          # Tailwind + custom CSS
│   │   └── package.json
│   └── api/                    # Express backend
│       ├── src/
│       │   ├── routes/          # REST endpoints
│       │   ├── services/          # Business logic
│       │   ├── sockets/         # Socket.io handlers
│       │   └── db/              # Migrations, queries
│       └── package.json
├── packages/
│   └── shared-types/           # Shared TS interfaces
├── docker/
│   └── Dockerfile.*            # Container configs
└── docker-compose.yml
```

### API Endpoints (Internal)

```
REST:
POST   /api/chat/send           # Send message to OpenClaw
GET    /api/chat/history        # Get conversation history
GET    /api/status              # Current OpenClaw status
GET    /api/todos               # CRUD for todos

WebSocket Events:
ws://silverfox.local/socket.io
  → chat:message               # Incoming from OpenClaw
  → chat:typing                # Typing indicator
  → status:update              # Token usage, model status
  → connection:status          # Online/offline
```

### Database Schema

```sql
-- conversations
CREATE TABLE conversations (
  id INTEGER PRIMARY KEY,
  session_key TEXT NOT NULL,
  title TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- messages
CREATE TABLE messages (
  id INTEGER PRIMARY KEY,
  conversation_id INTEGER REFERENCES conversations(id),
  role TEXT CHECK(role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  token_count INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- todos (for future phases)
CREATE TABLE todos (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  priority INTEGER DEFAULT 1, -- 0=low, 1=normal, 2=high
  status TEXT DEFAULT 'open', -- open, in_progress, done
  due_date DATETIME,
  tags TEXT, -- JSON array
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME
);
```

---

## 2. Design System

### Color Palette — "Royal Purple Dark"

```css
/* Primary Backgrounds */
--bg-primary: #0a0a0f;        /* Deep void black */
--bg-secondary: #12121a;      /* Elevated surfaces */
--bg-tertiary: #1a1a26;       /* Cards, panels */
--bg-glass: rgba(26, 26, 38, 0.7); /* Glassmorphism */

/* Regal Purple Accent */
--purple-50: #f5f3ff;
--purple-100: #ede9ff;
--purple-200: #ddd6fe;
--purple-300: #c4b5fd;
--purple-400: #a78bfa;
--purple-500: #8b5cf6;        /* Primary accent */
--purple-600: #7c3aed;        /* Regal purple */
--purple-700: #6d28d9;
--purple-800: #5b21b9;
--purple-900: #4c1d95;
--purple-950: #2e1065;        /* Deep purple */

/* Semantic Colors */
--success: #22c55e;
--warning: #f59e0b;
--error: #ef4444;
--info: #3b82f6;

/* Text */
--text-primary: #f8fafc;
--text-secondary: #94a3b8;
--text-muted: #64748b;
```

### Typography

- **Primary**: Inter (Google Fonts) — clean, modern, excellent readability
- **Monospace**: JetBrains Mono — for code blocks, token counts
- **Scale**: 14px base, 1.25 ratio

### Components Needed

| Component | Purpose |
|-----------|---------|
| ChatContainer | Main chat interface |
| MessageBubble | User/assistant messages |
| InputComposer | Text input with send |
| TypingIndicator | "Thinking..." animation |
| StatusBar | Token count, model name, connection |
| Sidebar | Conversations list, navigation |
| GlassCard | Reusable glassmorphism panel |
| Button/IconButton | Actions |

### Animations

- **Message entrance**: Slide up + fade (200ms, ease-out)
- **Typing dots**: Bounce stagger (1.4s infinite)
- **Token counter**: Number roll animation
- **Status pulse**: Subtle glow on online indicator

### Layout

```
┌─────────────────────────────────────────────┐
│ 🦊 Silver Fox          [🔴] Token: 1.2k   │ <- Status Bar
├──────────┬──────────────────────────────────┤
│          │                                  │
│ Conversations │   Chat Messages           │
│ List     │   ┌────────────────────────┐  │
│          │   │ User: Hello!           │  │
│   ⬤      │   ├────────────────────────┤  │
│   Active   │   │ 🤖 I can help with...  │  │
│   Session  │   └────────────────────────┘  │
│          │                                  │
│ + New    │   [Type a message...      ] [↲] │
│          │                                  │
└──────────┴──────────────────────────────────┘
```

---

## 3. OpenClaw Integration

### Session Bridge Architecture

```
┌─────────────┐      ┌─────────────┐      ┌─────────────┐      ┌─────────────┐
│   Browser   │──────▶│ Express API │──────▶│  sessions_* │──────▶│  OpenClaw   │
│  (React)    │◀──────│  (Node.js)  │◀─────│    APIs     │◀─────│   Core      │
└─────────────┘ WebS  └─────────────┘ HTTP  └─────────────┘      └─────────────┘
```

### Message Flow

1. **User sends message**:
   ```typescript
   // Frontend → WebSocket → Backend
   socket.emit('chat:send', { content: "Hello" });
   
   // Backend → OpenClaw
   await sessions_send({
     sessionKey: TARGET_SESSION,
     message: content
   });
   ```

2. **Receiving responses**:
   - Backend maintains identity (same sessionKey as user's main session)
   - New messages trickle back via sessions_history polling
   - OR if OpenClaw has webhooks, use those

3. **Status updates**:
   - Poll session_status every 5s when active
   - Push updates via WebSocket to frontend

### Authentication

- Use OpenClaw's existing session authentication
- Silver Fox backend stores main session key in env var
- All OpenClaw API calls authenticated via Gateway token

---

## 4. Deployment & Infrastructure

### Docker Compose (Dockge Stack)

```yaml
# /opt/stacks/silverfox/docker-compose.yml
version: '3.8'
services:
  api:
    build:
      context: ./apps/api
      dockerfile: ../../docker/Dockerfile.api
    container_name: silverfox-api
    environment:
      - OPENCLAW_URL=http://gateway:8080
      - OPENCLAW_TOKEN=${OPENCLAW_TOKEN}
      - SESSION_KEY=${SESSION_KEY}
      - DATABASE_URL=/data/silverfox.db
    volumes:
      - ./data:/data
    networks:
      - silverfox
    restart: unless-stopped

  web:
    build:
      context: ./apps/web
      dockerfile: ../../docker/Dockerfile.web
    container_name: silverfox-web
    depends_on:
      - api
    networks:
      - silverfox
    restart: unless-stopped

  nginx:
    image: nginx:alpine
    container_name: silverfox-nginx
    volumes:
      - ./docker/nginx.conf:/etc/nginx/nginx.conf
    ports:
      - "3003:80"
    depends_on:
      - web
      - api
    networks:
      - silverfox
    restart: unless-stopped

networks:
  silverfox:
    name: silverfox
```

### Caddy Reverse Proxy

```
# Add to Caddyfile
silverfox.local {
    reverse_proxy localhost:3003
}
```

### GitHub Workflow

1. Development on local machine or via GitHub Codespaces
2. Push to `develop` branch
3. Pull on homelab: `cd /opt/stacks/silverfox && git pull`
4. Dockge → Restart stack

---

## 5. Sprint Plan

### Sprint 1: Chat Core (MVP) — 1-2 weeks

**Goals**:
- ✅ Project scaffolding
- ✅ Express API with OpenClaw bridge
- ✅ Basic React chat UI
- ✅ Socket.io real-time messaging
- ✅ Status display (token count, model)
- ✅ SQLite message persistence

**Deliverable**: Functional chat via silverfox.local

### Sprint 2: Polish & Extended Features — 1 week

**Goals**:
- ✅ Full design system implementation
- ✅ Message history with search
- ✅ Multiple conversations
- ✅ Mobile responsiveness
- ✅ Connection status indicators

**Deliverable**: Production-ready chat interface

### Sprint 3: Mission Control Modules — Ongoing

**Module Queue**:
1. **Todo List** — Kanban or list view, priorities, due dates
2. **Memory Lens** — Browse/search MEMORY.md, daily notes
3. **Session Explorer** — Visual timeline, sub-agent monitoring
4. **Token Analytics** — Usage graphs, cost tracking
5. **Quick Actions** — Run common OpenClaw commands

---

## 6. MVP Implementation Tasks

### Backend (api/)

- [ ] Setup Express + TypeScript
- [ ] Configure Socket.io
- [ ] Create OpenClaw service wrapper
- [ ] Implement message routes
- [ ] Setup SQLite with better-sqlite3
- [ ] Create migrations
- [ ] Implement auth middleware

### Frontend (web/)

- [ ] Setup Vite + React + Tailwind
- [ ] Install shadcn/ui components
- [ ] Configure Socket.io client
- [ ] Build ChatContainer
- [ ] Build MessageBubble
- [ ] Build InputComposer
- [ ] Build StatusBar
- [ ] Connect to API

### DevOps

- [ ] Create Dockerfiles
- [ ] Create docker-compose.yml
- [ ] Add Caddy config
- [ ] Test deployment
- [ ] Document setup

---

## 7. Key Decisions Log

| Decision | Rationale |
|----------|-----------|
| SQLite over PostgreSQL | Simpler for homelab, zero config, single file backup |
| Socket.io over native WS | Built-in reconnection, room support, fallbacks |
| Separate web/api containers | Clean separation, independent scaling |
| Monorepo with npm workspaces | Shared types, unified versioning |
| Tailwind over CSS-in-JS | Performance, familiarity, design system ready |
| Zustand over Redux | Simpler, less boilerplate, perfect for this scale |

---

## Next Steps

1. **Approve this plan** — Any changes needed?
2. **Create GitHub repo** — Initialize silverfox repository
3. **Sprint 1 Kickoff** — I'll scaffold the project and start building

Ready when you are, Ryan. 🦊
