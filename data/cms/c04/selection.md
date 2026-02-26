# C04 Candidate Pool & Source Validation

Selection rule: prioritize candidates with **verifiable primary documentation** (official docs + repository README), and avoid social-only claims.

## Candidate Pool

| Candidate | Primary Source Coverage | Verifiability | Priority | Decision |
|---|---|---|---|---|
| Bambu 3D Printer Control | OpenClaw Showcase entry + GitHub README with commands, config, and networking notes | High | P1 | ✅ Selected |
| PR Review → Telegram Feedback | Showcase card + X post link | Medium (social-dependent) | P2 | Not selected |
| Tesco Shop Autopilot | Showcase card + X post link | Medium (social-dependent) | P2 | Not selected |
| Wine Cellar Skill in Minutes | Showcase card + X post link | Medium (social-dependent) | P3 | Not selected |

## Why Bambu 3D Printer Control was selected for C04

1. It has stable, checkable sources:
   - OpenClaw Showcase listing
   - Public GitHub README with executable command examples
2. Key capability claims (install, config, status/print commands, ports, secret handling guidance) are traceable to README lines.
3. It fits the C-series user-case format without inventing ROI metrics.

## Evidence Links

- OpenClaw Showcase: https://docs.openclaw.ai/start/showcase
- bambu-cli repository: https://github.com/tobiasbischoff/bambu-cli
- bambu-cli README (raw): https://github.com/tobiasbischoff/bambu-cli/blob/master/README.md?raw=1
