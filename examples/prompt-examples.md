# Prompt Examples

These prompts are designed for agents connected to the Leadpipe MCP server.

They assume the MCP server is configured with `LEADPIPE_API_KEY` and has access to the tools exposed by `@leadpipe/mcp`.

## Topic Discovery

```text
Find strong B2B intent topics for procurement automation software.

Use Leadpipe topic discovery to:
1. search for relevant topics
2. compare recent trend lines
3. identify fast-growing movers
4. recommend the best 5 topics to use in an audience preview

Explain why each topic made the cut.
```

```text
Analyze https://www.ramp.com and tell me which Leadpipe topics best match the company.

Then suggest 3 adjacent topics I should also consider targeting.
```

## Audience Preview

```text
Preview an audience for B2B topics related to cloud security posture management.

Use these constraints:
- minimum score 70
- business email required
- LinkedIn required
- company size mid-market or enterprise

Return:
- estimated total audience size
- a short interpretation of the sample
- any warning if the audience looks too narrow
```

```text
I want an audience for HR software buyers in California.

Find relevant topics, preview the audience, and tell me whether the result set is broad enough for outbound.
```

## Saved Audiences

```text
Create a saved audience named "Cloud Cost Buyers - EU" using the best topics for cloud cost optimization.

After creating it:
1. activate it
2. check status until it is ready
3. summarize the first page of results

Do not export unless I ask.
```

```text
Check audience <audience-id>.

If it is materializing, tell me the current status clearly.
If it is ready, show me:
- total count
- data date
- first few rows
- any obvious data quality observations
```

## Exports

```text
Export audience <audience-id>.

If a cached export already exists, reuse it.
Then give me the download URL and the row count.
```

```text
For audience <audience-id>, list available runs first.
Then export the most recent ready run and tell me what date it corresponds to.
```

## Visitor Data / Resolution

```text
Investigate visitor data for example.com over the last 30 days.

Use Leadpipe to:
1. check account health
2. query visitor activity for the domain
3. inspect configured pixels

Tell me whether tracking appears healthy and what I should fix if not.
```

```text
Look up visitor data for jane@company.com.

If there is a resolved journey, summarize:
- the domains involved
- recency
- anything notable about session activity
```

## Pixel Management

```text
List all Leadpipe pixels for this account.

Group them into:
- active
- paused

Call out any domains that look misconfigured or duplicated.
```

```text
Create a new pixel for www.example.com named "Example Marketing Site".

After creation, summarize:
- pixel id
- status
- domain
```

```text
Pause pixel <pixel-id> and exclude these paths:
- /careers
- /blog

Then confirm the final pixel state.
```

## Account Health

```text
Check Leadpipe account status and summarize:
- overall health
- credit usage
- pixel counts
- intent audience slot availability

Keep the summary concise and operational.
```

## Good Agent Behavior

These prompts work best when the agent:

- uses `search_topics` before picking topic ids
- uses `preview_audience` before creating or activating large audiences
- checks `get_audience_status` before assuming results exist
- checks `get_account_status` before troubleshooting visitor-data issues
- treats exports as delivery artifacts and results as interactive browsing data
