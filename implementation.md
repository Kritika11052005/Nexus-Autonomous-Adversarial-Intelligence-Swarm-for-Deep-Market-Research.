# NEXUS — Implementation Plan
**Document Version:** 1.0  
**Project:** NEXUS Multi-Agent Intelligence Swarm  
**Format:** Hackathon-optimized execution plan  

---

## 1. OVERVIEW

This plan breaks the NEXUS build into 6 sequential phases. Each phase has a clear deliverable, estimated time, and task checklist. The total estimated time for a functional MVP is **16–20 hours** (solo) or **10–12 hours** (2-person team).

### Execution Principles
- **Vertical slices first** — get one full path working end-to-end before expanding
- **Mock before integrate** — stub expensive dependencies (LLM, search) early, swap real APIs in later
- **Ship the demo loop** — query in → swarm visible → report out; everything else is polish
- **No premature optimization** — working first, fast later

---

## 2. PHASE OVERVIEW

| Phase | Name | Focus | Est. Time |
|---|---|---|---|
| **1** | Project Setup | Repos, tooling, env, skeleton | 1–1.5h |
| **2** | Database & Auth | Schema, migrations, JWT auth | 2–2.5h |
| **3** | Backend — Agent Core | LangGraph swarm, SSE stream | 4–5h |
| **4** | Frontend — Core UI | Layout, swarm graph, log feed | 3–4h |
| **5** | Integration & Polish | Connect FE+BE, animations, edge cases | 2–3h |
| **6** | Testing & Deployment | Tests, Docker, deploy | 1.5–2h |

---

## 3. PHASE 1 — PROJECT SETUP

**Goal:** Mono-repo initialized, both apps runnable, env variables wired.  
**Time:** 1–1.5 hours

### 3.1 Repository Structure

```
nexus/
├── backend/
│   ├── app/
│   │   ├── agents/          ← One file per agent
│   │   │   ├── planner.py
│   │   │   ├── researcher.py
│   │   │   ├── critic.py
│   │   │   ├── validator.py
│   │   │   └── reconciler.py
│   │   ├── graph/
│   │   │   └── graph.py     ← LangGraph pipeline definition
│   │   ├── api/
│   │   │   ├── routes/
│   │   │   │   ├── sessions.py
│   │   │   │   ├── auth.py
│   │   │   │   └── stream.py
│   │   │   └── deps.py      ← FastAPI dependencies
│   │   ├── db/
│   │   │   ├── models.py    ← SQLAlchemy models
│   │   │   ├── session.py   ← DB connection/pool
│   │   │   └── redis.py     ← Redis client
│   │   ├── core/
│   │   │   ├── config.py    ← Settings (pydantic-settings)
│   │   │   └── security.py  ← JWT + hashing utils
│   │   └── main.py          ← FastAPI app entry point
│   ├── migrations/          ← Alembic
│   ├── tests/
│   ├── Dockerfile
│   ├── pyproject.toml
│   └── .env.example
│
├── frontend/
│   ├── src/
│   │   ├── app/             ← Next.js App Router pages
│   │   │   ├── page.tsx     ← Home / query input
│   │   │   ├── run/
│   │   │   │   └── [sessionId]/
│   │   │   │       └── page.tsx  ← Active swarm view
│   │   │   ├── history/
│   │   │   │   └── page.tsx
│   │   │   └── layout.tsx
│   │   ├── components/
│   │   │   ├── SwarmGraph.tsx
│   │   │   ├── AgentNode.tsx
│   │   │   ├── AgentLogFeed.tsx
│   │   │   ├── OutputReport.tsx
│   │   │   ├── QueryInput.tsx
│   │   │   ├── ConfidenceBadge.tsx
│   │   │   └── ProgressBar.tsx
│   │   ├── lib/
│   │   │   ├── api.ts       ← API client
│   │   │   ├── sse.ts       ← SSE hook
│   │   │   └── types.ts     ← Shared TS types
│   │   └── styles/
│   │       └── globals.css  ← CSS variables, base styles
│   ├── public/
│   ├── Dockerfile
│   ├── package.json
│   └── .env.local.example
│
├── docker-compose.yml       ← Full local stack
└── README.md
```

### 3.2 Checklist

