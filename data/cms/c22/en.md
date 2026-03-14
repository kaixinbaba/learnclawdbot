---
title: "OpenClaw Roadmap 2026: What's Coming to the Open Source AI Gateway"
description: "An honest look at OpenClaw's 2026 development roadmap. Planned features, protocol improvements, model integrations, and the community projects shaping the platform's future."
publishedAt: 2026-03-23
status: published
visibility: public
---

# OpenClaw Roadmap 2026: What's Coming to the Open Source AI Gateway

OpenClaw has moved fast. In the span of about two years, it went from a simple CLI wrapper for Claude to a full-featured, self-hosted AI gateway that supports multiple models, MCP servers, voice input, browser automation, and plugin ecosystems. The pace of change has been fast enough that features I considered advanced six months ago are now defaults.

This post looks at what's on the horizon for 2026: confirmed features from the roadmap, community-driven projects in active development, and the protocol-level changes that will affect how the entire ecosystem works. I'm drawing from the public GitHub roadmap, community Discord discussions, and direct conversations with contributors.

## Protocol Layer: MCP 2.0

The Model Context Protocol is the most important protocol in the OpenClaw ecosystem, and the specification is evolving significantly in 2026.

**MCP 2.0 key changes:**

- **Streaming tool responses**: Currently, tool calls are synchronous — the model waits for a complete result before continuing. MCP 2.0 adds streaming, so long-running tools can send incremental updates. This is critical for tools that watch files, monitor logs, or execute slow operations.

- **Tool schemas with versioning**: Tool schemas can declare version compatibility, enabling graceful degradation when a server updates its API.

- **Multi-modal tool inputs**: MCP 2.0 supports tools that accept image and audio inputs alongside text. This opens up vision-based automation tools (screenshot analysis, OCR) that work natively within the protocol.

- **Bidirectional server push**: Servers can send unsolicited events to the model client. This enables real-time notifications — an MCP server watching your inbox can push a notification when an urgent email arrives, without the model needing to poll.

OpenClaw has committed to MCP 2.0 support in Q2 2026. Migration for existing MCP servers should be non-breaking for most servers — the 2.0 spec maintains backward compatibility with 1.x tools.

## Model Integration Updates

**Support for thinking models**: OpenAI's o3/o4 series and Anthropic's Claude models with extended thinking both provide access to the model's reasoning process. OpenClaw is adding dedicated display for these reasoning traces — they'll appear as a collapsible section in the UI, separate from the final response.

**Computer use automation**: Anthropic's computer use API (ability to control the desktop through screenshots and input events) is being integrated as a first-class OpenClaw feature. The current Playwright integration covers browser automation; the upcoming computer use feature will extend this to full desktop control. Expected in Q3 2026.

**Improved local model support**: The Ollama integration is being extended with automatic model recommendation. When you describe a task, OpenClaw will suggest the most appropriate available local model for that task type — not just any available model, but the right one.

**Multi-provider routing**: A significant architectural addition planned for Q2 2026 is intelligent request routing. You'll define a pool of providers and a routing policy (cost, latency, quality), and OpenClaw will automatically select the best available provider for each request. Cloud falls back to local when offline; cheap models handle simple tasks, expensive models handle complex ones.

```yaml
# Planned config syntax for multi-provider routing
routing:
  policy: quality-cost-balanced
  providers:
    - name: claude-sonnet
      priority: 1
      conditions:
        - task_type: complex_reasoning
    - name: mistral-local
      priority: 2
      conditions:
        - network: offline
        - task_type: simple_qa
    - name: deepseek-v3
      priority: 3
      conditions:
        - cost_target: low
```

## Platform Features

**OpenClaw Agents (persistent background agents)**: The current interaction model is request-response: you ask, the model answers. The planned Agents feature adds persistent background processes — AI agents that run continuously, monitor for conditions, and take actions. Think: a monitoring agent that watches your CI/CD pipeline and summarizes failures, or a research agent that periodically updates a knowledge base.

This is architecturally significant. It requires OpenClaw to manage agent state across sessions, handle agent-to-agent communication, and provide oversight interfaces for running agents. Target: Q4 2026.

**Plugin marketplace improvements**: ClawdHub (the OpenClaw plugin directory) is getting a significant overhaul. Key additions:
- Automated plugin security scanning before listing
- Plugin ratings and usage statistics
- One-click install via `openclaw plugin install <plugin-name>`
- Plugin compatibility matrix (which models support which plugins)

**Team workspaces**: Multi-user OpenClaw deployments currently require manual configuration of shared contexts and permissions. The planned team workspaces feature introduces organization-level configuration — shared system prompts, centralized API key management, and per-user permission scoping through a proper management interface.

