"""Small FastAPI service for saving moodboards. Playback and analysis stay in the browser."""
import json
import os
import sqlite3
import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import FastAPI, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

DB_PATH = os.getenv("MOOD_DB", "moodboards.db")
ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")

app = FastAPI(title="Mood Canvas API", version="0.1.0")
app.add_middleware(CORSMiddleware, allow_origins=ORIGINS, allow_methods=["*"], allow_headers=["*"])


def db() -> sqlite3.Connection:
    con = sqlite3.connect(os.getenv("MOOD_DB", DB_PATH))
    con.row_factory = sqlite3.Row
    con.execute(
        "CREATE TABLE IF NOT EXISTS moodboards (id TEXT PRIMARY KEY, title TEXT NOT NULL, "
        "background_color TEXT NOT NULL, canvas_data TEXT NOT NULL, music_config TEXT, "
        "created_at TEXT NOT NULL, updated_at TEXT NOT NULL)"
    )
    return con


class MoodboardIn(BaseModel):
    title: str = Field(min_length=1, max_length=120)
    background_color: str = Field(default="#0f1020", pattern=r"^#[0-9a-fA-F]{6}$")
    canvas_data: dict[str, Any] = {}
    music_config: dict[str, Any] | None = None


class MoodboardOut(MoodboardIn):
    id: str
    created_at: str
    updated_at: str


def row_to_out(r: sqlite3.Row) -> MoodboardOut:
    return MoodboardOut(
        id=r["id"], title=r["title"], background_color=r["background_color"],
        canvas_data=json.loads(r["canvas_data"]),
        music_config=json.loads(r["music_config"]) if r["music_config"] else None,
        created_at=r["created_at"], updated_at=r["updated_at"],
    )


def now() -> str:
    return datetime.now(timezone.utc).isoformat()


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/moodboards", response_model=MoodboardOut, status_code=201)
def create(body: MoodboardIn) -> MoodboardOut:
    id_, ts = str(uuid.uuid4()), now()
    with db() as con:
        con.execute(
            "INSERT INTO moodboards VALUES (?,?,?,?,?,?,?)",
            (id_, body.title, body.background_color, json.dumps(body.canvas_data),
             json.dumps(body.music_config) if body.music_config else None, ts, ts),
        )
        return row_to_out(con.execute("SELECT * FROM moodboards WHERE id=?", (id_,)).fetchone())


@app.get("/api/moodboards", response_model=list[MoodboardOut])
def list_all() -> list[MoodboardOut]:
    with db() as con:
        return [row_to_out(r) for r in con.execute("SELECT * FROM moodboards ORDER BY updated_at DESC")]


@app.get("/api/moodboards/{id_}", response_model=MoodboardOut)
def get_one(id_: str) -> MoodboardOut:
    with db() as con:
        r = con.execute("SELECT * FROM moodboards WHERE id=?", (id_,)).fetchone()
    if not r:
        raise HTTPException(404, "Moodboard not found")
    return row_to_out(r)


@app.put("/api/moodboards/{id_}", response_model=MoodboardOut)
def update(id_: str, body: MoodboardIn) -> MoodboardOut:
    with db() as con:
        cur = con.execute(
            "UPDATE moodboards SET title=?, background_color=?, canvas_data=?, music_config=?, updated_at=? WHERE id=?",
            (body.title, body.background_color, json.dumps(body.canvas_data),
             json.dumps(body.music_config) if body.music_config else None, now(), id_),
        )
        if cur.rowcount == 0:
            raise HTTPException(404, "Moodboard not found")
        return row_to_out(con.execute("SELECT * FROM moodboards WHERE id=?", (id_,)).fetchone())


@app.delete("/api/moodboards/{id_}", status_code=204)
def delete(id_: str) -> Response:
    with db() as con:
        cur = con.execute("DELETE FROM moodboards WHERE id=?", (id_,))
    if cur.rowcount == 0:
        raise HTTPException(404, "Moodboard not found")
    return Response(status_code=204)
