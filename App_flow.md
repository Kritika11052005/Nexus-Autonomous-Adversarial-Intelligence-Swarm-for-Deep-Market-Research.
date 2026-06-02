# NEXUS — App Flow Document
**Version:** 1.0  
**Project:** NEXUS — Adversarial Multi-Agent Intelligence Swarm  
**Last Updated:** June 2026  

---

## 1. USER JOURNEY (End-to-End)

```
[Landing Page]
     │
     │ User types query + optional domain → clicks "Run Swarm"
     ▼
[Swarm Execution Page]
     │
     │ Watches agents activate in real time on the graph
     │ Reads activity log as agents report progress
     │
     │ When all agents complete → auto-redirect
     ▼
[Intelligence Report Page]
     │
     │ Reads confidence-scored report
     │ Explores contested findings
     │ Exports or shares report
     ▼
[Query History] (optional — accessible from nav)
     │
     │ Views past queries
     │ Re-runs a query
     ▼
[Back to Landing]
```

---

## 2. FLOW DIAGRAM

```
┌─────────────────────────────────────────────────────────┐
│                     LANDING PAGE                        │
│                                                         │
│  [Logo + Tagline]                                       │
│  [Query Input Field]                                    │
│  [Domain Selector: Business / Research / Tech / General]│
│  [Example queries as clickable chips]                   │
│  [Run Swarm Button]                                     │
│                                                         │
│  Validation:                                            │
│  - Empty query → show inline error, don't submit        │
│  - Query < 10 chars → "Be more specific" warning        │
│  - Query > 500 chars → char count warning, block submit │
└─────────────────┬───────────────────────────────────────┘
                  │ POST /api/query
                  │ Receive {query_id}
                  │ Navigate to /run/{query_id}
                  ▼
┌─────────────────────────────────────────────────────────┐
│                 SWARM EXECUTION PAGE                    │
│                                                         │
│  Left Panel: Agent Graph (React Flow)                   │
│  ┌─────────────────────────────────────────────┐        │
│  │  [Planner Node]                             │        │
│  │       ↓ ↓ ↓ (edges to 3 researchers)       │        │
│  │  [ResA] [ResB] [ResC]                       │        │
│  │       ↓   ↓   ↓  (edges merge to critic)   │        │
│  │       [Critic Node]                         │        │
│  │            ↓                                │        │
│  │       [Validator Node]                      │        │
│  │            ↓                                │        │
│  │    [Reconciler+Writer Node]                 │        │
│  └─────────────────────────────────────────────┘        │
│                                                         │
│  Right Panel: Activity Log                              │
│  ┌─────────────────────────────────────────────┐        │
│  │ [timestamp] Planner: Analyzing query...     │        │
│  │ [timestamp] Planner: Generated 3 questions  │        │
│  │ [timestamp] Researcher A: Searching web...  │        │
│  │ ...streaming in real time...                │        │
│  └─────────────────────────────────────────────┘        │
│                                                         │
│  Bottom: Progress bar + "Agent X of 7 complete"         │
│  Top right: [Cancel] button                             │
│                                                         │
│  On complete: auto-navigate to /report/{query_id}       │
└─────────────────────────────────────────────────────────┘
                  │ Auto-redirect when type="complete"
                  ▼
┌─────────────────────────────────────────────────────────┐
│               INTELLIGENCE REPORT PAGE                  │
│                                                         │
│  Header: Query text + Run time + Domain badge           │
│                                                         │
│  [Executive Summary card]                               │
│                                                         │
│  [Key Insights section]                                 │
│  ┌──────────────────────────────────────┐               │
│  │ 🟢 HIGH   │ Insight text here...    │               │
│  │ 🟡 MEDIUM │ Insight text here...    │               │
│  │ 🔴 CONTESTED │ Insight text here... │               │
│  └──────────────────────────────────────┘               │
│                                                         │
│  [Contested Findings — expandable section]              │
│  Shows: Researcher claim vs Critic challenge            │
│                                                         │
│  [Sources]                                              │
│  Numbered list with domain, URL, relevance              │
│                                                         │
│  [Follow-up Questions]                                  │
│  3 suggested next queries as clickable chips            │
│                                                         │
│  Footer: [Copy Markdown] [Download PDF] [Share Link]    │
└─────────────────────────────────────────────────────────┘
```

