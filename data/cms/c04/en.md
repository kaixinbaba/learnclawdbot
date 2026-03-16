---
title: "Operating BambuLab Printers with bambu-cli + OpenClaw"
description: "How users can run a repeatable BambuLab control workflow with bambu-cli and OpenClaw, based on documented commands and networking requirements."
featuredImageUrl: /images/blog/c04-bambu-cli-3d-printer-control.webp
publishedAt: 2026-01-31
status: published
visibility: public
author: "The Curator"
---

# C04 User Case: Operating BambuLab Printers with bambu-cli + OpenClaw

## Case Profile

- **Category:** Automation / Hardware Workflow
- **Audience:** Users who want command-based control for BambuLab printer operations
- **Sources:**
  - [OpenClaw Docs: Showcase](https://docs.openclaw.ai/start/showcase)
  - [tobiasbischoff/bambu-cli](https://github.com/tobiasbischoff/bambu-cli)
  - [bambu-cli README (raw)](https://github.com/tobiasbischoff/bambu-cli/blob/master/README.md?raw=1)

## Background

When printer operations are handled only through GUI apps, repeatable tasks (status checks, print starts, profile setup) can become fragmented.

This case focuses on a documented, command-first path:

- configure once,
- run operational commands,
- hand results into OpenClaw conversations for follow-up actions.

## Verified Capabilities from Sources

From the bambu-cli README and OpenClaw Showcase entry:

1. `bambu-cli` is a CLI for controlling BambuLab printers over MQTT/FTPS/camera.
2. It provides documented install and quick-start commands (`brew install`, `config set`, `status`, `print start`).
3. It defines configuration precedence (flags > env > project config > user config).
4. It documents required network ports (8883 MQTT, 990 FTPS, 6000 camera).
5. OpenClaw Showcase lists “Bambu 3D Printer Control” as a community project for printer control/troubleshooting workflows.

## Implementation Path

### 1) Install bambu-cli

```bash
brew install tobiasbischoff/tap/bambu-cli
```

### 2) Configure a printer profile with file-based access code

```bash
mkdir -p ~/.config/bambu
printf "%s" "YOUR_ACCESS_CODE" > ~/.config/bambu/lab.code
chmod 600 ~/.config/bambu/lab.code

bambu-cli config set --printer lab \
  --ip 192.168.1.200 \
  --serial AC12309BH109 \
  --access-code-file ~/.config/bambu/lab.code \
  --default
```

### 3) Run operational commands

```bash
bambu-cli status
bambu-cli print start ./benchy.3mf --plate 1
```

### 4) Connect with OpenClaw workflow

Use OpenClaw conversations to coordinate checks and next actions around the CLI output (for example, status review, runbook guidance, and troubleshooting steps).

## Outcome (Evidence-Based)

- A GUI-only printer routine can be transformed into reproducible command steps.
- Profile + config precedence documentation makes behavior more predictable across environments.
- File-based access code handling supports safer automation than passing secrets directly in command flags.

## Confirmed Facts vs Pending Validation

### ✅ Confirmed by sources

- `bambu-cli` controls BambuLab printers via MQTT/FTPS/camera.
- Homebrew installation and quick-start commands are explicitly documented.
- Config precedence and required ports are documented.
- OpenClaw Showcase includes “Bambu 3D Printer Control”.

### ⚠️ Pending (requires user telemetry/interview)

- Average time saved per print operation
- Failure-rate reduction after moving from GUI-only flow
- Throughput gains in multi-printer environments

## Practical Notes

- Store printer access code in files and apply restricted permissions (`chmod 600`).
- Confirm network reachability for MQTT/FTPS/camera ports before automation runs.
- Keep configuration explicit to reduce drift between machines.

## Frequently Asked Questions

**Q: Which BambuLab printer models are supported?**
Check the bambu-cli README for the current list of supported models. Support depends on network connectivity mode (LAN vs cloud); some commands require specific firmware versions.

**Q: Can I automate print starts without being on the same LAN?**
Cloud mode is documented in the README. LAN mode is faster and doesn't require internet access, but cloud mode extends reach to remote or mobile use cases.

**Q: What if the printer state doesn't update in OpenClaw?**
Status commands return machine-readable JSON output. If the state seems stale, re-run the status command rather than relying on cached output from a previous query.

**Q: Is it possible to control multiple printers from the same bambu-cli setup?**
Yes — bambu-cli supports multiple named printer profiles. Configure each printer with a distinct name using `bambu-cli config set --printer <name>`, then address them individually in commands with `--printer <name>`. The `--default` flag sets which printer is used when no name is specified.

**Q: How does OpenClaw actually help here beyond running the CLI commands?**
The value comes from the conversational layer. You can ask OpenClaw to "start a print when the current job finishes" — the agent can poll status, detect job completion, and issue the next command. You can also ask it to summarize errors from the status output in plain language, or to run a pre-print checklist against current printer state before starting. The CLI provides the control surface; OpenClaw provides the reasoning and orchestration.

## Key Takeaways

bambu-cli works because BambuLab printers expose a documented MQTT/FTPS interface, and the CLI wraps it with predictable configuration precedence and machine-readable output. The OpenClaw integration is most valuable not for individual commands, but for chained operations: checking status, deciding next steps, and running multi-step print workflows without manual intervention between each step. Secure your access code with file-based references and restricted permissions from the start — it's harder to retrofit this later.

## References

- [OpenClaw Showcase](https://docs.openclaw.ai/start/showcase)
- [bambu-cli repository](https://github.com/tobiasbischoff/bambu-cli)
- [bambu-cli README](https://github.com/tobiasbischoff/bambu-cli/blob/master/README.md?raw=1)

## Related Articles

- [Automating Padel Court Booking with padel-cli + OpenClaw](/blog/c02-padel-cli-booking-automation) — another hardware/service CLI wrapped into an OpenClaw plugin workflow
- [Managing Linear Issues with linear-cli + OpenClaw](/blog/c05-linear-cli-openclaw-issue-workflow) — the same pattern applied to project management automation
- [Running 14+ AI Agents in Parallel with OpenClaw](/blog/c06-multi-agent-orchestration-kev-dream-team) — scale up your automation with parallel agent workflows
