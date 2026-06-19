import asyncio
import os
import sys
from dotenv import load_dotenv

# Add backend directory to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

load_dotenv()

from app.agents.swarm import build_swarm_graph

async def main():
    graph = build_swarm_graph()
    
    initial_state = {
        "query": "Should a B2B SaaS startup target Indian SMEs in 2026?",
        "domain": "Business",
        "language": "English",
        "custom_settings": {
            "model": "gemini-3.5-flash",
            "search_depth": 3,
            "planner_temp": 0.2,
            "critic_temp": 0.7
        },
        "planner_plan": [],
        "findings": [],
        "critic_critique": None,
        "validation_results": [],
        "confidence_score": 0.0,
        "final_report": {},
        "current_step": "Test run",
        "logs": []
    }
    
    print("[TEST] Running swarm graph...")
    try:
        result = await graph.ainvoke(initial_state)
        print("[TEST] Run completed successfully!")
        print("Final Report Summary:", result.get("final_report", {}).get("executive_summary", ""))
    except Exception as e:
        import traceback
        print("[TEST] Run failed!")
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(main())
