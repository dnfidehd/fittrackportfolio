from pathlib import Path
import sys

from fastapi import HTTPException
from starlette.requests import Request

sys.path.append(str(Path(__file__).resolve().parents[1]))

from utils.rate_limit import (
    check_failed_attempt_lock,
    check_rate_limit,
    clear_rate_limit_storage,
    register_failed_attempt,
    reset_failed_attempts,
    resolve_client_ip,
)


def make_request(headers: list[tuple[bytes, bytes]] | None = None, client_host: str = "127.0.0.1") -> Request:
    scope = {
        "type": "http",
        "method": "GET",
        "path": "/",
        "headers": headers or [],
        "client": (client_host, 12345),
    }
    return Request(scope)


def test_resolve_client_ip_prefers_forwarded_for() -> None:
    request = make_request(headers=[(b"x-forwarded-for", b"203.0.113.10, 10.0.0.1")], client_host="127.0.0.1")
    assert resolve_client_ip(request) == "203.0.113.10"


def test_check_rate_limit_allows_until_limit() -> None:
    clear_rate_limit_storage()
    request = make_request(client_host="198.51.100.9")

    for _ in range(3):
        check_rate_limit(request, scope="guest_verify", limit=3, window_seconds=60)


def test_check_rate_limit_blocks_after_limit() -> None:
    clear_rate_limit_storage()
    request = make_request(client_host="198.51.100.10")

    for _ in range(2):
        check_rate_limit(request, scope="guest_verify", limit=2, window_seconds=60)

    try:
        check_rate_limit(request, scope="guest_verify", limit=2, window_seconds=60)
        assert False, "Expected HTTPException"
    except HTTPException as exc:
        assert exc.status_code == 429
        assert "Retry-After" in exc.headers


def test_failed_attempt_lock_blocks_after_threshold() -> None:
    clear_rate_limit_storage()
    request = make_request(client_host="198.51.100.11")

    for _ in range(3):
        register_failed_attempt(request, scope="guest_verify_fail", limit=3, window_seconds=300, block_seconds=120)

    try:
        check_failed_attempt_lock(request, scope="guest_verify_fail")
        assert False, "Expected HTTPException"
    except HTTPException as exc:
        assert exc.status_code == 429
        assert "Retry-After" in exc.headers


def test_reset_failed_attempts_clears_guest_verify_lock() -> None:
    clear_rate_limit_storage()
    request = make_request(client_host="198.51.100.12")

    for _ in range(2):
        register_failed_attempt(request, scope="guest_verify_fail", limit=2, window_seconds=300, block_seconds=120)

    reset_failed_attempts(request, scope="guest_verify_fail")
    check_failed_attempt_lock(request, scope="guest_verify_fail")
