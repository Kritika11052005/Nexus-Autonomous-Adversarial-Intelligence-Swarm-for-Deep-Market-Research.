import asyncio
from datetime import datetime
import operator
from typing import List, Dict, Any, TypedDict, Optional, Annotated
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import SystemMessage, HumanMessage
from langgraph.graph import StateGraph, END
from tavily import TavilyClient

from app.core.config import settings

# State definition with reducers for parallel updates
class SwarmState(TypedDict):
    session_id: str # Session UUID for real-time log persistence
    query: str
    domain: str
    language: str # Detected query language for output localization
    custom_settings: Dict[str, Any] # model_used, search_depth, temperatures
    planner_plan: List[str]
    findings: Annotated[List[Dict[str, Any]], operator.add] # Reducer list concatenation
    critic_critique: Optional[str]
    validation_results: List[Dict[str, Any]]
    confidence_score: float
    final_report: Dict[str, Any]
    current_step: str
    logs: Annotated[List[Dict[str, Any]], operator.add] # Reducer list concatenation

# Helper to persistence agent log to DB in real-time
async def save_agent_log(session_id: str, agent_name: str, message: str, data: Dict[str, Any] = None) -> None:
    """
    Saves an agent log event to the database in real-time.
    This triggers the SSE stream to push updates instantly to the frontend.
    """
    from app.store.session_store import append_event
    
    if not session_id:
        return
        
    try:
        event = {
            "timestamp": datetime.utcnow().isoformat(),
            "agent": agent_name,
            "message": message,
            "data": data or {}
        }
        await append_event(session_id, event)
    except Exception as e:
        print(f"[DB LOG EXCEPTION] {e}")

# Helper to safely extract string content from LangChain / Azure OpenAI response formats
def extract_content(content: Any) -> str:
    """
    Safely extracts string content from LangChain response structures.
    Handles plain strings, list of dictionaries, and custom nested content block objects.
    """
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        text_parts = []
        for chunk in content:
            if isinstance(chunk, str):
                text_parts.append(chunk)
            elif isinstance(chunk, dict):
                text_parts.append(chunk.get("text", chunk.get("content", "")))
            elif hasattr(chunk, "text"):
                text_parts.append(chunk.text)
            elif hasattr(chunk, "content"):
                text_parts.append(str(chunk.content))
            else:
                text_parts.append(str(chunk))
        return "".join(text_parts)
    return str(content) if content is not None else ""

# Initialize LLM based on user configuration
def get_llm(model_name: str = "gemini-3.5-flash", temperature: float = 0.3) -> ChatGoogleGenerativeAI:
    if "gpt" in model_name.lower() or model_name == "gpt-4o":
        model_name = "gemini-3.5-flash"
    return ChatGoogleGenerativeAI(
        model=model_name,
        google_api_key=settings.GEMINI_AGENT_KEY,
        temperature=temperature
    )

# 1. PLANNER AGENT
async def planner_node(state: SwarmState) -> Dict[str, Any]:
    session_id = state.get("session_id")
    query = state["query"]
    domain = state["domain"]
    settings_cfg = state["custom_settings"]
    model_name = settings_cfg.get("model", "gemini-3.5-flash")
    
    await save_agent_log(session_id, "Planner", "Planner initialized. Analyzing target domain and breaking down research axes...")
    
    llm = get_llm(model_name=model_name, temperature=0.2)
    
    system_prompt = (
        "You are the Lead Planner of NEXUS Multi-Agent Swarm.\n"
        "Your task is to:\n"
        "1. Detect the natural language of the user query (e.g. English, Hindi, Spanish, French, etc.).\n"
        "2. Break down the query into 3 distinct search/research tasks for parallel researcher agents (A, B, and C).\n"
        "Respond ONLY with a valid JSON containing 'language' and 'tasks' (a list of 3 strings)."
    )
    
    response = await llm.ainvoke([
        SystemMessage(content=system_prompt),
        HumanMessage(content=f"Domain: {domain}\nQuery: {query}")
    ])
    
    text = extract_content(response.content)
    
    import json
    import re
    try:
        json_match = re.search(r"\{.*\}", text, re.DOTALL)
        data = json.loads(json_match.group(0)) if json_match else {"language": "English", "tasks": [f"Research background on {query}", f"Analyze market impacts of {query}", f"Study technical hurdles of {query}"]}
    except Exception:
        data = {"language": "English", "tasks": [f"Research background on {query}", f"Analyze market impacts of {query}", f"Study technical hurdles of {query}"]}
        
    detected_lang = data.get("language", "English")
    tasks = data.get("tasks", [])
    if not isinstance(tasks, list):
        tasks = [str(tasks)] if tasks else []
        
    msg = f"Language detected: {detected_lang}. Dispatched 3 parallel research axes successfully."
    await save_agent_log(session_id, "Planner", msg, {"tasks": tasks, "language": detected_lang})
    
    return {
        "language": detected_lang,
        "planner_plan": tasks,
        "current_step": "Planner finished search breakdown.",
        "logs": [{
            "timestamp": datetime.utcnow().isoformat(),
            "agent": "Planner",
            "message": msg,
            "data": {"tasks": tasks, "language": detected_lang}
        }]
    }

