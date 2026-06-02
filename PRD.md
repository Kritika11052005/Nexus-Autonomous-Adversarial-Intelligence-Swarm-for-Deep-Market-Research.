# NEXUS — Product Requirements Document (PRD)
**Version:** 1.0  
**Project:** NEXUS — Adversarial Multi-Agent Intelligence Swarm  
**Last Updated:** June 2026  
**Author:** NEXUS Team  

---

## 1. APP OVERVIEW

**NEXUS** is a self-organizing, adversarial multi-agent intelligence system. Users submit any complex business, research, or strategic question. A swarm of 7 specialized AI agents — each with a distinct role — collaborates, debates, and validates findings to produce a structured intelligence report with explicit confidence scoring per insight.

**The core differentiator:** Unlike existing AI research tools (Perplexity, Gemini Deep Research, Hebbia) that return a single synthesized answer, NEXUS makes the reasoning process *visible and adversarial*. A dedicated Critic Agent challenges every claim. A Reconciler assigns HIGH / MEDIUM / CONTESTED confidence to each insight. Users don't just get answers — they see *where the swarm agreed, where it disagreed, and why*.

**One-liner:**  
> "Drop any hard question — a swarm of specialist agents plans, researches, debates, and delivers a confidence-scored intelligence report in under 3 minutes."

---

## 2. PROBLEM STATEMENT

### The Core Problem
AI research tools today are black boxes. They synthesize information and return a final answer with no indication of:
- Which claims are well-supported vs. weakly supported
- Where conflicting information was found
- How confident the model is about each specific insight
- What the model *doubted* but still included

This is a critical failure for high-stakes decisions. A startup founder deciding on market entry, an analyst preparing a briefing, or a researcher evaluating a hypothesis needs to know *which parts of the output to trust*.

### Why Existing Solutions Fall Short
| Tool | Gap |
|------|-----|
| Perplexity AI | Single-model retrieval, no adversarial validation, no confidence granularity |
| Gemini Deep Research | Black-box, no visible agent reasoning, no contested insight flagging |
| Hebbia | Enterprise-only, document-focused, not real-time web intelligence |
| ChatGPT with search | No multi-step planning, no self-criticism loop, no structured confidence output |

### The Gap NEXUS Fills
A transparent, adversarial, multi-agent intelligence system that shows its work — and tells you exactly how confident the swarm is about each finding.

---

## 3. TARGET USERS

### Primary Users
1. **Startup Founders & Product Managers**
   - Use case: Market research, competitor analysis, go-to-market validation
   - Pain: Can't trust single-source AI summaries for strategic decisions
   - Frequency: 3–5 times per week

2. **Research Analysts & Consultants**
   - Use case: Industry intelligence, investment research, due diligence prep
   - Pain: Manual research is slow; AI tools don't flag weak evidence
   - Frequency: Daily

3. **Graduate Researchers & Academics**
   - Use case: Literature synthesis, hypothesis validation, competitive landscape
   - Pain: Need sourced, confidence-graded outputs they can cite and scrutinize
   - Frequency: Multiple times per week

### Secondary Users
4. **Journalists & Investigative Writers**
   - Use case: Fact-checking, background research, story angles
5. **Enterprise Strategy Teams**
   - Use case: Competitive intelligence, scenario planning

### User Persona — Primary
**Name:** Priya, 28, Startup Founder  
**Context:** Building a B2B SaaS for Indian SMEs; needs market intelligence fast  
**Frustration:** "I ask ChatGPT something and it gives me a confident answer. I have no idea if it's hallucinating half of it."  
**Goal:** Get a structured research report in minutes that tells her *what to trust* and *what to verify*

---

## 4. CORE FEATURES

### Feature 1: Query Input
- Single text input field accepting natural language questions
- Query can be a business question, research question, hypothesis, or topic
- Optional: Domain tag (Business / Research / Technical / General)
- Query length: up to 500 characters
- Input validation with helpful error messages

### Feature 2: Live Agent Swarm Visualization
- Real-time node graph showing all 7 agents
- Each agent node has 4 states: IDLE → ACTIVE (pulsing) → DONE → ERROR
- Connection edges animate when data passes between agents
- Agent activity log panel showing current action in plain English
- Estimated time remaining indicator

### Feature 3: The 7-Agent Swarm Pipeline
| Agent | Role | Tool |
|-------|------|------|
| Planner | Decomposes query into 3–5 sub-questions | Google Gemini |
| Researcher A | Web retrieval on sub-question 1 | Tavily + Google Gemini |
| Researcher B | Web retrieval on sub-question 2 | Tavily + Google Gemini |
| Researcher C | Web retrieval on sub-question 3 | Tavily + Google Gemini |
| Critic | Challenges all researcher findings, flags weak evidence | Google Gemini |
| Validator | Cross-references sources, detects contradictions | Google Gemini |
| Reconciler + Writer | Assigns confidence scores, produces final report | Google Gemini |

