---
title: "C04 User Case: Operating BambuLab Printers with bambu-cli + OpenClaw"
description: "How users can run a repeatable BambuLab control workflow with bambu-cli and OpenClaw, based on documented commands and networking requirements."
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

## References

- [OpenClaw Showcase](https://docs.openclaw.ai/start/showcase)
- [bambu-cli repository](https://github.com/tobiasbischoff/bambu-cli)
- [bambu-cli README](https://github.com/tobiasbischoff/bambu-cli/blob/master/README.md?raw=1)
