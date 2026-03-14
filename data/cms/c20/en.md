---
title: "OpenClaw + Home Assistant: AI-Powered Smart Home Control"
description: "Connect OpenClaw to Home Assistant to control your smart home with natural language. Step-by-step setup using the Home Assistant MCP server, with real automation examples and voice command patterns."
publishedAt: 2026-03-21
status: published
visibility: public
---

# OpenClaw + Home Assistant: AI-Powered Smart Home Control

The standard way to automate a smart home is to write automations: if the sun sets and someone is home, turn on the living room lights. If the door opens at 7am on a weekday, start the coffee maker. These work, but they require you to anticipate the scenarios ahead of time and encode the exact conditions.

What I wanted was different: the ability to say "it feels a bit warm in here, adjust things so it's more comfortable" and have an AI figure out which entities to modify, by how much, and in what order. That's a fundamentally different interaction model, and it works surprisingly well.

This guide covers connecting OpenClaw to Home Assistant using the HA MCP server. When it's done, you can control your home through natural language conversation, ask OpenClaw to write automations for you, diagnose device problems, and query your home's state.

## Architecture Overview

The integration works through three components:

1. **Home Assistant** — your existing HA installation, any version from 2024+
2. **Home Assistant MCP Server** — a bridge that exposes HA's API as MCP tools
3. **OpenClaw** — the AI that calls those tools based on your requests

When you say "turn off all the lights in the bedroom," OpenClaw sends that to the model, the model decides to call the `call_service` tool with `light.turn_off` and the bedroom entity IDs, the MCP server executes that service call against HA, and HA turns off the lights.

The round trip is typically 1-3 seconds from typing to action for simple commands.

## Prerequisites

- Home Assistant installed and running (Home Assistant OS, Supervised, Container, or Core)
- A Long-Lived Access Token from HA
- OpenClaw installed
- Node.js 20+

## Getting a Home Assistant Access Token

In Home Assistant:
1. Click your profile (bottom left)
2. Scroll to "Long-Lived Access Tokens"
3. Click "Create Token"
4. Name it "OpenClaw" and copy the token immediately — it won't show again

## Installing the Home Assistant MCP Server

```bash
npm install -g @modelcontextprotocol/server-home-assistant
```

Verify it works:

```bash
HA_URL=http://homeassistant.local:8123 \
HA_TOKEN=your_token_here \
npx @modelcontextprotocol/server-home-assistant
# Should start without errors
```

## Configuring OpenClaw

Add the MCP server to your OpenClaw configuration:

```yaml
# ~/.openclaw/config.yaml

mcpServers:
  home-assistant:
    command: npx
    args:
      - "@modelcontextprotocol/server-home-assistant"
    env:
      HA_URL: "http://homeassistant.local:8123"
      HA_TOKEN: "${HA_TOKEN}"
```

Set the environment variable:

```bash
export HA_TOKEN="your_long_lived_access_token"
# Add to ~/.zshrc or ~/.bashrc to persist
```

Restart OpenClaw:

```bash
openclaw restart
openclaw mcp list
# Should show: home-assistant (X tools)
```

## Available Tools

The HA MCP server exposes these tools to OpenClaw:

```
get_states              - List all entity states
get_state               - Get a specific entity's state and attributes
call_service            - Call any HA service (turn on lights, etc.)
get_config              - Get HA configuration details
get_history             - Get historical state data for an entity
get_logbook             - Get logbook entries
list_automations        - List all automations
get_automation          - Get automation YAML
create_automation       - Create a new automation
get_template            - Evaluate a Jinja2 template
```

This is a comprehensive surface area — the model can do almost anything you can do in the HA UI.

## Basic Commands

Once connected, natural language commands work immediately:

```
"What's the temperature in the living room?"
"Turn off all the lights"
"Set the bedroom thermostat to 68°F"
"Is anyone home?"
"Lock the front door"
"Show me the battery level of all my sensors"
```

The model translates these to the appropriate service calls. For multi-entity commands like "turn off all the lights," it first calls `get_states` to find all light entities, then calls `call_service` with the relevant entities.

## Practical Examples

**Morning routine on demand:**

```
You: "Good morning, set up the house for my morning — I need about 45 minutes before I leave"

OpenClaw: I'll set up your morning routine.
- Kitchen lights → 80% brightness, warm white
- Coffee maker → on (if entity is available)
- Living room blinds → open
- Thermostat → 70°F
- Front door lock → verified locked

Anything else for your morning?
```

**Diagnosing device problems:**

