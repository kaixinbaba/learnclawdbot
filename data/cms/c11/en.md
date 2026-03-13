---
title: "Running OpenClaw on Raspberry Pi 5: Setup, Performance, and Real Expectations"
description: "Set up OpenClaw on a Raspberry Pi 5 for a private, always-on local AI gateway. Honest ARM64 install guide, model recommendations for limited RAM, and practical use cases."
publishedAt: 2026-03-14
status: published
visibility: public
---

# Running OpenClaw on Raspberry Pi 5: Setup, Performance, and Real Expectations

The Raspberry Pi 5 is genuinely good enough to run OpenClaw as a lightweight AI gateway — but "good enough" needs a bit of context. It's not going to run a 70B parameter model locally. What it *will* do is act as a persistent, private router between your home devices and cloud AI providers, with enough compute to handle lightweight local inference if you pick the right models.

This guide covers the real setup process, what to realistically expect from different hardware configurations, and which AI models actually work well on the Pi 5's constraints.

## Hardware: What You Actually Need

The Pi 5 comes in two RAM configurations that make a meaningful difference for this use case:

**4GB model (~$60)**: Sufficient for running OpenClaw as a cloud API gateway. You're routing requests to DeepSeek, OpenAI, or other providers — OpenClaw itself doesn't need much RAM for this. Tight if you want to add local inference.

**8GB model (~$80)**: Recommended if you want to experiment with running small local models (3B–7B parameters) alongside OpenClaw. The extra headroom matters.

Beyond the board itself, the storage choice matters more than most guides admit:

