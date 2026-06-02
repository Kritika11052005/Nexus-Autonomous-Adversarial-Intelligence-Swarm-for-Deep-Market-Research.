# NEXUS — Technical Requirements Document (TRD)
**Version:** 1.0  
**Project:** NEXUS — Adversarial Multi-Agent Intelligence Swarm  
**Last Updated:** June 2026  

---

## 1. SYSTEMS OVERVIEW

NEXUS is a full-stack web application with a stateless, streaming architecture. The frontend is a Next.js application that connects to a FastAPI backend via Server-Sent Events (SSE) for real-time agent status updates. The backend orchestrates a LangGraph state machine where each node is a specialized AI agent. All agents use Google Gemini as the underlying LLM. Researcher agents use Tavily for live web search. No persistent database is required for the hackathon version — all state is managed in-memory per session.

### High-Level System Diagram
```
[User Browser]
     │
     │  HTTP POST /api/query        (submit query)
     │  GET  /api/stream/{query_id} (SSE stream)
     ▼
[Next.js Frontend — Port 3000]
     │
     │  HTTP + SSE
     ▼
[FastAPI Backend — Port 8000]
     │
     ├── POST /query      → Creates query_id, starts async LangGraph run
     └── GET  /stream/{id} → SSE endpoint streaming agent events
          │
          ▼
     [LangGraph Orchestrator]
          │
          ├── PlannerNode        → Google Gemini API
          ├── ResearcherNodeA    → Tavily API + Google Gemini API
          ├── ResearcherNodeB    → Tavily API + Google Gemini API
          ├── ResearcherNodeC    → Tavily API + Google Gemini API
          ├── CriticNode         → Google Gemini API
          ├── ValidatorNode      → Google Gemini API
          └── ReconcilerWriterNode → Google Gemini API
```

---

## 2. FRONTEND STACK

### Framework & Core
| Technology | Version | Purpose |
|-----------|---------|---------|
| Next.js | 14.x (App Router) | Frontend framework |
| React | 18.x | UI library |
| TypeScript | 5.x | Type safety |
| Tailwind CSS | 3.x | Styling |
| Shadcn/ui | Latest | UI component library |

### Key Libraries
| Library | Version | Purpose |
|---------|---------|---------|
| `reactflow` | 11.x | Live agent graph visualization |
| `framer-motion` | 11.x | Node animations, pulse effects |
| `eventsource-parser` | Latest | Parse SSE stream from backend |
| `axios` | 1.x | HTTP client |
| `lucide-react` | Latest | Icons |
| `@radix-ui/react-*` | Latest | Accessible primitives (via Shadcn) |
| `html2pdf.js` | Latest | Client-side PDF export |

### Frontend File Structure
```
frontend/
├── app/
│   ├── layout.tsx              ← Root layout, fonts, global styles
│   ├── page.tsx                ← Landing / Query Input screen
│   ├── run/
│   │   └── [queryId]/
│   │       └── page.tsx        ← Swarm Execution screen
│   └── report/
│       └── [queryId]/
│           └── page.tsx        ← Intelligence Report screen
│
├── components/
│   ├── ui/                     ← Shadcn auto-generated components
│   ├── AgentGraph/
│   │   ├── AgentGraph.tsx      ← React Flow canvas
│   │   ├── AgentNode.tsx       ← Single agent node component
│   │   ├── AgentEdge.tsx       ← Animated directional edge
│   │   └── agentGraphConfig.ts ← Node positions, initial states
│   ├── ActivityLog/
│   │   └── ActivityLog.tsx     ← Streaming agent action log
│   ├── Report/
│   │   ├── ReportView.tsx      ← Full report renderer
│   │   ├── InsightCard.tsx     ← Single insight with confidence badge
│   │   ├── ContestedSection.tsx ← Contested findings display
│   │   └── SourceList.tsx      ← Sources with URLs
│   └── QueryInput/
│       └── QueryInput.tsx      ← Input form with domain selector
│
├── hooks/
│   ├── useSSEStream.ts         ← Custom hook for SSE connection + parsing
│   ├── useAgentGraph.ts        ← Agent state management for React Flow
│   └── useReport.ts            ← Report data management
│
├── lib/
│   ├── api.ts                  ← API call wrappers
│   ├── constants.ts            ← Agent names, colors, positions
│   └── types.ts                ← TypeScript interfaces
│
├── styles/
│   └── globals.css             ← Tailwind + custom CSS variables
│
└── public/
    └── fonts/                  ← Space Grotesk, Inter font files
```

