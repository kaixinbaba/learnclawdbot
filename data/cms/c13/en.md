---
title: "Building Your First Voice Assistant with OpenClaw"
description: "Build a voice AI assistant you can call from any phone using OpenClaw, Twilio, and Deepgram or Whisper. Complete setup guide from STT/TTS configuration to your first call."
publishedAt: 2026-03-14
status: published
visibility: public
---

# Building Your First Voice Assistant with OpenClaw

The ability to call a phone number and get an intelligent AI response — no app, no account, just a phone — is more useful than it might sound. It works from any phone worldwide, including feature phones. Family members can use it without technical knowledge. You can call it while driving.

This guide builds a complete voice AI assistant using OpenClaw as the brain, Twilio to handle the phone side, and your choice of speech recognition and text-to-speech provider. If you've looked at the [Clawdia Phone Bridge](/blog/clawdia-phone-bridge) as a managed option, this guide shows you how to build the same kind of system yourself with more control over every component.

## The Components

| Component | Role | Recommended options |
|---|---|---|
| **OpenClaw** | AI gateway — routes your voice to the model and back | Self-hosted or cloud |
| **Twilio Voice** | Handles incoming phone calls, forwards to OpenClaw | Twilio (dominant option) |
| **STT (Speech-to-Text)** | Converts your speech to text | Deepgram Nova-2, OpenAI Whisper |
| **TTS (Text-to-Speech)** | Converts AI responses to speech | ElevenLabs, OpenAI TTS, Google Cloud TTS |
| **AI Model** | Generates the response | DeepSeek-V3, GPT-4o, Claude, or any OpenClaw-supported model |

A minimal working setup uses: **OpenClaw + Twilio + Deepgram + OpenAI TTS**. That combination gives you good accuracy, low latency, and straightforward billing.

## What You Need Before Starting