**Export and import**: Session history export to standard formats (Markdown, JSON) for archiving, sharing, and migration between OpenClaw instances. Useful for organizations that want to maintain records of AI-assisted decisions.

## Performance Improvements

**Context streaming optimization**: Current sessions load the full conversation history with each request. Q2 2026 brings incremental context loading — only new messages are transmitted, with the full history maintained in a server-side cache. For long sessions, this can reduce latency by 40-60%.

**MCP server connection pooling**: Each MCP server currently gets a fresh connection per request. Connection pooling, planned for Q1 2026, maintains persistent connections to frequently-used servers. This reduces the latency overhead for tool-heavy workflows.

**Offline-first architecture**: More of OpenClaw's UI features will work without an internet connection. Currently, some UI elements require reaching back to OpenClaw's update server even in fully local deployments. The offline-first refactor ensures that local deployments are truly independent.

## Community Projects to Watch

**openclaw-langchain**: A bridge that exposes LangChain's agent ecosystem through OpenClaw's MCP interface. Still experimental, but enables LangChain tools to be used from the OpenClaw CLI without any additional configuration.

**HA-OpenClaw**: A dedicated Home Assistant add-on that packages the OpenClaw HA MCP server with a configuration UI in HA's add-on store. Makes the home automation integration point-and-click for HA users.

**openclaw-raycast**: A Raycast extension that exposes OpenClaw through Raycast's launcher on macOS. Invoke OpenClaw from anywhere on the system with a keyboard shortcut.

**openclaw-vscode**: VS Code extension in active development. Provides an OpenClaw panel directly in VS Code, letting you query your AI assistant without leaving the editor. Unlike GitHub Copilot, it works with any OpenClaw-supported model including local ones.

**OpenClaw iOS**: Early-stage mobile client that connects to a self-hosted OpenClaw instance. The initial version is a thin client — essentially a mobile UI for the OpenClaw API. Voice input is the primary interaction mode for the mobile use case.

## What I'm Most Interested In

The multi-provider routing feature and the persistent agents are the two changes I think will have the most practical impact. Routing solves the real-world problem of managing multiple model subscriptions with different cost profiles. I currently do this manually — choosing which model to use for each task — and automation would save meaningful time.

Persistent agents are the bigger architectural shift. Right now, every OpenClaw interaction requires me to be present and actively querying. Background agents could monitor, summarize, and alert without my direct involvement — changing OpenClaw from a tool I use into infrastructure that works for me.

The MCP 2.0 streaming updates will matter more for developers building MCP servers than for end users, but the indirect benefit — better tool integrations with more responsive behavior — will be noticeable across the whole ecosystem.

## Contributing

OpenClaw is MIT licensed and actively accepts contributions. The areas most in need of help:

- **MCP server implementations**: Many useful services don't have MCP servers yet. If you use a service regularly and want to use it from OpenClaw, building the MCP server is the highest-leverage contribution you can make.
- **Documentation and tutorials**: As the platform grows in complexity, documentation quality matters more.
- **Testing**: End-to-end tests for the MCP integration layer are incomplete. Contributions here directly improve reliability.
- **Mobile client**: The iOS and Android clients are community efforts. Mobile developers are welcome.

The roadmap is public on GitHub. Feature requests and implementation discussions happen in GitHub Issues. The Discord server is the fastest way to get feedback on a contribution before investing heavily in an implementation.

## FAQ

**Is OpenClaw committed to staying open source?**

Yes. OpenClaw is MIT licensed, and the core team has explicitly committed to maintaining the open source nature of the project. The business model (when one exists) is expected to be cloud hosting and support services, not gating the core software.

**When will MCP 2.0 be available?**

The MCP specification team targets Q2 2026 for the 2.0 spec finalization. OpenClaw's implementation follows the spec. Expect OpenClaw MCP 2.0 support in Q3 2026, with beta availability earlier.

**Will the background agents feature require additional infrastructure?**

For simple agents (monitoring, summarization), the existing OpenClaw server is sufficient. For complex multi-agent workflows, you'll likely want dedicated compute. The feature is designed to work at small scale on existing hardware first.

**What about backward compatibility?**

The core team takes backward compatibility seriously. Breaking changes in the configuration format or API are always versioned, and migration guides are provided. The jump from early OpenClaw versions to current has been bumpy in places, but the team is more disciplined about compatibility than they were in the early days.

The 2026 roadmap reflects a platform that has found its footing and is now building depth rather than breadth. The foundational pieces — multi-model support, MCP, plugins — are established. The next phase is making those pieces more powerful, more reliable, and more accessible to users who aren't comfortable with YAML configuration files. That's the right direction.
