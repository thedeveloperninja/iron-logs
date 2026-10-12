"""Small in-memory limiter for failed sign-in / sign-up attempts (per client IP).

Good enough for a single-process deployment. If you run several workers,
put a limiter in your reverse proxy as well.
"""
from __future__ import annotations

import threading
import time
from collections import defaultdict, deque

from fastapi import HTTPException, Request

from app.core.config import get_settings

WINDOW_SECONDS = 15 * 60
MAX_FAILURES = 10

_lock = threading.Lock()
_failures: dict[str, deque[float]] = defaultdict(deque)


def client_ip(request: Request) -> str:
    if get_settings().trust_proxy:
        fwd = request.headers.get("x-forwarded-for")
        if fwd:
            return fwd.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def check(ip: str) -> None:
    now = time.time()
    with _lock:
        q = _failures[ip]
        while q and now - q[0] > WINDOW_SECONDS:
            q.popleft()
        if len(q) >= MAX_FAILURES:
            raise HTTPException(429, "Too many failed attempts. Wait 15 minutes and try again.")


def fail(ip: str) -> None:
    with _lock:
        _failures[ip].append(time.time())


def clear(ip: str) -> None:
    with _lock:
        _failures.pop(ip, None)


def reset_all() -> None:
    with _lock:
        _failures.clear()