### Frontend Environment Variables
```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

---

## 3. BACKEND STACK

### Framework & Core
| Technology | Version | Purpose |
|-----------|---------|---------|
| Python | 3.11+ | Runtime |
| FastAPI | 0.111.x | API framework |
| Uvicorn | 0.29.x | ASGI server |
| LangGraph | 0.2.x | Agent orchestration state machine |
| LangChain | 0.2.x | LLM tooling, prompt management |

### Key Libraries
| Library | Version | Purpose |
|---------|---------|---------|
| `Google Gemini` | 0.28.x | Google Gemini API SDK |
| `langchain-Google Gemini` | Latest | LangChain Google Gemini integration |
| `tavily-python` | Latest | Tavily search API client |
| `python-dotenv` | Latest | Environment variable management |
| `pydantic` | 2.x | Request/response validation |
| `asyncio` | stdlib | Async execution for parallel agents |
| `uuid` | stdlib | Query session ID generation |

### Backend File Structure
```
backend/
├── main.py                     ← FastAPI app, routes, SSE endpoint
├── graph.py                    ← LangGraph state machine definition
├── state.py                    ← GraphState TypedDict definition
├── config.py                   ← App config, env vars, constants
│
├── agents/
│   ├── __init__.py
│   ├── planner.py              ← Planner agent node
│   ├── researcher.py           ← Researcher agent node (used for A/B/C)
│   ├── critic.py               ← Critic agent node
│   ├── validator.py            ← Validator agent node
│   └── reconciler_writer.py    ← Reconciler + Writer combined node
│
├── tools/
│   ├── __init__.py
│   └── search.py               ← Tavily search wrapper
│
├── models/
│   ├── __init__.py
│   ├── query.py                ← QueryRequest, QueryResponse Pydantic models
│   └── report.py               ← Report, Insight, Source Pydantic models
│
├── store/
│   └── session_store.py        ← In-memory query state store (dict)
│
└── requirements.txt
```

### Backend Environment Variables
```env
Google Gemini_API_KEY=your_key_here
TAVILY_API_KEY=your_key_here
CORS_ORIGINS=http://localhost:3000
```

---

## 4. DATABASE

### Hackathon Version: In-Memory Only
No persistent database is required for the hackathon. All query state is stored in an in-memory Python dictionary keyed by `query_id`.

```python
# store/session_store.py
session_store: dict[str, SessionState] = {}

class SessionState:
    query_id: str
    query_text: str
    status: str          # "pending" | "running" | "complete" | "error"
    agent_events: list   # list of SSE events emitted so far
    final_report: dict   # populated when status = "complete"
    created_at: datetime
```

### Post-Hackathon: PostgreSQL Schema (Planned)
```sql
-- queries table
CREATE TABLE queries (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    query_text  TEXT NOT NULL,
    domain      VARCHAR(50),
    status      VARCHAR(20) DEFAULT 'pending',
    created_at  TIMESTAMP DEFAULT now(),
    completed_at TIMESTAMP,
    user_id     UUID REFERENCES users(id)
);

-- reports table
CREATE TABLE reports (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    query_id    UUID REFERENCES queries(id),
    content     JSONB NOT NULL,    -- full report JSON
    created_at  TIMESTAMP DEFAULT now()
);

-- agent_runs table
CREATE TABLE agent_runs (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    query_id    UUID REFERENCES queries(id),
    agent_name  VARCHAR(50),
    status      VARCHAR(20),
    input       TEXT,
    output      TEXT,
    duration_ms INTEGER,
    created_at  TIMESTAMP DEFAULT now()
);
```

---

## 5. AUTH & SECURITY

### Hackathon Version
- **No authentication** — session-based, stateless
- Each query gets a UUID `query_id`; this acts as the session token
- `query_id` is generated server-side and returned on query submission
- SSE stream requires valid `query_id` to connect — prevents unauthorized streaming

### Security Rules (Hackathon)
- CORS restricted to frontend origin only
- API keys stored in `.env`, never exposed to frontend
- Query text sanitized before passing to LLM (strip injection patterns)
- Rate limiting: max 5 concurrent queries (in-memory semaphore)
- Query text max length: 500 characters, enforced server-side

### Security Rules (Production)
- JWT-based auth (Clerk or Supabase Auth)
- HTTPS only
- API key rotation policy
- Input sanitization for prompt injection prevention
- Rate limiting per user (10 queries/hour on free tier)
- OWASP Top 10 compliance

---

## 6. AI & APIs

### LLM: Google Gemini Google Gemini
- **Model:** `Google Gemini-2.5-flash`
- **Usage:** All 7 agents use Google Gemini as the base LLM
- **Max tokens per call:** 1500 (agents), 3000 (writer)
- **Temperature:** 0.3 (factual agents: planner, validator), 0.7 (critic, writer)
- **API calls per query:** ~8–10 Google Gemini calls total

### Agent System Prompts Summary
| Agent | Temperature | Max Tokens | Key Instruction |
|-------|------------|------------|-----------------|
| Planner | 0.2 | 800 | Decompose into exactly 3 sub-questions, return JSON |
| Researcher A/B/C | 0.3 | 1200 | Research sub-question, cite sources, return JSON |
| Critic | 0.7 | 1000 | Challenge every finding, flag weak evidence, return JSON |
| Validator | 0.3 | 800 | Cross-reference, detect contradictions, return JSON |
| Reconciler+Writer | 0.5 | 3000 | Assign confidence, write full report, return JSON |

### Web Search: Tavily API
- **Plan:** Free tier (1000 calls/month)
- **Calls per query:** 3 (one per Researcher agent)
- **Search depth:** `advanced`
- **Max results per search:** 5
- **Include domains:** No restriction
- **Exclude domains:** None

### SSE Streaming Protocol
Events emitted from backend to frontend:

```json
// Agent status update
{"type": "agent_update", "agent": "planner", "status": "active", "message": "Decomposing your query into sub-questions..."}

