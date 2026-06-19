import asyncio
import os
import sys
from dotenv import load_dotenv

# Load env variables from backend/.env
dotenv_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "backend", ".env")
load_dotenv(dotenv_path)

# Enable prisma debugging
os.environ["PRISMA_SHOW_ALL_LOGS"] = "true"
os.environ["DEBUG"] = "*"

async def test_prisma():
    from prisma import Prisma
    db = Prisma()
    try:
        print("Connecting to database...")
        await db.connect()
        print("Successfully connected!")
        # Run a simple query
        user_count = await db.user.count()
        print(f"User count: {user_count}")
    except Exception as e:
        print(f"\nConnection failed with error:\n{type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()
    finally:
        if db.is_connected():
            await db.disconnect()

asyncio.run(test_prisma())
