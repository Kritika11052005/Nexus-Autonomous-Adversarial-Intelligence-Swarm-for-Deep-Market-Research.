# NEXUS — UI/UX Design Document
**Document Version:** 1.0  
**Project:** NEXUS Multi-Agent Intelligence Swarm  
**Design Concept:** Bioluminescent Swarm  

---

## 1. DESIGN PHILOSOPHY

### Core Concept
NEXUS is modeled after **bioluminescent deep-sea organisms and firefly swarms** — living systems that coordinate intelligently in darkness through light signals. Every visual decision reinforces the idea: *you are watching a living colony think*.

The interface should feel like a **mission control for a living intelligence** — not a chatbot, not a dashboard, not a typical SaaS tool. It is alien, precise, and alive.

### Design Principles

| Principle | Application |
|---|---|
| **Clarity in Complexity** | Show 7 agents working in parallel without visual chaos |
| **Alive, Not Static** | Nothing is frozen — idle states pulse, active states glow, edges animate |
| **Trust Through Transparency** | Confidence scores, agent debates, and contested findings are always visible |
| **Minimal Chrome** | No unnecessary borders, shadows, or decoration — let the glow do the work |
| **Spatial Intelligence** | Layout communicates relationships — swarm graph = the brain, output panel = the result |

### Mood & Feel
- **Dark** — like the deep ocean or a bioluminescent forest at night
- **Precise** — monospace data readouts, clean grid, intentional spacing
- **Alive** — pulsing nodes, flowing edges, animated tokens streaming in
- **Credible** — confidence scores, citations, and evidence make every output feel earned

---

## 2. COLOR PALETTE

### Base Colors

| Token | Hex | Usage |
|---|---|---|
| `--bg-base` | `#08080F` | App background — near-black with a blue tint |
| `--bg-surface` | `#0E0E1A` | Cards, panels, modals |
| `--bg-raised` | `#14142A` | Input fields, hover states, code blocks |
| `--border-subtle` | `#1E1E3A` | Dividers, card borders |
| `--border-glow` | `#00FFD130` | Glowing border on active panels |

### Text Colors

| Token | Hex | Usage |
|---|---|---|
| `--text-primary` | `#E8E8F0` | Main body text |
| `--text-secondary` | `#8888AA` | Labels, metadata, captions |
| `--text-muted` | `#44445A` | Placeholder text, disabled states |
| `--text-code` | `#A0F0D0` | Monospace readouts, agent IDs |

### Agent Glow Colors (one per agent)

| Agent | Color | Hex | State Behavior |
|---|---|---|---|
| **Planner** | Violet | `#8B5CF6` | Pulses on query intake |
| **Researcher A** | Cyan | `#06B6D4` | Strobes during web search |
| **Researcher B** | Teal | `#14B8A6` | Strobes during web search |
| **Researcher C** | Sky | `#38BDF8` | Strobes during web search |
| **Critic** | Amber | `#F59E0B` | Flashes on contradiction |
| **Validator** | Emerald | `#10B981` | Solid on completion |
| **Reconciler / Writer** | White-Cyan | `#E0FFFA` | Glows during output generation |

### Semantic Colors

| Token | Hex | Usage |
|---|---|---|
| `--confidence-high` | `#10B981` | High confidence findings |
| `--confidence-medium` | `#F59E0B` | Medium confidence |
| `--confidence-contested` | `#EF4444` | Contested / conflicting data |
| `--success` | `#22C55E` | Completed states |
| `--warning` | `#EAB308` | Warning states |
| `--error` | `#F43F5E` | Error / failed agent |

---

## 3. TYPOGRAPHY

### Font Stack

```
Headings:   Space Grotesk (Google Fonts) — weights 500, 600, 700
Body:       Inter (Google Fonts) — weights 400, 500
Monospace:  JetBrains Mono — agent IDs, confidence scores, token streams
```

### Type Scale

