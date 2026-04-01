# Visitor Diagnostics Playbook

Use this playbook when an agent needs to investigate resolved visitor activity, validate tracking setup, or troubleshoot pixel health.

## Goal

Turn a vague tracking or visitor-data question into:

- account health summary
- visitor activity summary for a domain or email
- pixel inventory and state check
- concrete next actions

## Inputs

- optional domain
- optional email
- optional timeframe
- optional concern:
  - missing traffic
  - paused pixel
  - unhealthy account
  - low resolution volume

## Recommended Tool Sequence

1. `get_account_status`
2. `query_visitor_data`
3. `list_pixels`
4. `create_pixel` if setup is missing
5. `update_pixel` if activation or exclusions need adjustment

## Workflow

### 1. Check account health first

Start with `get_account_status`.

Look for:

- `healthy`
- organization status
- credit usage
- pixel totals
- paused vs active pixels
- intent slot availability if relevant

Good result:
- clear operational baseline before diving into traffic questions

### 2. Query visitor activity

Use `query_visitor_data` in one of two modes:

- `email`
  - for a single resolved visitor journey
- `domain` + `timeframe`
  - for broader traffic inspection

Good result:
- whether there is activity at all
- whether the data looks fresh
- whether the domain/email is returning expected volume

### 3. Inspect pixel configuration

Use `list_pixels` and check:

- whether the domain has a pixel
- whether it is active or paused
- whether there are duplicate or suspicious entries

Good result:
- one clear statement about whether the tracking setup looks healthy

### 4. Make targeted changes

Use:

- `create_pixel`
  - if a required domain has no pixel
- `update_pixel`
  - to pause/reactivate
  - to manage excluded paths

Good result:
- one deliberate operational change
- confirmation of final pixel state

## What To Tell The User

- whether account health is normal
- whether visitor activity exists for the requested domain/email
- whether pixel setup looks correct
- the most likely next action if something is wrong

## Failure Handling

### No visitor data found

- confirm timeframe is not too narrow
- confirm domain spelling
- check whether tracking is installed and active
- call out when “no data” might be expected rather than broken

### Pixel exists but is paused

- explain that paused tracking is likely the reason for missing activity
- only reactivate if the user requests it or the workflow clearly calls for it

### Account is unhealthy

- surface that immediately
- do not over-diagnose downstream traffic until account health is understood

### Multiple pixels for similar domains

- call out potential duplication or misconfiguration
- avoid making destructive changes without a clear instruction

## Good Agent Output Shape

- account summary
- visitor-data summary
- pixel summary
- diagnosis
- recommended next step
