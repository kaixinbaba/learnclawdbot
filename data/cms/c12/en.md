---
title: "10 OpenClaw Plugins That Changed How I Work"
description: "Real-world experience with the OpenClaw plugins I rely on daily. Not a feature list — these are the integrations that actually stuck, why they work, and one thing each of them gets wrong."
publishedAt: 2026-03-14
status: published
visibility: public
author: "The Architect"
featuredImageUrl: /images/blog/c12-openclaw-plugins-productivity.webp
---

# 10 OpenClaw Plugins That Changed How I Work

Most plugin roundups are written by people who've tested each one for 20 minutes. This isn't that. These are the plugins I installed over the past several months and either kept or removed — and why.

A few I listed didn't make the cut and aren't here. A calendar plugin I tried had OAuth issues and silently dropped events without any error message. I removed it. What's below survived actual use.

## How the Plugin System Works (The Short Version)

Each plugin is a manifest file (`openclaw.plugin.json`) that tells OpenClaw what actions are available — `search_web`, `create_issue`, `send_message` — and what the AI should understand about when to use them. At runtime, the model reads those descriptions and decides whether to invoke the plugin based on what you said.

The implication: **you don't need to invoke plugins manually**. Saying "find recent papers on quantum error correction" is enough for the AI to reach for the Google Search plugin without you specifying it. When it works, this is surprisingly seamless. When the model doesn't invoke a plugin you expected it to, you add a line to the system prompt clarifying when that plugin applies.

