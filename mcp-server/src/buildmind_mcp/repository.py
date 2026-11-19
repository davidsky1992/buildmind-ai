"""Data access and business logic, independent of MCP so it can be unit-tested directly.

The calculations mirror the TypeScript implementation in ``web/src/tools`` so the
browser demo and this server return the same numbers for the same seed data.
"""

from __future__ import annotations

import json
import os
import re
from datetime import date
from functools import lru_cache
from pathlib import Path
from typing import Any, Literal

from pydantic import BaseModel, Field

ProjectStatus = Literal["On Track", "At Risk", "Delayed", "Completed", "On Hold"]
SortBy = Literal["delay_days", "ld_exposure"]

DEFAULT_DATA_PATH = Path(__file__).parent / "data" / "projects.json"

STATE_NAMES = {
    "CA": "california",
    "WA": "washington",
    "ID": "idaho",
    "OH": "ohio",
    "TX": "texas",
    "CO": "colorado",
    "AZ": "arizona",
    "WI": "wisconsin",
    "NC": "north carolina",
}

_STOPWORDS = frozenset(
    "a an and are as at be by for from has have how in is it of on or that the this to was what which with "
    "project projects job jobs site sites construction".split()
)


class ProjectNotFoundError(LookupError):
    """Raised when a project id does not exist in the dataset."""


# --------------------------------------------------------------------------- models


class Milestone(BaseModel):
    name: str
    planned: str
    forecast: str
    actual: str | None = None


class Risk(BaseModel):
    title: str
    severity: Literal["High", "Medium", "Low"]


class Project(BaseModel):
    id: str
    name: str
    type: str
    client: str
    city: str
    state: str
    status: ProjectStatus
    contractValue: int
    costToDate: int
    percentComplete: int
    startDate: str
    plannedCompletion: str
    forecastCompletion: str
    actualCompletion: str | None = None
    projectManager: str
    generalContractor: str
    liquidatedDamagesPerDay: int
    contractDocument: str
    description: str
    milestones: list[Milestone]
    risks: list[Risk]


class ProjectSummary(BaseModel):
    id: str
    name: str
    type: str
    location: str
    status: ProjectStatus
    percent_complete: int
    contract_value: int
    planned_completion: str
    forecast_completion: str
    delay_days: int
    match_score: float = Field(description="Share of query terms matched (1.0 when no query is given)")


class SearchProjectsResult(BaseModel):
    filters: dict[str, Any]
    total: int
    projects: list[ProjectSummary]


class DelaySummary(BaseModel):
    delay_days: int = Field(description="Calendar days late (negative = early)")
    completion_date: str
    completion_basis: Literal["actual", "forecast"]
    time_elapsed_percent: float
    progress_gap_points: float
    liquidated_damages_exposure: int = Field(description="Delay days x daily LD rate, capped at 10% of contract value")


class ProjectDetails(BaseModel):
    project: Project
    delay: DelaySummary
    budget_used_percent: float
    as_of_date: str


class DelayedProject(BaseModel):
    id: str
    name: str
    status: ProjectStatus
    delay_days: int
    planned_completion: str
    forecast_completion: str
    liquidated_damages_exposure: int
    recovery_schedule_required: bool


class DelayedProjectsResult(BaseModel):
    as_of_date: str
    min_delay_days: int
    count: int
    total_exposure: int
    projects: list[DelayedProject]


# --------------------------------------------------------------------------- helpers


def _parse(iso: str) -> date:
    try:
        return date.fromisoformat(iso)
    except ValueError as exc:  # pragma: no cover - guarded by data validation
        raise ValueError(f'Invalid date "{iso}" (expected YYYY-MM-DD)') from exc


def days_between(a: str, b: str) -> int:
    """Calendar days from ``a`` to ``b`` (positive when ``b`` is later)."""
    return (_parse(b) - _parse(a)).days


def normalize_project_id(project_id: str) -> str:
    m = re.fullmatch(r"\s*bm[-\s]?(\d{3})\s*", project_id, flags=re.IGNORECASE)
    return f"BM-{m.group(1)}" if m else project_id.strip().upper()


def _words(text: str) -> list[str]:
    return re.findall(r"[a-z0-9]+(?:\.[0-9]+)*", text.lower())


def _stem(word: str) -> str:
    """Tiny suffix stripper, deliberately simple (keeps search deterministic)."""
    for suffix, rep in (("ies", "y"), ("ing", ""), ("ed", ""), ("es", "e"), ("s", "")):
        if len(word) > 3 and word.endswith(suffix) and not word.endswith("ss"):
            word = word[: -len(suffix)] + rep
            break
    return word[:-1] if len(word) > 4 and word.endswith("e") else word


# --------------------------------------------------------------------------- repository


