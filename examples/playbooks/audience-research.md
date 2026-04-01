# Audience Research Playbook

Use this playbook when an agent needs to go from a rough GTM idea to a saved audience that is ready for browsing or export.

## Goal

Turn a targeting idea into:

- a short list of validated intent topics
- an audience preview with realistic constraints
- a saved audience
- a ready run with browsable results or an export URL

## Inputs

- product or campaign description
- optional ICP hints:
  - industry
  - company size
  - geography
  - seniority
  - required contact fields

## Recommended Tool Sequence

1. `search_topics`
2. `get_topic_trend`
3. `compare_topics`
4. `get_topic_movers`
5. `get_audience_filters`
6. `preview_audience`
7. `create_audience`
8. `update_audience` with `status=active`
9. `get_audience_status`
10. `get_audience_results`
11. `export_audience` if the user wants delivery

## Workflow

### 1. Discover candidate topics

- Search for obvious product/category terms.
- Prefer a compact shortlist over a broad pile of weak topics.
- Use trend and movers data to avoid stale topics.

Good result:
- 3 to 10 strong topics with a clear reason for each one

### 2. Validate audience shape

- Fetch audience filters before applying ICP constraints.
- Use `preview_audience` before creating a saved audience.
- If the audience is too broad, tighten by:
  - increasing `minScore`
  - increasing `minTopicOverlap`
  - requiring business email / LinkedIn / phone
  - narrowing company size or industry
- If the audience is too narrow, relax one constraint at a time.

Good result:
- a preview with a believable total count
- a masked sample that fits the ICP

### 3. Persist the audience

- Create a saved audience once the preview looks right.
- Use a descriptive audience name that includes the use case or region.
- Activate it with `update_audience`.

Good result:
- a saved audience id
- a clear statement that the run is materializing or ready

### 4. Wait and read

- Poll `get_audience_status` until status is `ready`.
- Once ready, inspect:
  - `totalCount`
  - `dataDate`
  - first page of `get_audience_results`
  - `get_audience_stats` if field completeness matters

Good result:
- concise interpretation of the dataset
- call out any obvious quality issues before export

### 5. Deliver

- Use `export_audience` when the user needs a CSV artifact.
- Reuse cached export when available.

## What To Tell The User

- why the chosen topics are the best fit
- whether the audience looks too broad, too narrow, or healthy
- whether materialization is still running
- whether the results are export-ready

## Failure Handling

### No good topics found

- broaden the search terms
- drop overly specific brand/product phrasing
- try adjacent categories

### Preview is too small

- lower `minScore`
- reduce `minTopicOverlap`
- relax one ICP filter at a time

### Preview is too large

- increase `minScore`
- require more topic overlap
- add required identity/contact filters

### Audience stuck materializing

- report the current status clearly
- do not pretend results are ready
- only export once a ready run exists

## Good Agent Output Shape

- recommended topics
- preview summary
- saved audience id and status
- next action:
  - browse results
  - wait longer
  - export