**Backend setup:**
- [ ] `mkdir nexus && cd nexus`
- [ ] Initialize Python project: `uv init backend` (or `pip` + `venv`)
- [ ] Install core dependencies:
  ```bash
  pip install fastapi uvicorn sqlalchemy[asyncio] asyncpg alembic
  pip install langgraph langchain-anthropic httpx python-dotenv
  pip install redis[hiredis] pydantic-settings python-jose[cryptography] bcrypt
  pip install tavily-python
  ```
- [ ] Create `.env` file (copy from `.env.example`)
- [ ] Verify `uvicorn app.main:app --reload` runs on port `8000`

**Frontend setup:**
- [ ] `npx create-next-app@latest frontend --typescript --tailwind --app`
- [ ] Install dependencies:
  ```bash
  npm install @xyflow/react lucide-react class-variance-authority clsx
  npm install tailwind-merge @radix-ui/react-dialog @radix-ui/react-tooltip
  ```
- [ ] Set up CSS variables in `globals.css` (all tokens from Design Doc)
- [ ] Install Google Fonts: Space Grotesk, Inter, JetBrains Mono
- [ ] Verify `npm run dev` runs on port `3000`

**Docker Compose:**
- [ ] Create `docker-compose.yml` with services: `db` (Postgres), `redis`, `backend`, `frontend`
- [ ] Verify `docker compose up` boots full stack

---

## 4. PHASE 2 — DATABASE & AUTH

**Goal:** Schema live, migrations running, JWT auth endpoints working.  
**Time:** 2–2.5 hours

### 4.1 Database Setup

- [ ] Enable pgvector extension:
  ```sql
  CREATE EXTENSION IF NOT EXISTS vector;
  ```
- [ ] Write SQLAlchemy models in `app/db/models.py` (all 7 tables from Schema doc)
- [ ] Initialize Alembic:
  ```bash
  alembic init migrations
  alembic revision --autogenerate -m "initial_schema"
  alembic upgrade head
  ```
- [ ] Verify all tables exist in Postgres: `\dt` in psql
- [ ] Set up async session factory in `app/db/session.py`
- [ ] Set up Redis client in `app/db/redis.py`

### 4.2 Auth Implementation

- [ ] Write `app/core/security.py`:
  - `hash_password(plain)` → bcrypt
  - `verify_password(plain, hashed)` → bcrypt check
  - `create_access_token(user_id, plan)` → JWT
  - `decode_token(token)` → payload dict
- [ ] Implement `POST /auth/register` route
- [ ] Implement `POST /auth/login` route
- [ ] Implement `GET /auth/me` (protected) route
- [ ] Write `app/api/deps.py`:
  - `get_current_user` dependency → validates JWT, returns user
- [ ] **Quick test:** curl register → login → get /me works end-to-end

### 4.3 Seed Dev Data

- [ ] Write `backend/seed.py` script
- [ ] Create dev user: `dev@nexus.local` / `password123`
- [ ] Verify login works with seeded user

---

## 5. PHASE 3 — BACKEND AGENT CORE

**Goal:** Full LangGraph pipeline runs. SSE streams events. Session created and stored.  
**Time:** 4–5 hours (core of the build)

### 5.1 Agent Prompts

Write system prompts for each agent in `app/agents/`:

- [ ] **Planner** (`planner.py`):
  - Takes: raw user query
  - Outputs: JSON list of 3–5 sub-queries for researchers
  - Prompt must enforce JSON output format

- [ ] **Researcher A/B/C** (`researcher.py` — parameterized):
  - Takes: assigned sub-query
  - Tools: Tavily search
  - Outputs: structured findings with source URLs
  - Runs in parallel (LangGraph fan-out)

- [ ] **Critic** (`critic.py`):
  - Takes: all researcher outputs combined
  - Outputs: list of challenges — each pointing to a specific finding + reason
  - Prompt: adversarial persona, must find real conflicts

- [ ] **Validator** (`validator.py`):
  - Takes: researcher findings + critic challenges
  - Outputs: each finding tagged as `confirmed` / `contested` / `rejected` with reason

- [ ] **Reconciler** (`reconciler.py`):
  - Takes: validated findings
  - Outputs: final structured report with confidence scores per finding

### 5.2 LangGraph Graph Definition

- [ ] Create `app/graph/graph.py`:

