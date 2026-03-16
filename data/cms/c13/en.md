---
title: "Building Your First Voice Assistant with OpenClaw"
description: "Build a voice AI assistant you can call from any phone using OpenClaw, Twilio, and Deepgram or Whisper. Complete setup guide from STT/TTS configuration to your first call."
publishedAt: 2026-03-14
status: published
visibility: public
author: "The Architect"
featuredImageUrl: /images/blog/c13-voice-assistant-openclaw.webp
---

# Building Your First Voice Assistant with OpenClaw

The ability to call a phone number and get an intelligent AI response is more useful than it sounds on paper. It works from any phone anywhere in the world. No app installation. No login. You can use it while driving. Family members who would never set up an AI app can interact with it naturally.

I built this setup primarily because I wanted to query my home AI while doing chores and driving without touching a screen. The result works well enough that I now use it daily.

This guide covers the complete build: Twilio for phone handling, Deepgram or Whisper for speech recognition, ElevenLabs or OpenAI for speech synthesis, and OpenClaw as the reasoning layer. If you're considering [Clawdia Phone Bridge](/blog/clawdia-phone-bridge) as the managed option, this guide shows exactly what you'd be building yourself.

## The Architecture

| Component | Role | Options |
|---|---|---|
| **OpenClaw** | AI gateway — routes speech to model and back | Self-hosted on any server |
| **Twilio Voice** | Handles incoming calls, routes audio to OpenClaw | Twilio |
| **STT (Speech-to-Text)** | Converts your speech to text | Deepgram Nova-2, OpenAI Whisper |
| **TTS (Text-to-Speech)** | Converts AI text response to speech | ElevenLabs, OpenAI TTS, Google Cloud TTS |
| **AI Model** | Generates the response | Any OpenClaw-supported model |

The minimal working setup: **OpenClaw + Twilio + Deepgram + OpenAI TTS**. That's what I'd build first — get it working, then swap components if something doesn't suit you.

