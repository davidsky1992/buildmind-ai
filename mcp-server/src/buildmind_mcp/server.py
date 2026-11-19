"""BuildMind MCP server built with the official MCP Python SDK (``MCPServer``, formerly FastMCP).

Run over stdio:
    python -m buildmind_mcp            # or: buildmind-mcp
Inspect interactively:
    mcp dev src/buildmind_mcp/server.py
"""

from __future__ import annotations

import logging
from typing import Annotated

from mcp.server.mcpserver import MCPServer
from mcp.server.mcpserver.exceptions import ToolError
from mcp_types import ToolAnnotations
from pydantic import Field

from buildmind_mcp.repository import (
    DelayedProjectsResult,
    ProjectDetails,
    ProjectNotFoundError,
    ProjectRepository,
    ProjectStatus,
    SearchProjectsResult,
    SortBy,
    default_repository,
)

logger = logging.getLogger("buildmind_mcp")

READ_ONLY = ToolAnnotations(read_only_hint=True, destructive_hint=False, idempotent_hint=True, open_world_hint=False)


def create_server(repository: ProjectRepository | None = None) -> MCPServer:
    """Builds the server. Tests pass their own repository; production uses the bundled seed data."""
    repo = repository or default_repository()
    mcp = MCPServer(
        "BuildMind Projects",
        instructions=(
            "Read-only access to the BuildMind construction project portfolio (10 fictional projects). "
            f"Schedule figures are calculated as of {repo.as_of_date}."
        ),
    )

    @mcp.tool(title="Search projects", annotations=READ_ONLY)
    def search_projects(
        query: Annotated[str | None, Field(description="Free-text keywords matched against name, client, description and people", max_length=120)] = None,
        status: Annotated[ProjectStatus | None, Field(description="Filter by project status")] = None,
        project_type: Annotated[str | None, Field(description="Filter by type, e.g. Healthcare, Infrastructure, Transit", max_length=40)] = None,
        location: Annotated[str | None, Field(description="City, two-letter state code or state name", max_length=40)] = None,
        limit: Annotated[int, Field(description="Maximum number of results", ge=1, le=10)] = 10,
    ) -> SearchProjectsResult:
        """Search the construction project portfolio by keyword and optional status, type and location filters."""
        logger.info("search_projects query=%r status=%r type=%r location=%r", query, status, project_type, location)
        return repo.search_projects(query=query, status=status, project_type=project_type, location=location, limit=limit)

    @mcp.tool(title="Get project details", annotations=READ_ONLY)
    def get_project_details(
        project_id: Annotated[str, Field(description="Project id, e.g. BM-101", pattern=r"^[Bb][Mm]-?\d{3}$")],
    ) -> ProjectDetails:
        """Return the full record for one project: schedule, budget, milestones, risks, team and calculated delay."""
        try:
            return repo.get_project_details(project_id)
        except ProjectNotFoundError as exc:
            raise ToolError(str(exc)) from exc

    @mcp.tool(title="Get delayed projects", annotations=READ_ONLY)
    def get_delayed_projects(
        min_delay_days: Annotated[int, Field(description="Only include projects at least this many days late", ge=1, le=1000)] = 1,
        include_completed: Annotated[bool, Field(description="Include projects that already finished late")] = False,
        sort_by: Annotated[SortBy, Field(description="Sort by delay in days or by liquidated-damages exposure")] = "delay_days",
    ) -> DelayedProjectsResult:
        """List projects forecast (or actually) finishing after their contract completion date, most delayed first."""
        return repo.get_delayed_projects(min_delay_days=min_delay_days, include_completed=include_completed, sort_by=sort_by)

    return mcp


# Module-level instance so `mcp dev src/buildmind_mcp/server.py` and `mcp run` can discover it.
mcp = create_server()


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    mcp.run("stdio")


if __name__ == "__main__":
    main()
