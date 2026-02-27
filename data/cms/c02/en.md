---
title: "Automating Padel Court Booking with padel-cli + OpenClaw"
description: "How an automation-first player used padel-cli and OpenClaw plugin flow to reduce manual court checking and standardize booking operations."
---

# C02 User Case: Automating Padel Court Booking with padel-cli + OpenClaw

## Case Profile

- **Category:** Automation / Plugin Workflow
- **Audience:** Users who repeatedly check and reserve Padel courts via Playtomic
- **Sources:**
  - [OpenClaw Docs: Showcase](https://docs.openclaw.ai/start/showcase)
  - [joshp123/padel-cli](https://github.com/joshp123/padel-cli)

## Background

A frequent evening player wanted to avoid repeated manual checks for court availability. The usual routine was:

- Open app
- Search by location/date/time
- Repeat every day for the same preferred slots

The user needed a flow that stays scriptable, reproducible, and usable from OpenClaw.

## Verified Capabilities from Sources

From the repository and showcase entry, padel-cli provides:

1. Availability and search commands
2. Authenticated booking commands
3. Venue alias management for repeat use
4. `--json` output for automation pipelines
5. An `openclawPlugin` flake output designed for nix-openclaw integration

## Implementation Path

### 1) Validate CLI build and basic search

```bash
go build -o padel
padel clubs --near "Madrid"
padel search --location "Barcelona" --date 2025-01-05 --time 18:00-22:00
```

### 2) Set authentication and booking path

```bash
padel auth login --email you@example.com --password yourpass
padel auth status
padel book --venue myclub --date 2025-01-05 --time 10:30 --duration 90
```

### 3) Stabilize repeat operations with venue aliases

```bash
padel venues add --id "<playtomic-id>" --alias myclub --name "My Club" --indoor --timezone "Europe/Madrid"
padel venues list
padel search --venues myclub --date 2025-01-05 --time 09:00-11:00
```

### 4) Integrate into OpenClaw plugin workflow

The repository explicitly documents an `openclawPlugin` flake output. In nix-openclaw setups, plugin packages are added to `PATH` and skills are symlinked under workspace skill directories.

## Outcome (Evidence-Based)

- The workflow can move from ad-hoc app tapping to script-driven commands.
- Search/availability/booking become composable operations.
- JSON output and venue aliases improve reliability for repeated runs.

## Confirmed Facts vs Pending Validation

### ✅ Confirmed by sources

- padel-cli includes `search`, `availability`, `auth`, `book`, `venues` commands.
- padel-cli supports JSON output.
- padel-cli documents `openclawPlugin` flake output for nix-openclaw.
- OpenClaw showcase includes a dedicated "Padel Court Booking" entry linking this project.

### ⚠️ Pending (requires user telemetry/interview)

- Exact weekly time saved for specific users
- Booking success uplift across different cities/clubs
- Long-term win rate impact during peak-demand slots

## Practical Notes

- Keep credentials and config under secure local paths (`~/.config/padel`).
- Validate timezone/venue mapping before automation runs.
- Treat booking workflows as “assistive automation” and keep a confirmation checkpoint where required.

## References

- [OpenClaw Showcase](https://docs.openclaw.ai/start/showcase)
- [padel-cli README](https://github.com/joshp123/padel-cli)