class ProjectRepository:
    """Read-only access to the seeded project portfolio."""

    def __init__(self, data_path: Path | str | None = None) -> None:
        path = Path(data_path or os.environ.get("BUILDMIND_DATA", DEFAULT_DATA_PATH))
        raw = json.loads(path.read_text(encoding="utf-8"))
        self.as_of_date: str = raw["asOfDate"]
        self.projects: list[Project] = [Project.model_validate(p) for p in raw["projects"]]
        self._by_id = {p.id: p for p in self.projects}

    # -- lookup -------------------------------------------------------------------------

    def get(self, project_id: str) -> Project:
        project = self._by_id.get(normalize_project_id(project_id))
        if project is None:
            ids = sorted(self._by_id)
            raise ProjectNotFoundError(f'Project "{project_id}" was not found. Valid ids are {ids[0]} to {ids[-1]}.')
        return project

    # -- calculations ---------------------------------------------------------------------

    def delay(self, p: Project) -> DelaySummary:
        basis: Literal["actual", "forecast"] = "actual" if p.actualCompletion else "forecast"
        completion = p.actualCompletion or p.forecastCompletion
        delay_days = days_between(p.plannedCompletion, completion)
        baseline = days_between(p.startDate, p.plannedCompletion)
        elapsed = min(max(days_between(p.startDate, self.as_of_date), 0), baseline)
        elapsed_pct = round(elapsed / baseline * 100, 1)
        exposure = min(max(delay_days, 0) * p.liquidatedDamagesPerDay, round(p.contractValue * 0.1))
        return DelaySummary(
            delay_days=delay_days,
            completion_date=completion,
            completion_basis=basis,
            time_elapsed_percent=elapsed_pct,
            progress_gap_points=round(p.percentComplete - elapsed_pct, 1),
            liquidated_damages_exposure=exposure,
        )

    def summarize(self, p: Project, score: float = 1.0) -> ProjectSummary:
        return ProjectSummary(
            id=p.id,
            name=p.name,
            type=p.type,
            location=f"{p.city}, {p.state}",
            status=p.status,
            percent_complete=p.percentComplete,
            contract_value=p.contractValue,
            planned_completion=p.plannedCompletion,
            forecast_completion=p.actualCompletion or p.forecastCompletion,
            delay_days=self.delay(p).delay_days,
            match_score=score,
        )

    # -- tool implementations ---------------------------------------------------------------

    def search_projects(
        self,
        query: str | None = None,
        status: ProjectStatus | None = None,
        project_type: str | None = None,
        location: str | None = None,
        limit: int = 10,
    ) -> SearchProjectsResult:
        terms = [_stem(w) for w in _words(query or "") if w not in _STOPWORDS]
        loc = location.strip().lower() if location else None
        results: list[ProjectSummary] = []
        for p in self.projects:
            if status and p.status != status:
                continue
            if project_type and project_type.lower() not in p.type.lower():
                continue
            if loc and loc not in (p.city.lower(), p.state.lower(), STATE_NAMES.get(p.state)):
                continue
            score = 1.0
            if terms:
                haystack = " ".join(
                    [p.id, p.name, p.type, p.client, p.city, p.state, STATE_NAMES.get(p.state, ""),
                     p.description, p.projectManager, p.generalContractor]
                )
                hay = {_stem(w) for w in _words(haystack)}
                matched = sum(1 for t in terms if t in hay)
                if matched == 0:
                    continue
                score = round(matched / len(terms), 2)
            results.append(self.summarize(p, score))
        results.sort(key=lambda r: (-r.match_score, r.id))
        filters = {k: v for k, v in {"query": query, "status": status, "project_type": project_type, "location": location}.items() if v}
        return SearchProjectsResult(filters=filters, total=len(results), projects=results[:limit])

    def get_project_details(self, project_id: str) -> ProjectDetails:
        p = self.get(project_id)
        return ProjectDetails(
            project=p,
            delay=self.delay(p),
            budget_used_percent=round(p.costToDate / p.contractValue * 100, 1),
            as_of_date=self.as_of_date,
        )

    def get_delayed_projects(
        self, min_delay_days: int = 1, include_completed: bool = False, sort_by: SortBy = "delay_days"
    ) -> DelayedProjectsResult:
        rows: list[DelayedProject] = []
        for p in self.projects:
            if p.status == "Completed" and not include_completed:
                continue
            d = self.delay(p)
            if d.delay_days < min_delay_days:
                continue
            rows.append(
                DelayedProject(
                    id=p.id,
                    name=p.name,
                    status=p.status,
                    delay_days=d.delay_days,
                    planned_completion=p.plannedCompletion,
                    forecast_completion=d.completion_date,
                    liquidated_damages_exposure=d.liquidated_damages_exposure,
                    recovery_schedule_required=d.delay_days > 14 and d.completion_basis == "forecast",
                )
            )
        key = (lambda r: (-r.liquidated_damages_exposure, r.id)) if sort_by == "ld_exposure" else (lambda r: (-r.delay_days, r.id))
        rows.sort(key=key)
        return DelayedProjectsResult(
            as_of_date=self.as_of_date,
            min_delay_days=min_delay_days,
            count=len(rows),
            total_exposure=sum(r.liquidated_damages_exposure for r in rows),
            projects=rows,
        )


@lru_cache(maxsize=1)
def default_repository() -> ProjectRepository:
    return ProjectRepository()