---

## 3. CORE PAGES

### Page 1: Landing Page (`/`)
**Purpose:** Accept query and initiate swarm  
**Components:**
- `QueryInput` — textarea with character counter
- Domain selector — 4 pills (Business / Research / Technical / General)
- Example query chips — 3 clickable examples that populate the input
- "Run Swarm" CTA button — disabled when input invalid
- Nav: Logo (left), "History" link (right)

**Actions:**
- Type query
- Select domain (optional, defaults to "General")
- Click example chip → populates input
- Submit → POST to backend, navigate to /run/{query_id}

**States:**
- Default: empty input, button disabled
- Typing: char counter visible, button enabled
- Submitting: button shows spinner, input disabled
- Error: inline error message under input

---

### Page 2: Swarm Execution Page (`/run/[queryId]`)
**Purpose:** Display real-time agent activity  
**Components:**
- `AgentGraph` — React Flow canvas with 7 agent nodes
- `ActivityLog` — streaming log panel
- Progress bar with agent completion count
- Agent detail tooltip (click any node to see its current output preview)
- Cancel button (top right)

**SSE Event Handling:**
- On `agent_update` with `status: "active"` → set node to ACTIVE state (pulsing glow)
- On `agent_update` with `status: "done"` → set node to DONE state (solid glow)
- On `agent_output` → append to activity log
- On `error` → set node to ERROR state (red), append error to log, continue if non-fatal
- On `complete` → wait 1.5s (visual pause), then navigate to /report/{queryId}

**States:**
- Loading (connecting to SSE): spinner overlay
- Running: agents activating in sequence
- Partial error: error node shown, swarm continues
- Complete: brief "Swarm complete" flash, then redirect
- Fatal error: all nodes go gray, error message shown, "Try again" button

---

### Page 3: Intelligence Report Page (`/report/[queryId]`)
**Purpose:** Display the final confidence-scored report  
**Components:**
- `ReportHeader` — query text, run duration, domain badge
- `ExecutiveSummary` — card with summary text
- `InsightList` — list of `InsightCard` components
- `ContestedSection` — expandable accordion
- `SourceList` — numbered source list
- `FollowUpQuestions` — 3 chips that link back to landing with pre-filled query
- `ExportBar` — Copy / PDF / Share

**Actions:**
- Click insight card → expand for more detail
- Click contested finding → expand to see Researcher vs Critic views
- Click follow-up question chip → navigate to `/` with query pre-filled
- Click "Copy Markdown" → copies report as markdown to clipboard
- Click "Download PDF" → generates and downloads PDF
- Click "Share" → copies shareable URL to clipboard

**States:**
- Loading: skeleton loaders for each section
- Loaded: full report visible
- Error (report not found): "Report expired or not found" message

---

### Page 4: Query History (`/history`)
**Purpose:** View and re-run past queries  
**Components:**
- Search bar (filter by keyword)
- List of past query cards: query text, domain, date, status badge
- "Re-run" button per card
- "View Report" button per card (if completed)

**Note (Hackathon):** History is session-based only. Refreshing clears it.

---

## 4. NAVIGATION RULES

| From | To | Trigger |
|------|----|---------|
| Landing `/` | Execution `/run/{id}` | Query submitted successfully |
| Execution `/run/{id}` | Report `/report/{id}` | SSE `complete` event received |
| Report `/report/{id}` | Landing `/` | User clicks "New Query" or logo |
| Report `/report/{id}` | Landing `/` with prefill | User clicks follow-up question chip |
| Any page | History `/history` | User clicks "History" in nav |
| History `/history` | Report `/report/{id}` | User clicks "View Report" |
| History `/history` | Execution `/run/{id}` | User clicks "Re-run" |
| Any error state | Landing `/` | User clicks "Try Again" |

**Back button behavior:**
- From Execution → goes to Landing (SSE connection is closed)
- From Report → goes to Landing (not back to execution)
- Browser history is managed with Next.js router

---

## 5. PRIMARY ACTIONS