// Agent completed
{"type": "agent_update", "agent": "planner", "status": "done", "message": "Identified 3 research sub-questions"}

// Agent output preview
{"type": "agent_output", "agent": "critic", "preview": "Challenged 2 claims from Researcher B..."}

// Run complete
{"type": "complete", "query_id": "abc-123", "redirect": "/report/abc-123"}

// Error
{"type": "error", "agent": "researcher_a", "message": "Search API timeout — retrying..."}
```

---

## 7. DEPLOYMENT

### Hackathon Deployment
| Service | Usage |
|---------|-------|
| **Vercel** | Frontend (Next.js) — free tier |
| **Railway** or **Render** | Backend (FastAPI) — free tier |
| **Environment variables** | Set in Vercel + Railway dashboards |

### Local Development
```bash
# Backend
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000

# Frontend
cd frontend
npm install
npm run dev  # runs on port 3000
```

### Deployment Checklist
- [ ] CORS origins updated for production URL
- [ ] API keys set in deployment environment
- [ ] Backend health check endpoint: `GET /health`
- [ ] Frontend env var `NEXT_PUBLIC_API_URL` points to production backend
- [ ] SSE endpoint tested on deployed environment (not just local)

---

## 8. ARCHITECTURE FLOW

### Request Lifecycle
```
1. User types query → clicks "Run Swarm"
2. Frontend: POST /api/query {text: "...", domain: "..."}
3. Backend: 
   a. Validates input
   b. Creates query_id = UUID
   c. Stores initial session state in session_store
   d. Starts async background task: run_swarm(query_id, query_text)
   e. Returns {query_id: "abc-123"}
4. Frontend: Navigates to /run/abc-123
5. Frontend: Opens SSE connection → GET /stream/abc-123
6. Backend background task emits SSE events as each agent completes
7. Frontend: useSSEStream hook parses events → updates React Flow node states
8. When type="complete": Frontend navigates to /report/abc-123
9. Frontend: GET /report/abc-123 → receives full report JSON
10. Report rendered with confidence tags
```

### LangGraph State Flow
```python
class GraphState(TypedDict):
    query: str
    sub_questions: list[str]        # populated by Planner
    research_results: list[dict]    # populated by Researchers A/B/C
    critic_feedback: list[dict]     # populated by Critic
    validated_findings: list[dict]  # populated by Validator
    final_report: dict              # populated by Reconciler+Writer
    query_id: str                   # for SSE event emission
    errors: list[str]               # accumulated error messages

# Graph edges:
START → planner → [researcher_a, researcher_b, researcher_c] (parallel) 
     → critic → validator → reconciler_writer → END
```

---

## 9. ENGINEERING RULES

### Scalable
- Each agent is a stateless function — input state in, output state out
- LangGraph handles state passing; agents don't hold memory between calls
- Session store can be swapped to Redis without changing agent code
- Researcher agents are identical functions — parameterized by sub-question index

### Modular
- One file per agent in `agents/` directory
- Agents are independent — Critic does not import from Researcher
- All inter-agent communication happens through `GraphState`
- Tools (search) are separate from agents and independently testable

### Observable
- Every agent emits SSE events: start, progress, completion, error
- Agent outputs are logged to console with `[AGENT_NAME]` prefix
- Session store tracks full event history for debugging
- FastAPI has `/health` and `/debug/{query_id}` endpoints

### Security by Default
- No secrets in frontend code — all API keys backend-only
- User input sanitized before any LLM call
- CORS allowlist enforced
- Query ID is UUID v4 — not guessable
- SSE stream disconnects automatically after 10 minutes

---

## 10. PERFORMANCE TARGETS

| Metric | Target |
|--------|--------|
| Planner completion | < 10 seconds |
| Each Researcher completion | < 20 seconds |
| All 3 Researchers (parallel) | < 25 seconds |
| Critic completion | < 15 seconds |
| Validator completion | < 10 seconds |
| Reconciler + Writer completion | < 20 seconds |
| **Total pipeline** | **< 90 seconds** |
| SSE first event latency | < 2 seconds |
| Report page load | < 1 second |

---

## 11. DEPENDENCIES & VERSIONS

### requirements.txt
```
fastapi==0.111.0
uvicorn[standard]==0.29.0
langgraph==0.2.0
langchain==0.2.0
langchain-google gemini==0.1.15
google gemini==0.28.0
tavily-python==0.3.3
python-dotenv==1.0.1
pydantic==2.7.1
httpx==0.27.0
```

### package.json (key deps)
```json
{
  "dependencies": {
    "next": "14.2.3",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "typescript": "^5.4.5",
    "tailwindcss": "^3.4.3",
    "@xyflow/react": "^12.0.0",
    "framer-motion": "^11.2.0",
    "axios": "^1.7.2",
    "eventsource-parser": "^2.0.0",
    "lucide-react": "^0.379.0",
    "html2pdf.js": "^0.10.2"
  }
}
```