**Prerequisites**:
- OpenClaw running at a public URL. For local development, [ngrok](https://ngrok.com) creates a public tunnel.
- A Twilio account with a phone number (~$1/month).
- A Deepgram or OpenAI API key for STT.
- An ElevenLabs or OpenAI API key for TTS.

## Step 1: Speech-to-Text

STT is the most latency-sensitive component. Slow transcription makes the whole call feel laggy. Target under 500ms from when you stop speaking to when text hits the model.

### Deepgram Nova-2 (What I Use)

Purpose-built for real-time phone audio. Handles background noise, accents, and telephone audio compression better than general-purpose models. Consistent sub-300ms latency.

```bash
STT_PROVIDER=deepgram
DEEPGRAM_API_KEY=your_key_here
DEEPGRAM_MODEL=nova-2
DEEPGRAM_LANGUAGE=en-US
```

Deepgram's streaming API starts transcribing while you're still speaking and delivers a final result within 200–400ms of your last word. Cost: ~$0.0059/minute.

### OpenAI Whisper (Alternative)

Better multilingual support — 57 languages, strong Chinese/Japanese/Korean performance. Slightly higher latency than Deepgram on English, but the accuracy is excellent:

```bash
STT_PROVIDER=openai_whisper
OPENAI_API_KEY=your_key_here
WHISPER_MODEL=whisper-1
```

Choose Whisper if your primary language isn't English or if you want one API key to handle both STT and the AI model.

## Step 2: Text-to-Speech

Voice quality matters more than you'd expect. A robotic-sounding response breaks the illusion of conversation. I've tried three options:

### ElevenLabs (Best Quality)

```bash
TTS_PROVIDER=elevenlabs
ELEVENLABS_API_KEY=your_key_here
ELEVENLABS_VOICE_ID=21m00Tcm4TlvDq8ikWAM  # "Rachel" — clear and neutral
ELEVENLABS_MODEL=eleven_turbo_v2
```

The voice ID above is "Rachel." Browse alternatives in the ElevenLabs dashboard. The `eleven_turbo_v2` model is optimized for low latency — important for keeping calls feeling responsive. Standard ElevenLabs models add 800ms–1s of synthesis time; turbo is under 400ms.

### OpenAI TTS (Simpler, Cheaper)

```bash
TTS_PROVIDER=openai_tts
OPENAI_API_KEY=your_key_here
OPENAI_TTS_VOICE=nova
OPENAI_TTS_MODEL=tts-1
```

Available voices: alloy, echo, fable, onyx, nova, shimmer. Nova is the clearest for calls. Use `tts-1-hd` for better quality at slightly more latency.

OpenAI TTS is noticeably less natural than ElevenLabs but costs less and requires one fewer API account. For personal use, I'd start here and upgrade to ElevenLabs if the voice quality bothers you.

## Step 3: Connect Twilio

Install the Twilio Voice plugin:
1. Open OpenClaw Dashboard → **Plugins → Browse → "Twilio Voice" → Install**
2. Add credentials:

```bash
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_PHONE_NUMBER=+15551234567
```

**Configure the webhook in Twilio Console**:
1. **Phone Numbers → Active Numbers** → your number
2. Under **Voice & Fax → A Call Comes In**, set webhook URL:

```
https://your-openclaw-domain.com/api/twilio/voice
```

3. HTTP method: POST

**For local development**, use ngrok:

```bash
ngrok http 3000
```

Copy the `https://` URL and use it as the Twilio webhook. Note: free ngrok URLs change every time you restart ngrok. For regular development use a paid ngrok account with a fixed domain, or use a cheap cloud VM.

**Test**: Call your Twilio number. First call may take 3–5 seconds (cold start); subsequent calls should be under 2 seconds total for STT + model + TTS.

## Step 4: Tune the System Prompt for Voice

This step matters more than most people expect. A voice conversation needs completely different prompting from a text chat.

In OpenClaw Dashboard → **Settings → Voice Mode → System Prompt**:

```
You are a voice AI assistant. The user is calling you on the phone.

Voice rules:
- Answer in 2–4 sentences for simple questions. Be concise.
- Never use bullet points, numbered lists, markdown formatting, asterisks, or code blocks.
- Speak in complete, natural sentences as if talking to a knowledgeable friend.
- Avoid filler phrases: "Certainly!", "Absolutely!", "Great question!", "Of course!"
- If you don't know something, say so briefly.
- For questions needing longer answers: give the key point first, then ask if they want more detail.

Your name is [your assistant name].
```

**The most common mistake**: forgetting to ban markdown. Without that rule, the AI will literally say "asterisk asterisk important asterisk asterisk" for anything it tries to emphasize. This ruins the experience.

The "2–4 sentences" rule also needs to be explicit. Without it, the AI defaults to text-chat length responses that are too long to listen to.

## Step 5: Add Plugins

A voice assistant that only chats is limited. The useful version combines OpenClaw's plugins with the voice layer:

- **Google Search**: "What's the weather in Tokyo tomorrow?" — searches and speaks the forecast
- **Calendar**: "What meetings do I have today?" — reads your Google Calendar, gives a spoken summary
- **Email**: "Any urgent emails this morning?" — reads your inbox and flags time-sensitive items
- **WhatsApp/SMS**: "Text my wife I'll be home by 7" — sends the message, confirms back

Each of these needs the corresponding plugin installed and configured. See the [OpenClaw plugins guide](/blog/openclaw-plugins-productivity) for setup instructions.

## What the Call Actually Looks Like

End-to-end timing for a typical short query:

1. **You call** your Twilio number
2. **OpenClaw answers**, starts recording
3. **You speak** your question
4. **Deepgram transcribes** in real-time (~200–300ms after you stop)
5. **Model generates response** (~500ms–1.5s depending on complexity and provider)
6. **TTS synthesizes** the response (~300–400ms with turbo models)
7. **You hear the answer** — 1–3 seconds end-to-end for short queries

**Total latency budget**: 4–5 seconds is the boundary. Longer than that and conversations feel awkward. This setup — Deepgram + eleven_turbo_v2 + DeepSeek-V3 — consistently lands under 3 seconds.

Where you'll exceed the budget:
- Using standard ElevenLabs (not turbo) — adds ~600ms
- Using Claude Opus instead of Sonnet or DeepSeek for the model — adds 1–2s
- Cold start after OpenClaw restart — adds 3–5s for the first call

## Deployment

For a personal assistant you use daily, running it on a cloud VM or a [Raspberry Pi 5](/blog/openclaw-raspberry-pi-5) at home is worth the setup effort. An always-on Pi setup costs about $5–10/month in electricity and gives you a private server with full control.

For a basic cloud VM: any small instance (1vCPU / 1GB RAM) on Hetzner or DigitalOcean runs OpenClaw fine at personal-use scale. Budget ~$4–6/month.

## FAQ

**What does this cost per month for light personal use (~100 minutes/month)?**

- Twilio: ~$1–2 (call routing + phone number)
- Deepgram STT: ~$0.60
- ElevenLabs TTS (turbo): ~$1–3 depending on plan
- AI model (DeepSeek-V3 for most responses): ~$0.10
- **Total: roughly $3–7/month**

If you switch to OpenAI TTS instead of ElevenLabs, cut the TTS cost roughly in half.

**Can I support multiple callers or phone numbers?**
Yes. Twilio supports concurrent calls. You can set up different numbers pointing to the same OpenClaw instance with different system prompts — one for personal use, one for family, one for work.

**Does it work in languages other than English?**
Whisper handles 57 languages well. For Deepgram, set `DEEPGRAM_LANGUAGE` to your language code — supported languages are listed in their docs. Mandarin Chinese, Spanish, French, and German all work. For Japanese or Korean, Whisper tends to outperform Deepgram.

**Can it recognize who's calling?**
OpenClaw gets the caller's phone number from Twilio (`TWILIO_CALLER_ID` context). You can configure different system prompts or permissions based on caller number — useful for multi-user household setups where family members each get a slightly different experience.

**Can I run this without exposing a public URL?**
For testing only — ngrok works for development. For regular use, Twilio must reach your webhook on every call, which requires a stable public URL. A cheap cloud VM or static home IP with port forwarding both work.

## Related Articles

- [Clawdia Phone Bridge](/blog/clawdia-phone-bridge) — the managed alternative to this DIY build, using Vapi instead of Twilio
- [Running OpenClaw on Raspberry Pi 5](/blog/openclaw-raspberry-pi-5) — host your voice assistant on a $130 always-on home server
- [10 OpenClaw Plugins That Changed How I Work](/blog/openclaw-plugins-productivity) — the plugins that power what your voice assistant can actually do
- [OpenClaw + DeepSeek: The Low-Cost AI Assistant That Actually Delivers](/blog/openclaw-deepseek-low-cost) — pair this voice setup with DeepSeek to keep the per-call AI cost under $0.01
