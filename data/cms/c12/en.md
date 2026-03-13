---
title: "10 Must-Have OpenClaw Plugins for Productivity"
description: "Discover the top 10 OpenClaw plugins to supercharge your AI assistant. From Google Search to Slack and GitHub, here's what each plugin actually does and how to get started."
publishedAt: 2026-03-14
status: published
visibility: public
---

# 10 Must-Have OpenClaw Plugins for Productivity

Out of the box, OpenClaw is a capable AI assistant. But its real power comes from **plugins** — modular extensions that connect your assistant to the tools you actually use. A plugin isn't just a wrapper; it gives the AI real ability to act, not just advise.

## How OpenClaw Plugins Work

Each plugin is defined by a manifest file (`openclaw.plugin.json`) that describes what the plugin can do. The manifest tells OpenClaw:

- What **actions** the plugin exposes (e.g., `search_web`, `create_issue`, `send_message`)
- What **authentication** it needs (API keys, OAuth tokens)
- A natural-language **description** the AI uses to decide when to invoke it

At runtime, when you say "find me recent news about X," the AI sees the Google Search plugin's description and decides to use it. You don't have to explicitly invoke plugins — they activate when relevant.

You can browse and install community plugins from [ClawdHub](https://clawdhub.com). Each listing shows the plugin's actions, required credentials, user ratings, and a changelog.

---

## The Top 10 Plugins

### 1. Google Search

**What it does**: Executes live web searches and pulls structured results, news, or page snippets directly into your conversation context.

**Why it matters**: Without this, your AI assistant's knowledge cuts off at its training date. With it, you can ask about current events, recent software releases, live prices, or anything else that changes.

**Practical example**: "What breaking changes were introduced in React 19?" — the assistant searches, reads the relevant docs, and gives you a specific answer rather than a guess from training data.

**Where to find it**: Search "Google Search" on [ClawdHub](https://clawdhub.com). Requires a Google Custom Search API key (available free tier for low volume).

---

### 2. Browser Relay

**What it does**: Controls a headless browser to fetch, render, and extract content from any webpage — including JavaScript-heavy sites that break simple scrapers.

**Why it matters**: Search engines return links. This plugin gives the AI the actual page content. Indispensable for competitor analysis, research, or reading paywalled content you have legitimate access to.

**Practical example**: "Summarize the key findings from this research paper [URL]" — the plugin fetches the full page, the AI reads it and gives you a structured summary.

**A note**: This plugin can be slow on pages with heavy JavaScript rendering. For simple static pages, the Google Search plugin's snippet extraction is often faster.

---

### 3. File System Manager

**What it does**: Read, write, move, copy, and delete files and directories on your local machine or connected drives.

**Why it matters**: This is the bridge between AI assistance and your actual files. Instead of copying content back and forth, the AI works directly with your filesystem.

**Practical example**: "Find all `.log` files in `/var/log` modified in the last 24 hours, summarize any ERROR lines, and save the summary to my desktop."

**Security note**: Configure the plugin's allowed paths carefully. You don't want to grant it access to your entire filesystem — scope it to the directories it needs.

---

### 4. GitHub Integration

**What it does**: Create issues, open pull requests, read file contents, search code, post comments, and check workflow status across your GitHub repositories.

**Why it matters**: Turns your AI assistant into a coding collaborator that can actually take action — not just suggest what you should do.

**Practical example**: After debugging a session in chat, tell it: "Create a GitHub issue for this bug in the `auth` repo with the description and reproduction steps we just worked through." It creates the issue with proper formatting.

**Requires**: A GitHub Personal Access Token with appropriate repo permissions.

---

### 5. Twilio Voice

**What it does**: Make and receive phone calls, send SMS messages, and bridge telephone interactions with your AI assistant.

**Why it matters**: Enables a genuine voice interface — call your AI assistant from any phone, anywhere. No app required for the caller.

**Best use**: This plugin is the foundation for building a full voice assistant — see the [voice assistant setup guide](/blog/voice-assistant-openclaw) for the complete walkthrough including STT/TTS configuration.

**Requires**: A Twilio account with a phone number and credentials. Twilio charges per call/SMS, with pricing on their website.

---

### 6. Calendar (Google / Outlook)

**What it does**: Read, create, update, and delete calendar events across Google Calendar and Microsoft Outlook, including checking attendee availability.

**Why it matters**: Your AI assistant becomes genuinely useful for scheduling when it can see your actual calendar — not just suggest times blindly.

**Practical example**: "Block two hours tomorrow morning for deep work, but check first that I don't already have something scheduled." It checks your calendar, finds a gap, and creates the block.

**Requires**: OAuth authorization for your Google or Microsoft account.

---

### 7. Email (Gmail / Outlook)

**What it does**: Read, draft, send, search, and organize emails from your connected accounts.

**Why it matters**: Email triage is one of the highest-ROI tasks to delegate. "Summarize my unread emails from the last 24 hours and flag anything that looks time-sensitive" is a genuinely useful daily workflow.

**Practical example**: "Draft a polite follow-up to the proposal I sent to Acme Corp last Tuesday. Keep it under 100 words." It finds the original sent email, reads the context, and writes the follow-up.

**Requires**: OAuth authorization. The plugin does not store your email credentials — it uses OAuth tokens that can be revoked anytime.

---

### 8. WhatsApp

**What it does**: Send and receive WhatsApp messages via the WhatsApp Business API or supported third-party bridges.

**Why it matters**: Large parts of the world communicate primarily on WhatsApp. This plugin brings your AI into those channels — for personal use, family coordination, or small business customer interactions.

**Practical setup**: The official WhatsApp Business API requires business verification. For personal use, some third-party bridges offer simpler setup (check ClawdHub for current options and their status, as this integration landscape changes frequently).

---

### 9. Slack

**What it does**: Post messages, read channel history, search workspace content, respond to mentions, and create scheduled posts in Slack.

**Why it matters**: For teams already living in Slack, this brings the AI into existing workflows rather than requiring a context switch.

**Practical example**: "Summarize yesterday's discussion in #engineering and post a brief status update to #team-updates based on what was resolved." It reads the channel history and posts the summary.

**Requires**: A Slack app with appropriate OAuth scopes (the plugin's ClawdHub listing specifies which scopes are needed).

---

### 10. ClawdHub Marketplace

**What it does**: Browse, install, update, and remove plugins directly from within OpenClaw's chat interface — without touching config files.

**Why it matters**: The plugin ecosystem grows regularly. New integrations for tools like Notion, Linear, Airtable, and Jira appear on ClawdHub frequently. This plugin makes keeping up with those additions trivial.

**Practical example**: "What Notion plugins are available on ClawdHub?" — it queries the marketplace and shows you current options with descriptions.

---

## How to Install Plugins

**Via Dashboard (recommended)**:

1. Open your OpenClaw Dashboard at `http://localhost:3000`
2. Go to **Plugins → Browse**
3. Search for the plugin by name, or browse by category
4. Click **Install** and provide any required API keys or OAuth authorization
5. The plugin is immediately available — test it by asking OpenClaw to use it

**Via ClawdHub directly**:

Visit [clawdhub.com](https://clawdhub.com), find the plugin, and follow its installation instructions. Each plugin page shows exactly what credentials are needed before you start.

**Manual installation** (for custom or private plugins):

Place your plugin directory (containing `openclaw.plugin.json` and any supporting files) in OpenClaw's plugins folder, then reload OpenClaw. Refer to [docs.openclaw.ai](https://docs.openclaw.ai) for the exact plugin directory path for your installation.

## A Note on Plugin Quality

Not all community plugins on ClawdHub are equally maintained. Before installing a plugin, check:
- When it was last updated
- The number of installs and ratings
- Whether the author has responded to issues in the comments

The plugins listed above are among the most widely used and actively maintained in the ecosystem. For niche tools, verify the plugin is still being updated before building workflows around it.

## Related Reading

- [Building a Voice Assistant with OpenClaw](/blog/voice-assistant-openclaw) — uses the Twilio Voice plugin plus STT/TTS to build a phone-callable AI
- [OpenClaw vs Claude Code: Which Should You Use?](/blog/claude-code-vs-openclaw) — if you're still deciding whether OpenClaw fits your workflow

## Frequently Asked Questions

**Are plugins secure? What data do they access?**
Each plugin only accesses what you explicitly authorize. API keys and OAuth tokens are stored in your OpenClaw instance, not transmitted to ClawdHub. Review each plugin's manifest (visible on its ClawdHub page) to see exactly what permissions it requests.

**Can I build my own plugin?**
Yes. A plugin is a folder containing a `openclaw.plugin.json` manifest and any server-side code needed to handle actions. The [OpenClaw developer docs](https://docs.openclaw.ai) cover the manifest format and how to test locally before publishing to ClawdHub.

**Do plugins work with all AI models?**
Yes — plugins are model-agnostic. The AI model (DeepSeek, GPT-4o, Claude, etc.) reads the plugin manifest and decides when to invoke it based on the conversation. Different models may vary slightly in how reliably they invoke plugins, but all supported models work with the plugin system.

**What if a plugin breaks or stops working?**
Most breakage is due to API credential expiry or upstream service changes. Check the plugin's ClawdHub page for known issues and updates. You can always disable a plugin from the Dashboard without uninstalling it.
