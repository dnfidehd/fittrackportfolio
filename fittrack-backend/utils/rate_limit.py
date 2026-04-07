from __future__ import annotations

from collections import defaultdict, deque
from threading import Lock
from time import time

from fastapi import HTTPException, Request, status


_RATE_LIMIT_STORAGE: dict[str, deque[float]] = defaultdict(deque)
_RATE_LIMIT_LOCK = Lock()
_FAILED_ATTEMPT_STORAGE: dict[str, deque[float]] = defaultdict(deque)
_FAILED_BLOCK_UNTIL: dict[str, float] = {}


def resolve_client_ip(request: Request) -> str:
    forwarded_for = request.headers.get("x-forwarded-for", "").strip()
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()
    if request.client and request.client.host:
        return request.client.host
    return "unknown"


def clear_rate_limit_storage() -> None:
    with _RATE_LIMIT_LOCK:
        _RATE_LIMIT_STORAGE.clear()
        _FAILED_ATTEMPT_STORAGE.clear()
        _FAILED_BLOCK_UNTIL.clear()


def check_rate_limit(request: Request, scope: str, limit: int, window_seconds: int) -> None:
    client_ip = resolve_client_ip(request)
    now = time()
    bucket_key = f"{scope}:{client_ip}"

    with _RATE_LIMIT_LOCK:
        attempts = _RATE_LIMIT_STORAGE[bucket_key]

        while attempts and now - attempts[0] > window_seconds:
            attempts.popleft()

        if len(attempts) >= limit:
            retry_after = max(1, int(window_seconds - (now - attempts[0])))
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"요청이 너무 많습니다. 잠시 후 다시 시도해주세요. ({retry_after}초 후)",
                headers={"Retry-After": str(retry_after)},
            )

        attempts.append(now)


def check_failed_attempt_lock(request: Request, scope: str) -> None:
    client_ip = resolve_client_ip(request)
    now = time()
    bucket_key = f"{scope}:{client_ip}"

    with _RATE_LIMIT_LOCK:
        blocked_until = _FAILED_BLOCK_UNTIL.get(bucket_key)
        if blocked_until and blocked_until > now:
            retry_after = max(1, int(blocked_until - now))
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"인증 시도가 잠시 제한되었습니다. {retry_after}초 후 다시 시도해주세요.",
                headers={"Retry-After": str(retry_after)},
            )

        if blocked_until and blocked_until <= now:
            _FAILED_BLOCK_UNTIL.pop(bucket_key, None)


def register_failed_attempt(
    request: Request,
    scope: str,
    limit: int = 5,
    window_seconds: int = 600,
    block_seconds: int = 600,
) -> None:
    client_ip = resolve_client_ip(request)
    now = time()
    bucket_key = f"{scope}:{client_ip}"

    with _RATE_LIMIT_LOCK:
        attempts = _FAILED_ATTEMPT_STORAGE[bucket_key]

        while attempts and now - attempts[0] > window_seconds:
            attempts.popleft()

        attempts.append(now)

        if len(attempts) >= limit:
            _FAILED_BLOCK_UNTIL[bucket_key] = now + block_seconds


def reset_failed_attempts(request: Request, scope: str) -> None:
    client_ip = resolve_client_ip(request)
    bucket_key = f"{scope}:{client_ip}"

    with _RATE_LIMIT_LOCK:
        _FAILED_ATTEMPT_STORAGE.pop(bucket_key, None)
        _FAILED_BLOCK_UNTIL.pop(bucket_key, None)