- **microSD**: Fine for testing. Gets slow under write-heavy workloads (OpenClaw's conversation history, logs). Cards wear out faster than you'd expect under continuous use.
- **NVMe SSD via M.2 HAT**: The right choice for a production-grade setup. Pi 5's PCIe 2.0 interface is fast enough that a budget NVMe (~$20 for 128GB) dramatically outperforms any microSD.

For cooling: the Pi 5 throttles above 85°C. At peak load running Node.js, it will hit this without active cooling. The official Pi 5 Active Cooler (~$5) or the Pimoroni Pico HAT solves this cleanly.

**Total hardware cost for a solid setup**: Pi 5 8GB + M.2 HAT + 128GB NVMe + active cooler + 27W USB-C supply ≈ $130–150.

## OS Setup

### Raspberry Pi OS (64-bit) — Recommended

Flash the 64-bit Raspberry Pi OS (Bookworm) using Raspberry Pi Imager. In the Imager's advanced options, enable SSH and set a hostname before flashing — this saves a lot of headache on first boot.

After first boot:

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git build-essential
```

Run headless (no desktop) to reclaim ~150MB RAM and reduce idle CPU load:

```bash
sudo raspi-config
# → System Options → Boot / Auto Login → Console Autologin
```

### Docker (Alternative)

If you prefer containerized deployments and easy updates:

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
newgrp docker
sudo apt install -y docker-compose-plugin
```

## Installing OpenClaw on ARM64

ARM64 (aarch64) is fully supported by OpenClaw. Follow the official installation guide at [docs.openclaw.ai](https://docs.openclaw.ai) for your specific version — the exact steps vary slightly between releases and deployment methods.

The general flow is:

**1. Install Node.js 20.x** via NodeSource:

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node --version  # Verify: should show v20.x.x
```

**2. Install OpenClaw** following the instructions at [docs.openclaw.ai](https://docs.openclaw.ai). The docs will tell you whether to clone from source, use a release tarball, or pull a Docker image — this varies by version.

**3. Configure your environment** by editing the `.env` file with your API keys and provider settings.

### Running as a System Service

To ensure OpenClaw starts automatically on boot, create a systemd service:

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

The `NODE_OPTIONS=--max-old-space-size=1024` line raises Node.js's heap limit from the default ~512MB to 1GB — important on a 4GB Pi. On the 8GB model, you can push this to 2048.

## Swap Configuration (4GB Model)

Add swap as a safety net to handle memory spikes:

```bash
sudo dphys-swapfile swapoff
sudo nano /etc/dphys-swapfile
# Set: CONF_SWAPSIZE=1024
sudo dphys-swapfile setup
sudo dphys-swapfile swapon
```

With NVMe (not microSD), swap performance is acceptable. On microSD, swap will be slow enough to cause noticeable pauses — another reason to use NVMe for any serious workload.

## Which AI Models Work on a Raspberry Pi 5?

This is where most guides get vague. Here's honest guidance:

**As a cloud gateway** (no local inference): Any model works. OpenClaw routes API calls to DeepSeek, OpenAI, Anthropic, etc. The Pi 5 just manages the connections — CPU and RAM usage stay low. This is the recommended setup for most people. See [OpenClaw + DeepSeek setup](/blog/openclaw-deepseek-low-cost) for the cheapest cloud option.

**For local inference** (models running on the Pi itself): Stick to small models. The Pi 5's Cortex-A76 CPUs generate tokens slowly on anything larger than a few billion parameters.

Practical local model options that work on the Pi 5 8GB:
- **Qwen2.5 1.5B or 3B** (via Ollama or llama.cpp): Fast enough for interactive chat, reasonable quality
- **Llama 3.2 3B**: Good general-purpose model at this scale
- **Phi-3 Mini (3.8B)**: Strong coding and reasoning for its size

Avoid loading 7B+ models on the Pi 5 unless you're prepared for very slow token generation (often 1–3 tokens/second). A 13B model will run, but barely. For reference, a 7B model at Q4 quantization requires roughly 4GB of RAM — leaving little room for the OS and OpenClaw on a 4GB board.

OpenClaw can connect to locally-running Ollama instances via the OpenAI-compatible API endpoint. Configure it like any other provider in your `.env` or Dashboard settings.

## Practical Use Cases

Here's what actually works well with an always-on Pi 5 OpenClaw setup:

**Private document Q&A**: Point OpenClaw at a folder of PDFs or text files and ask questions over them. All processing stays local (if you're using a local model) or is handled by a cloud provider of your choosing — no third-party service holding your documents.

**Home Assistant integration**: OpenClaw's webhook plugin can trigger Home Assistant automations via natural language. "Turn off all lights in 20 minutes" becomes a voice command processed on your Pi. Especially useful combined with a voice interface — see [voice assistant setup](/blog/voice-assistant-openclaw).

**Local network monitoring**: Schedule OpenClaw to check device availability, summarize Pi-hole blocklist stats, or ping services and alert you via messaging apps.

**Personal journal and notes**: Append notes or voice memos from your phone via a messaging plugin, have them auto-processed, tagged, and searchable.

**Always-on chat gateway for your household**: Family members can message a WhatsApp or Telegram number and get AI responses, without each person needing their own API account.

## Frequently Asked Questions

**Can the Pi 5 run models offline without any cloud API?**
Yes, using Ollama with small models (1.5B–3B parameters). Expect response quality significantly below GPT-4o-class models. For most practical household tasks, a cloud API routed through OpenClaw gives much better results at very low cost.

**How much electricity does this use?**
The Pi 5 draws roughly 5W at idle and up to 12W under sustained load. At typical usage patterns (mostly idle with occasional bursts), expect well under 5kWh per month — a few cents in most regions.

**Is it secure to run this on my home network?**
OpenClaw's dashboard should not be exposed to the public internet without authentication. Keep it behind your firewall and access it via VPN or SSH tunnel if you need remote access. If you use Twilio or other webhooks, only expose the specific webhook endpoint, not the full dashboard.

**What happens when my internet goes down?**
If you're using cloud providers, the assistant won't be able to process requests during an outage. With a local model running via Ollama, basic functionality continues offline.

**Should I use the 4GB or 8GB model?**
For pure cloud gateway use: 4GB is fine. If you want local model experiments or plan to run multiple skills simultaneously: 8GB.
