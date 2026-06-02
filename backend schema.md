# NEXUS — Backend Schema Document
**Document Version:** 1.0  
**Project:** NEXUS Multi-Agent Intelligence Swarm  
**Database:** PostgreSQL (primary) + Redis (cache/streams)

---

## 1. OVERVIEW

NEXUS uses a relational PostgreSQL database as its source of truth, Redis for real-time agent event streaming and session state, and an optional vector store (pgvector) for semantic search over past findings.

### Design Goals
- **Data Integrity:** All agent runs and findings are fully traceable with FK relationships
- **Fast Queries:** Indexed on user_id, session_id, created_at for all hot paths
- **Scalable:** Sessions and findings are append-only; no destructive updates
- **Observable:** Every agent action is logged with timestamps for debugging/auditing
- **Easy Maintenance:** Clear naming conventions, no ambiguous nullable columns

---

## 2. TECH STACK

| Layer | Technology | Purpose |
|---|---|---|
| Primary DB | PostgreSQL 15+ | Users, sessions, findings, reports |
| Cache + Streams | Redis 7+ | Websockets event queues, session state, rate limiting |
| ORM | SQLAlchemy 2.0 (async) | Python DB interface |
| Migrations | Alembic | Schema versioning |
| Vector Store | pgvector extension | Semantic search over past findings |
| Connection Pool | asyncpg | High-throughput async connections |
| Secrets | Environment variables (`.env`) | No credentials in code |

---

## 3. ENTITY RELATIONSHIP DIAGRAM

```
┌──────────────┐         ┌──────────────────┐         ┌──────────────────┐
│    users     │ 1─────N │    sessions      │ 1─────N │    agent_runs    │
│──────────────│         │──────────────────│         │──────────────────│
│ id (PK)      │         │ id (PK)          │         │ id (PK)          │
│ email        │         │ user_id (FK)     │         │ session_id (FK)  │
│ name         │         │ query_text       │         │ agent_name       │
│ created_at   │         │ status           │         │ status           │
│ updated_at   │         │ confidence_score │         │ started_at       │
│ api_key_hash │         │ created_at       │         │ completed_at     │
└──────────────┘         │ completed_at     │         │ output_text      │
                         │ model_used       │         │ error_message    │
                         │ total_tokens     │         └──────────────────┘
                         │ duration_seconds │                  │ 1
                         └──────────────────┘                  │
                                  │ 1                          N
                                  │                   ┌──────────────────┐
                                  N                   │   agent_events   │
                         ┌──────────────────┐         │──────────────────│
                         │    findings      │         │ id (PK)          │
                         │──────────────────│         │ agent_run_id(FK) │
                         │ id (PK)          │         │ event_type       │
                         │ session_id (FK)  │         │ event_data       │
                         │ claim_text       │         │ created_at       │
                         │ confidence_level │         └──────────────────┘
                         │ confidence_score │
                         │ source_agent     │
                         │ challenged_by    │
                         │ embedding        │ ← pgvector
                         │ created_at       │
                         └──────────────────┘
                                  │ 1
                                  N
                         ┌──────────────────┐
                         │     sources      │
                         │──────────────────│
                         │ id (PK)          │
                         │ finding_id (FK)  │
                         │ url              │
                         │ title            │
                         │ snippet          │
                         │ fetched_at       │
                         └──────────────────┘
```

---

## 4. TABLE DEFINITIONS

---

### 4.1 `users`

Stores registered users. Supports both email/password auth and API key auth.

```sql
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           VARCHAR(255) NOT NULL UNIQUE,
    name            VARCHAR(100),
    password_hash   VARCHAR(255),           -- NULL if OAuth only
    api_key_hash    VARCHAR(255) UNIQUE,    -- SHA-256 hash of issued API key
    plan            VARCHAR(20) NOT NULL DEFAULT 'free',  -- 'free' | 'pro'
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_api_key_hash ON users(api_key_hash);
```

