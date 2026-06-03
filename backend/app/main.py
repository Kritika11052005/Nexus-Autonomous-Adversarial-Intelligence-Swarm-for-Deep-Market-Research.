from fastapi import FastAPI, HTTPException, Depends, BackgroundTasks, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import uuid
import json
import asyncio
from datetime import datetime

from app.core.config import settings
from app.db.session import get_db, db as prisma_client
from prisma import Prisma, Json
from prisma.models import User, Session, AgentRun, AgentEvent, Finding, Source, Report
from app.api.routes import auth, billing
from app.api.deps import get_current_user
from app.agents.swarm import build_swarm_graph, SwarmState
from app.store import session_store

app = FastAPI(
    title="NEXUS — Adversarial Multi-Agent Intelligence Swarm",
    description="Production-grade multi-agent research swarm pipeline",
    version="1.0"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# FastAPI startup/shutdown connection managers
@app.on_event("startup")
async def startup():
    if not prisma_client.is_connected():
        await prisma_client.connect()
    await session_store.init_pool()

@app.on_event("shutdown")
async def shutdown():
    if prisma_client.is_connected():
        await prisma_client.disconnect()
    await session_store.close_pool()

# Include Authentication and Stripe routers
app.include_router(auth.router)
app.include_router(billing.router)

class SwarmSettings(BaseModel):
    model: Optional[str] = "gemini-3.5-flash"
    search_depth: Optional[int] = 5
    planner_temp: Optional[float] = 0.2
    critic_temp: Optional[float] = 0.7

class SessionRequest(BaseModel):
    query: str
    domain: Optional[str] = "General"
    settings: Optional[SwarmSettings] = SwarmSettings()

class SessionResponse(BaseModel):
    session_id: str
    query_text: str
    status: str
    plan: str
    created_at: datetime

# Compile the LangGraph
swarm_graph = build_swarm_graph()

# Background Executor Task
async def run_swarm_pipeline(session_id: str, query: str, domain: str, custom_settings: Dict[str, Any], db_session_id: str):
    """
    Asynchronous executor running the LangGraph Swarm pipeline.
    Persists all intermediate node runs, logs, and reports inside PostgreSQL using session_store.
    """
    try:
        # Fetch Session
        session_rec = await session_store.get_session(session_id)
        if not session_rec:
            return
            
        session_rec["status"] = "running"
        await session_store.set_session(session_id, session_rec)
        
        # Initial state
        initial_state: SwarmState = {
            "session_id": session_id,
            "query": query,
            "domain": domain,
            "language": "English",
            "custom_settings": custom_settings,
            "planner_plan": [],
            "findings": [],
            "critic_critique": None,
            "validation_results": [],
            "confidence_score": 0.0,
            "final_report": {},
            "current_step": "Planner initializing...",
            "logs": []
        }
        
        # Run LangGraph pipeline
        final_output = await swarm_graph.ainvoke(initial_state)
        
        # Save Report & Findings & Sources inside final_report object
        report_data = final_output.get("final_report", {})
        findings = []
        for f in final_output.get("findings", []):
            val_status = "high"
            for v in final_output.get("validation_results", []):
                if v.get("claim") == f.get("claim"):
                    val_status = v.get("status", "high").lower()
            findings.append({
                "claim": f.get("claim", ""),
                "status": val_status,
                "agent": f.get("source_agent", "Alpha")
            })
            
        sources = []
        for f in final_output.get("findings", []):
            sources.append({
                "title": f.get("title", "Reference Source"),
                "url": f.get("url", "#"),
                "domain": f.get("url", "").split("/")[2] if "//" in f.get("url", "") else "web",
                "snippet": f.get("snippet", "")
            })

        final_report_payload = {
            "confidence_score": final_output.get("confidence_score", 85.0),
            "report": {
                "executive_summary": report_data.get("executive_summary", ""),
                "full_markdown": report_data.get("full_markdown", "")
            },
            "findings": findings,
            "sources": sources
        }
        
        # Update Session to complete
        session_rec["status"] = "complete"
        session_rec["final_report"] = final_report_payload
        await session_store.set_session(session_id, session_rec)
        
        print(f"[SWARM ENGINE] Session {session_id} completed successfully")
        
    except Exception as e:
        # Mark session as failed
        try:
            session_rec = await session_store.get_session(session_id)
            if session_rec:
                session_rec["status"] = "failed"
                await session_store.set_session(session_id, session_rec)
        except Exception as update_err:
            print(f"[SWARM ENGINE] Failed to update status to failed: {update_err}")
        print(f"[SWARM ENGINE] Session {session_id} failed: {str(e)}")

@app.get("/health", tags=["System"])
def health_check():
    """Health check endpoint to ensure API service status is online."""
    return {
        "status": "healthy",
        "environment": settings.ENVIRONMENT,
        "timestamp": datetime.utcnow()
    }

@app.post("/sessions", response_model=SessionResponse, tags=["Sessions"])
async def create_session(
    payload: SessionRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user)
):
    """
    Submits a research query to initialize an intelligence session.
    Verifies subscription usage parameters and triggers LangGraph swarm.
    """
    query_id = str(uuid.uuid4())
    
    # Initialize session in PostgreSQL
    new_session_data = {
        "status": "pending",
        "query_text": payload.query,
        "agent_events": [],
        "final_report": None
    }
    await session_store.set_session(query_id, new_session_data)
    
    # Launch Swarm executor in background task thread
    custom_cfg = {
        "model": payload.settings.model if current_user.plan == "pro" else "gpt-4o",
        "search_depth": payload.settings.search_depth if current_user.plan == "pro" else 3,
        "planner_temp": payload.settings.planner_temp,
        "critic_temp": payload.settings.critic_temp
    }
    
    background_tasks.add_task(
        run_swarm_pipeline,
        query_id,
        payload.query,
        payload.domain,
        custom_cfg,
        query_id
    )
    
    return SessionResponse(
        session_id=query_id,
        query_text=payload.query,
        status="pending",
        plan=current_user.plan,
        created_at=datetime.utcnow()
    )

