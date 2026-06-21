"""
llm_router.py — the fallback chain: Groq → Gemini → Ollama.

THE CORE IDEA
--------------
One function, route_completion(), is the ONLY way the rest of the
project ever talks to an LLM. Everything else (classify_turn.py)
calls this function and never touches Groq/Gemini/Ollama directly.

Why one function instead of calling each provider wherever needed?
Because if classify_turn.py called Groq directly, and Groq goes
down, classify_turn.py breaks. By routing everything through ONE
function, the fallback logic lives in exactly one place, and every
caller automatically benefits from it without knowing it exists.

REDIS CACHING
-------------
Before calling out to the expensive or rate-limited external APIs,
we check a local Redis cache. If we have seen this EXACT prompt 
before, we instantly return the cached JSON result, bypassing the APIs.
"""

import os
import json
import logging
import hashlib
from typing import Type, TypeVar

try:
    import redis
except ImportError:
    redis = None

from pydantic import BaseModel, ValidationError
from dotenv import load_dotenv

load_dotenv()  # reads a local .env file and loads keys into os.environ

logger = logging.getLogger("llm_router")
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")

T = TypeVar("T", bound=BaseModel)

# Redis Cache setup
REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379/0")
redis_client = None
if redis:
    try:
        redis_client = redis.from_url(REDIS_URL)
        redis_client.ping()
        logger.info(f"Connected to Redis cache at {REDIS_URL}")
    except Exception as e:
        logger.warning(f"Failed to connect to Redis cache at {REDIS_URL}: {e}")
        redis_client = None

# File Cache Fallback
if os.environ.get("VERCEL"):
    CACHE_FILE_PATH = "/tmp/llm_cache.json"
else:
    CACHE_FILE_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "llm_cache.json")

import threading
_cache_lock = threading.Lock()

def _read_local_cache() -> dict:
    if not os.path.exists(CACHE_FILE_PATH):
        # On Vercel, copy the packaged read-only template to /tmp on first read
        if os.environ.get("VERCEL"):
            package_cache_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "llm_cache.json")
            if os.path.exists(package_cache_path):
                try:
                    import shutil
                    os.makedirs(os.path.dirname(CACHE_FILE_PATH), exist_ok=True)
                    shutil.copyfile(package_cache_path, CACHE_FILE_PATH)
                    logger.info(f"Initialized writeable cache at {CACHE_FILE_PATH} from template.")
                except Exception as e:
                    logger.warning(f"Failed to copy package cache to /tmp: {e}")
                    # Fallback to reading the template directly
                    try:
                        with open(package_cache_path, "r", encoding="utf-8") as f:
                            return json.load(f)
                    except Exception:
                        return {}
            else:
                return {}
        else:
            return {}
            
    with _cache_lock:
        try:
            with open(CACHE_FILE_PATH, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            logger.warning(f"Failed to read local file cache: {e}")
            return {}

def _write_local_cache(data: dict):
    with _cache_lock:
        try:
            os.makedirs(os.path.dirname(CACHE_FILE_PATH), exist_ok=True)
            with open(CACHE_FILE_PATH, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2)
        except Exception as e:
            logger.warning(f"Failed to write local file cache: {e}")


# ─────────────────────────────────────────────────────────────────
# Individual provider calls
# ─────────────────────────────────────────────────────────────────

def _call_groq(prompt: str, schema: Type[T]) -> T:
    from groq import Groq

    api_key = os.environ.get("GROQ_API_KEY")
    if not api_key:
        raise RuntimeError("GROQ_API_KEY not set")

    client = Groq(api_key=api_key)
    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[
            {
                "role": "system",
                "content": (
                    "You respond ONLY with valid JSON matching the requested "
                    "schema. No prose, no markdown fences, just the JSON object."
                ),
            },
            {"role": "user", "content": prompt},
        ],
        response_format={"type": "json_object"},
        temperature=0.2,
    )
    raw = response.choices[0].message.content
    return schema.model_validate_json(raw)


def _call_gemini(prompt: str, schema: Type[T]) -> T:
    from google import genai
    from google.genai import types

    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY not set")

    client = genai.Client(api_key=api_key)
    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=prompt,
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            temperature=0.2,
        ),
    )
    return schema.model_validate_json(response.text)