**Column Notes:**
- `api_key_hash`: Never store raw API keys. Hash with SHA-256 before storing.
- `plan`: Determines rate limits applied at the API layer.
- `password_hash`: Uses bcrypt with cost factor 12.

---

### 4.2 `sessions`

Each session = one user query run through the full agent swarm pipeline.

```sql
CREATE TABLE sessions (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    query_text       TEXT NOT NULL,
    status           VARCHAR(20) NOT NULL DEFAULT 'pending',
                     -- 'pending' | 'running' | 'complete' | 'failed' | 'cancelled'
    confidence_score NUMERIC(5, 2),         -- Overall 0–100, computed at end
    model_used       VARCHAR(100),          -- e.g. 'claude-sonnet-4-20250514'
    total_tokens     INTEGER,               -- Total tokens consumed
    duration_seconds NUMERIC(8, 2),         -- Wall-clock time for full run
    error_message    TEXT,                  -- Top-level error if failed
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at     TIMESTAMPTZ
);

-- Indexes
CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_status ON sessions(status);
CREATE INDEX idx_sessions_created_at ON sessions(created_at DESC);
```

**Status Transitions:**
```
pending → running → complete
pending → running → failed
running → cancelled (user-initiated)
```

---

### 4.3 `agent_runs`

One row per agent per session. Tracks what each agent did and its output.

```sql
CREATE TABLE agent_runs (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id    UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    agent_name    VARCHAR(50) NOT NULL,
                  -- 'planner' | 'researcher_a' | 'researcher_b' | 'researcher_c'
                  -- | 'critic' | 'validator' | 'reconciler'
    status        VARCHAR(20) NOT NULL DEFAULT 'idle',
                  -- 'idle' | 'queued' | 'running' | 'done' | 'failed' | 'skipped'
    input_data    JSONB,                    -- What this agent received as input
    output_text   TEXT,                    -- Agent's raw text output
    tokens_used   INTEGER,                 -- Tokens for this agent's LLM call(s)
    started_at    TIMESTAMPTZ,
    completed_at  TIMESTAMPTZ,
    error_message TEXT,
    retry_count   SMALLINT NOT NULL DEFAULT 0
);

-- Indexes
CREATE INDEX idx_agent_runs_session_id ON agent_runs(session_id);
CREATE INDEX idx_agent_runs_agent_name ON agent_runs(agent_name);
CREATE UNIQUE INDEX idx_agent_runs_session_agent 
    ON agent_runs(session_id, agent_name);  -- One run per agent per session
```

**`input_data` JSONB structure (example for Researcher agents):**
```json
{
  "sub_query": "semiconductor supply chain 2024 disruptions",
  "assigned_by": "planner",
  "search_depth": 5
}
```

---

### 4.4 `agent_events`

Append-only event log for every action taken within an agent run. Used for the live log feed and post-run debugging.

```sql
CREATE TABLE agent_events (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_run_id UUID NOT NULL REFERENCES agent_runs(id) ON DELETE CASCADE,
    event_type   VARCHAR(50) NOT NULL,
                 -- 'search_started' | 'search_complete' | 'llm_call_started'
                 -- | 'llm_call_complete' | 'challenge_raised' | 'validated'
                 -- | 'error' | 'status_change'
    event_data   JSONB,                    -- Arbitrary structured payload
    message      TEXT,                    -- Human-readable log line
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_agent_events_agent_run_id ON agent_events(agent_run_id);
CREATE INDEX idx_agent_events_created_at ON agent_events(created_at DESC);
CREATE INDEX idx_agent_events_event_type ON agent_events(event_type);
```

**`event_data` examples:**

```json
// search_started
{ "query": "TSMC capacity expansion 2024", "source": "tavily" }

// challenge_raised (Critic agent)
{ "challenged_agent": "researcher_a", "claim": "GPU demand +340%", "reason": "Source is 2022 projection, not 2024 actuals" }

// status_change
{ "from": "running", "to": "done" }
```

