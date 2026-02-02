# LearnClawdBot.org 🤖📚

[🇨🇳 中文](./README-zh.md) | [🇯🇵 日本語](./README-ja.md) | [🇰🇷 한국어](./README-ko.md)

**The most comprehensive multilingual documentation site for [OpenClaw](https://github.com/openclaw/openclaw)** — your open-source AI assistant framework.

🌐 **Live Site:** [https://learnclawdbot.org](https://learnclawdbot.org)

---

## ✨ What is This?

LearnClawdBot.org is an **unofficial, community-driven** documentation and tutorial site for OpenClaw (formerly Moltbot/Clawdbot). We provide:

- 📖 **264+ documentation pages** covering every aspect of OpenClaw
- 🌍 **4 languages** — English, Chinese (中文), Japanese (日本語), Korean (한국어)
- 🔧 **Step-by-step tutorials** for setup, configuration, and advanced usage
- 💡 **Real-world examples** and best practices
- 📝 **Blog posts** with tips, integrations, and use cases

## 🌍 Language Coverage

| Language | Docs | Status |
|----------|------|--------|
| 🇺🇸 English | 264 pages | ✅ Complete |
| 🇨🇳 中文 | 264 pages | ✅ Complete |
| 🇯🇵 日本語 | 264 pages | ✅ Complete |
| 🇰🇷 한국어 | 260 pages | 🔄 98% Complete |

## 📚 Documentation Structure

```
docs/
├── en/          # English (source)
├── zh/          # Chinese
├── ja/          # Japanese
├── ko/          # Korean
│
├── channels/    # Telegram, Discord, WhatsApp, Signal, Slack, LINE...
├── cli/         # CLI reference (41 commands)
├── concepts/    # Architecture, agents, sessions, models...
├── gateway/     # Configuration, security, remote access...
├── install/     # npm, Docker, Nix, Bun...
├── nodes/       # Mobile nodes, camera, audio, location...
├── platforms/   # macOS, Linux, Windows, Raspberry Pi, cloud...
├── plugins/     # Voice call, agent tools, manifests...
├── providers/   # Anthropic, OpenAI, Ollama, DeepSeek, Gemini...
├── start/       # Quick start guides
├── tools/       # Browser, exec, skills, subagents...
└── web/         # Dashboard, webchat, control UI...
```

## 🛠️ Tech Stack

- **Framework:** [Next.js](https://nextjs.org/) (App Router)
- **Docs Engine:** [Fumadocs](https://fumadocs.vercel.app/)
- **Styling:** Tailwind CSS
- **i18n:** next-intl (4 locales)
- **Deployment:** Vercel
- **CMS:** MDX-based content

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- pnpm (recommended) or npm

### Installation

```bash
git clone https://github.com/kaixinbaba/learnclawdbot.git
cd learnclawdbot
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) to see the site.

### Build

```bash
pnpm build
```

## 🤝 Contributing

Contributions are welcome! Here's how you can help:

- **🌍 Translation improvements** — Fix translation quality or add missing pages
- **📝 Content updates** — Keep docs in sync with the latest OpenClaw releases
- **🐛 Bug fixes** — Report or fix issues with the site
- **✨ New tutorials** — Write blog posts about OpenClaw use cases

### Translation Guide

1. English docs in `docs/en/` are the source of truth
2. Translated docs go in `docs/{locale}/` with the same file structure
3. Keep MDX structure identical — only translate text content
4. Preserve code blocks, inline code, and technical terms in English

## 📊 OpenClaw Topics Covered

- **19 channel integrations** — Telegram, Discord, WhatsApp, Signal, Slack, LINE, Matrix, Twitch, and more
- **19 AI providers** — Anthropic, OpenAI, Ollama, DeepSeek, Gemini, Qwen, and more
- **14 platform guides** — macOS, Linux, Windows, Docker, Raspberry Pi, cloud platforms
- **22 tool references** — Browser automation, code execution, skills, subagents
- **30 concept explainers** — Agent architecture, sessions, model failover, context management

## 📄 License

This project is open source. Documentation content is provided for educational purposes.

## 🔗 Links

- 🌐 **Website:** [learnclawdbot.org](https://learnclawdbot.org)
- 🤖 **OpenClaw:** [github.com/openclaw/openclaw](https://github.com/openclaw/openclaw)
- 📖 **Official Docs:** [docs.openclaw.ai](https://docs.openclaw.ai)
- 💬 **Community:** [OpenClaw Discord](https://discord.com/invite/clawd)

---

*Built with ❤️ by the OpenClaw community*
