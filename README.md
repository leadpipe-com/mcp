# Leadpipe MCP

Official MCP server for Leadpipe intent and data APIs.

Use this server to give agents direct access to:
- topic discovery
- website topic analysis
- audience preview and ad hoc query
- saved audience management
- audience status, results, runs, stats, and exports
- visitor data lookup
- tracking pixel management
- account health and credit status

## What This Is

Leadpipe MCP wraps the public Leadpipe intent and data APIs in a local MCP server that agents can use over stdio.

This server is API-key authenticated by default so the full audience workflow, visitor data access, and pixel management workflows are available to agents.

## Use With Claude, Cursor, and Codex

Most users do not need to clone this repo or build from source. The published package is:

```bash
npx -y @leadpipe/mcp
```

You will need:

```bash
export LEADPIPE_API_KEY=sk_...
```

Optional advanced override:

```bash
export LEADPIPE_BASE_URL=https://api.aws53.cloud
```

`LEADPIPE_BASE_URL` only needs to change if you are pointing at a non-default environment.

### Claude Desktop

Add this to your Claude Desktop MCP config:

```json
{
  "mcpServers": {
    "leadpipe": {
      "command": "npx",
      "args": ["-y", "@leadpipe/mcp"],
      "env": {
        "LEADPIPE_API_KEY": "sk_..."
      }
    }
  }
}
```

### Cursor

Add this to `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "leadpipe": {
      "command": "npx",
      "args": ["-y", "@leadpipe/mcp"],
      "env": {
        "LEADPIPE_API_KEY": "sk_..."
      }
    }
  }
}
```

### Codex

Add the server with the Codex CLI:

```bash
codex mcp add leadpipe --env LEADPIPE_API_KEY=sk_... -- npx -y @leadpipe/mcp
```

Then confirm it is configured:

```bash
codex mcp list
```

## Quick Start

If you just want to verify the package runs:

```bash
npx -y @leadpipe/mcp
```

## Run From Source

For local development or repo hacking:

```bash
npm install
npm run build
node dist/index.js
```

For iterative local development:

```bash
npm run dev
```

Local source build MCP config:

```json
{
  "mcpServers": {
    "leadpipe": {
      "command": "node",
      "args": ["/absolute/path/to/mcp/dist/index.js"],
      "env": {
        "LEADPIPE_API_KEY": "sk_..."
      }
    }
  }
}
```

## Tool Surface

### Topic Discovery
- `list_topics`
- `get_topic_facets`
- `search_topics`
- `get_topic_trend`
- `compare_topics`
- `get_topic_movers`
- `analyze_website_topics`

### Audience Builder
- `get_audience_filters`
- `preview_audience`
- `query_audience`
- `list_audiences`
- `get_audience`
- `create_audience`
- `update_audience`
- `delete_audience`

### Audience Results
- `get_audience_status`
- `get_audience_results`
- `list_audience_runs`
- `get_audience_stats`
- `export_audience`

### Visitor Data
- `query_visitor_data`

### Pixels
- `list_pixels`
- `create_pixel`
- `update_pixel`

### Account
- `get_account_status`

## Prompts

- `discover-audience-topics`
- `operate-saved-audience`
- `investigate-visitor-data`

## Prompt Examples

See [examples/prompt-examples.md](./examples/prompt-examples.md) for copy-paste prompts that work well with this MCP server.

Good starting prompts:

- "Find 5-10 B2B topics for cloud cost optimization software, compare their recent trends, and preview an audience."
- "Create a saved audience for these topics, activate it, wait until it is ready, and then summarize the first page of results."
- "Check the status of audience `<audience-id>`. If it is ready, export it and give me the download URL."
- "Investigate visitor activity for `example.com` over the last 30 days and tell me whether our tracking setup looks healthy."
- "List our pixels, find any paused ones, and explain what needs attention."

## Agent Playbooks

For more structured operational flows, see:

- [Audience Research Playbook](./examples/playbooks/audience-research.md)
- [Visitor Diagnostics Playbook](./examples/playbooks/visitor-diagnostics.md)

## Resources

- `leadpipe://docs/auth`
- `leadpipe://docs/workflows`
- `leadpipe://docs/data-api`

## Typical Agent Workflow

1. Search or analyze topics
2. Preview audience size
3. Create or update a saved audience
4. Check status until the audience is ready
5. Fetch results or export CSV

## Typical Data Workflow

1. Check `get_account_status`
2. Query visitor activity with `query_visitor_data`
3. Inspect or create pixels with `list_pixels` / `create_pixel`
4. Pause or reactivate tracking with `update_pixel`

## Development

```bash
npm run typecheck
npm run build
```

## License

MIT
