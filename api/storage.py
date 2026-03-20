"""Backboard-backed platform storage for users and databases."""

import json
import os
from typing import Optional

import bcrypt
from backboard import BackboardClient

from models import DatabaseRecord, UserRecord

_client: Optional[BackboardClient] = None
_assistant_id: Optional[str] = None

ASSISTANT_NAME = "db-host-storage"


def get_client() -> BackboardClient:
    global _client
    if _client is None:
        api_key = os.getenv("BACKBOARD_API_KEY")
        if not api_key:
            raise RuntimeError("BACKBOARD_API_KEY not set")
        _client = BackboardClient(api_key=api_key)
    return _client


async def get_assistant_id() -> str:
    global _assistant_id
    if _assistant_id:
        return _assistant_id

    # Prefer env var for fast lookup
    env_id = os.getenv("BACKBOARD_ASSISTANT_ID")
    if env_id:
        _assistant_id = env_id
        return _assistant_id

    client = get_client()
    assistants = await client.list_assistants()
    for a in assistants:
        if a.name == ASSISTANT_NAME:
            _assistant_id = a.assistant_id
            return _assistant_id

    assistant = await client.create_assistant(
        name=ASSISTANT_NAME,
        system_prompt="Platform storage for db-host. Stores user accounts and database records.",
    )
    _assistant_id = assistant.assistant_id
    return _assistant_id


# ── Users ──────────────────────────────────────────────────────────────────────

async def get_user_by_email(email: str) -> Optional[UserRecord]:
    client = get_client()
    aid = await get_assistant_id()
    all_memories = await client.get_memories(aid)
    for m in all_memories.memories:
        meta = m.metadata or {}
        if meta.get("type") == "user" and meta.get("email") == email:
            data = json.loads(m.content)
            return UserRecord(**data)
    return None


async def get_user_by_id(user_id: str) -> Optional[UserRecord]:
    client = get_client()
    aid = await get_assistant_id()
    all_memories = await client.get_memories(aid)
    for m in all_memories.memories:
        meta = m.metadata or {}
        if meta.get("type") == "user" and meta.get("user_id") == user_id:
            data = json.loads(m.content)
            return UserRecord(**data)
    return None


async def create_user(record: UserRecord) -> UserRecord:
    client = get_client()
    aid = await get_assistant_id()
    await client.add_memory(
        assistant_id=aid,
        content=record.model_dump_json(),
        metadata={
            "type": "user",
            "email": record.email,
            "user_id": record.user_id,
        },
    )
    return record


# ── Databases ──────────────────────────────────────────────────────────────────

async def list_databases_for_user(user_id: str) -> list[DatabaseRecord]:
    client = get_client()
    aid = await get_assistant_id()
    all_memories = await client.get_memories(aid)
    results = []
    for m in all_memories.memories:
        meta = m.metadata or {}
        if meta.get("type") == "database" and meta.get("user_id") == user_id:
            data = json.loads(m.content)
            results.append(DatabaseRecord(**data))
    results.sort(key=lambda r: r.created_at, reverse=True)
    return results


async def get_database(db_id: str, user_id: str) -> Optional[DatabaseRecord]:
    client = get_client()
    aid = await get_assistant_id()
    all_memories = await client.get_memories(aid)
    for m in all_memories.memories:
        meta = m.metadata or {}
        if (
            meta.get("type") == "database"
            and meta.get("db_id") == db_id
            and meta.get("user_id") == user_id
        ):
            data = json.loads(m.content)
            return DatabaseRecord(**data)
    return None


async def get_database_by_api_key(api_key: str) -> Optional[DatabaseRecord]:
    client = get_client()
    aid = await get_assistant_id()
    all_memories = await client.get_memories(aid)
    key_bytes = api_key.encode("utf-8")
    for m in all_memories.memories:
        meta = m.metadata or {}
        if meta.get("type") != "database":
            continue
        data = json.loads(m.content)
        rec = DatabaseRecord(**data)
        if not rec.api_key_hash:
            continue
        if bcrypt.checkpw(key_bytes, rec.api_key_hash.encode("utf-8")):
            return rec
    return None