### Feature 4: Confidence-Scored Intelligence Report
Report structure:
- **Executive Summary** (3–4 sentences)
- **Key Insights** — each tagged HIGH / MEDIUM / CONTESTED
- **Contested Findings** — insights where Critic and Researchers disagreed, with both sides shown
- **Source Attribution** — URL + domain + relevance score per insight
- **Swarm Confidence Overview** — aggregate confidence breakdown
- **Recommended Follow-up Questions** — 3 questions the swarm identified as unresolved

### Feature 5: Report Export
- Copy to clipboard (Markdown)
- Download as PDF
- Share via unique URL (read-only)

### Feature 6: Query History
- List of past queries with timestamps
- Ability to re-run a query (fresh swarm pass)
- Basic search/filter on history

---

## 5. GOALS

### Hackathon Goals (Immediate)
1. Working end-to-end demo with all 7 agents functional
2. Live agent graph visualization that animates in real time
3. Confidence scoring visible per insight in final report
4. Demo query runs in under 3 minutes
5. Deployed and accessible via public URL

### Product Goals (Post-Hackathon)
1. Reduce research time for target users by 70%
2. Provide measurably more trustworthy outputs than single-model tools
3. Make multi-agent AI reasoning accessible to non-technical users
4. Build a foundation for a SaaS product with enterprise pricing potential

---

## 6. USER STORIES

### Core Flow
- **As a user**, I want to type a complex question and submit it, so that the swarm begins processing immediately.
- **As a user**, I want to watch the agents work in real time, so that I understand how the answer is being constructed.
- **As a user**, I want each insight in the final report to have a confidence tag, so that I know which findings to act on and which to verify.
- **As a user**, I want to see what the Critic Agent challenged, so that I understand the limitations of the output.
- **As a user**, I want to export the report, so that I can share it with my team.

### Edge Case Stories
- **As a user**, if an agent fails, I want to see a clear error state on that node, so that I understand what went wrong without the whole swarm breaking.
- **As a user**, if my query is too vague, I want a suggestion to refine it before the swarm runs.
- **As a user**, if the swarm takes longer than expected, I want a progress indicator, not a frozen screen.

---

## 7. SUCCESS METRICS

### Hackathon Metrics
| Metric | Target |
|--------|--------|
| End-to-end run time | < 3 minutes |
| Agent nodes visible and animated | 7/7 |
| Confidence tags on insights | ≥ 4 per report |
| Demo stability (no crashes) | 100% during judging |
| Judge comprehension of unique value | Qualitative — "adversarial validation" must be explained clearly |

### Product Metrics (Post-Hackathon)
| Metric | Target (Month 3) |
|--------|-----------------|
| Queries per day | 500+ |
| Report completion rate | > 90% |
| User return rate (7-day) | > 40% |
| Average session time | > 4 minutes |
| NPS score | > 50 |

---

## 8. FEATURE MAP

```
NEXUS
├── Landing / Query Input
│   ├── Query text field
│   ├── Domain selector (optional)
│   ├── Example queries
│   └── Submit button
│
├── Swarm Execution Screen
│   ├── Live agent graph (React Flow)
│   │   ├── 7 agent nodes with state colors
│   │   ├── Animated directional edges
│   │   └── Agent detail panel (click any node)
│   ├── Activity log (streaming text)
│   ├── Progress bar / ETA
│   └── Cancel button
│
├── Intelligence Report Screen
│   ├── Executive Summary
│   ├── Key Insights (with HIGH/MEDIUM/CONTESTED tags)
│   ├── Contested Findings section
│   ├── Source list with URLs
│   ├── Confidence overview chart
│   ├── Follow-up questions
│   └── Export options (Copy / PDF / Share)
│
└── Query History
    ├── Past queries list
    ├── Re-run option
    └── Search/filter
```

---

## 9. OUT OF SCOPE (Hackathon Version)

- User authentication / accounts (use session-based state only)
- Persistent database (in-memory state sufficient)
- Payment / billing
- Custom agent configuration by users
- Multi-language support
- Mobile-optimized responsive design (desktop-first for demo)
- Real-time collaboration (multi-user same session)

---

## 10. ASSUMPTIONS & CONSTRAINTS

- **Assumption:** Tavily API free tier (1000 calls/month) is sufficient for hackathon demo
- **Assumption:** Google Gemini API access is available throughout the hackathon
- **Constraint:** All agents must complete within API rate limits — implement retry logic
- **Constraint:** Demo environment is a laptop/desktop browser — no mobile optimization required
- **Assumption:** Queries will be in English only for hackathon version