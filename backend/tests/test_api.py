import pytest
from fastapi.testclient import TestClient


@pytest.fixture()
def client(tmp_path, monkeypatch):
    monkeypatch.setenv("MOOD_DB", str(tmp_path / "t.db"))
    from app.main import app
    return TestClient(app)


def test_crud_roundtrip(client):
    r = client.post("/api/moodboards", json={"title": "Night", "canvas_data": {"elements": []}})
    assert r.status_code == 201
    id_ = r.json()["id"]
    assert client.get(f"/api/moodboards/{id_}").json()["title"] == "Night"
    r = client.put(f"/api/moodboards/{id_}", json={"title": "Dawn", "background_color": "#ffffff"})
    assert r.json()["title"] == "Dawn"
    assert len(client.get("/api/moodboards").json()) == 1
    assert client.delete(f"/api/moodboards/{id_}").status_code == 204
    assert client.get(f"/api/moodboards/{id_}").status_code == 404


def test_validation(client):
    assert client.post("/api/moodboards", json={"title": ""}).status_code == 422
    assert client.post("/api/moodboards", json={"title": "x", "background_color": "red"}).status_code == 422