| Style | Font | Size | Weight | Line Height | Usage |
|---|---|---|---|---|---|
| `display` | Space Grotesk | 36px | 700 | 1.1 | Hero / loading screen |
| `h1` | Space Grotesk | 28px | 600 | 1.2 | Page titles |
| `h2` | Space Grotesk | 22px | 600 | 1.3 | Section headers |
| `h3` | Space Grotesk | 18px | 500 | 1.4 | Card titles |
| `body-lg` | Inter | 16px | 400 | 1.6 | Main content |
| `body` | Inter | 14px | 400 | 1.6 | Standard UI |
| `caption` | Inter | 12px | 400 | 1.5 | Metadata, labels |
| `mono` | JetBrains Mono | 13px | 400 | 1.4 | Code, scores, IDs |

### Typography Rules
- Never use pure `#FFFFFF` for text — always use `--text-primary` (`#E8E8F0`)
- Avoid ALL CAPS except for status badges and confidence labels
- Letter spacing: `0.05em` on labels/badges only
- No text decoration on anything that isn't a hyperlink

---

## 4. SPACING & LAYOUT SYSTEM

### Grid
- Base unit: `4px`
- Spacing scale: `4, 8, 12, 16, 24, 32, 48, 64, 96px`
- App layout: 2-column split (Swarm Graph | Output/Log Panel)
  - Left panel (Swarm): `55% width`
  - Right panel (Output): `45% width`
  - Divider: `1px solid var(--border-subtle)`

### Breakpoints
```
Mobile:  < 768px   → Stack panels vertically, graph collapses to list view
Tablet:  768–1199px → Panels at 50/50
Desktop: ≥ 1200px  → 55/45 default
Wide:    ≥ 1600px  → Max content width 1440px, centered
```

### Border Radius
```
--radius-sm: 4px   → Tags, badges
--radius-md: 8px   → Cards, inputs
--radius-lg: 12px  → Modals, panels
--radius-xl: 20px  → Agent nodes in graph
--radius-full: 9999px → Pills, status dots
```

---

## 5. UI COMPONENTS

### 5.1 Agent Node (React Flow)

**Shape:** Rounded rectangle (not circle — too generic)  
**Size:** 160px × 72px  
**States:**

```
IDLE      → Dim fill (bg-surface), faint border (agent color @ 20% opacity), no glow
QUEUED    → Faint pulse animation on border (agent color @ 40% opacity)
ACTIVE    → Bright border glow, inner shimmer, pulsing outer ring
DONE      → Solid filled border (agent color), static
FAILED    → Red border, red inner tint, shake animation (200ms)
CONTESTED → Amber border strobing, warning icon
```

**Node anatomy:**
```
┌─────────────────────────────┐
│  [●] RESEARCHER A           │  ← Status dot + Agent name (Space Grotesk 500)
│  Analyzing policy data...   │  ← Current action (Inter 12px, muted)
└─────────────────────────────┘
```

**Edge (connection line) style:**
- Animated dashed line flowing from source to target
- Color matches the source agent's glow color
- Animation direction: source → target (shows data flowing)
- Thickness: `1.5px` default, `2.5px` when active

---

### 5.2 Query Input Bar

Full-width input at top of screen:

```
┌─────────────────────────────────────────────────────┐
│  ⬡  What do you want NEXUS to investigate?    [RUN] │
└─────────────────────────────────────────────────────┘
```

- Background: `--bg-raised`
- Border: `1px solid --border-subtle` at rest → glows `--border-glow` on focus
- Button: Filled with `--agent-planner` violet, `Space Grotesk 600`
- Hexagon icon (⬡) = NEXUS brand mark — subtle, monochrome
- On Run: input locks, button becomes a pulsing "RUNNING..." state

---

### 5.3 Confidence Badge

Used on every finding in the output report:

```
● HIGH        → Green filled pill
◐ MEDIUM      → Amber outlined pill
✕ CONTESTED   → Red filled pill with strikethrough
```

- Font: `JetBrains Mono`, `11px`, letter-spacing `0.1em`
- Icon: dot / half-dot / X to communicate without color alone (accessibility)

---

### 5.4 Agent Log Feed (Right Panel — Live)

Scrolling terminal-style feed as agents work:

```
14:23:01  [PLANNER]      → Decomposed into 4 sub-tasks
14:23:03  [RESEARCHER_A] → Querying: "semiconductor supply chain 2024"
14:23:05  [RESEARCHER_B] → Found 7 sources, extracting...
14:23:08  [CRITIC]       ⚠ Challenging Researcher A: Source conflicts with B
14:23:11  [VALIDATOR]    ✓ Cross-reference confirmed: B source authoritative
14:23:14  [RECONCILER]   → Synthesizing final output...
```