Browse and install from [ClawdHub](https://clawdhub.com).

---

## 1. Google Search

The plugin that makes an AI assistant actually useful for real work.

Without live search, every AI assistant lies confidently about anything that changed after its training cutoff. With it, "what's the current stable version of Bun?" or "did anything break in the latest Next.js release?" becomes a useful question instead of a liability.

The practical limit: it retrieves search result snippets, not full page content. For digging into an article or documentation page, that's where Browser Relay comes in.

**Setup**: Requires a Google Custom Search Engine API key. The free tier covers roughly 100 queries/day, which is plenty for personal use. ClawdHub listing includes setup instructions.

**One thing it gets wrong**: Occasionally it'll search for something when you just wanted the AI's general opinion on a well-established topic. A line in your system prompt like "search the web when asked about recent events or specific current data" helps calibrate this.

---

## 2. Browser Relay

Google Search tells you a page exists. Browser Relay actually reads it.

This plugin uses a headless browser to fetch and render any URL — including JavaScript-heavy SPAs that break simple HTTP scrapers — and returns the page content to the conversation. I use it constantly for reading documentation pages, GitHub issues, and archived articles.

**The workflow I rely on**: "Summarize the migration guide at this URL and tell me what would break if I upgraded from version 3 to version 4." The plugin fetches the full page, the model reads it and gives me a structured answer.

**One thing it gets wrong**: Render time on heavy pages can be 5-8 seconds. For quick lookups this is annoying. I keep both this and Google Search configured — the search plugin for quick answers, Browser Relay when I need to read the actual page.

---

## 3. File System Manager

This one I was skeptical about. I've been using the terminal for 15 years; why would I want an AI touching my filesystem?

Turns out the value isn't replacing `ls` and `mv`. It's the combination: the AI can search, read, process, and write in a single chain. "Find all `.log` files in `/var/log` from the last 24 hours, pull out any ERROR lines, write a summary to `~/Desktop/log-report.txt`" — that's five separate terminal commands replaced with one instruction.

**Important**: Configure allowed paths carefully. I restrict the plugin to my home directory subdirectories. You absolutely don't want this plugin operating on `/etc` or anything system-level.

**One thing it gets wrong**: Error messages when a path doesn't exist are vague. It'll say the operation failed without telling you whether it was a permissions issue or a missing file. Check your path configuration first when something doesn't work.

---

## 4. GitHub Integration

The best way I've found to describe this plugin: it turns the AI from an advisor into a participant.

Without it, you explain a bug, the AI suggests a fix, you go implement it, create the issue, write the PR description. With it, after a debugging session you say "create a GitHub issue in repo X describing this problem with the reproduction steps we just worked through" — and it does, with proper formatting, labels, and a clear title.

I use it most for:
- Creating issues after debugging sessions (the context is already in the conversation)
- Checking what's currently in a file on a branch before making changes
- Searching code across a repository when I don't have it checked out locally

**Requires**: A Personal Access Token with `repo` scope. Create one at GitHub Settings → Developer settings → Personal access tokens.

**One thing it gets wrong**: It doesn't handle private organization repos without extra token configuration. The public docs on this are thin — check the ClawdHub plugin comments for the right token scope setup.

---

## 5. Twilio Voice

This is the plugin that makes the whole system feel like science fiction, and also the one with the most setup friction.

It bridges phone calls to your AI assistant. You call a Twilio number, speak your question, hear the answer. No app, no login, just a phone call. I use this in the car more than anywhere else.

For the full setup walkthrough — including STT/TTS configuration, system prompt tuning for voice, and latency optimization — the [voice assistant guide](/blog/voice-assistant-openclaw) covers everything this plugin needs to actually work well.

**One thing it gets wrong**: The first call after restarting OpenClaw takes 3–5 seconds longer than normal (cold start). Subsequent calls are fine. If you're demoing this to someone, do a warmup call first.

---

## 6. Email (Gmail / Outlook)

Email triage is the task I most consistently didn't do before this plugin existed.

The workflow: in the morning, "summarize my unread emails from the last 12 hours, flag anything that looks urgent." It reads through everything, gives me a brief rundown, and highlights the one or two things that need a response today. Takes about 30 seconds. I then handle the flagged ones and ignore the rest until later.

The draft feature is genuinely useful for follow-ups: "draft a reply to the email from Sarah asking about the project timeline. Be direct, two paragraphs max." It finds the email thread automatically from context, drafts the reply, and pastes it into the conversation for me to review before sending.

**Requires**: OAuth authorization. The plugin doesn't store credentials — it uses OAuth tokens that can be revoked anytime from your Google or Microsoft account settings.

**One thing it gets wrong**: Thread context sometimes gets lost on long email chains. For threads longer than about 15 messages, the summary can miss earlier context. For those cases I manually paste the relevant thread into the conversation.

---

## 7. Calendar (Google / Outlook)

Less flashy than email, more consistently useful.

The main thing I use this for: scheduling requests that actually check whether I'm free. "Block 90 minutes tomorrow morning for deep work" becomes "blocked 9–10:30am, which was the only gap before your 11am call." It knows my actual schedule.

The second use: end-of-day check-in. "What's on my calendar tomorrow?" gives me a spoken rundown (via the Twilio plugin) when I'm heading out.

**Requires**: OAuth. If you've already set up the Email plugin, this uses the same authorization flow.

**One thing it gets wrong**: Timezone handling is occasionally wrong for events created with explicit timezone overrides. If you travel a lot and schedule meetings across timezones, double-check the times it creates.

---

## 8. WhatsApp

The most significant thing about this plugin is the use case it enables, not the plugin itself: it makes your AI accessible to people who would never install an app or create an account.

In my household, this means family members can message a WhatsApp number to check something — "what time does the pharmacy close today?" — and get an answer routed through the same OpenClaw setup I use for work.

**Practical note on setup**: The official WhatsApp Business API requires business verification, which is a real process. For personal use, third-party bridges are faster to get running — check current ClawdHub listings for what's available and maintained, as this changes. Don't try to set up the official API just for personal use; it's not worth the overhead.

**One thing it gets wrong**: Message delivery occasionally has a 2–5 second delay that isn't visible to you as the operator. For time-sensitive responses, manage expectations with users.

---

## 9. Slack

If your team is in Slack, this plugin either becomes part of your daily workflow or it doesn't get used at all. There isn't much middle ground.

The use case that made it stick for me: morning standup preparation. "Summarize what was discussed in #engineering yesterday" gives me context before I join a call. Takes 10 seconds.

The more ambitious version: "read yesterday's #support channel and identify any recurring issues." This takes longer to set up (the AI needs clear instructions about what patterns to look for) but surfaces things you'd otherwise miss in a busy channel.

**Requires**: A Slack app with `channels:history`, `channels:read`, and `chat:write` OAuth scopes. The ClawdHub page lists the exact scopes needed.

**One thing it gets wrong**: The Slack API rate limits reads aggressively. If you're trying to read a very active channel going back more than a day, you'll hit rate limits. The plugin handles this gracefully (it retries), but expect slower results for large reads.

---

## 10. ClawdHub Marketplace

I debated including this one since it's technically a meta-plugin, but it's legitimately changed how I discover new integrations.

Without it, finding a new plugin means leaving the chat, opening a browser, navigating to ClawdHub, searching. With it, "what Notion plugins are available?" or "is there a Linear integration?" happens in the conversation. When I find something interesting, I can install it immediately with "install that one."

The more useful pattern: "what plugins are available for project management tools?" It searches ClawdHub and gives me a rundown of relevant options I can explore.

**One thing it gets wrong**: Search quality on ClawdHub varies. Common tools (Notion, Jira, Slack) return clean results. More niche searches sometimes surface plugins that haven't been updated in months. Always check the "last updated" date before installing something you'll build workflows around.

---

## Installing Plugins

**Via Dashboard** (easiest):
1. Open OpenClaw Dashboard at `http://localhost:3000`
2. Go to **Plugins → Browse**, search by name
3. Click Install, provide any required API keys or OAuth
4. Test immediately by asking OpenClaw to use it

**Via ClawdHub directly**: Visit [clawdhub.com](https://clawdhub.com) for detailed setup instructions per plugin.

**Custom plugins**: Place the plugin directory in OpenClaw's plugins folder and reload. The [developer docs](https://docs.openclaw.ai) cover the manifest format. A working custom plugin takes about an hour to build if you're comfortable with JSON and a bit of JavaScript.

---

## Frequently Asked Questions

**How do I know which plugins are actually being used?**
Check OpenClaw's conversation logs — each plugin invocation is recorded. The Dashboard's activity view shows which plugins were called and when. Useful for debugging cases where the AI called a plugin you didn't expect (or didn't call one you expected it to).

**Do plugins work with all models (DeepSeek, GPT-4o, Claude, etc.)?**
Yes, but reliability varies. Claude and GPT-4o are the most consistent at choosing the right plugin without explicit prompting. DeepSeek-V3 works well but occasionally needs the system prompt to be more explicit about when a particular plugin applies. This is a model behavior difference, not a plugin issue.

**Can I restrict what a plugin can do after installation?**
Yes. Most plugins support scope configuration — you can limit which directories the File System plugin can access, or which Slack channels the Slack plugin can read. Set these during installation; they're much harder to change cleanly afterward.

**What if a plugin stops working after an update?**
Usually one of two things: an API credential expired, or the upstream service changed an endpoint. Check the plugin's ClawdHub page first — the author typically posts known issues within a day or two of a breaking change.

## Related Articles

- [Claude Code vs OpenClaw: An Honest Comparison for 2026](/blog/claude-code-vs-openclaw) — understand the full OpenClaw feature set that the plugin ecosystem extends
- [Running 14+ AI Agents in Parallel with OpenClaw](/blog/c06-multi-agent-orchestration-kev-dream-team) — combine plugins with multi-agent orchestration for higher throughput
- [Building Your First Voice Assistant with OpenClaw](/blog/voice-assistant-openclaw) — use voice plugins to interact with your OpenClaw setup hands-free
- [OpenClaw + DeepSeek: The Low-Cost AI Assistant That Actually Delivers](/blog/openclaw-deepseek-low-cost) — run all these plugins against a low-cost model backend
