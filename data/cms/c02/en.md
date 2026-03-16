---
title: "Automating Padel Court Booking with padel-cli + OpenClaw"
description: "How an automation-first player used padel-cli and OpenClaw plugin flow to reduce manual court checking and standardize booking operations."
featuredImageUrl: /images/blog/c02-padel-cli-booking-automation.webp
publishedAt: 2026-01-17
status: published
visibility: public
author: "The Curator"
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

## Frequently Asked Questions

**Q: Does padel-cli work outside of Spain and Europe?**
padel-cli connects to Playtomic's API, which operates in multiple countries. Venue availability depends on whether your local clubs are listed on Playtomic. Check the official README for supported regions.

**Q: Can I run this automation without a nix-openclaw setup?**
Yes. The CLI commands work standalone. The nix-openclaw integration via the `openclawPlugin` flake output is an optional enhancement for users who already use declarative Nix deployments.

**Q: What happens if the booking fails silently?**
The `--json` output flag enables programmatic error detection. Build a confirmation step into your workflow that checks the returned status before treating a booking as complete.

**Q: Is it safe to store Playtomic credentials on a server or automation system?**
Store credentials in a file outside your code repository (e.g., `~/.config/padel/credentials`), with file permissions set to 600. Never hardcode credentials in scripts or commit them to version control. If running on a shared server, consider using environment variable injection at runtime rather than a stored credential file.

**Q: Can I schedule padel-cli to run at a specific time automatically?**
Yes — the CLI is designed to be scriptable. Wrap your search and book commands in a shell script and schedule it with cron or a systemd timer. For OpenClaw users, you can trigger this workflow conversationally by asking your agent to "check court availability for Tuesday evening," which will invoke the plugin and return structured results.

## Key Takeaways

The padel-cli + OpenClaw combination works because the CLI was built with automation in mind: JSON output, venue aliases, and a documented OpenClaw plugin flake all point toward scriptable, repeatable workflows. The main constraint is Playtomic coverage in your region. Where that coverage exists, the shift from manual app-checking to command-driven availability queries is straightforward to implement and audit.

## References

- [OpenClaw Showcase](https://docs.openclaw.ai/start/showcase)
- [padel-cli README](https://github.com/joshp123/padel-cli)

## Related Articles

- [Managing Linear Issues with linear-cli + OpenClaw](/blog/c05-linear-cli-openclaw-issue-workflow) — another CLI-first automation workflow using the same OpenClaw plugin pattern
- [Running 14+ AI Agents in Parallel with OpenClaw](/blog/c06-multi-agent-orchestration-kev-dream-team) — extend your automation further with multi-agent orchestration
- [Declarative OpenClaw Deployment with nix-openclaw](/blog/c01-nix-openclaw-declarative-deployment) — if you're using the nix-openclaw flake output, this guide covers the deployment layer
