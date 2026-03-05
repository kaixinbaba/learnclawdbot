---
title: Clawdia Phone Bridge - Build Your Own Voice AI Assistant with Vapi and OpenClaw
description: Learn how to build a real-time voice AI assistant by connecting Vapi voice assistant to OpenClaw via HTTP bridge. Make phone calls to your AI agent.
slug: /clawdia-phone-bridge
tags: voice, vapi, bridge, phone, ai-assistant
publishedAt: 2026-03-05
status: published
visibility: public
featuredImageUrl: /images/features/clawdia-phone-bridge.webp
---

# Clawdia Phone Bridge - Build Your Own Voice AI Assistant with Vapi and OpenClaw

Ever wished you could just call your AI assistant on the phone? With **Clawdia Phone Bridge**, you can. This project creates a real-time voice bridge between Vapi's voice AI and your OpenClaw agent, enabling near real-time phone conversations with your AI.

## What is Clawdia Phone Bridge?

[Clawdia Phone Bridge](https://github.com/alejandroOPI/clawdia-bridge) is an HTTP bridge that connects Vapi (a voice assistant platform) to OpenClaw. It allows you to:

- Make phone calls to your AI assistant
- Get voice responses in real-time
- Access all OpenClaw skills (calendar, email, weather, etc.) via voice

## How It Works

The architecture is elegantly simple:

1. **You** make a phone call
2. **Vapi** captures your voice and sends it to the bridge
3. **Clawdia Bridge** forwards the request to OpenClaw via WebSocket
4. **OpenClaw** processes the request using its AI agent
5. **Response** flows back through the bridge to Vapi
6. **Vapi** speaks the response to you

```
You (phone call)
    ↓
Clawdia (Vapi voice AI)
    ↓ POST /ask (tool call)
Clawdia Bridge
    ↓ WebSocket to Gateway
Clawdius (processes request)
    ↓ returns response
Clawdia Bridge
    ↓ returns to Vapi
Clawdia
    ↓ speaks response
You
```

## Quick Start

### Prerequisites

- Node.js installed
- A Vapi account
- OpenClaw Gateway running

### Installation

```bash
# Clone the repository
git clone https://github.com/alejandroOPI/clawdia-bridge.git
cd clawdia-bridge

# Install dependencies
npm install

# Run the bridge
npm start
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| BRIDGE_PORT | 3847 | Port to listen on |
| GATEWAY_URL | ws://127.0.0.1:18789 | OpenClaw Gateway WebSocket URL |

### Vapi Configuration

1. **Create Assistant**: In Vapi dashboard, create an assistant named "Clawdia"
2. **Configure Voice**: Select a female voice (e.g., Lily from Vapi)
3. **Add Tool**: Add the `ask_clawdius` function tool
4. **Assign Phone Number**: Connect a Vapi phone number

### Exposing to Internet

For production, expose the bridge using:

```bash
# Using Tailscale Funnel (recommended)
npm start
tailscale funnel 3847

# Or using ngrok
npm start
ngrok http 3844
```

## API Endpoints

### POST /ask

The main endpoint that Vapi calls to communicate with OpenClaw:

```json
{
  "question": "What's the weather today?"
}
```

Response:

```json
{
  "answer": "The current weather is sunny, 72°F."
}
```

### GET /health

Health check endpoint:

```json
{
  "status": "ok",
  "mode": "gateway-ws"
}
```

## Why This Matters

This bridge opens up incredible possibilities:

- **Voice-first workflows**: Interact with your AI hands-free
- **Phone-based AI agents**: Create AI assistants callable via regular phone
- **Accessibility**: Make AI assistance available to non-tech-savvy users
- **Business applications**: Customer service, appointment booking, information retrieval

## Use Cases

- **Personal AI assistant**: Call your AI to check calendar, weather, or send emails
- **Business hotline**: AI-powered customer support via phone
- **Elderly assistance**: Simple voice interface for AI access
- **Hands-free productivity**: Get things done while driving or cooking

## Conclusion

Clawdia Phone Bridge demonstrates the power of combining voice AI with OpenClaw's agent capabilities. By bridging Vapi and OpenClaw, you can create sophisticated voice-powered AI assistants that leverage all of OpenClaw's skills and integrations.

Ready to build your voice AI? Check out the [GitHub repository](https://github.com/alejandroOPI/clawdia-bridge) for full documentation.