- Font: `JetBrains Mono 12px`
- Colors: agent name uses its glow color; actions in `--text-secondary`
- New entries animate in from bottom (`translateY(8px) → 0`, opacity 0→1)
- Auto-scroll with pause-on-hover

---

### 5.5 Output Report Card

Final generated report block:

```
┌──────────────────────────────────────────────────────────────────┐
│  NEXUS INTELLIGENCE REPORT                        ● COMPLETE     │
│  Query: "Impact of AI on semiconductor demand"                   │
│  Generated: 2024-01-15 14:23 UTC  |  Confidence: 78%  |  8 min  │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  EXECUTIVE SUMMARY                                               │
│  AI workloads are driving a structural shift in chip demand...   │
│                                                                  │
│  KEY FINDINGS                                                    │
│  ● HIGH       GPU demand forecasted to grow 340% by 2026        │
│  ◐ MEDIUM     TSMC's capacity expansion may lag by 18 months    │
│  ✕ CONTESTED  China export restrictions impact: disputed         │
│                                                                  │
│  SOURCES  [12 cited]    AGENT DEBATE  [View 4 exchanges]         │
│                                                     [EXPORT PDF] │
└──────────────────────────────────────────────────────────────────┘
```

---

### 5.6 Status Pill / Badge

```
● RUNNING      → Animated dot, cyan
● COMPLETE     → Static dot, emerald
● FAILED       → Static dot, red
● IDLE         → Static dot, muted
```

---

### 5.7 Progress Indicator

Horizontal segmented bar showing pipeline progress:

```
[PLANNER] → [RESEARCH] → [CRITIQUE] → [VALIDATE] → [WRITE] → [DONE]
  ████          ████         ░░░░        ░░░░        ░░░░      ░░░░
```

Segments fill with each agent's color as it completes.

---

## 6. ANIMATIONS & MICRO-INTERACTIONS

| Element | Animation | Duration | Easing |
|---|---|---|---|
| Agent node active state | Border glow pulse | 1.5s loop | `ease-in-out` |
| Edge data flow | Dashed line stroke offset | 0.8s loop | `linear` |
| Log entry appear | Fade + slide up | 200ms | `ease-out` |
| Report streaming in | Token-by-token text | Streaming | N/A |
| Node status change | Scale bounce (1 → 1.05 → 1) | 300ms | `spring` |
| Query submission | Input compress + ripple | 400ms | `ease-in-out` |
| Confidence badge reveal | Stagger fade-in | 80ms each | `ease-out` |

**Performance rules:**
- All animations use `transform` and `opacity` only (GPU composited)
- Disable animations when `prefers-reduced-motion: reduce` is set
- No animation should block interaction

---

## 7. SCREEN LAYOUTS

### 7.1 Landing / Home Screen

