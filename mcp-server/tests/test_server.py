"""Protocol-level tests: a real MCP client talks to the server in-process (no mocks)."""

import sys

import anyio
import pytest
from mcp import Client, StdioServerParameters

from buildmind_mcp.server import create_server

EXPECTED_TOOLS = {"search_projects", "get_project_details", "get_delayed_projects"}


def run(coro_fn):
    return anyio.run(coro_fn)


async def _with_client(fn):
    async with Client(create_server()) as client:
        return await fn(client)


def test_tools_are_registered_with_input_schemas():
    async def go(client):
        return (await client.list_tools()).tools

    tools = {t.name: t for t in run(lambda: _with_client(go))}
    assert set(tools) == EXPECTED_TOOLS
    details = tools["get_project_details"].input_schema
    assert details["required"] == ["project_id"]
    assert details["properties"]["project_id"]["pattern"] == r"^[Bb][Mm]-?\d{3}$"
    delayed = tools["get_delayed_projects"].input_schema["properties"]
    assert delayed["min_delay_days"]["minimum"] == 1
    assert delayed["sort_by"]["enum"] == ["delay_days", "ld_exposure"]
    for t in tools.values():
        assert t.description
        assert t.annotations.read_only_hint is True
        assert t.output_schema is not None


def test_call_get_delayed_projects_returns_structured_content():
    async def go(client):
        return await client.call_tool("get_delayed_projects", {"min_delay_days": 30})

    r = run(lambda: _with_client(go))
    assert not r.is_error
    assert [p["id"] for p in r.structured_content["projects"]] == ["BM-107", "BM-101", "BM-110", "BM-103"]


def test_call_search_projects():
    async def go(client):
        return await client.call_tool("search_projects", {"location": "Seattle"})

    r = run(lambda: _with_client(go))
    assert not r.is_error
    assert r.structured_content["total"] == 1
    assert r.structured_content["projects"][0]["id"] == "BM-102"


def test_call_get_project_details():
    async def go(client):
        return await client.call_tool("get_project_details", {"project_id": "BM-103"})

    r = run(lambda: _with_client(go))
    assert not r.is_error
    assert r.structured_content["project"]["name"] == "Cedar Creek Bridge Replacement"
    assert r.structured_content["delay"]["delay_days"] == 42


def test_unknown_project_returns_tool_error():
    async def go(client):
        return await client.call_tool("get_project_details", {"project_id": "BM-999"})

    r = run(lambda: _with_client(go))
    assert r.is_error
    assert "was not found" in r.content[0].text


@pytest.mark.parametrize(
    "tool,args",
    [
        ("get_project_details", {"project_id": "hospital"}),  # pattern
        ("get_project_details", {}),  # missing required
        ("get_delayed_projects", {"min_delay_days": 0}),  # minimum
        ("get_delayed_projects", {"sort_by": "cost"}),  # enum
        ("search_projects", {"limit": 50}),  # maximum
        ("search_projects", {"status": "Late"}),  # enum
    ],
)
def test_invalid_arguments_are_rejected(tool, args):
    async def go(client):
        return await client.call_tool(tool, args)

    r = run(lambda: _with_client(go))
    assert r.is_error


def test_unknown_tool_is_rejected():
    async def go(client):
        return await client.call_tool("delete_project", {"project_id": "BM-101"})

    r = run(lambda: _with_client(go))
    assert r.is_error


def test_stdio_transport_end_to_end():
    """Launches `python -m buildmind_mcp` as a subprocess, exactly as MCP Inspector or a desktop client would."""

    async def go():
        params = StdioServerParameters(command=sys.executable, args=["-m", "buildmind_mcp"])
        async with Client(params) as client:
            names = {t.name for t in (await client.list_tools()).tools}
            r = await client.call_tool("get_delayed_projects", {})
            return names, r

    names, r = run(go)
    assert names == EXPECTED_TOOLS
    assert r.structured_content["count"] == 7
