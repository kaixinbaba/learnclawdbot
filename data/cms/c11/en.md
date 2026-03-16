---
title: "Running OpenClaw on Raspberry Pi 5: Setup, Performance, and Real Expectations"
description: "Set up OpenClaw on a Raspberry Pi 5 for a private, always-on local AI gateway. Honest ARM64 install guide, model recommendations for limited RAM, and practical use cases."
publishedAt: 2026-03-14
status: published
visibility: public
author: "The Architect"
featuredImageUrl: /images/blog/c11-openclaw-raspberry-pi.webp
---

# Running OpenClaw on Raspberry Pi 5: Setup, Performance, and Real Expectations

The Raspberry Pi 5 is good enough to run OpenClaw as a private AI gateway, but only if you understand what "good enough" actually means.

It will not run a 70B model locally at acceptable speed. It will not replace a beefy dev workstation for heavy inference. What it will do — and does well — is act as a persistent, private router between your home devices and cloud AI providers, with enough spare compute to handle small local models when you want them.

I've had a Pi 5 8GB running OpenClaw as my home gateway for several months. Here's the honest picture.

## Hardware

The two Pi 5 variants make a real difference for this use case:

**4GB (~$60)**: Adequate for running OpenClaw as a pure cloud API gateway. OpenClaw itself is Node.js — it needs maybe 200–400MB RAM under normal load, which is well within 4GB. Gets tight if you add local inference.

**8GB (~$80)**: What I use and recommend. The extra headroom matters for running small local models (3B–7B parameters) alongside OpenClaw without memory pressure causing slowdowns.

**Storage matters more than most guides admit.** I learned this the hard way:

- **microSD**: Fine for testing. Write-intensive workloads (conversation history, logs) wear cards out. I killed two cards in six months before switching.
- **NVMe SSD via M.2 HAT**: Right choice for anything longer than a few weeks. A budget NVMe (~$20 for 128GB) over the Pi 5's PCIe 2.0 interface is dramatically faster than any microSD card.

**Cooling is not optional.** The Pi 5's Cortex-A76 cores throttle at 85°C. Under sustained Node.js load — which OpenClaw generates during active conversations — you'll hit this temperature without active cooling. The official Pi 5 Active Cooler (~$5) keeps it around 55–65°C under load. Without it, expect thermal throttling within minutes.

**Total bill for a solid, long-term setup**: Pi 5 8GB + M.2 HAT + 128GB NVMe + Active Cooler + official 27W USB-C supply ≈ $130–150. That's a one-time cost that pays back within months compared to a cloud VM.

## OS Setup

**Raspberry Pi OS 64-bit (Bookworm) is the right choice.** Other distros work but this is what has the best driver support for Pi 5's hardware, including the PCIe interface for NVMe.

Flash using Raspberry Pi Imager. In the advanced options, enable SSH and configure a hostname before flashing — saves 20 minutes of headache on first boot.

After first boot:

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git build-essential
```

**Run headless.** No desktop needed. This reclaims ~150MB RAM and reduces idle CPU by a few percent:

```bash
sudo raspi-config
# System Options → Boot / Auto Login → Console Autologin
```

**Docker alternative**: If you prefer containerized deployments for easier updates:

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
newgrp docker
sudo apt install -y docker-compose-plugin
```

## Installing OpenClaw on ARM64

