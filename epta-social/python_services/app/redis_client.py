# redis_client.py
# Redis client setup for FastAPI to publish events to Node.js backend (Realtime layer)

import os
import json
import redis

REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
REDIS_PORT = int(os.getenv("REDIS_PORT", 6379))
REDIS_DB = int(os.getenv("REDIS_DB", 0))
REDIS_PASSWORD = os.getenv("REDIS_PASSWORD", None)

try:
    # Initialize connection
    redis_client = redis.Redis(
        host=REDIS_HOST,
        port=REDIS_PORT,
        db=REDIS_DB,
        password=REDIS_PASSWORD,
        decode_responses=True
    )
except Exception as e:
    print(f"[RE-CLIENT ERROR] Не удалось подключиться к Redis: {e}")
    redis_client = None

def publish_event(event_type: str, data: dict):
    """
    Publishes an event to Redis pub/sub. The Node.js layer is listening to
    the 'events:realtime' channel and will forward it to target websockets.
    """
    if not redis_client:
        print(f"[REDIS-PUB PREVIEW FALLBACK] Realtime event: {event_type}")
        return
        
    payload = {
        "type": event_type,
        "data": data
    }
    try:
        redis_client.publish("events:realtime", json.dumps(payload))
        print(f"[REDIS-PUB SUCCESS] Published {event_type} event to Redis.")
    except Exception as e:
        print(f"[REDIS-PUB ERROR] Ошибка публикации {event_type} в Redis: {e}")
