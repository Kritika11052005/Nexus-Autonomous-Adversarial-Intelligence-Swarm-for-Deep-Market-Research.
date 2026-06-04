import time
import asyncio
from typing import Optional, Dict, List
from fastapi import HTTPException, status, Depends
import redis.asyncio as aioredis
from app.core.config import settings
from app.api.deps import get_current_user
from prisma.models import User

class RateLimiter:
    def __init__(self):
        self.redis_client: Optional[aioredis.Redis] = None
        self.redis_available = False
        self.in_memory_store: Dict[str, List[float]] = {}
        self.lock = asyncio.Lock()
        
        # Initialize connection
        if settings.REDIS_URL:
            try:
                self.redis_client = aioredis.from_url(
                    settings.REDIS_URL, 
                    encoding="utf-8", 
                    decode_responses=True,
                    socket_connect_timeout=2.0
                )
                self.redis_available = True
            except Exception as e:
                print(f"[RateLimiter] Redis not available, falling back to memory: {e}")
                self.redis_available = False

    async def _check_redis(self) -> bool:
        if not self.redis_available or not self.redis_client:
            return False
        try:
            # Quick ping to verify active connection
            await self.redis_client.ping()
            return True
        except Exception:
            self.redis_available = False
            return False

    async def check_rate_limit(self, user_id: str, rate_type: str, max_requests: int, window_seconds: int):
        now = time.time()
        key = f"rate_limit:{rate_type}:{user_id}"
        
        # 1. Try Redis sliding window rate limiter
        if await self._check_redis():
            try:
                clear_before = now - window_seconds
                pipe = self.redis_client.pipeline()
                # Remove expired requests
                pipe.zremrangebyscore(key, 0, clear_before)
                # Count remaining requests in window
                pipe.zcard(key)
                # Add current request timestamp
                pipe.zadd(key, {str(now): now})
                # Set TTL on key to avoid leaks
                pipe.expire(key, window_seconds)
                
                results = await pipe.execute()
                current_requests = results[1]
                
                if current_requests >= max_requests:
                    raise HTTPException(
                        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                        detail={
                            "error": "Rate limit exceeded",
                            "limit": max_requests,
                            "window_seconds": window_seconds,
                            "message": f"Too many requests for {rate_type}. Please try again later."
                        }
                    )
                return
            except HTTPException:
                raise
            except Exception as e:
                print(f"[RateLimiter] Redis command failed, falling back to memory: {e}")
                self.redis_available = False

        # 2. In-memory sliding window rate limiter fallback
        async with self.lock:
            if key not in self.in_memory_store:
                self.in_memory_store[key] = []
            
            # Filter timestamps
            timestamps = self.in_memory_store[key]
            filtered_timestamps = [t for t in timestamps if t > now - window_seconds]
            
            if len(filtered_timestamps) >= max_requests:
                self.in_memory_store[key] = filtered_timestamps  # Update to clean expired
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail={
                        "error": "Rate limit exceeded",
                        "limit": max_requests,
                        "window_seconds": window_seconds,
                        "message": f"Too many requests for {rate_type}. Please try again later."
                    }
                )
            
            filtered_timestamps.append(now)
            self.in_memory_store[key] = filtered_timestamps

# Single global rate limiter instance
limiter = RateLimiter()

def rate_limit(rate_type: str, max_requests: int, window_seconds: int):
    """
    FastAPI dependency factory for checking rate limits.
    """
    async def dependency(current_user: User = Depends(get_current_user)):
        await limiter.check_rate_limit(
            user_id=str(current_user.id),
            rate_type=rate_type,
            max_requests=max_requests,
            window_seconds=window_seconds
        )
        return current_user
    return dependency