ARM64 (aarch64) is fully supported. Follow the [official installation guide](https://docs.openclaw.ai) for your specific OpenClaw version — the exact steps vary between releases and deployment methods (bare Node, Docker, or systemd).

**1. Install Node.js 20.x** via NodeSource:

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node --version  # Should show v20.x.x
```

**2. Install OpenClaw** per [docs.openclaw.ai](https://docs.openclaw.ai). The docs specify whether to clone from source, use a release tarball, or pull a Docker image for your version.

**3. Configure your `.env`** with API keys and provider settings.

### Running as a Systemd Service

The right setup for anything you want to reliably run 24/7:

```bash
sudo nano /etc/systemd/system/openclaw.service
```

```ini
[Unit]
Description=OpenClaw AI Gateway
After=network.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/openclaw
ExecStart=/usr/bin/node server.js
Restart=on-failure
RestartSec=5
Environment=NODE_ENV=production
Environment=NODE_OPTIONS=--max-old-space-size=1024

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable openclaw
sudo systemctl start openclaw
```

The `NODE_OPTIONS=--max-old-space-size=1024` line is important — it raises Node.js's heap limit from the default ~512MB to 1GB. On the 8GB model, you can push this to 2048. Without it, long conversations will hit memory pressure and the process will restart.

## Swap (4GB Model)

Add 1GB of swap as a buffer against memory spikes:

```bash
sudo dphys-swapfile swapoff
sudo nano /etc/dphys-swapfile
# Set: CONF_SWAPSIZE=1024
sudo dphys-swapfile setup
sudo dphys-swapfile swapon
```

On NVMe this performs fine. On microSD it's slow enough to cause audible pauses in responses — another reason to use NVMe storage.

## What Models Actually Work

This section gets vague in most guides. Here's specific guidance:

**As a cloud gateway (no local inference)**: Any model works. OpenClaw routes API calls to DeepSeek, OpenAI, or Anthropic — the Pi just manages connections. CPU stays under 5%, RAM under 400MB. This is what I run 95% of the time.

**For local inference**: Stick to small models. The Pi 5's four Cortex-A76 cores generate tokens slowly on larger models.

Tested performance on Pi 5 8GB (Ollama, Q4_K_M quantization):

| Model | RAM required | Tokens/sec | Usable for chat? |
|---|---|---|---|
| Qwen2.5 1.5B | ~1GB | ~8–12 t/s | Yes, fast |
| Llama 3.2 3B | ~2GB | ~4–6 t/s | Yes, acceptable |
| Phi-3 Mini (3.8B) | ~2.5GB | ~3–5 t/s | Yes for short queries |
| Llama 3.1 7B (Q4) | ~4.5GB | ~1–2 t/s | Too slow for chat |
| Any 13B+ | Will OOM / barely runs | < 1 t/s | No |

The 7B threshold is real. 4 tokens per second sounds almost usable until you're waiting 15 seconds for a paragraph. For interactive chat, stay under 4B parameters. For batch offline processing where latency doesn't matter, 7B is manageable.

OpenClaw connects to locally-running Ollama via its OpenAI-compatible API endpoint. Configure it like any other provider.

## What This Setup Is Actually Good For

**Private document Q&A**: Point OpenClaw at a folder of PDFs or text files. All processing happens locally (with a local model) or goes to a cloud provider you've chosen — not a third-party service that holds your documents.

**Home Assistant integration**: OpenClaw's webhook plugin triggers Home Assistant automations via natural language. "Turn off all lights in 20 minutes" goes through the Pi. Combined with a voice interface, this replaces a lot of expensive smart home hub subscriptions.

**Local network monitoring**: Schedule OpenClaw to check device availability, summarize Pi-hole blocklist stats, or ping services and alert you via messaging app.

**Always-on household AI gateway**: Family members message a WhatsApp or Telegram number, get AI responses, without each person needing their own API account. The Pi handles routing; they interact normally.

**Personal notes and journal**: Voice memos from your phone get routed to OpenClaw, auto-processed, tagged, and saved. Requires the WhatsApp or Telegram plugin plus a file system plugin for storage.

## FAQ

**Can it run models offline without a cloud API?**
Yes, via Ollama with 1.5B–3B models. Response quality is noticeably below GPT-4o-class. For factual Q&A or simple tasks, workable. For anything nuanced, cloud routing is much better.

**How much power does this draw?**
~5W idle, up to ~12W under sustained load. At typical household usage (mostly idle with bursts), under 5kWh/month — pennies in most regions. Significantly less than leaving a laptop running.

**Is this secure on a home network?**
Keep the OpenClaw dashboard behind your firewall — never expose it directly to the internet. For remote access, use a VPN or SSH tunnel. If you're using Twilio or other webhooks, only expose that specific webhook endpoint, not the full dashboard.

**What happens during an internet outage?**
Cloud provider requests fail. With a local Ollama model configured as fallback, basic functionality continues offline. The Pi itself keeps running fine.

**4GB or 8GB?**
Pure cloud gateway use: 4GB with 1GB swap is fine. Anything involving local inference or multiple simultaneous skills: 8GB.

## Related Articles

- [OpenClaw + DeepSeek: The Low-Cost AI Assistant That Actually Delivers](/blog/openclaw-deepseek-low-cost) — pair your Pi gateway with DeepSeek for the lowest-cost cloud backend
- [Building Your First Voice Assistant with OpenClaw](/blog/voice-assistant-openclaw) — add a phone-callable voice interface to your Pi-hosted OpenClaw instance
- [10 OpenClaw Plugins That Changed How I Work](/blog/openclaw-plugins-productivity) — the plugins worth running on a Pi gateway
- [Claude Code vs OpenClaw: An Honest Comparison for 2026](/blog/claude-code-vs-openclaw) — understand why OpenClaw is the right choice for self-hosted deployments