---

### 4.5 `findings`

Individual validated claims extracted from the reconciler's output. Each finding has a confidence level and optional vector embedding for semantic search.

```sql
CREATE TABLE findings (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id       UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    claim_text       TEXT NOT NULL,
    confidence_level VARCHAR(20) NOT NULL,
                     -- 'high' | 'medium' | 'contested'
    confidence_score NUMERIC(5, 2),        -- 0–100
    source_agent     VARCHAR(50),          -- Which agent produced this finding
    challenged_by    VARCHAR(50),          -- Set if Critic challenged this
    challenge_reason TEXT,                 -- Critic's challenge text
    resolution       TEXT,                 -- Validator's resolution note
    embedding        VECTOR(1536),         -- pgvector embedding (optional)
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_findings_session_id ON findings(session_id);
CREATE INDEX idx_findings_confidence_level ON findings(confidence_level);
-- Vector similarity index (IVFFlat)
CREATE INDEX idx_findings_embedding ON findings 
    USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
```

---

### 4.6 `sources`

Web sources (URLs) used to support findings. Each source links to a finding.

```sql
CREATE TABLE sources (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    finding_id   UUID NOT NULL REFERENCES findings(id) ON DELETE CASCADE,
    session_id   UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    url          TEXT NOT NULL,
    title        VARCHAR(500),
    snippet      TEXT,                     -- Relevant excerpt
    domain       VARCHAR(255),            -- Extracted domain for display
    fetched_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_sources_finding_id ON sources(finding_id);
CREATE INDEX idx_sources_session_id ON sources(session_id);
CREATE INDEX idx_sources_domain ON sources(domain);
```

---

### 4.7 `reports`

The final assembled report document per session.

```sql
CREATE TABLE reports (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id        UUID NOT NULL UNIQUE REFERENCES sessions(id) ON DELETE CASCADE,
    executive_summary TEXT,
    full_markdown     TEXT,               -- Full report as Markdown
    finding_count     INTEGER,
    source_count      INTEGER,
    debate_exchanges  JSONB,              -- Critic ↔ Validator exchanges array
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_reports_session_id ON reports(session_id);
```

**`debate_exchanges` JSONB structure:**
```json
[
  {
    "round": 1,
    "critic": "Source cited is a 2022 projection...",
    "validator": "Confirmed — replacing with 2024 IDC data.",
    "outcome": "resolved"
  }
]
```

---

### 4.8 `rate_limits` (Redis — not PostgreSQL)

Rate limiting is enforced in Redis, not the database, for speed.

**Redis key patterns:**
```
rl:user:{user_id}:hourly     → Counter, expires in 3600s
rl:user:{user_id}:daily      → Counter, expires in 86400s
rl:ip:{ip_address}:minutely  → Counter for unauthenticated requests
```

**Limits by plan:**
| Plan | Hourly | Daily |
|---|---|---|
| Free | 3 sessions | 10 sessions |
| Pro | 20 sessions | 100 sessions |

---

## 5. REDIS DATA STRUCTURES

### 5.1 Websocket Event Queue (per session)

Used to stream agent events to the frontend via Websockets.

```
Key:   nexus:stream:{session_id}
Type:  Redis List (LPUSH / BRPOP)
TTL:   86400s (24 hours)

Value format (JSON string per event):
{
  "type": "agent_event",
  "agent": "researcher_a",
  "event": "search_complete",
  "message": "Found 7 sources for sub-query",
  "timestamp": "2024-01-15T14:23:05Z"
}
```

### 5.2 Session State Cache

Hot cache for active session state.

```
Key:   nexus:session:{session_id}:state
Type:  Redis Hash
TTL:   3600s

Fields:
  status          → "running"
  current_agent   → "critic"
  step            → "3"
  started_at      → ISO timestamp
```

