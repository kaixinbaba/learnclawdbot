---
title: "Turning Screen Snippets into LLM-Ready Markdown with SNAG"
description: "How users can use SNAG + OpenClaw workflows to capture screen regions and convert them into markdown for faster AI context handoff."
---

# C03 User Case: Turning Screen Snippets into LLM-Ready Markdown with SNAG

## Case Profile

- **Category:** Automation / Developer Workflow
- **Audience:** Users who frequently move code/UI snippets from screen into AI chats
- **Sources:**
  - [OpenClaw Docs: Showcase](https://docs.openclaw.ai/start/showcase)
  - [am-will/snag](https://github.com/am-will/snag)

## Background

In screen-heavy workflows, users often need to copy a small UI area, code fragment, or diagram into an LLM conversation. Manual transcription is slow and error-prone.

The goal of this case is to make the handoff path repeatable:

- capture screen region,
- convert to markdown,
- paste into OpenClaw chat context.

## Verified Capabilities from Sources

From the SNAG README and OpenClaw Showcase entry:

1. SNAG is a screenshot-to-text CLI tool.
2. It supports region selection and multi-monitor capture.
3. It can process text/code/diagrams/UI and outputs markdown to clipboard.
4. It supports multiple providers (Google Gemini, OpenRouter, Z.AI).
5. OpenClaw Showcase includes SNAG as a community project (“Screenshot-to-Markdown”).

## Implementation Path

### 1) Install SNAG

```bash
uv tool install git+https://github.com/am-will/snag.git
```

### 2) Configure provider keys and defaults

```bash
snag --setup
```

Set provider/model and API key according to your environment.

### 3) Capture and convert

```bash
snag
```

SNAG captures a selected region and copies markdown output directly to the clipboard.

### 4) Feed output into OpenClaw workflow

Paste the markdown result into your OpenClaw conversation to continue debugging, summarization, or code review tasks.

## Outcome (Evidence-Based)

- The capture-to-markdown step becomes command-based instead of manual rewriting.
- Clipboard-first output reduces friction when building LLM context.
- Multi-provider support allows users to adapt the workflow to their existing AI stack.

## Confirmed Facts vs Pending Validation

### ✅ Confirmed by sources

- SNAG supports region capture and multi-monitor usage.
- SNAG supports Gemini / OpenRouter / Z.AI providers.
- SNAG outputs markdown-ready text and copies to clipboard.
- OpenClaw Showcase includes SNAG in community examples.

### ⚠️ Pending (requires user telemetry/interview)

- Average time saved per capture session
- Error-rate reduction versus manual retyping
- Long-term effect on debugging throughput

## Practical Notes

- On macOS, screen recording permissions are required on first run.
- For global hotkey usage, make sure `snag` is available in PATH.
- Keep API keys in the local config path described by SNAG (`~/.config/snag/`).

## References

- [OpenClaw Showcase](https://docs.openclaw.ai/start/showcase)
- [SNAG README](https://github.com/am-will/snag)