```python
from langgraph.graph import StateGraph, END
from typing import TypedDict, List

class SwarmState(TypedDict):
    session_id: str
    query: str
    sub_queries: List[str]
    researcher_outputs: List[dict]
    critic_challenges: List[dict]
    validator_results: List[dict]
    final_report: dict

graph = StateGraph(SwarmState)
graph.add_node("planner", planner_node)
graph.add_node("researcher_a", researcher_node_a)
graph.add_node("researcher_b", researcher_node_b)
graph.add_node("researcher_c", researcher_node_c)
graph.add_node("critic", critic_node)
graph.add_node("validator", validator_node)
graph.add_node("reconciler", reconciler_node)

graph.set_entry_point("planner")
graph.add_edge("planner", "researcher_a")
graph.add_edge("planner", "researcher_b")
graph.add_edge("planner", "researcher_c")
graph.add_edge(["researcher_a", "researcher_b", "researcher_c"], "critic")
graph.add_edge("critic", "validator")
graph.add_edge("validator", "reconciler")
graph.add_edge("reconciler", END)

nexus_graph = graph.compile()
```

- [ ] Each node function:
  1. Pushes a `status_change` event to Redis stream
  2. Runs its LLM/tool logic
  3. Pushes a `complete` event to Redis stream
  4. Returns updated state

### 5.3 Session Management

- [ ] `POST /sessions` endpoint:
  - Creates session row in DB (`status = 'pending'`)
  - Returns `{ session_id }`
  - Kicks off background task: `asyncio.create_task(run_swarm(session_id, query))`

- [ ] `run_swarm()` async function:
  - Sets session to `running`
  - Invokes `nexus_graph.astream(state)`
  - On each state update: writes events to Redis stream
  - On completion: saves findings, sources, report to DB; updates session to `complete`
  - On error: sets session to `failed`, writes error

- [ ] `GET /sessions/{session_id}` endpoint:
  - Returns session row + agent_runs status

- [ ] `GET /sessions/` endpoint:
  - Returns paginated list of user's sessions (for history screen)

### 5.4 SSE Streaming Endpoint

- [ ] `GET /sessions/{session_id}/stream` endpoint:

```python
@router.get("/sessions/{session_id}/stream")
async def stream_session(session_id: str, current_user = Depends(get_current_user)):
    async def event_generator():
        redis = get_redis()
        last_id = "0"
        while True:
            events = await redis.xread(
                {f"nexus:stream:{session_id}": last_id}, 
                count=10, block=1000
            )
            if events:
                for _, messages in events:
                    for msg_id, data in messages:
                        last_id = msg_id
                        yield f"data: {json.dumps(data)}\n\n"
            # Check if session complete
            session = await get_session(session_id)
            if session.status in ("complete", "failed"):
                yield f"data: {json.dumps({'type': 'done', 'status': session.status})}\n\n"
                break

    return StreamingResponse(event_generator(), media_type="text/event-stream")
```

### 5.5 Validate Agent Pipeline (No Frontend Yet)

- [ ] Write `backend/test_pipeline.py` script
- [ ] Run pipeline with a sample query end-to-end in terminal
- [ ] Verify:
  - Redis events appearing in correct order
  - All 7 agents run and complete
  - DB rows created correctly
  - Final report returned

---

## 6. PHASE 4 — FRONTEND CORE UI

**Goal:** All screens built, connected to backend, swarm graph animates live.  
**Time:** 3–4 hours

### 6.1 Global Styles & Tokens

- [ ] Add all CSS variables from Design Doc to `globals.css`
- [ ] Set `body { background: var(--bg-base); color: var(--text-primary); }`
- [ ] Configure `tailwind.config.ts` to extend with NEXUS color tokens

### 6.2 API & SSE Client

- [ ] `src/lib/api.ts`:
  - `createSession(query: string)` → POST /sessions → returns `session_id`
  - `getSession(id: string)` → GET /sessions/{id}
  - `getHistory()` → GET /sessions
  - Auth header injection via interceptor

- [ ] `src/lib/sse.ts`:
  - `useSessionStream(sessionId)` hook
  - Opens `EventSource` to `/sessions/{id}/stream`
  - Returns `{ events, status, agentStates }`
  - Handles reconnect on drop

### 6.3 TypeScript Types

- [ ] `src/lib/types.ts`:
```typescript
type AgentName = 'planner' | 'researcher_a' | 'researcher_b' | 
                 'researcher_c' | 'critic' | 'validator' | 'reconciler'

type AgentStatus = 'idle' | 'queued' | 'running' | 'done' | 'failed'

interface AgentState {
  name: AgentName
  status: AgentStatus
  message?: string
  startedAt?: string
  completedAt?: string
}

interface LogEntry {
  timestamp: string
  agent: AgentName
  eventType: string
  message: string
}

interface Finding {
  id: string
  claimText: string
  confidenceLevel: 'high' | 'medium' | 'contested'
  confidenceScore: number
  sources: Source[]
}
```

