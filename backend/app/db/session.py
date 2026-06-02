import contextlib
from typing import AsyncGenerator
from prisma import Prisma

# Global Prisma Client instance
db = Prisma()

@contextlib.asynccontextmanager
async def AsyncSessionLocal():
    """
    Context manager yielding the active Prisma client.
    Maintains compatibility with 'async with AsyncSessionLocal() as db:' structures.
    """
    if not db.is_connected():
        await db.connect()
    try:
        yield db
    except Exception:
        raise

async def get_db() -> AsyncGenerator[Prisma, None]:
    """
    FastAPI dependency yielding the connected Prisma client.
    """
    if not db.is_connected():
        await db.connect()
    try:
        yield db
    finally:
        pass