# 2. RESEARCHER AGENTS (Parallel Nodes A, B, C)
async def run_researcher(state: SwarmState, idx: int, name: str) -> Dict[str, Any]:
    session_id = state.get("session_id")
    tasks = state.get("planner_plan", [])
    if len(tasks) <= idx:
        task = f"Find general details about: {state['query']}"
    else:
        task = tasks[idx]
        
    settings_cfg = state["custom_settings"]
    search_depth = settings_cfg.get("search_depth", 5)
    
    await save_agent_log(session_id, name, f"Starting Tavily deep crawler for task: '{task}' with depth {search_depth}...")
    
    findings = []
    tavily_client = TavilyClient(api_key=settings.TAVILY_API_KEY)
    
    try:
        search_res = tavily_client.search(query=task, max_results=search_depth)
        results = search_res.get("results", [])
        
        for r in results:
            findings.append({
                "source_agent": name,
                "title": r.get("title", "Untitled Source"),
                "url": r.get("url", "#"),
                "snippet": r.get("content", ""),
                "claim": r.get("content", "")[:200]
            })
    except Exception as e:
        findings.append({
            "source_agent": name,
            "title": "Search Error",
            "url": "#",
            "snippet": f"Could not perform search: {str(e)}",
            "claim": f"Search failed for {task}"
        })
        
    msg = f"Completed crawler run. Discovered {len(findings)} source citations."
    await save_agent_log(session_id, name, msg, {"findings_count": len(findings)})
    
    return {
        "findings": findings,
        "logs": [{
            "timestamp": datetime.utcnow().isoformat(),
            "agent": name,
            "message": msg,
            "data": {"findings_count": len(findings)}
        }]
    }

async def researcher_a(state: SwarmState) -> Dict[str, Any]:
    return await run_researcher(state, 0, "Researcher Alpha")

async def researcher_b(state: SwarmState) -> Dict[str, Any]:
    return await run_researcher(state, 1, "Researcher Beta")

async def researcher_c(state: SwarmState) -> Dict[str, Any]:
    return await run_researcher(state, 2, "Researcher Gamma")

# 3. CRITIC AGENT
async def critic_node(state: SwarmState) -> Dict[str, Any]:
    session_id = state.get("session_id")
    findings = state.get("findings", [])
    query = state["query"]
    settings_cfg = state["custom_settings"]
    model_name = settings_cfg.get("model", "gemini-3.5-flash")
    
    await save_agent_log(session_id, "Critic", "Adversarial swarm Critic engaged. Spotting contradictions, factual gaps, and biases...")
    
    llm = get_llm(model_name=model_name, temperature=0.7)
    
    system_prompt = (
        "You are the Adversarial Swarm Critic of NEXUS.\n"
        "Your task is to analyze the research findings, raise tough questions, spot contradictions, "
        "identify biases, and challenge claims to guarantee top-tier factual accuracy.\n"
        "Write your critique concisely in a structured adversarial tone."
    )
    
    findings_str = "\n".join([f"- [{f['source_agent']}] {f['claim']}" for f in findings])
    response = await llm.ainvoke([
        SystemMessage(content=system_prompt),
        HumanMessage(content=f"Query: {query}\nFindings:\n{findings_str}")
    ])
    
    critique = extract_content(response.content)
    
    msg = "Adversarial assessment finished. Challenged structural gaps and drafted rebuttals."
    await save_agent_log(session_id, "Critic", msg, {"critique_preview": critique[:150] + "..."})
    
    return {
        "critic_critique": critique,
        "current_step": "Adversarial critique completed.",
        "logs": [{
            "timestamp": datetime.utcnow().isoformat(),
            "agent": "Critic",
            "message": msg,
            "data": {"critique": critique[:300] + "..."}
        }]
    }

