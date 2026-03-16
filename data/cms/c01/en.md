---
title: "Declarative OpenClaw Deployment with nix-openclaw"
description: "How a small ops team standardized OpenClaw deployment with nix-openclaw, Home Manager, and reproducible configuration across macOS and Linux."
featuredImageUrl: /images/blog/c01-nix-openclaw-declarative-deployment.webp
publishedAt: 2026-01-10
status: published
visibility: public
author: "The Curator"
---

# C01 User Case: Declarative OpenClaw Deployment with nix-openclaw

## Case Profile

- **Category:** Deployment / Infrastructure
- **Audience:** Engineering teams maintaining long-running OpenClaw instances
- **Sources:**
  - [OpenClaw Docs: Nix Installation](https://docs.openclaw.ai/install/nix)
  - [openclaw/nix-openclaw](https://github.com/openclaw/nix-openclaw)

## Background

A three-person platform team ran OpenClaw on one Mac mini and one Linux VPS. Their old workflow was command-by-command setup plus manual plugin installs. After each OS update or machine replacement, setup drift appeared:

- Different CLI tool versions across machines
- Hard-to-audit local edits in runtime configs
- Slow recovery after failed upgrades

They needed a deployment path with deterministic builds and predictable rollback behavior.

## Pain Points Before Migration

1. **Configuration drift** between environments
2. **Weak reproducibility** when onboarding a new machine
3. **Risky updates** without a clear rollback procedure
4. **Mixed ownership** between immutable config and mutable runtime state

## Why They Chose nix-openclaw

From the official docs and repository, nix-openclaw provides:

- A **Home Manager module** for declarative OpenClaw setup
- Pinned dependencies and package graph via Nix
- Service integration: **launchd** on macOS and **systemd --user** on Linux
- OpenClaw **Nix mode** (`OPENCLAW_NIX_MODE=1`) to disable self-mutation flows
- Fast rollback through Home Manager generations

## Deployment Path

### 1) Initialize flake from template

The team started from the official template (`templates/agent-first/flake.nix`) and filled placeholders for user, system, and channels.

### 2) Separate pinned config from runtime state

They kept:

- Declarative config in flake + `programs.openclaw.config`
- Documents (`AGENTS.md`, `SOUL.md`, `TOOLS.md`) in a managed directory
- Runtime/session data in `~/.openclaw`

This follows the "pinned config vs runtime state" boundary described in Golden Paths guidance.

### 3) Enable channels and secrets via file paths

Telegram token and provider keys were injected using file references instead of inline secrets in config.

### 4) Apply and verify

```bash
home-manager switch --flake .#<user>
```

Verification used service-level checks:

- macOS: `launchctl print gui/$UID/com.steipete.openclaw.gateway`
- Linux: `systemctl --user status openclaw-gateway`

## Outcome

After migration, their deployment became repeatable and reviewable:

- New machine bootstrap changed from ad-hoc steps to one flake-based workflow
- Update confidence improved with deterministic dependency pinning
- Rollback path became explicit (`home-manager switch --rollback`)
- Team discussions shifted from "what did we change locally" to PR-based config diffs

## Practical Notes

- macOS privacy permissions (TCC) still need one-time manual approval for specific capabilities.
- Nix mode should stay enabled in declarative setups to avoid runtime auto-mutation.
- Keep plugin sources pinned and treat every deployment as a code-reviewed infrastructure change.

## Frequently Asked Questions

**Q: Do I need Nix experience before setting up nix-openclaw?**
Basic Nix/NixOS familiarity helps, but the official template provides a starting point that works without deep Nix knowledge. The main concepts you need are flakes, Home Manager modules, and how to run `home-manager switch`.

**Q: Can I use nix-openclaw with an existing OpenClaw installation?**
Yes. You can migrate an existing setup by exporting your current config, translating key settings to the declarative format, and running an initial `home-manager switch`. Existing runtime state in `~/.openclaw` is preserved.

**Q: What happens to plugins during a rollback?**
Plugins installed via the Nix config roll back with the full Home Manager generation. Plugins installed at runtime (outside the Nix config) are unaffected by the rollback.

**Q: How should we handle secrets and API keys in a declarative setup?**
Never embed API keys directly in your flake config — those end up in the Nix store which is world-readable. Instead, use file-path references pointing to secrets managed outside the config (e.g., `~/.secrets/openai-key`), or integrate with `agenix` or SOPS for encrypted secrets. The nix-openclaw Golden Paths documentation covers this pattern explicitly.

**Q: Can we run nix-openclaw on both macOS and Linux from the same config?**
Yes — the module handles platform differences internally. Service wiring maps to `launchd` on macOS and `systemd --user` on Linux. You define a single configuration block; nix-openclaw resolves the platform-specific service unit automatically during `home-manager switch`.

## Key Takeaways

Declarative deployment with nix-openclaw addresses three specific operational problems: configuration drift between machines, risky upgrades without a clear rollback path, and unclear boundaries between managed config and runtime state. The approach works best when the team treats the flake config as the source of truth — every change goes through a PR, every deployment is reproducible, and rollback is a single command. The main upfront investment is learning the pinned-config vs. runtime-state boundary; once that's clear, the operational benefits compound over time.

## References

- [OpenClaw Nix installation overview](https://docs.openclaw.ai/install/nix)
- [nix-openclaw README and module options](https://github.com/openclaw/nix-openclaw)
- [Golden Paths guidance](https://github.com/openclaw/nix-openclaw/blob/main/docs/golden-paths.md)

## Related Articles

- [Running 14+ AI Agents in Parallel with OpenClaw](/blog/c06-multi-agent-orchestration-kev-dream-team) — once your deployment is stable, scale up with parallel subagents
- [Claude Code vs OpenClaw: An Honest Comparison for 2026](/blog/claude-code-vs-openclaw) — understand how OpenClaw compares to other tools before committing to a deployment strategy
- [10 OpenClaw Plugins That Changed How I Work](/blog/openclaw-plugins-productivity) — explore the plugins worth including in your declarative config