- OpenClaw installed and reachable at a public URL. For local development, [ngrok](https://ngrok.com) creates a public tunnel to your local instance.
- A Twilio account with a phone number. Sign up at [twilio.com](https://twilio.com); phone numbers start at ~$1/month.
- A Deepgram API key from [console.deepgram.com](https://console.deepgram.com), or an OpenAI API key for Whisper.
- A TTS provider API key (ElevenLabs, OpenAI, or Google Cloud).

Twilio charges per minute of call plus a small per-transcription fee if using their native transcription (we'll use Deepgram instead, which is cheaper and more accurate). Budget ~$0.01–$0.02 per call minute for Twilio + Deepgram combined.

## Step 1: Configure Your STT Provider

Speech recognition is the most latency-sensitive piece. You want your spoken words converted to text in under 500ms so the total response time stays under 3 seconds.

### Deepgram Nova-2 (Recommended)

Deepgram Nova-2 is purpose-built for real-time phone audio. It handles background noise, accents, and telephone audio quality better than general-purpose models:

```bash
# Add to your OpenClaw .env file:
STT_PROVIDER=deepgram
DEEPGRAM_API_KEY=your_deepgram_key_here
DEEPGRAM_MODEL=nova-2
DEEPGRAM_LANGUAGE=en-US
```

Deepgram's pricing is usage-based — roughly $0.0059/minute for pre-recorded audio and cheaper for streaming. A 100-hour monthly call volume would cost around $35 in STT alone.

### OpenAI Whisper (Alternative)

Whisper supports 57 languages and handles non-standard speech well. Slightly higher latency than Deepgram but excellent accuracy:

```bash
STT_PROVIDER=openai_whisper
OPENAI_API_KEY=your_openai_key_here
WHISPER_MODEL=whisper-1
```

For multilingual use cases, Whisper often performs better. For English-only at low latency, Deepgram edges it out.

## Step 2: Configure Your TTS Provider

### ElevenLabs (Most Natural Voice Quality)

ElevenLabs produces the most natural-sounding speech, which matters a lot for phone conversations:

```bash
TTS_PROVIDER=elevenlabs
ELEVENLABS_API_KEY=your_elevenlabs_key_here
ELEVENLABS_VOICE_ID=21m00Tcm4TlvDq8ikWAM
ELEVENLABS_MODEL=eleven_turbo_v2
```

The voice ID above is "Rachel," a clear and neutral voice. The `eleven_turbo_v2` model is optimized for low latency — important for keeping the call feeling responsive. You can browse voice options in the ElevenLabs dashboard and substitute any voice ID you prefer.

### OpenAI TTS (Simpler, Lower Cost)

If you want a simpler setup and slightly lower cost:

```bash
TTS_PROVIDER=openai_tts
OPENAI_API_KEY=your_openai_key_here
OPENAI_TTS_VOICE=nova
OPENAI_TTS_MODEL=tts-1
```

Available voices: alloy, echo, fable, onyx, nova, shimmer. Use `tts-1-hd` for higher audio quality at the cost of slightly more latency.

## Step 3: Connect Twilio

OpenClaw's Twilio Voice plugin handles the webhook integration between Twilio and OpenClaw.

**Install the Twilio Voice plugin**:
1. Open OpenClaw Dashboard → **Plugins → Browse**
2. Search for "Twilio Voice" and click **Install**
3. Add your credentials via the Dashboard or `.env`:

```bash
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_PHONE_NUMBER=+15551234567
```

**Configure the webhook in Twilio Console**:
1. Go to **Phone Numbers → Active Numbers** → click your number
2. Under **Voice & Fax → A Call Comes In**, set webhook to:

```
https://your-openclaw-domain.com/api/twilio/voice
```

3. Set the HTTP method to POST

For local development, run ngrok first:

```bash
ngrok http 3000
```

Copy the `https://` URL ngrok gives you and use that as the Twilio webhook. The URL changes each time you restart ngrok unless you use a paid ngrok account with a fixed domain.

**Test it**: Call your Twilio number. You should hear OpenClaw answer, speak your question, and receive a spoken response. First call may take 3–5 seconds for cold start; subsequent calls are typically under 2 seconds for STT + model + TTS combined.

## Step 4: Optimize the System Prompt for Voice

A voice conversation needs different prompting than a text chat. The AI needs to know it's speaking, not writing:

In OpenClaw Dashboard → **Settings → Voice Mode → System Prompt**:

```
You are a voice AI assistant. The user is calling you on the phone.

Voice response rules:
- Answer in 2–4 sentences unless the user asks for detail.
- Never use bullet points, numbered lists, markdown, or code blocks — speak in natural sentences.
- Avoid filler phrases like "Certainly!", "Absolutely!", "Great question!"
- If you don't know something, say so briefly and offer to help with something else.
- When a question needs a long answer, give the key point first, then ask if they want more detail.
- Speak naturally, like talking to a knowledgeable friend.

Your name is [your assistant name]. You are helpful, direct, and occasionally witty.
```

The most common mistake with voice prompts is forgetting to ban markdown. The AI will start saying "asterisk asterisk important asterisk asterisk" if you don't.

## Step 5: Add Plugins for Real Capability

A voice assistant that can only chat is limited. The real power comes from plugins:

- **Google Search**: "What's the weather in Tokyo tomorrow?" — searches and speaks the forecast
- **Calendar**: "What meetings do I have this week?" — reads your Google Calendar and summarizes
- **Email**: "Draft a follow-up to the client email I sent yesterday" — finds the email and prepares a reply
- **WhatsApp/SMS**: "Text my wife that I'll be home by 7" — sends the message and confirms

See the [full plugins guide](/blog/openclaw-plugins-productivity) for setup instructions for each of these.

## What the End-to-End Call Looks Like

Once everything is configured:

1. **You call** your Twilio number from any phone
2. **OpenClaw answers** and begins recording your speech
3. **You speak** your question
4. **Deepgram transcribes** your speech to text in real time (~200ms)
5. **Your AI model** generates a response (~500ms–1.5s depending on provider)
6. **TTS converts** the response to speech (~300ms–500ms)
7. **You hear the answer** — typically 1–3 seconds end-to-end for short responses

The latency budget matters for voice. If the total round-trip exceeds 4–5 seconds, conversations feel awkward. Using Deepgram (not Whisper) and `eleven_turbo_v2` (not ElevenLabs' standard model) keeps you well within that budget.

## Deploying for Reliable Use

For a personal assistant you use regularly, running it on a cloud VM or a [Raspberry Pi 5](/blog/openclaw-raspberry-pi-5) at home with proper uptime is worth it. An always-on Raspberry Pi setup costs about $5–10/month in electricity and gives you a private server you fully control.

If you're evaluating whether to build this yourself or use a managed service, see the [Clawdia Phone Bridge article](/blog/clawdia-phone-bridge) for how the managed option compares.

## Frequently Asked Questions

**How much does this cost per month?**
It depends heavily on usage. A rough estimate for 100 minutes/month of calls:
- Twilio: ~$1–2 (call routing + phone number)
- Deepgram STT: ~$0.60
- ElevenLabs TTS: ~$1–3 depending on plan
- AI model (DeepSeek-V3): ~$0.10 for the responses
- Total: roughly $3–7/month for light personal use

**Can I use this for more than one phone number / caller?**
Yes. Twilio supports multiple concurrent calls. You can also set up different phone numbers for different use cases (personal vs. family vs. work) pointing to the same OpenClaw instance with different system prompts.

**Does it work with non-English languages?**
Whisper supports 57 languages natively. Deepgram supports major languages but with varying accuracy. Set `DEEPGRAM_LANGUAGE` to your language code, or use Whisper for broader language coverage. For Chinese, Japanese, or Korean, Whisper often performs better.

**What if I want the voice assistant to recognize specific people calling?**
OpenClaw supports caller ID via the `TWILIO_CALLER_ID` context — when someone calls, their phone number is available. You can configure different system prompts or permissions based on caller number. This is documented in the Twilio Voice plugin's settings.

**Can I run this without a public domain (just locally)?**
For testing, yes — use ngrok to expose your local instance. For regular use, you need a stable public URL since Twilio must be able to reach your webhook on every call.