def _call_ollama(prompt: str, schema: Type[T]) -> T:
    from ollama import Client

    model_name = os.environ.get("OLLAMA_MODEL", "llama3")
    ollama_host = os.environ.get("OLLAMA_HOST", "http://127.0.0.1:11434")
    
    client = Client(host=ollama_host)
    
    full_prompt = (
        f"{prompt}\n\n"
        "Respond ONLY with a valid JSON object matching the schema described "
        "above. No prose before or after, no markdown code fences."
    )
    response = client.generate(model=model_name, prompt=full_prompt)
    raw_text = response["response"].strip()

    if raw_text.startswith("```"):
        raw_text = raw_text.strip("`")
        if raw_text.startswith("json"):
            raw_text = raw_text[4:]
        raw_text = raw_text.strip()

    return schema.model_validate_json(raw_text)


# ─────────────────────────────────────────────────────────────────
# The router itself
# ─────────────────────────────────────────────────────────────────

PROVIDER_CHAIN = [
    ("groq", _call_groq),
    ("gemini", _call_gemini),
    ("ollama", _call_ollama),
]


# Global set to track providers that have exhausted their quota
DISABLED_PROVIDERS = set()

def route_completion(prompt: str, schema: Type[T]) -> tuple[T, str]:
    """
    Checks cache first. If cache miss, tries each provider in order.
    Return as soon as one succeeds, and caches the result.
    If a provider hits a rate limit, it is permanently skipped for future calls.
    """
    global DISABLED_PROVIDERS
    import time
    
    prompt_hash = hashlib.sha256(prompt.encode("utf-8")).hexdigest()
    cache_key = f"llm_cache:{schema.__name__}:{prompt_hash}"
    
    # 1. Check Redis Cache
    if redis_client:
        try:
            cached_raw = redis_client.get(cache_key)
            if cached_raw:
                result = schema.model_validate_json(cached_raw)
                logger.info("route_completion succeeded via 'cache'")
                return result, "cache"
        except Exception as e:
            logger.warning(f"Redis cache read error: {e}")
    else:
        # Fallback to local file cache
        local_cache = _read_local_cache()
        if cache_key in local_cache:
            try:
                result = schema.model_validate_json(local_cache[cache_key])
                logger.info("route_completion succeeded via 'local_file_cache'")
                return result, "cache"
            except Exception as e:
                logger.warning(f"Local file cache parsing error: {e}")

    # 2. Cache miss -> Fallback Chain
    failures = []
    for provider_name, provider_fn in PROVIDER_CHAIN:
        if provider_name in DISABLED_PROVIDERS:
            failures.append(f"{provider_name} skipped (previously disabled due to rate limits).")
            continue
            
        try:
            # Sleep 3 seconds on cache miss to avoid API rate limits
            logger.info(f"Cache miss. Sleeping 3s before calling {provider_name} API to prevent rate limits...")
            time.sleep(3)
            
            result = provider_fn(prompt, schema)
            logger.info(f"route_completion succeeded via '{provider_name}'")
            
            # 3. Save to Cache
            if redis_client:
                try:
                    redis_client.set(cache_key, result.model_dump_json())
                except Exception as e:
                    logger.warning(f"Redis cache write error: {e}")
            else:
                try:
                    local_cache = _read_local_cache()
                    local_cache[cache_key] = result.model_dump_json()
                    _write_local_cache(local_cache)
                except Exception as e:
                    logger.warning(f"Local file cache write error: {e}")

            return result, provider_name
        except Exception as e:
            error_str = str(e)
            reason = f"{provider_name} failed: {type(e).__name__}: {error_str}"
            logger.warning(reason)
            failures.append(reason)
            
            # If the error is a rate limit or quota exhaustion, disable the provider permanently
            if "429" in error_str or "RateLimitError" in type(e).__name__ or "RESOURCE_EXHAUSTED" in error_str:
                logger.warning(f"CIRCUIT BREAKER: {provider_name} has hit its quota and will be skipped for all future requests in this run.")
                DISABLED_PROVIDERS.add(provider_name)
                
            continue

    raise RuntimeError(
        "All providers in the fallback chain failed:\n" + "\n".join(failures)
    )


# ─────────────────────────────────────────────────────────────────
# Self-test
# ─────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    class Echo(BaseModel):
        reply: str

    test_prompt = 'Respond with JSON: {"reply": "pong"} — exactly that, nothing else.'

    try:
        result, provider = route_completion(test_prompt, Echo)
        print(f"\n✓ Router succeeded via '{provider}'")
        print(f"✓ Parsed result: {result}")
        
        # Test Cache hit
        print("\nTesting cache hit...")
        result2, provider2 = route_completion(test_prompt, Echo)
        print(f"✓ Router succeeded via '{provider2}'")
    except RuntimeError as e:
        print(f"\n✗ Router exhausted all providers:\n{e}")