### 5.3 User Session Index

Fast lookup of a user's recent sessions.

```
Key:   nexus:user:{user_id}:sessions
Type:  Redis Sorted Set
Score: Unix timestamp (created_at)
Value: session_id

Trim to last 50 sessions per user.
```

---

## 6. AUTH FLOW

### 6.1 Email / Password Auth

```
1. POST /auth/register
   → Hash password (bcrypt, cost=12)
   → Insert row into users table
   → Return JWT (access_token: 15min, refresh_token: 7 days)

2. POST /auth/login
   → Lookup user by email
   → Verify bcrypt hash
   → Return JWT pair

3. Token refresh
   → POST /auth/refresh with refresh_token
   → Validate refresh token signature + expiry
   → Return new access_token

4. All protected routes
   → Validate Authorization: Bearer <access_token>
   → Decode JWT, extract user_id
   → Attach user to request context
```

### 6.2 API Key Auth

```
1. POST /auth/api-key/generate (authenticated users only)
   → Generate 32-byte random key: nexus_sk_{base64}
   → SHA-256 hash → store in users.api_key_hash
   → Return raw key ONCE (never stored again)

2. API key usage
   → X-API-Key: nexus_sk_... header
   → SHA-256 hash → lookup in users table
   → Attach user to request context
```

### 6.3 JWT Payload

```json
{
  "sub": "user-uuid-here",
  "plan": "pro",
  "iat": 1705315200,
  "exp": 1705316100
}
```

---

## 7. DATA INTEGRITY RULES

| Rule | Implementation |
|---|---|
| No orphaned sessions | `ON DELETE CASCADE` from users → sessions |
| No orphaned agent_runs | `ON DELETE CASCADE` from sessions → agent_runs |
| One run per agent per session | `UNIQUE INDEX` on (session_id, agent_name) |
| Confidence scores in range | `CHECK (confidence_score BETWEEN 0 AND 100)` |
| Valid status values | `CHECK` constraint on all status columns |
| All timestamps in UTC | `TIMESTAMPTZ` type enforced across all tables |
| No plaintext secrets | API keys hashed before insert; never logged |

---

## 8. MIGRATION STRATEGY (Alembic)

```
migrations/
├── env.py
├── script.py.mako
└── versions/
    ├── 0001_create_users.py
    ├── 0002_create_sessions.py
    ├── 0003_create_agent_runs.py
    ├── 0004_create_agent_events.py
    ├── 0005_create_findings.py
    ├── 0006_create_sources.py
    ├── 0007_create_reports.py
    └── 0008_add_pgvector_embedding.py
```

**Run migrations:**
```bash
alembic upgrade head
alembic downgrade -1   # rollback one
alembic history        # view all migrations
```

---

## 9. SEED DATA (Development)

```sql
-- Test user
INSERT INTO users (email, name, plan, password_hash)
VALUES (
    'dev@nexus.local',
    'Dev User',
    'pro',
    '$2b$12$...'  -- bcrypt of 'password123'
);

-- Sample session
INSERT INTO sessions (user_id, query_text, status)
VALUES (
    (SELECT id FROM users WHERE email = 'dev@nexus.local'),
    'What are the geopolitical risks in Southeast Asia in 2024?',
    'complete'
);
```

---

## 10. PERFORMANCE CONSIDERATIONS

| Concern | Solution |
|---|---|
| High session query volume | Index on `(user_id, created_at DESC)` |
| Large agent_events tables | Partition by month after 6 months |
| Slow full-text search on findings | Add GIN index on `claim_text` with `to_tsvector` |
| Report fetch latency | Cache `reports` row in Redis for 1 hour after completion |
| Embedding search speed | IVFFlat index on `findings.embedding` |
| Connection exhaustion | asyncpg pool: min=5, max=20 per worker |

---

*End of NEXUS Backend Schema Document v1.0*