### 6.4 Page: Home (`/`)

- [ ] `QueryInput` component: full-width input + RUN button
- [ ] On submit: call `createSession(query)` → redirect to `/run/{sessionId}`
- [ ] Recent history list (last 5 sessions from `getHistory()`)
- [ ] Subtle particle background (CSS animation, no library needed)

### 6.5 Page: Active Run (`/run/[sessionId]`)

**Left panel — SwarmGraph:**
- [ ] `SwarmGraph.tsx` using `@xyflow/react`
- [ ] Static layout: hardcoded node positions matching the 7-agent topology
- [ ] `AgentNode.tsx` custom node component:
  - Receives `status` prop
  - Applies CSS class per status (idle/active/done/failed)
  - Glow animation via CSS keyframes
- [ ] Animated edges: custom SVG path with `stroke-dashoffset` animation
- [ ] `ProgressBar.tsx` at bottom of graph showing pipeline steps

**Right panel — Log + Output:**
- [ ] `AgentLogFeed.tsx`:
  - Renders `LogEntry[]` as scrolling list
  - Auto-scroll to bottom
  - Each entry fades in
  - Color per agent using CSS variables
- [ ] `OutputReport.tsx`:
  - Appears when session `status = 'complete'`
  - Renders findings with `ConfidenceBadge` per item
  - Debate exchanges expandable section
  - Export PDF button (Phase 5)

**Data wiring:**
- [ ] Use `useSessionStream(sessionId)` hook
- [ ] Derive `agentStates` from events array → feed to `SwarmGraph`
- [ ] Append events to log feed in real-time

### 6.6 Page: History (`/history`)

- [ ] Table/list of past sessions
- [ ] Columns: date, query (truncated), overall confidence, status, link to report
- [ ] Click row → navigate to `/run/{sessionId}` (results view)

---

## 7. PHASE 5 — INTEGRATION & POLISH

**Goal:** End-to-end flow works flawlessly. Animations live. Edge cases handled.  
**Time:** 2–3 hours

### 7.1 End-to-End Integration Test

- [ ] Full flow: type query → submit → watch swarm animate → read report
- [ ] Verify all SSE events arrive and update UI correctly
- [ ] Verify agent node states transition correctly in graph
- [ ] Verify log feed is accurate and timestamped

### 7.2 Animations

- [ ] Agent node glow pulse (CSS `@keyframes glow-pulse`)
- [ ] Edge flow animation (CSS `stroke-dashoffset` animation)
- [ ] Log entry slide-in animation
- [ ] Report streaming fade-in (per-paragraph stagger)
- [ ] Hex logo assembly animation on landing screen
- [ ] Ensure `prefers-reduced-motion` disables all animations

### 7.3 Edge Cases

- [ ] **Query timeout:** If pipeline exceeds 10 minutes, set session to failed, notify via SSE
- [ ] **Agent failure:** Mark individual agent as failed, show retry option, pipeline continues with available data
- [ ] **SSE disconnect:** Auto-reconnect with `EventSource` + `lastEventId`
- [ ] **Empty researcher output:** Critic handles gracefully; validator notes data gap
- [ ] **Rate limit hit:** 429 response → frontend shows "Limit reached" toast, not a crash
- [ ] **Network offline:** Frontend detects dropped SSE, shows "Reconnecting..." state

### 7.4 PDF Export

- [ ] Install: `npm install jspdf`
- [ ] `exportToPDF(report)` function in `src/lib/export.ts`
- [ ] Output: structured PDF with session metadata, findings by confidence, sources

### 7.5 Share Link

- [ ] `GET /sessions/{sessionId}/report` — public endpoint (no auth) if user marks as shared
- [ ] Add "Share" button to report → copies `nexus.app/run/{sessionId}` to clipboard

---

## 8. PHASE 6 — TESTING & DEPLOYMENT

**Goal:** Stable, deployed, demo-ready.  
**Time:** 1.5–2 hours

### 8.1 Backend Tests

```
tests/
├── test_auth.py         ← Register, login, JWT validation
├── test_sessions.py     ← Create session, get session, list sessions
├── test_pipeline.py     ← Full graph run with mocked LLM
└── test_stream.py       ← SSE event ordering
```