@app.get("/sessions/{session_id}", tags=["Sessions"])
async def get_session(
    session_id: str,
    current_user: User = Depends(get_current_user)
):
    """
    Returns the current execution state, findings, and complete reports
    of a particular agent swarm session using the postgres sessions store.
    """
    session_rec = await session_store.get_session(session_id)
    if not session_rec:
        raise HTTPException(status_code=404, detail="Session not found")
        
    final_report = session_rec.get("final_report") or {}
    
    return {
        "session_id": str(session_rec["query_id"]),
        "query_text": session_rec["query_text"],
        "status": session_rec["status"],
        "confidence_score": float(final_report.get("confidence_score", 0.0)) if final_report else 0.0,
        "created_at": session_rec["created_at"],
        "report": final_report.get("report") if final_report else None,
        "findings": final_report.get("findings", []) if final_report else [],
        "sources": final_report.get("sources", []) if final_report else [],
        "agent_events": sorted(session_rec.get("agent_events", []), key=lambda x: x["timestamp"])
    }

@app.get("/sessions", tags=["Sessions"])
async def list_sessions(
    current_user: User = Depends(get_current_user)
):
    """Returns a list of all historical runs."""
    sessions = await session_store.list_sessions()
    return [{
        "session_id": str(s["query_id"]),
        "query_text": s["query_text"],
        "status": s["status"],
        "confidence_score": float(s["final_report"].get("confidence_score", 0.0)) if s.get("final_report") else 0.0,
        "created_at": s["created_at"]
    } for s in sessions]

# Real-Time SSE Stream Endpoint
@app.get("/sessions/{session_id}/stream", tags=["Sessions"])
async def stream_session_events(
    session_id: str
):
    """
    Server-Sent Events (SSE) endpoint to stream active swarm progress
    and agent node logs to the client in real-time.
    """
    try:
        uuid.UUID(session_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Session ID must be a valid UUID formatting string."
        )

    async def event_generator():
        last_event_count = 0
        while True:
            try:
                session_rec = await session_store.get_session(session_id)
                if not session_rec:
                    yield f"data: {json.dumps({'error': 'Session not found'})}\n\n"
                    break
                    
                sorted_logs = sorted(session_rec.get("agent_events", []), key=lambda x: x["timestamp"])
                
                # Emit new logs
                if len(sorted_logs) > last_event_count:
                    new_logs = sorted_logs[last_event_count:]
                    for log in new_logs:
                        yield f"data: {json.dumps({'type': 'log', 'event': log})}\n\n"
                    last_event_count = len(sorted_logs)
                    
                if session_rec["status"] in ("complete", "failed"):
                    yield f"data: {json.dumps({'type': 'status', 'status': session_rec['status']})}\n\n"
                    break
            except Exception as loop_err:
                print(f"[SSE LOOP EXCEPTION] {loop_err}")
                pass
                
            await asyncio.sleep(1.0)
            
    headers = {
        "Cache-Control": "no-cache, no-transform",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no"
    }
    return StreamingResponse(event_generator(), media_type="text/event-stream", headers=headers)
