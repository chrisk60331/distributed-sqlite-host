"""db-host FastAPI app."""

import logging
import os
import sys
import time
import traceback
from pathlib import Path

from dotenv import load_dotenv

_API_DIR = Path(__file__).resolve().parent
_REPO_ROOT = _API_DIR.parent
_RUNTIME_TRACE = _API_DIR / "runtime_trace.log"

load_dotenv(_REPO_ROOT / ".env")
load_dotenv(_API_DIR / ".env")

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from routers import admin, auth, byo_bucket, databases

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    handlers=[logging.StreamHandler(sys.stderr)],
)
logging.getLogger("httpcore").setLevel(logging.WARNING)
logging.getLogger("httpx").setLevel(logging.WARNING)
logger = logging.getLogger("db-host")


def _trace(line: str) -> None:
    """Append one line — survives wonky uvicorn/subshell logging."""
    stamp = time.strftime("%Y-%m-%dT%H:%M:%S", time.gmtime())
    with _RUNTIME_TRACE.open("a", encoding="utf-8") as f:
        f.write(f"{stamp}Z {line}\n")
        f.flush()
        os.fsync(f.fileno())


_trace(f"main loaded pid={os.getpid()} file={__file__}")

app = FastAPI(title="db-host API", version="0.1.0")

_origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    (os.getenv("FRONTEND_URL") or "").strip(),
]
allow_origins = [o for o in _origins if o]

# Next dev often uses Network URL (e.g. 192.168.x.x:3000); exact list misses those → no ACAO on any status.
_DEV_HTTP_PORT_3000 = r"^http://[^/]+:3000$"

app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_origin_regex=_DEV_HTTP_PORT_3000,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Keep errors inside app exception layer so CORSMiddleware still adds ACAO (ServerErrorMiddleware does not)."""
    _trace(f"handler {type(exc).__name__}: {exc}\n{traceback.format_exc().strip()}")
    logger.exception("Unhandled exception %s %s", request.method, request.url.path)
    return JSONResponse(status_code=500, content={"detail": str(exc)})


@app.middleware("http")
async def trace_requests(request: Request, call_next):
    _trace(f"in {request.method} {request.url.path}")
    logger.info("Incoming %s %s", request.method, request.url.path)
    try:
        response = await call_next(request)
        _trace(f"out {request.method} {request.url.path} -> {response.status_code}")
        logger.info(
            "Outgoing %s %s -> %s",
            request.method,
            request.url.path,
            response.status_code,
        )
        return response
    except Exception:
        _trace(
            f"exc {request.method} {request.url.path}\n{traceback.format_exc().strip()}"
        )
        logger.exception("Request failed")
        raise


app.include_router(auth.router)
app.include_router(databases.router)
app.include_router(byo_bucket.router)
app.include_router(admin.router)


@app.get("/health")
async def health() -> dict:
    return {"status": "ok"}
