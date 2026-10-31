from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.main import create_app


@pytest.fixture
def static_root(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    (tmp_path / "minimal").mkdir()
    (tmp_path / "index.html").write_text("host a")
    (tmp_path / "minimal" / "index.html").write_text("host b")
    monkeypatch.setenv("LUNA_STATIC_ROOT", str(tmp_path))
    return tmp_path


@pytest.mark.usefixtures("static_root")
def test_hosts_share_one_origin_with_the_api() -> None:
    with TestClient(create_app()) as client:
        assert client.get("/").text == "host a"
        assert client.get("/minimal/").text == "host b"
        assert client.get("/api/health").json() == {"ok": True}


@pytest.mark.usefixtures("static_root")
def test_bare_minimal_path_redirects_to_host_b() -> None:
    with TestClient(create_app()) as client:
        response = client.get("/minimal", follow_redirects=False)

    assert response.status_code == 307
    assert response.headers["location"].endswith("/minimal/")


@pytest.mark.usefixtures("static_root")
def test_unknown_api_path_is_not_served_a_host_page() -> None:
    with TestClient(create_app()) as client:
        response = client.get("/api/does-not-exist")

    assert response.status_code == 404
    assert "host" not in response.text


def test_api_only_without_static_root(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("LUNA_STATIC_ROOT", raising=False)

    with TestClient(create_app()) as client:
        assert client.get("/").status_code == 404


def test_missing_static_root_crashes_at_startup(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    missing = tmp_path / "missing"
    monkeypatch.setenv("LUNA_STATIC_ROOT", str(missing))

    with pytest.raises(RuntimeError, match="does not exist"):
        create_app()
