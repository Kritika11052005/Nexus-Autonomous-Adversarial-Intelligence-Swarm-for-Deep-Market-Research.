import os
import json
import uuid
import asyncpg
from typing import Dict, Any, List, Optional
from datetime import datetime
from app.core.config import settings

# Global pool variable
pool: Optional[asyncpg.Pool] = None

async def init_pool() -> None:
    """
    Initializes the asyncpg connection pool and creates the sessions table if it doesn't exist.
    """
    global pool
    database_url = settings.DATABASE_URL
    if not database_url:
        raise ValueError("DATABASE_URL settings variable is not set")
    
    # Check if we need SSL (Azure/Neon Postgres requires this)
    ssl_mode = None
    if "sslmode=require" in database_url:
        # Strip sslmode query parameter so asyncpg can parse the URL
        database_url = database_url.replace("sslmode=require&", "")
        database_url = database_url.replace("&sslmode=require", "")
        database_url = database_url.replace("sslmode=require", "")
        database_url = database_url.rstrip("?&")
        ssl_mode = "require"
        
    if ssl_mode:
        pool = await asyncpg.create_pool(dsn=database_url, ssl=ssl_mode)
    else:
        pool = await asyncpg.create_pool(dsn=database_url)
        
    # Create the sessions table if it doesn't exist
    async with pool.acquire() as conn:
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS swarm_sessions (
                query_id UUID PRIMARY KEY,
                query_text TEXT,
                status VARCHAR(20) DEFAULT 'pending',
                agent_events JSONB DEFAULT '[]',
                final_report JSONB,
                created_at TIMESTAMP DEFAULT now()
            );
        """)

async def close_pool() -> None:
    """
    Closes the connection pool on app shutdown.
    """
    global pool
    if pool:
        await pool.close()

async def get_session(query_id: str) -> Optional[Dict[str, Any]]:
    """
    Retrieves a session from the PostgreSQL sessions table.
    """
    global pool
    if not pool:
        raise RuntimeError("Database pool not initialized")
        
    try:
        q_id = uuid.UUID(query_id)
    except ValueError:
        return None
        
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT query_id, query_text, status, agent_events, final_report, created_at FROM swarm_sessions WHERE query_id = $1",
            q_id
        )
        if row:
            res = dict(row)
            # deserialize JSONB fields if they are returned as string (though asyncpg usually parses them to dict/list)
            if isinstance(res["agent_events"], str):
                res["agent_events"] = json.loads(res["agent_events"])
            if isinstance(res["final_report"], str):
                res["final_report"] = json.loads(res["final_report"])
            return res
        return None

async def set_session(query_id: str, data: Dict[str, Any]) -> None:
    """
    Upserts a session record to the PostgreSQL sessions table.
    """
    global pool
    if not pool:
        raise RuntimeError("Database pool not initialized")
        
    try:
        q_id = uuid.UUID(query_id)
    except ValueError:
        raise ValueError(f"Invalid UUID: {query_id}")
        
    status = data.get("status", "pending")
    query_text = data.get("query_text", "")
    agent_events = data.get("agent_events", [])
    final_report = data.get("final_report", None)
    
    # Serialize JSON
    agent_events_json = json.dumps(agent_events)
    final_report_json = json.dumps(final_report) if final_report is not None else None
    
    async with pool.acquire() as conn:
        await conn.execute(
            """
            INSERT INTO swarm_sessions (query_id, query_text, status, agent_events, final_report)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (query_id) DO UPDATE
            SET query_text = EXCLUDED.query_text,
                status = EXCLUDED.status,
                agent_events = EXCLUDED.agent_events,
                final_report = EXCLUDED.final_report
            """,
            q_id, query_text, status, agent_events_json, final_report_json
        )

async def append_event(query_id: str, event: Dict[str, Any]) -> None:
    """
    Appends an event to the agent_events JSONB array of the specified query_id.
    """
    global pool
    if not pool:
        raise RuntimeError("Database pool not initialized")
        
    try:
        q_id = uuid.UUID(query_id)
    except ValueError:
        raise ValueError(f"Invalid UUID: {query_id}")
        
    event_json = json.dumps(event)
    
    async with pool.acquire() as conn:
        await conn.execute(
            """
            UPDATE swarm_sessions
            SET agent_events = COALESCE(agent_events, '[]'::jsonb) || $2::jsonb
            WHERE query_id = $1
            """,
            q_id, event_json
        )

async def list_sessions() -> List[Dict[str, Any]]:
    """
    Retrieves all historical sessions from the PostgreSQL sessions table.
    """
    global pool
    if not pool:
        raise RuntimeError("Database pool not initialized")
        
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT query_id, query_text, status, final_report, created_at FROM swarm_sessions ORDER BY created_at DESC"
        )
        res_list = []
        for r in rows:
            res = dict(r)
            if isinstance(res["final_report"], str):
                res["final_report"] = json.loads(res["final_report"])
            res_list.append(res)
        return res_list
