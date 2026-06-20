# NEXUS ⬡ Adversarial Multi-Agent Intelligence Swarm

[![Hackathon Theme: Agent Swarms](https://img.shields.io/badge/Theme-Agent%20Swarms-purple.svg)](#theme-alignment)
[![LLM Stack: Google Gemini](https://img.shields.io/badge/LLM%20Stack-Google%20Gemini-orange.svg)](#google-gemini-integration)
[![FastAPI Backend](https://img.shields.io/badge/Backend-FastAPI-green.svg)](backend/)
[![Next.js Frontend](https://img.shields.io/badge/Frontend-Next.js-black.svg)](frontend/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](#license)

> **"Drop any hard question — a swarm of seven specialist agents plans, researches, debates, and delivers a confidence-scored intelligence report in under 3 minutes."**

---

## 📽️ Project Overview

**NEXUS** is an ultra-premium, self-organizing, adversarial multi-agent intelligence swarm. Users submit complex business, research, or strategic questions. Instead of generating a black-box summary, NEXUS initiates an adversarial 7-agent pipeline. A dedicated Critic Agent challenges every finding, a Validator reconciles contradictory data, and a Reconciler grades insights with confidence levels, providing a highly-credible structured report.

### 🌟 Core Differentiators
- **Adversarial Validation Loop**: A dedicated Critic Agent flags assumptions, biases, and dates while Researchers defend claims.
- **Granular Confidence Scores**: Every key insight is tagged as **HIGH**, **MEDIUM**, or **CONTESTED**.
- **Real-Time Swarm Visualizer**: Users watch parallel agent nodes pulse, interact, and stream reasoning logs via Server-Sent Events (SSE).
- **Voice Queries (Gemini STT)**: Hands-free vocal entry powered by Gemini API speech-to-text transcription.
- **Cinematic Premium Design**: Featuring custom dark modes, interactive 3D particle synapse networks, and responsive layouts.

---

## 🧬 Theme Alignment: Agent Swarms

NEXUS was built from the ground up for the **Agent Swarms** theme. It demonstrates a self-organizing, state-managed distributed AI architecture at its finest.
- **Decomposition**: The Lead Planner breaks the primary question into 3 parallel research axes.
- **Parallel Work**: Three Researcher Agents retrieve live-web context simultaneously.
- **Adversarial Friction**: The Critic reviews raw research and challenges claims, provoking a debate.
- **Synthesis**: The Validator and Reconciler grade truthfulness, score confidence, and write the report.

---

## 🧠 Google Gemini Integration

NEXUS is powered by **Google Gemini** models to orchestrate agent reasoning and voice capabilities:
1. **Google Gemini Models**: All 7 Swarm Agents (Planner, Researchers, Critic, Validator, Reconciler/Writer) utilize **Gemini 1.5/3.5** models (defaulting to `gemini-3.5-flash`) via LangChain for logical reasoning, speed, and analytical correctness.
2. **Gemini Speech API**: Hands-free voice query transcription using the Google/Gemini transcription services.
3. **High-Concurrency Execution**: Low-latency responses and lightweight context windows allow rapid concurrent execution of the agent swarm.

---

## 🏗️ System Architecture

NEXUS uses a modern, high-fidelity stack optimized for low-latency streaming and high throughput:

```mermaid
graph TD
    User([User Query]) -->|Websocket/HTTP| FE[Next.js Frontend]
    FE -->|SSE Event Stream| BE[FastAPI Backend]
    BE -->|LangGraph Orchestrator| Swarm[7-Agent Swarm]
    
    subgraph Swarm Swarm Swarm
        Swarm --> Planner[Planner Agent]
        Planner -->|Dispatch Parallel Tasks| R1[Researcher Alpha]
        Planner -->|Dispatch Parallel Tasks| R2[Researcher Beta]
        Planner -->|Dispatch Parallel Tasks| R3[Researcher Gamma]
        R1 & R2 & R3 -->|Compile Source Findings| Critic[Critic Agent]
        Critic -->|Adversarial Rebuttal| Validator[Validator Agent]
        Validator -->|Confidence Scoring| Writer[Reconciler & Writer]
    end
    
    R1 & R2 & R3 -->|Live Web Crawl| Tavily((Tavily Search API))
    Swarm -->|LLM Reasoning| Gemini[Google Gemini Models]
    Swarm -->|Database Logging| DB[(PostgreSQL Session Store)]
    BE -->|Throttling & Sliding Window| Redis[(Redis Cache)]
```

---

## ⚡ Setup & Installation

Follow these steps to run NEXUS locally in development mode:

### Prerequisites
- **Node.js** (v18+ recommended)
- **Python** (v3.10+ recommended)
- **PostgreSQL** (Active database instance)
- **Redis** (Used for rate-limiting, optional with local memory fallback)

---

### 1. Backend Configuration
1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Create a virtual environment and activate it:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows use: venv\Scripts\activate
   ```
3. Install Python dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Create a `.env` file in the project root (using the template below) and configure your API keys:
   ```env
   # API Keys
   GEMINI_AGENT_KEY="your-gemini-agent-api-key"      # API Key for Google Gemini LLM agents (gemini-3.5-flash / gemini-1.5-flash)
   GEMINI_API_KEY="your-gemini-speech-to-text-key"   # API Key for speech-to-text voice transcription
   TAVILY_API_KEY="your-tavily-api-key"
   
   # Databases (Standard URL required for Prisma ORM — do not use postgresql+asyncpg://)
   DATABASE_URL="postgresql://postgres:password@localhost:5432/nexus"
   REDIS_URL="redis://localhost:6379/0"
   
   # Security (Generate a secure hex key using `openssl rand -hex 32`)
   JWT_SECRET_KEY="generate_a_secure_hex_key_here"
   JWT_ALGORITHM="HS256"
   ```
5. Apply database schemas and migrations:
   ```bash
   # Generate Prisma client and sync database tables
   python create_tables.py
   ```
6. Spin up the FastAPI server:
   ```bash
   python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
   ```

---

### 2. Frontend Configuration
1. Navigate to the frontend directory:
   ```bash
   cd ../frontend
   ```
2. Install npm packages:
   ```bash
   npm install
   ```
3. Spin up the Next.js development server:
   ```bash
   npm run dev
   ```
4. Open [http://localhost:3000](http://localhost:3000) in your browser.

---

### 🐳 Docker Compose (Single-Command Launch)
To spin up PostgreSQL, Redis, the Backend, and the Frontend together:
```bash
docker-compose up --build
```

---

## 🔒 Security & Data Privacy

- **No Exposed Secrets**: All API keys, database credentials, and session tokens are strictly loaded via server-side environment variables and are excluded from version control via `.gitignore`.
- **Advanced Rate Limiting**: Features a sliding-window rate limiter on backend API endpoints. Utilizes Redis sorted sets for scale, with a thread-safe in-memory cache fallback if Redis is unavailable.
- **Privacy First**: No third-party commercial marketing trackers. Session history can be cleared on demand.

---

## 👥 Developer Profiles & Team Details

NEXUS was designed, built, and optimized by:

### Kritika Benjwal
- **GitHub**: [Kritika11052005](https://github.com/Kritika11052005)
- **LinkedIn**: [Kritika Benjwal](https://www.linkedin.com/in/kritika-benjwal)
- **Email**: [ananya.benjwal@gmail.com](mailto:ananya.benjwal@gmail.com)

### Sarthak Gupta
- **GitHub**: [SarthakG1801](https://github.com/SarthakG1801)
- **LinkedIn**: [Sarthak Gupta](https://www.linkedin.com/in/sarthakgupta1801/)
- **Email**: [sarthakgupta1971@gmail.com](mailto:sarthakgupta1971@gmail.com)

---

## 🤖 AI Disclosure

- **AI Tools Used**: Developed with the assistance of GitHub Copilot and Google Gemini for boilerplate code, visual CSS patterns, and unit tests.

---

## 📄 License
This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
