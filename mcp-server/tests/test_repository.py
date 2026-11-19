import json
from pathlib import Path

import pytest

from buildmind_mcp.repository import (
    DEFAULT_DATA_PATH,
    ProjectNotFoundError,
    ProjectRepository,
    days_between,
    normalize_project_id,
)


@pytest.fixture(scope="module")
def repo() -> ProjectRepository:
    return ProjectRepository()


def test_seed_data_loads_ten_projects(repo):
    assert len(repo.projects) == 10
    assert repo.as_of_date == "2026-11-15"


def test_seed_data_matches_web_copy():
    """The browser demo and the MCP server must use identical seed data."""
    web_copy = Path(__file__).resolve().parents[2] / "web" / "src" / "data" / "projects.json"
    if not web_copy.exists():
        pytest.skip("web project not present")
    assert json.loads(web_copy.read_text("utf-8")) == json.loads(DEFAULT_DATA_PATH.read_text("utf-8"))


def test_days_between():
    assert days_between("2026-09-25", "2027-01-29") == 126
    assert days_between("2026-08-07", "2026-08-03") == -4


@pytest.mark.parametrize("raw,expected", [("bm-101", "BM-101"), ("BM 107", "BM-107"), ("bm104", "BM-104"), ("x", "X")])
def test_normalize_project_id(raw, expected):
    assert normalize_project_id(raw) == expected


def test_delay_and_ld_exposure_match_typescript_implementation(repo):
    d = repo.delay(repo.get("BM-101"))
    assert d.delay_days == 77
    assert d.liquidated_damages_exposure == 77 * 25_000
    assert d.completion_basis == "forecast"
    early = repo.delay(repo.get("BM-104"))
    assert early.delay_days == -9
    assert early.liquidated_damages_exposure == 0


def test_get_unknown_project_raises(repo):
    with pytest.raises(ProjectNotFoundError, match="BM-101 to BM-110"):
        repo.get("BM-999")


def test_get_delayed_projects_default(repo):
    r = repo.get_delayed_projects()
    assert [p.id for p in r.projects] == ["BM-107", "BM-101", "BM-110", "BM-103", "BM-102", "BM-109", "BM-106"]
    assert r.count == 7
    assert r.total_exposure == sum(p.liquidated_damages_exposure for p in r.projects)


def test_get_delayed_projects_threshold_and_sort(repo):
    assert [p.id for p in repo.get_delayed_projects(min_delay_days=30).projects] == ["BM-107", "BM-101", "BM-110", "BM-103"]
    assert repo.get_delayed_projects(sort_by="ld_exposure").projects[0].id == "BM-101"


def test_completed_projects_excluded_unless_requested(repo):
    # BM-105 finished early, so it never appears; check the flag is honoured with a custom threshold
    ids = {p.id for p in repo.get_delayed_projects(include_completed=True).projects}
    assert "BM-105" not in ids


def test_search_by_filters(repo):
    assert [p.id for p in repo.search_projects(location="north carolina").projects] == ["BM-109", "BM-110"]
    assert [p.id for p in repo.search_projects(location="NC").projects] == ["BM-109", "BM-110"]
    assert [p.id for p in repo.search_projects(status="On Track").projects] == ["BM-104", "BM-108"]
    assert [p.id for p in repo.search_projects(project_type="healthcare").projects] == ["BM-101"]


def test_search_free_text_and_limit(repo):
    r = repo.search_projects(query="Granite Peak hospital")
    assert r.projects[0].id == "BM-101"
    assert r.projects[0].match_score == 1.0
    assert repo.search_projects(limit=3).total == 10
    assert len(repo.search_projects(limit=3).projects) == 3
    assert repo.search_projects(query="zeppelin").total == 0


def test_project_details(repo):
    d = repo.get_project_details("bm-107")
    assert d.project.name == "Metro Line 3 Station Upgrades"
    assert d.delay.delay_days == 126
    assert d.budget_used_percent == pytest.approx(84.3)


def test_custom_data_path(tmp_path):
    data = json.loads(DEFAULT_DATA_PATH.read_text("utf-8"))
    data["projects"] = data["projects"][:2]
    f = tmp_path / "p.json"
    f.write_text(json.dumps(data), "utf-8")
    assert len(ProjectRepository(f).projects) == 2
