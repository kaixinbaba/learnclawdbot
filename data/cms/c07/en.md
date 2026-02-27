---
title: "SNAG: Turn Screen Snippets into LLM-Ready Markdown"
description: "Learn how to use SNAG with OpenClaw to capture screen regions and instantly convert them to markdown for faster AI context handoff."
---

# C07 User Case: SNAG - Turn Screen Snippets into LLM-Ready Markdown

## Case Profile

- **Category:** DevTools / Developer Workflow
- **Audience:** Developers who frequently need to convert screen captures into text for AI conversations
- **Sources:**
  - [OpenClaw Docs: Showcase](https://docs.openclaw.ai/start/showcase)
  - [am-will/snag](https://github.com/am-will/snag)

## Background

When working with screen-heavy workflows, developers often need to copy UI elements, code snippets, or diagrams into LLM conversations. Manual transcription is slow and error-prone.

SNAG provides a streamlined solution:

- Capture any screen region with a click-drag
- AI-powered conversion to markdown
- Automatic clipboard output - ready to paste

## Verified Capabilities

From the SNAG README and OpenClaw Showcase:

1. **Region Selection**: Click and drag to capture any part of your screen
2. **Multi-Monitor Support**: Works across all connected displays
3. **Smart Transcription**: Handles text, code, diagrams, charts, and UI elements
4. **Instant Clipboard**: Results automatically copied, ready to paste
5. **Multiple Providers**: Google Gemini, OpenRouter, or Z.AI (GLM-4.6V)
6. **Cross-Platform**: Linux (X11/Wayland), Windows, macOS

## Implementation Steps

### 1) Install SNAG

```bash
uv tool install git+https://github.com/am-will/snag.git
```

### 2) Configure API Keys

```bash
snag --setup
```

This opens an interactive menu to configure your preferred provider and API key.

### 3) Capture Your Screen

```bash
snag
```

- Left-click + drag to select region
- Release mouse to capture and process
- Right-click or Escape to cancel

### 4) Paste into OpenClaw

The markdown result is already in your clipboard. Paste it directly into your OpenClaw conversation for debugging, summarization, or code review.

## Why This Improves Developer Productivity

- **Speed**: Capture-to-markdown takes seconds instead of minutes
- **Accuracy**: AI transcription handles complex layouts, code syntax, and diagrams
- **Clipboard-First**: No file saving required - instant paste workflow
- **Flexibility**: Choose between different AI providers based on your needs

## Practical Notes

- **macOS**: Grant Screen Recording permission on first run (System Settings → Privacy & Security → Screen Recording)
- **Global Shortcuts**: Set up a desktop environment shortcut (e.g., Super+Shift+S on GNOME) for instant access
- **API Keys**: Stored in `~/.config/snag/.env` - works with keyboard shortcuts that don't have shell environment access

## Confirmed Facts vs Assumptions

### ✅ Verified by Sources

- SNAG supports region capture and multi-monitor usage
- SNAG supports Gemini, OpenRouter, and Z.AI providers
- SNAG outputs markdown and copies to clipboard automatically
- OpenClaw Showcase includes SNAG in community examples

### ⚠️ User-Dependent

- Actual time savings vary by use case
- Provider quality differs for specific content types (code vs diagrams)

## References

- [OpenClaw Showcase](https://docs.openclaw.ai/start/showcase)
- [SNAG GitHub Repository](https://github.com/am-will/snag)