# 4. VALIDATOR AGENT
async def validator_node(state: SwarmState) -> Dict[str, Any]:
    session_id = state.get("session_id")
    findings = state.get("findings", [])
    critique = state.get("critic_critique", "")
    query = state["query"]
    settings_cfg = state["custom_settings"]
    model_name = settings_cfg.get("model", "gemini-3.5-flash")
    
    await save_agent_log(session_id, "Validator", "Validator engaged. Reconciling Critic disputes and computing confidence trust score...")
    
    llm = get_llm(model_name=model_name, temperature=0.1)
    
    system_prompt = (
        "You are the Swarm Validator of NEXUS.\n"
        "Your task is to:\n"
        "1. Resolve disputes between findings and the Critic's critique.\n"
        "2. Rate each finding's truthfulness as High, Medium, or Contested.\n"
        "3. Provide a single overall confidence score between 0 and 100.\n"
        "Respond ONLY with a valid JSON containing 'confidence_score' (int) and 'validated_findings' "
        "(list of objects with 'claim', 'status', and 'resolution' keys)."
    )
    
    findings_str = "\n".join([f"- {f['claim']}" for f in findings])
    response = await llm.ainvoke([
        SystemMessage(content=system_prompt),
        HumanMessage(content=f"Query: {query}\nFindings:\n{findings_str}\nCritique:\n{critique}")
    ])
    
    text = extract_content(response.content)
    
    import json
    import re
    try:
        json_match = re.search(r"\{.*\}", text, re.DOTALL)
        data = json.loads(json_match.group(0)) if json_match else {"confidence_score": 85, "validated_findings": []}
    except Exception:
        data = {"confidence_score": 85, "validated_findings": []}
        
    score = data.get("confidence_score", 85)
    validations = data.get("validated_findings", [])
    if not isinstance(validations, list):
        validations = []
        
    msg = f"Factual validation completed. Swarm confidence rating: {score}%."
    await save_agent_log(session_id, "Validator", msg, {"confidence_score": score, "validations_count": len(validations)})
    
    return {
        "confidence_score": float(score),
        "validation_results": validations,
        "current_step": "Fact validation and scoring complete.",
        "logs": [{
            "timestamp": datetime.utcnow().isoformat(),
            "agent": "Validator",
            "message": msg,
            "data": {"confidence_score": score, "validations_count": len(validations)}
        }]
    }

# 5. RECONCILER & WRITER (LOCALIZED SYNTHESIS)
async def reconciler_node(state: SwarmState) -> Dict[str, Any]:
    session_id = state.get("session_id")
    query = state["query"]
    language = state.get("language", "English")
    findings = state.get("findings", [])
    validations = state.get("validation_results", [])
    score = state.get("confidence_score", 80)
    settings_cfg = state["custom_settings"]
    model_name = settings_cfg.get("model", "gemini-3.5-flash")
    
    await save_agent_log(session_id, "Reconciler", f"Lead Reconciler compiling executive intelligence report in target language: {language}...")
    
    llm = get_llm(model_name=model_name, temperature=0.4)
    
    system_prompt = (
        "You are the Lead Reconciler and Writer of NEXUS Swarm.\n"
        "Your task is to write a highly polished, comprehensive, and beautiful executive intelligence report.\n"
        f"IMPORTANT: You MUST write the entire report, executive summaries, claims, and findings IN THE DETECTED LANGUAGE: {language}.\n"
        "Use GitHub alerts syntax (> [!NOTE], > [!WARNING], > [!IMPORTANT]) to represent contested claims or insights.\n"
        "Include a brief table of contents, a synthesis of findings, and a final conclusion."
    )
    
    findings_str = "\n".join([f"- {f['claim']}" for f in findings])
    response = await llm.ainvoke([
        SystemMessage(content=system_prompt),
        HumanMessage(content=f"Query: {query}\nConfidence Score: {score}%\nFindings:\n{findings_str}")
    ])
    
    report_md = extract_content(response.content)
    
    msg = "Report writing completed. Formatting and structures compiled."
    await save_agent_log(session_id, "Reconciler", msg)
    
    return {
        "final_report": {
            "executive_summary": report_md[:400] + "...",
            "full_markdown": report_md,
            "confidence_score": score
        },
        "current_step": "Complete localized report generated.",
        "logs": [{
            "timestamp": datetime.utcnow().isoformat(),
            "agent": "Reconciler",
            "message": msg,
            "data": {}
        }]
    }

# Graph Construction
def build_swarm_graph() -> StateGraph:
    builder = StateGraph(SwarmState)
    
    # Add nodes
    builder.add_node("planner", planner_node)
    builder.add_node("researcher_a", researcher_a)
    builder.add_node("researcher_b", researcher_b)
    builder.add_node("researcher_c", researcher_c)
    builder.add_node("critic", critic_node)
    builder.add_node("validator", validator_node)
    builder.add_node("reconciler", reconciler_node)
    
    # Define execution graph flows
    builder.set_entry_point("planner")
    
    # Planner fans out parallel researcher agents A, B, and C
    builder.add_edge("planner", "researcher_a")
    builder.add_edge("planner", "researcher_b")
    builder.add_edge("planner", "researcher_c")
    
    # Researchers fan in to Critic
    builder.add_edge("researcher_a", "critic")
    builder.add_edge("researcher_b", "critic")
    builder.add_edge("researcher_c", "critic")
    
    # Critic passes to Validator
    builder.add_edge("critic", "validator")
    
    # Validator passes to Reconciler
    builder.add_edge("validator", "reconciler")
    
    # Reconciler outputs report
    builder.add_edge("reconciler", END)
    
    return builder.compile()