```
You: "My office motion sensor hasn't triggered in two days, what's going on?"

OpenClaw: [Calls get_history for the sensor entity]

Looking at binary_sensor.office_motion history:
- Last triggered: 2 days ago at 9:47 AM
- Battery: 8% (last reported 3 days ago)
- Current state: unavailable

The sensor has gone unavailable, which with a battery at 8% suggests it's run out of power. Replace the battery and it should reconnect automatically. If it doesn't reconnect within 10 minutes, you may need to re-pair it with your Zigbee/Z-Wave coordinator.
```

**Writing automations:**

```
You: "Create an automation that turns on the porch light when the front door opens after sunset, and turns it off 5 minutes after the door closes"

OpenClaw: [Calls list_automations to check for conflicts, then create_automation]

Created automation "Porch light on door open after sunset":
- Trigger: front_door state changes to 'open'
- Condition: sun is below horizon
- Action: turn on porch_light
- Additional trigger: front_door state changes to 'closed'
- Additional action: turn off porch_light after 5 minute delay

The automation is active. Want me to test it by simulating a door open event?
```

**Energy monitoring queries:**

```
You: "Which devices are using the most power right now?"

OpenClaw: [Calls get_states for all power monitoring entities]

Current power consumption (highest first):
1. HVAC system: 2,340W
2. Oven (left on!): 1,800W
3. EV charger: 1,200W
4. Refrigerator: 145W
5. TV + entertainment: 87W

Note: your oven appears to be on — is that intentional? Total current draw: ~5.6kW.
```

## Security Considerations

The HA MCP server runs locally and communicates with your HA instance directly. Key security points:

**Restrict what OpenClaw can do.** HA's access token has full access to your instance by default. For a more restricted setup, consider using HA's API key scoping (available in some HA versions) or deploying a proxy that limits which services can be called.

**Don't expose HA's external URL.** Configure the MCP server to use your local HA address, not the external HA Cloud URL. All communication should stay on your local network.

**Review automations before activating.** When asking OpenClaw to create automations, review the YAML before the automation goes live. The model is good but not infallible — check edge cases.

```yaml
# More restrictive config: use local network only
mcpServers:
  home-assistant:
    env:
      HA_URL: "http://192.168.1.100:8123"  # Direct IP, not external URL
      HA_TOKEN: "${HA_TOKEN}"
```

**Log what OpenClaw does.** In HA, enable the logbook for entities you care about. If something unexpected happens, you can trace which service was called when.

## Advanced: Voice Commands

Combine OpenClaw's MCP integration with its voice input support for hands-free home control:

```bash
# OpenClaw with voice input (when configured)
openclaw voice --provider home-assistant

# Or use the keyboard shortcut in OpenClaw's terminal UI
# Voice input → transcription → model processes → HA executes
```

The latency for voice → action is typically 3-5 seconds total: 1s for transcription, 1-2s for model inference, 1s for HA service execution.

## Handling Multiple Homes or Zones

If you have multiple HA instances (main home + vacation home), configure multiple MCP server instances:

```yaml
mcpServers:
  home-main:
    command: npx
    args: ["@modelcontextprotocol/server-home-assistant"]
    env:
      HA_URL: "http://homeassistant.local:8123"
      HA_TOKEN: "${HA_TOKEN_MAIN}"

  home-vacation:
    command: npx
    args: ["@modelcontextprotocol/server-home-assistant"]
    env:
      HA_URL: "https://vacation-home.duckdns.org:8123"
      HA_TOKEN: "${HA_TOKEN_VACATION}"
```

The model can address both: "Check if anyone left the vacation home lights on."

## FAQ

**Will this work with my Zigbee/Z-Wave/Matter/WiFi devices?**

Yes. OpenClaw interacts with Home Assistant's entity layer, which abstracts over all device protocols. As long as a device shows up as an entity in HA, OpenClaw can control it.

**Can OpenClaw accidentally break something?**

The model calls real HA services. In theory it could call a service you didn't intend. In practice, the model is conservative about destructive actions and usually asks for confirmation before doing something irreversible (like disabling an alarm). Always supervise unexpected commands.

**Does this work with Home Assistant Cloud (Nabu Casa)?**

Yes. Use your HA Cloud external URL instead of the local address. Performance will be slightly slower due to the additional round trip through the cloud.

**What if my HA instance has hundreds of entities?**

The `get_states` call returns all entities, which can be a large payload. The model handles this fine, but responses may be slightly slower. For very large installations (500+ entities), consider filtering by domain in your commands: "show me all light entities."

**Can I use this with the Ollama offline setup?**

Yes. The MCP server is independent of the model backend. Configure OpenClaw to use Ollama as the provider and the HA MCP server remains available. Your smart home control then works completely offline (assuming HA is local).

The OpenClaw + Home Assistant integration has changed how I interact with my home. Writing automations feels more natural as a conversation than as YAML editing, and being able to ask diagnostic questions in plain English saves significant troubleshooting time. The setup overhead is about 15 minutes for anyone with an existing HA installation.
