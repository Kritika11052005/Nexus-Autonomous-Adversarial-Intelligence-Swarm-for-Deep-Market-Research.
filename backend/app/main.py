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

@app.on_event("shutdown")
async def shutdown():
    if prisma_client.is_connected():
        await prisma_client.disconnect()

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
    Persists all intermediate node runs, logs, and reports inside Neon Postgres using Prisma.
    """
    from app.db.session import AsyncSessionLocal
    
    # Create isolated DB session for background task
    async with AsyncSessionLocal() as db:
        try:
            # Fetch Session
            session_rec = await db.session.find_unique(where={"id": session_id})
            if not session_rec:
                return
                
            await db.session.update(
                where={"id": session_id},
                data={"status": "running"}
            )
            
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
            
            # Update Session Status
            await db.session.update(
                where={"id": session_id},
                data={
                    "status": "complete",
                    "confidence_score": final_output.get("confidence_score", 85.0),
                    "model_used": custom_settings.get("model", "gemini-3.5-flash"),
                    "completed_at": datetime.utcnow()
                }
            )
            
            # 1. Save Report
            report_data = final_output.get("final_report", {})
            await db.report.create(
                data={
                    "session_id": session_id,
                    "executive_summary": report_data.get("executive_summary", ""),
                    "full_markdown": report_data.get("full_markdown", ""),
                    "finding_count": len(final_output.get("findings", [])),
                    "source_count": len(final_output.get("findings", [])),
                    "debate_exchanges": Json({"critique": final_output.get("critic_critique", "")})
                }
            )
                
            # 3. Save Findings & Sources
            for f in final_output.get("findings", []):
                finding_id = str(uuid.uuid4())
                val_status = "high"
                for v in final_output.get("validation_results", []):
                    if v.get("claim") == f.get("claim"):
                        val_status = v.get("status", "high").lower()
                        
                await db.finding.create(
                    data={
                        "id": finding_id,
                        "session_id": session_id,
                        "claim_text": f.get("claim", ""),
                        "confidence_level": val_status,
                        "confidence_score": 90.0 if val_status == "high" else (60.0 if val_status == "medium" else 30.0),
                        "source_agent": f.get("source_agent", "Alpha")
                    }
                )
                
                # Save Source reference
                await db.source.create(
                    data={
                        "finding_id": finding_id,
                        "session_id": session_id,
                        "url": f.get("url", "#"),
                        "title": f.get("title", "Reference Source"),
                        "snippet": f.get("snippet", ""),
                        "domain": f.get("url", "").split("/")[2] if "//" in f.get("url", "") else "web"
                    }
                )

            print(f"[SWARM ENGINE] Session {session_id} completed successfully")
            
        except Exception as e:
            # Mark session as failed
            await db.session.update(
                where={"id": session_id},
                data={
                    "status": "failed",
                    "error_message": str(e)
                }
            )
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
    current_user: User = Depends(get_current_user),
    db: Prisma = Depends(get_db)
):
    """
    Submits a research query to initialize an intelligence session using Prisma.
    Verifies subscription usage parameters and triggers LangGraph swarm.
    """
    # Enforce Free Tier query caps
    if current_user.plan == "free":
        # Check today's query usage
        today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        sessions = await db.session.find_many(
            where={
                "user_id": current_user.id,
                "created_at": {"gte": today_start}
            }
        )
        if len(sessions) >= 3:
            raise HTTPException(
                status_code=status.HTTP_402_PAYMENT_REQUIRED,
                detail="Free Tier usage cap reached (3 queries/day). Please upgrade to NEXUS PRO."
            )

    query_id = str(uuid.uuid4())
    new_session = await db.session.create(
        data={
            "id": query_id,
            "user_id": current_user.id,
            "query_text": payload.query,
            "status": "pending",
        }
    )
    
    # Launch Swarm executor in background task thread
    custom_cfg = {
        "model": payload.settings.model if current_user.plan == "pro" else "gemini-3.5-flash",
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
        created_at=new_session.created_at
    )

@app.get("/sessions/{session_id}", tags=["Sessions"])
async def get_session(
    session_id: str,
    current_user: User = Depends(get_current_user),
    db: Prisma = Depends(get_db)
):
    """
    Returns the current execution state, findings, and complete reports
    of a particular agent swarm session using Prisma's nested includes.
    """
    session_rec = await db.session.find_first(
        where={
            "id": session_id,
            "user_id": current_user.id
        },
        include={
            "report": True,
            "findings": True,
            "sources": True
        }
    )
    
    if not session_rec:
        raise HTTPException(status_code=404, detail="Session not found")
        
    # Retrieve agent logs using nested relations
    runs = await db.agentrun.find_many(
        where={"session_id": session_id},
        include={"events": True}
    )
    
    agent_logs = []
    for r in runs:
        for e in r.events or []:
            agent_logs.append({
                "timestamp": e.created_at.isoformat(),
                "agent": r.agent_name,
                "message": e.message,
                "data": e.event_data
            })
            
    return {
        "session_id": str(session_rec.id),
        "query_text": session_rec.query_text,
        "status": session_rec.status,
        "confidence_score": float(session_rec.confidence_score) if session_rec.confidence_score else 0.0,
        "created_at": session_rec.created_at,
        "report": {
            "full_markdown": session_rec.report.full_markdown if session_rec.report else "",
            "executive_summary": session_rec.report.executive_summary if session_rec.report else ""
        } if session_rec.report else None,
        "findings": [{
            "claim": f.claim_text,
            "status": f.confidence_level,
            "agent": f.source_agent
        } for f in session_rec.findings or []],
        "sources": [{
            "title": s.title,
            "url": s.url,
            "domain": s.domain,
            "snippet": s.snippet
        } for s in session_rec.sources or []],
        "agent_events": sorted(agent_logs, key=lambda x: x["timestamp"])
    }

@app.get("/sessions", tags=["Sessions"])
async def list_sessions(
    current_user: User = Depends(get_current_user),
    db: Prisma = Depends(get_db)
):
    """Returns a list of all historical runs of the authenticated user."""
    sessions = await db.session.find_many(
        where={"user_id": current_user.id},
        order={"created_at": "desc"}
    )
    return [{
        "session_id": str(s.id),
        "query_text": s.query_text,
        "status": s.status,
        "confidence_score": float(s.confidence_score) if s.confidence_score else 0.0,
        "created_at": s.created_at
    } for s in sessions]

# Real-Time SSE Stream Endpoint
@app.get("/sessions/{session_id}/stream", tags=["Sessions"])
async def stream_session_events(
    session_id: str
):
    """
    Server-Sent Events (SSE) endpoint to stream active swarm progress
    and agent node logs to the client in real-time.
    Validates UUID query formatting and executes queries inside isolated connections.
    """
    # Pre-validate UUID syntax to prevent database driver driver crashes
    try:
        uuid.UUID(session_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Session ID must be a valid UUID formatting string."
        )

    async def event_generator():
        from app.db.session import AsyncSessionLocal
        last_event_count = 0
        
        while True:
            try:
                # Open isolated DB connection inside each loop tick to avoid dependency context closing
                async with AsyncSessionLocal() as db:
                    session_rec = await db.session.find_unique(where={"id": session_id})
                    
                    if not session_rec:
                        yield f"data: {json.dumps({'error': 'Session not found'})}\n\n"
                        break
                        
                    runs = await db.agentrun.find_many(
                        where={"session_id": session_id},
                        include={"events": True}
                    )
                    
                    all_logs = []
                    for r in runs:
                        for e in r.events or []:
                            all_logs.append({
                                "timestamp": e.created_at.isoformat(),
                                "agent": r.agent_name,
                                "message": e.message,
                                "data": e.event_data
                            })
                            
                    sorted_logs = sorted(all_logs, key=lambda x: x["timestamp"])
                    
                    # Emit new logs
                    if len(sorted_logs) > last_event_count:
                        new_logs = sorted_logs[last_event_count:]
                        for log in new_logs:
                            yield f"data: {json.dumps({'type': 'log', 'event': log})}\n\n"
                        last_event_count = len(sorted_logs)
                        
                    if session_rec.status in ("complete", "failed"):
                        # Emit final state update
                        yield f"data: {json.dumps({'type': 'status', 'status': session_rec.status})}\n\n"
                        break
            except Exception as loop_err:
                print(f"[SSE LOOP EXCEPTION] {loop_err}")
                # Prevent connection crashing on temporary pooler drops
                pass
                
            await asyncio.sleep(1.0)
            
    # Set headers explicitly to avoid response buffering
    headers = {
        "Cache-Control": "no-cache, no-transform",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no"
    }
    return StreamingResponse(event_generator(), media_type="text/event-stream", headers=headers)
