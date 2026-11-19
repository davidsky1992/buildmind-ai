# BuildMind MCP Server

A small, independent [Model Context Protocol](https://modelcontextprotocol.io) server that exposes the BuildMind construction-project portfolio to any MCP client. It is built with the **official MCP Python SDK** (`mcp` 2.x, `MCPServer`, which was called `FastMCP` in 1.x) and uses the **stdio** transport.

> **Scope:** this server runs **locally only**. The public BuildMind web demo is a static site and does **not** connect to it. The two projects share the same JSON seed data and the same delay calculation, so they return the same numbers.

## Tools

| Tool | Arguments (validated) | Returns |
|---|---|---|
| `search_projects` | `query?` (≤120 chars), `status?` (`On Track` / `At Risk` / `Delayed` / `Completed` / `On Hold`), `project_type?`, `location?` (city, state code or state name), `limit` (1-10, default 10) | Matching project summaries with a match score |
| `get_project_details` | `project_id` (required, must match `^[Bb][Mm]-?\d{3}$`) | Full project record, calculated delay, budget used |
| `get_delayed_projects` | `min_delay_days` (1-1000, default 1), `include_completed` (bool), `sort_by` (`delay_days` / `ld_exposure`) | Late projects, days late, liquidated-damages exposure |

- Each tool publishes a JSON **input schema** (generated from type hints and pydantic `Field` constraints) and an **output schema**. Results come back as `structuredContent`.
- **Validation:** arguments that break the schema (wrong type, out of range, bad enum value, bad pattern, missing required field) are rejected before the tool runs, and the result has `isError: true`.
- **Error handling:** an unknown project id raises `ToolError`, which becomes `isError: true` with a readable message. Unexpected exceptions are logged with a traceback to stderr, and the client receives only a generic message.
- All tools are annotated `readOnlyHint: true`, `destructiveHint: false`.

Schedule figures are calculated as of the dataset's `asOfDate` (2026-11-15), so results are deterministic.

## Requirements

- Python **3.12+** (the test suite has also passed on Python 3.14)
- Node.js 18+ is needed only for MCP Inspector

## Run locally

```bash
cd mcp-server
python -m venv .venv
# Windows: .venv\Scripts\activate    macOS/Linux: source .venv/bin/activate
pip install -e ".[dev]"

python -m buildmind_mcp        # or: buildmind-mcp
```

The server speaks JSON-RPC over stdin/stdout and waits for a client, so it prints nothing to stdout itself. Logs go to stderr.

To use a different dataset, set `BUILDMIND_DATA=/path/to/projects.json`.

## Test with MCP Inspector

**Interactive UI** (opens the Inspector in your browser):

```bash
npx @modelcontextprotocol/inspector python -m buildmind_mcp
```

Or use the SDK's helper: `mcp dev src/buildmind_mcp/server.py`.

In the Inspector, click **Connect**, then **Tools → List Tools**. You should see the three tools above. Select `get_delayed_projects`, set `min_delay_days` to `30`, and click **Run Tool**.

**CLI mode** (scriptable, no browser):

```bash
npx @modelcontextprotocol/inspector --cli python -m buildmind_mcp --method tools/list
npx @modelcontextprotocol/inspector --cli python -m buildmind_mcp --method tools/call --tool-name get_delayed_projects --tool-arg min_delay_days=30
npx @modelcontextprotocol/inspector --cli python -m buildmind_mcp --method tools/call --tool-name get_project_details --tool-arg project_id=BM-999   # → isError: true
```

(Run these with the virtualenv activated so `python` resolves to it, or pass the full path to the venv's Python.)

## Use from an MCP client (e.g. Claude Desktop)

```json
{
  "mcpServers": {
    "buildmind": {
      "command": "C:/path/to/buildmind-ai/mcp-server/.venv/Scripts/python.exe",
      "args": ["-m", "buildmind_mcp"]
    }
  }
}
```

On macOS/Linux use `.venv/bin/python`.

## Tests

```bash
pytest -q
```

- `tests/test_repository.py`: business logic (delay maths, filters, sorting, not-found errors). It also checks that the seed data is identical to `web/src/data/projects.json`.
- `tests/test_server.py`: protocol-level tests with a real `mcp.Client`. Covers tool discovery, input/output schemas, structured results, schema validation failures, unknown tools, tool errors, and an end-to-end test that launches `python -m buildmind_mcp` as a **stdio subprocess**.

## Layout

```
mcp-server/
├── pyproject.toml
├── src/buildmind_mcp/
│   ├── server.py        # MCP tool registration, schemas, error mapping
│   ├── repository.py    # data loading + business logic (no MCP dependency)
│   ├── __main__.py      # `python -m buildmind_mcp`
│   └── data/projects.json
└── tests/
```