async def create_database(record: DatabaseRecord) -> DatabaseRecord:
    client = get_client()
    aid = await get_assistant_id()
    await client.add_memory(
        assistant_id=aid,
        content=record.model_dump_json(),
        metadata={
            "type": "database",
            "db_id": record.db_id,
            "user_id": record.user_id,
            "name": record.name,
        },
    )
    return record


async def update_database_api_key_hash(
    db_id: str, user_id: str, api_key_hash: str
) -> Optional[DatabaseRecord]:
    client = get_client()
    aid = await get_assistant_id()
    all_memories = await client.get_memories(aid)
    for m in all_memories.memories:
        meta = m.metadata or {}
        if (
            meta.get("type") == "database"
            and meta.get("db_id") == db_id
            and meta.get("user_id") == user_id
        ):
            data = json.loads(m.content)
            rec = DatabaseRecord(**data)
            rec = rec.model_copy(update={"api_key_hash": api_key_hash})
            await client.delete_memory(assistant_id=aid, memory_id=m.id)
            await client.add_memory(
                assistant_id=aid,
                content=rec.model_dump_json(),
                metadata={
                    "type": "database",
                    "db_id": rec.db_id,
                    "user_id": rec.user_id,
                    "name": rec.name,
                },
            )
            return rec
    return None


async def delete_database(db_id: str, user_id: str) -> bool:
    client = get_client()
    aid = await get_assistant_id()
    all_memories = await client.get_memories(aid)
    for m in all_memories.memories:
        meta = m.metadata or {}
        if (
            meta.get("type") == "database"
            and meta.get("db_id") == db_id
            and meta.get("user_id") == user_id
        ):
            await client.delete_memory(assistant_id=aid, memory_id=m.id)
            return True
    return False


async def list_all_users() -> list[UserRecord]:
    client = get_client()
    aid = await get_assistant_id()
    all_memories = await client.get_memories(aid)
    results: list[UserRecord] = []
    for m in all_memories.memories:
        meta = m.metadata or {}
        if meta.get("type") == "user":
            data = json.loads(m.content)
            results.append(UserRecord(**data))
    results.sort(key=lambda r: r.created_at, reverse=True)
    return results


async def list_all_databases() -> list[DatabaseRecord]:
    client = get_client()
    aid = await get_assistant_id()
    all_memories = await client.get_memories(aid)
    results: list[DatabaseRecord] = []
    for m in all_memories.memories:
        meta = m.metadata or {}
        if meta.get("type") == "database":
            data = json.loads(m.content)
            results.append(DatabaseRecord(**data))
    results.sort(key=lambda r: r.created_at, reverse=True)
    return results


async def delete_database_by_id_global(db_id: str) -> Optional[DatabaseRecord]:
    client = get_client()
    aid = await get_assistant_id()
    all_memories = await client.get_memories(aid)
    for m in all_memories.memories:
        meta = m.metadata or {}
        if meta.get("type") == "database" and meta.get("db_id") == db_id:
            data = json.loads(m.content)
            rec = DatabaseRecord(**data)
            await client.delete_memory(assistant_id=aid, memory_id=m.id)
            return rec
    return None


async def delete_user_memories(user_id: str) -> int:
    """Delete all database memories for user, then the user memory. Returns DB count."""
    client = get_client()
    aid = await get_assistant_id()
    all_memories = (await client.get_memories(aid)).memories
    db_count = 0
    db_ids: list[str] = []
    user_memory_id: Optional[str] = None
    for m in all_memories:
        meta = m.metadata or {}
        if meta.get("type") == "database" and meta.get("user_id") == user_id:
            db_ids.append(m.id)
            db_count += 1
        elif meta.get("type") == "user" and meta.get("user_id") == user_id:
            user_memory_id = m.id
    for mid in db_ids:
        await client.delete_memory(assistant_id=aid, memory_id=mid)
    if user_memory_id:
        await client.delete_memory(assistant_id=aid, memory_id=user_memory_id)
    return db_count