```
┌────────────────────────────────────────────────────────────────────┐
│                                                                    │
│                    ⬡  N E X U S                                    │
│           Multi-Agent Intelligence Swarm                           │
│                                                                    │
│     ┌────────────────────────────────────────────────────┐         │
│     │  Ask anything complex...                    [RUN]  │         │
│     └────────────────────────────────────────────────────┘         │
│                                                                    │
│     Recent Queries:                                                │
│     · Impact of AI on semiconductor supply chains       →         │
│     · Geopolitical risks in Southeast Asia 2024         →         │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

Background: Subtle animated particle field — tiny glowing dots drifting slowly, representing idle agents. Density: low. Speed: very slow. No text overlapping particles.

---

### 7.2 Active Swarm Screen (Primary View)

```
┌─────────────────────────────────┬──────────────────────────────────┐
│    SWARM GRAPH (55%)            │   LIVE LOG + OUTPUT (45%)        │
│                                 │                                  │
│   [Planner]                     │  AGENT LOG                       │
│      ↓ ↓ ↓                      │  ─────────────────────────────── │
│  [R-A] [R-B] [R-C]              │  14:23:01 [PLANNER] Decomposed  │
│      ↓   ↓   ↓                  │  14:23:03 [R-A] Querying...     │
│     [Critic]                    │  14:23:05 [CRITIC] ⚠ Conflict   │
│         ↓                       │  ...                             │
│     [Validator]                 │  ─────────────────────────────── │
│         ↓                       │  OUTPUT REPORT                   │
│     [Reconciler]                │  [Streaming in when ready...]    │
│                                 │                                  │
│  ● RUNNING  |  Step 3 of 6     │                                  │
└─────────────────────────────────┴──────────────────────────────────┘
```

---

### 7.3 Results Screen

Same layout — Swarm graph dims to "complete" state on left, full report on right. Export and share controls appear at bottom of right panel.

---

### 7.4 History Screen

Clean list view:

```
PAST QUERIES
─────────────────────────────────────────────────────
2024-01-15  Impact of AI on semiconductors    78%  ●  →
2024-01-14  Southeast Asia geopolitical risk  91%  ●  →
2024-01-13  Climate finance mechanisms        62%  ●  →
```

---

## 8. ICONOGRAPHY

- **Primary icon set:** Lucide React (clean, geometric, consistent stroke width)
- **Brand mark:** Hexagon (⬡) — represents the swarm cell structure
- **Agent icons:** Each agent gets a unique geometric glyph
  - Planner: Grid / compass
  - Researchers: Magnifying glass variants
  - Critic: Alert triangle
  - Validator: Shield check
  - Reconciler: Merge arrows
  - Writer: Feather pen

No emoji in the main UI. Emoji only in user-visible log entries where the content warrants it.

---

## 9. EMPTY STATES & LOADING

### First Load
- Animated hexagonal logo assembles from 6 triangular pieces over 800ms
- Tagline fades in: `"Swarm intelligence, activated."`

### Waiting for Results
- Swarm graph animates actively — nodes pulse, edges flow
- Right panel shows: `"Agents working. Stand by."` in monospace
- Subtle particle drift in background intensifies slightly

### Error State
- Failed node shakes + turns red
- Log shows exact failure point
- Retry button appears: `"Restart from Critic"` or `"Full Restart"`

### Empty History
- Centered illustration: faint hexagonal swarm pattern
- Text: `"No past queries. Drop your first complex question above."`

---

## 10. ACCESSIBILITY

| Requirement | Implementation |
|---|---|
| Color contrast | All text meets WCAG AA (4.5:1 min) on dark backgrounds |
| Motion sensitivity | All animations respect `prefers-reduced-motion` |
| Focus states | Visible outline on all interactive elements (`2px solid --agent-planner`) |
| Screen readers | ARIA labels on all agent nodes, status badges, and confidence scores |
| Keyboard navigation | Full keyboard nav through query input, history, and results |
| Color-blind safe | Confidence levels use icons (●/◐/✕) not just color |

---

## 11. DESIGN TOKENS (CSS VARIABLES)

```css
:root {
  /* Backgrounds */
  --bg-base: #08080F;
  --bg-surface: #0E0E1A;
  --bg-raised: #14142A;

  /* Borders */
  --border-subtle: #1E1E3A;
  --border-glow: rgba(0, 255, 209, 0.18);

  /* Text */
  --text-primary: #E8E8F0;
  --text-secondary: #8888AA;
  --text-muted: #44445A;
  --text-code: #A0F0D0;

  /* Agent colors */
  --agent-planner: #8B5CF6;
  --agent-researcher-a: #06B6D4;
  --agent-researcher-b: #14B8A6;
  --agent-researcher-c: #38BDF8;
  --agent-critic: #F59E0B;
  --agent-validator: #10B981;
  --agent-reconciler: #E0FFFA;

  /* Confidence */
  --confidence-high: #10B981;
  --confidence-medium: #F59E0B;
  --confidence-contested: #EF4444;

  /* Spacing */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-6: 24px;
  --space-8: 32px;
  --space-12: 48px;
  --space-16: 64px;

  /* Radii */
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-xl: 20px;
  --radius-full: 9999px;

  /* Transitions */
  --transition-fast: 150ms ease-out;
  --transition-base: 250ms ease-out;
  --transition-slow: 400ms ease-out;
}
```

---

*End of NEXUS UI/UX Design Document v1.0*