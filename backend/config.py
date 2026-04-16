"""Environment loading, validation, and database connection helpers."""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

import psycopg2
from dotenv import load_dotenv

_BACKEND_ROOT = Path(__file__).resolve().parent


@dataclass(frozen=True)
class Settings:
    """Validated application settings loaded from the environment."""

    database_url: str


def load_dotenv_for_local() -> None:
    """Load backend/.env when present; never overrides existing process env (production-safe)."""
    load_dotenv(_BACKEND_ROOT / ".env", override=False)


def _require_database_url() -> str:
    raw = os.environ.get("DATABASE_URL")
    if raw is None:
        raise ValueError(
            "DATABASE_URL is not configured. "
            "For local development, add DATABASE_URL to backend/.env (loaded automatically via python-dotenv) "
            "or export it in your shell. "
            "In production, set DATABASE_URL in your host or orchestrator's environment or secrets store. "
            "Use a PostgreSQL URI (for example: postgresql://user:password@host:5432/database)."
        )
    url = raw.strip()
    if not url:
        raise ValueError(
            "DATABASE_URL is set but empty after trimming whitespace. "
            "Unset it or provide a complete PostgreSQL connection URI."
        )
    return url


def load_settings() -> Settings:
    """Load dotenv files, then read and validate required settings."""
    load_dotenv_for_local()
    return Settings(database_url=_require_database_url())


def describe_db_connect_failure(exc: BaseException) -> str:
    """Return a concise, operator-facing explanation for a failed DB connection."""
    text = str(exc).strip().lower()

    if isinstance(exc, psycopg2.OperationalError):
        if "password authentication failed" in text or "authentication failed" in text:
            return (
                "Database authentication failed. Check the username and password in DATABASE_URL. "
                "If you use a managed provider, confirm the user exists and credentials were rotated."
            )
        if "could not translate host name" in text or "name or service not known" in text:
            return (
                "Could not resolve the database hostname. Verify the host in DATABASE_URL (typos, DNS, or VPN). "
                "This is usually a configuration or network naming issue, not application code."
            )
        if "connection refused" in text:
            return (
                "Connection refused by the database host or port. "
                "Confirm the host and port, that PostgreSQL is listening, and that firewalls or security groups allow access."
            )
        if "timeout" in text or "timed out" in text:
            return (
                "Database connection timed out. The host may be unreachable, overloaded, or blocked by a firewall. "
                "If you use a serverless pooler (for example Supabase pooler), ensure the URI targets the correct endpoint."
            )
        if "ssl" in text or "tls" in text or "certificate" in text:
            return (
                "TLS/SSL negotiation with the database failed. "
                "Review sslmode and certificate settings in DATABASE_URL and your provider's documentation."
            )
        if "too many connections" in text:
            return (
                "The database rejected the connection because the server connection limit was reached. "
                "Reduce client concurrency or use a connection pooler."
            )
        return (
            "Could not open a connection to PostgreSQL (operational error). "
            "Verify DATABASE_URL, network reachability, credentials, and pooler settings. "
            f"Provider message: {exc}"
        )

    if isinstance(exc, psycopg2.InterfaceError):
        return f"Database driver interface error: {exc}"

    return f"Unexpected error while connecting to the database: {exc}"


def connect_postgres(database_url: str, *, connect_timeout: int = 10):
    """Open a psycopg2 connection with a bounded wait and a clear error on failure."""
    try:
        return psycopg2.connect(database_url, connect_timeout=connect_timeout)
    except psycopg2.Error as e:
        raise ConnectionError(describe_db_connect_failure(e)) from e


def check_db_connection(database_url: str, *, connect_timeout: int = 5) -> tuple[bool, str | None]:
    """Return (True, None) if a simple query succeeds; otherwise (False, explanation)."""
    conn = None
    try:
        conn = psycopg2.connect(database_url, connect_timeout=connect_timeout)
        with conn.cursor() as cur:
            cur.execute("SELECT 1")
        return True, None
    except psycopg2.Error as e:
        return False, describe_db_connect_failure(e)
    finally:
        if conn is not None:
            conn.close()


settings: Settings | None
settings_load_error: str | None

try:
    settings = load_settings()
    settings_load_error = None
except ValueError as e:
    settings = None
    settings_load_error = str(e)


def get_connection():
    """Return a new PostgreSQL connection using the validated DATABASE_URL."""
    if settings is None:
        raise ConnectionError(
            settings_load_error
            or "DATABASE_URL is not configured. Set DATABASE_URL in the environment or backend/.env."
        )
    return connect_postgres(settings.database_url)