1. **Submit Query** — Core action. Validates input → POST to backend → navigate to run page
2. **Watch Swarm** — Passive observation. User watches agent graph animate in real time
3. **Read Report** — Scrollable report with interactive insight cards
4. **Export Report** — Copy, PDF, or share
5. **Follow Up** — Click follow-up question chip to start a new related query
6. **Re-run Query** — From history, re-run a past query fresh

---

## 6. EDGE CASES

### Query Submission
| Edge Case | Handling |
|-----------|---------|
| Empty query | Inline error: "Please enter a question" |
| Query < 10 chars | Warning: "Add more detail for better results" |
| Query > 500 chars | Block: "Query too long. Max 500 characters." |
| Network error on submit | Toast error: "Connection failed. Please try again." |
| Backend unavailable | Toast error: "Service unavailable. Please try again shortly." |

### Swarm Execution
| Edge Case | Handling |
|-----------|---------|
| SSE connection drops | Auto-reconnect once. If fails again, show "Connection lost" with retry button |
| Single agent fails | Mark that node ERROR (red), log the error, swarm continues with remaining agents |
| Tavily search returns no results | Researcher agent falls back to Claude's knowledge, marks finding as LOW_CONFIDENCE |
| All 3 researchers fail | Fatal error state. Show "Swarm failed to gather research" with retry option |
| Swarm takes > 3 minutes | Show "Taking longer than usual..." message. Timeout at 5 minutes |
| User navigates away mid-run | Backend run continues; user can return to /run/{queryId} to reconnect |

### Report Page
| Edge Case | Handling |
|-----------|---------|
| Report not found (expired/wrong ID) | "Report not found" with link back to landing |
| Zero insights in report | Show "Insufficient information found" with suggestion to try a more specific query |
| PDF generation fails | Show toast: "PDF failed. Try copying as Markdown instead." |
| Share URL copy fails | Fallback: display URL in a modal for manual copy |

---

## 7. USER STATES

### Global User States
```
IDLE         → User on landing page, no query running
SUBMITTING   → Query submitted, awaiting backend response
RUNNING      → SSE connected, swarm executing
COMPLETE     → Report generated, viewing report
ERROR        → Something went wrong
HISTORY      → Browsing past queries
```

### Agent Node States (per node on graph)
```
IDLE      → Grey, no glow (default, all nodes start here)
ACTIVE    → Cyan pulsing glow (agent is currently processing)
DONE      → Solid green glow (agent completed successfully)
ERROR     → Red glow (agent failed or errored)
SKIPPED   → Dim grey (agent was bypassed — future feature)
```

### Confidence Badge States (in report)
```
HIGH        → Green badge — Swarm consensus, strong evidence
MEDIUM      → Yellow badge — General agreement, some uncertainty
CONTESTED   → Red/orange badge — Critic challenged, disagreement surfaced
```

---

## 8. FLOW NOTES

### SSE Connection Management
- SSE connection opens when `/run/[queryId]` mounts
- Connection closes when: (a) `complete` event received, (b) user navigates away, (c) timeout after 5 minutes
- `useSSEStream` hook manages connection lifecycle with cleanup on unmount

### Agent Graph Layout
- Fixed layout (not user-draggable during execution) to maintain visual clarity
- Nodes arranged top-to-bottom: Planner → 3 Researchers (row) → Critic → Validator → Reconciler/Writer
- Edges are directional arrows with animated dashes when the target agent is ACTIVE

### Report Caching
- Report is fetched once on page mount and stored in React state
- No polling needed — report is static once generated
- In-memory session store holds report for the session lifetime

### Demo Script Alignment
The intended demo flow is:
1. Type: "Should a startup build a B2B SaaS for Indian SMEs in 2026?"
2. Select: "Business"
3. Click "Run Swarm"
4. Watch: Planner activates → 3 Researchers fire in parallel → Critic pushes back → Validator cross-checks → Writer completes
5. Report shows: 4 HIGH insights, 1 MEDIUM, 2 CONTESTED (with Critic's exact objections visible)
6. This is the judge-facing money moment

### Follow-up Query Flow
- Follow-up question chips at bottom of report are pre-generated by the Writer agent
- Clicking one navigates to `/` with the question pre-filled in the input
- User can edit before running or submit directly