- [ ] Use `pytest` + `httpx.AsyncClient` for API tests
- [ ] Mock Anthropic API in pipeline tests (use fixtures)
- [ ] Mock Tavily API in researcher tests
- [ ] Minimum coverage target: **critical paths only** (not 100% — it's a hackathon)

### 8.2 Frontend Tests

- [ ] `SwarmGraph` renders with idle state
- [ ] `AgentNode` applies correct class per status
- [ ] `ConfidenceBadge` renders all three levels

### 8.3 Dockerfiles

**Backend `Dockerfile`:**
```dockerfile
FROM python:3.12-slim
WORKDIR /app
COPY pyproject.toml .
RUN pip install -e .
COPY . .
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

**Frontend `Dockerfile`:**
```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json .
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/.next/standalone .
CMD ["node", "server.js"]
```

### 8.4 Deployment

**Option A — Railway (fastest for hackathon):**
- [ ] Push to GitHub
- [ ] Create Railway project → add Postgres + Redis services
- [ ] Deploy backend from `/backend` directory
- [ ] Deploy frontend from `/frontend` directory
- [ ] Set all environment variables in Railway dashboard
- [ ] Run `alembic upgrade head` via Railway one-off command

**Option B — Render:**
- [ ] Create Render account
- [ ] New Web Service (backend) + Static Site (frontend)
- [ ] Add Postgres + Redis add-ons
- [ ] Same env var setup

### 8.5 Environment Variables Checklist

**Backend `.env`:**
```
DATABASE_URL=postgresql+asyncpg://...
REDIS_URL=redis://...
ANTHROPIC_API_KEY=sk-ant-...
TAVILY_API_KEY=tvly-...
JWT_SECRET_KEY=...        # 32+ random bytes
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=15
REFRESH_TOKEN_EXPIRE_DAYS=7
ENVIRONMENT=production
ALLOWED_ORIGINS=https://your-frontend-domain.com
```

**Frontend `.env.local`:**
```
NEXT_PUBLIC_API_URL=https://your-backend-domain.com
NEXT_PUBLIC_APP_URL=https://your-frontend-domain.com
```

### 8.6 Pre-Demo Checklist

- [ ] Full query runs successfully in production
- [ ] SSE stream works in production (HTTPS required for EventSource)
- [ ] CORS configured correctly (backend allows frontend domain)
- [ ] Demo query prepared: something compelling, 60–90 second runtime
- [ ] History shows at least 2–3 sample runs
- [ ] Error state demo-able (kill an agent, show recovery)
- [ ] Mobile layout confirmed working
- [ ] PDF export confirmed working
- [ ] No console errors in browser

---

## 9. DEMO SCRIPT (Hackathon Pitch)

**Duration:** 3–5 minutes

1. **(0:00)** Open NEXUS landing page — show the particle field, the clean input
2. **(0:15)** Type: *"What are the geopolitical risks that could disrupt semiconductor supply chains in 2025?"*
3. **(0:20)** Hit RUN — swarm graph activates, Planner node lights up violet
4. **(0:30)** Watch researchers fan out in parallel — three nodes pulsing simultaneously
5. **(1:00)** Critic agent fires — amber flash, log shows a challenge against Researcher A
6. **(1:15)** Validator resolves it — emerald glow, log shows resolution
7. **(1:30)** Reconciler fires — white-cyan glow, report begins streaming in
8. **(2:00)** Show final report — highlight HIGH / MEDIUM / CONTESTED confidence badges
9. **(2:15)** Expand debate section — show the adversarial Critic ↔ Validator exchange
10. **(2:30)** Export PDF — "this is what you'd actually send to a client"
11. **(2:45)** Close with: *"No other tool shows you where AI is uncertain — and why."*

---

## 10. KNOWN RISKS & MITIGATIONS

| Risk | Likelihood | Mitigation |
|---|---|---|
| LangGraph parallel fan-out is slow | Medium | Set 90s timeout per researcher; run in true async |
| Anthropic API rate limit during demo | Low | Pre-run and cache demo results; have fallback fixture |
| SSE drops in production | Medium | Auto-reconnect in `sse.ts`; show reconnecting state |
| Critic produces no useful challenges | Medium | Prompt tuning; ensure Critic is explicitly adversarial |
| pgvector slow on cold instance | Low | Don't demo semantic search; it's a Phase 2 feature |
| React Flow performance with animations | Low | Memoize nodes; disable glow on >15 nodes |

---

*End of NEXUS Implementation Plan v1.0*