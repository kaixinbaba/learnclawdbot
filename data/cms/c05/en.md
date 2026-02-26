---
title: "C05 User Case: Managing Linear Issues End-to-End with linear-cli + OpenClaw"
description: "A source-backed workflow for handling Linear issues from terminal execution to PR handoff, coordinated with OpenClaw."
---

# C05 User Case: Managing Linear Issues End-to-End with linear-cli + OpenClaw

## Overview

- **Category:** Automation / Developer Workflow
- **Audience:** Teams using Linear who want command-based execution with AI-assisted coordination
- **Sources:**
  - [OpenClaw Showcase](https://docs.openclaw.ai/start/showcase)
  - [Finesssee/linear-cli](https://github.com/Finesssee/linear-cli)
  - [linear-cli examples](https://github.com/Finesssee/linear-cli/blob/master/docs/examples.md?raw=1)

## Background

In many teams, issue operations are split between browser tabs, local terminal commands, and chat tools. That context switching makes routine execution slower and less reproducible.

This case focuses on a documented path:

1. run issue and git actions through `linear-cli`,
2. keep machine-readable outputs available,
3. hand the workflow context to OpenClaw for follow-up decisions.

## Verified Capabilities from Sources

From the project README, examples documentation, and the OpenClaw Showcase entry:

1. `linear-cli` provides broad command coverage for Linear entities (issues, projects, labels, teams, cycles, comments, and more).
2. Authentication supports both browser-based OAuth and API key flows.
3. Issue workflow commands include start/stop/close and assignment-related operations.
4. Git integration supports issue-linked branch checkout and PR creation (`linear-cli g checkout`, `linear-cli g pr`).
5. JSON/NDJSON output modes are documented for scripting and agent workflows.
6. OpenClaw Showcase highlights Linear CLI as a community project for terminal-first issue workflows.

## Implementation Path

### 1) Install and verify CLI availability

```bash
cargo install linear-cli
linear-cli --help
```

### 2) Configure authentication

```bash
linear-cli auth oauth
# or
linear-cli config set-key lin_api_xxx
```

### 3) Execute issue workflow from terminal

```bash
linear-cli i list --mine --output json --compact
linear-cli i start LIN-123 --checkout
linear-cli i comment LIN-123 -b "Work started from CLI workflow"
```

### 4) Create branch/PR handoff and continue in OpenClaw

```bash
linear-cli g pr LIN-123 --draft
```

Use OpenClaw conversation context to continue with review checklist, merge readiness discussion, and next-step coordination.

## Outcome (Evidence-Based)

- A repeatable issue-to-PR path can be executed from a single CLI surface.
- Structured output improves downstream automation and AI context handoff.
- Command-level workflow reduces dependency on manual UI navigation for routine operations.

## Confirmed Facts vs Pending Validation

### ✅ Confirmed by sources

- Linear CLI includes issue, git, and broader workspace command groups.
- OAuth/API-key authentication paths are documented.
- JSON/NDJSON output support is documented.
- Showcase includes Linear CLI as an OpenClaw community project.

### ⚠️ Pending (requires team telemetry/interviews)

- Average cycle-time reduction per issue
- Review latency changes after CLI-first adoption
- Long-term impact on throughput across multiple repositories

## Practical Notes

- Standardize identifiers (e.g., `LIN-123`) in team runbooks for consistency.
- Prefer machine-readable output when feeding context into AI workflows.
- Keep auth method explicit per environment to avoid workspace confusion.

## References

- [OpenClaw Showcase](https://docs.openclaw.ai/start/showcase)
- [linear-cli repository](https://github.com/Finesssee/linear-cli)
- [linear-cli examples](https://github.com/Finesssee/linear-cli/blob/master/docs/examples.md?raw=1)
