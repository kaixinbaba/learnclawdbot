---
title: "用 OpenClaw 打造你的第一个语音 AI 助手"
description: "使用 OpenClaw、Twilio 和 Deepgram 或 Whisper 构建可拨打的语音 AI 助手。从 STT/TTS 配置到首次通话的完整教程。"
publishedAt: 2026-03-14
status: published
visibility: public
---

# 用 OpenClaw 打造你的第一个语音 AI 助手

能拨打一个电话号码、获得智能 AI 回应——不需要任何应用、不需要账号、只需一部手机——这比听起来更实用。它在全球任意电话上都能用，包括功能机。家人无需技术背景就能使用。开车时可以拨打。

本教程构建一个完整的语音 AI 助手：OpenClaw 作为智能大脑，Twilio 处理电话侧，再加上你选择的语音识别和语音合成提供商。如果你已经看过[Clawdia Phone Bridge](/blog/clawdia-phone-bridge)作为托管方案的介绍，本教程教你如何自行搭建同类系统，并对每个组件拥有更多控制权。

## 组成部分

| 组件 | 作用 | 推荐选项 |
|---|---|---|
| **OpenClaw** | AI 网关——将你的语音路由到模型再返回 | 自托管或云端 |
| **Twilio Voice** | 处理来电，转发到 OpenClaw | Twilio（主流选择） |
| **STT（语音转文字）** | 将你的语音转换为文字 | Deepgram Nova-2、OpenAI Whisper |
| **TTS（文字转语音）** | 将 AI 回复转换为语音 | ElevenLabs、OpenAI TTS、Google Cloud TTS |
| **AI 模型** | 生成回复内容 | DeepSeek-V3、GPT-4o、Claude 或任何 OpenClaw 支持的模型 |

最简可行方案：**OpenClaw + Twilio + Deepgram + OpenAI TTS**。这个组合提供良好的准确率、低延迟，以及清晰的计费方式。

## 开始之前需要准备

- OpenClaw 已安装并可通过公网 URL 访问。本地开发时，[ngrok](https://ngrok.com) 可为你的本地实例创建公网隧道。
- 一个带有电话号码的 Twilio 账号。在 [twilio.com](https://twilio.com) 注册；电话号码从约 1 美元/月起。
- 来自 [console.deepgram.com](https://console.deepgram.com) 的 Deepgram API Key，或用于 Whisper 的 OpenAI API Key。
- 一个 TTS 提供商的 API Key（ElevenLabs、OpenAI 或 Google Cloud）。

Twilio 按通话分钟计费，另加小额转录费（如果使用其原生转录——我们将改用更便宜且更准确的 Deepgram）。Twilio + Deepgram 合计每通话分钟约 0.01–0.02 美元。

## 第一步：配置 STT 提供商

语音识别是延迟最敏感的环节。你希望语音转文字在 500ms 以内完成，以确保总响应时间保持在 3 秒以内。

### Deepgram Nova-2（推荐）

Deepgram Nova-2 专为实时电话音频设计。它处理背景噪音、口音和电话音频质量的能力优于通用模型：

```bash
# 添加到 OpenClaw 的 .env 文件：
STT_PROVIDER=deepgram
DEEPGRAM_API_KEY=your_deepgram_key_here
DEEPGRAM_MODEL=nova-2
DEEPGRAM_LANGUAGE=en-US
```

Deepgram 按用量计费——预录音频约 0.0059 美元/分钟，实时流更便宜。每月 100 小时通话量仅需约 35 美元的 STT 费用。

### OpenAI Whisper（备选）

Whisper 支持 57 种语言，对非标准语音处理良好。延迟略高于 Deepgram，但准确率出色：

```bash
STT_PROVIDER=openai_whisper
OPENAI_API_KEY=your_openai_key_here
WHISPER_MODEL=whisper-1
```

多语言场景 Whisper 通常表现更好。纯英语低延迟场景，Deepgram 略胜一筹。

## 第二步：配置 TTS 提供商

### ElevenLabs（音质最自然）

ElevenLabs 产出最自然的语音效果，这在电话对话中影响明显：

```bash
TTS_PROVIDER=elevenlabs
ELEVENLABS_API_KEY=your_elevenlabs_key_here
ELEVENLABS_VOICE_ID=21m00Tcm4TlvDq8ikWAM
ELEVENLABS_MODEL=eleven_turbo_v2
```

上方的 Voice ID 对应"Rachel"，一个清晰中性的声音。`eleven_turbo_v2` 模型针对低延迟优化——对保持通话流畅感很重要。你可以在 ElevenLabs 控制台浏览声音选项，替换为你喜欢的任何 Voice ID。

### OpenAI TTS（更简单，成本更低）

如果你想要更简单的配置和略低的成本：

```bash
TTS_PROVIDER=openai_tts
OPENAI_API_KEY=your_openai_key_here
OPENAI_TTS_VOICE=nova
OPENAI_TTS_MODEL=tts-1
```

可选声音：alloy、echo、fable、onyx、nova、shimmer。使用 `tts-1-hd` 可获得更高音频质量，但延迟略有增加。

## 第三步：接通 Twilio

OpenClaw 的 Twilio Voice 插件处理 Twilio 和 OpenClaw 之间的 Webhook 集成。

**安装 Twilio Voice 插件**：
1. 打开 OpenClaw Dashboard → **插件 → 浏览**
2. 搜索"Twilio Voice"，点击**安装**
3. 通过 Dashboard 或 `.env` 添加凭证：

```bash
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_PHONE_NUMBER=+15551234567
```

**在 Twilio 控制台配置 Webhook**：
1. 进入**电话号码 → 活跃号码**→ 点击你的号码
2. 在**语音与传真 → 来电时**，将 Webhook 设置为：

```
https://your-openclaw-domain.com/api/twilio/voice
```

3. HTTP 方式设为 POST

本地开发时，先运行 ngrok：

```bash
ngrok http 3000
```

复制 ngrok 给出的 `https://` URL，用它作为 Twilio 的 Webhook。每次重启 ngrok，URL 都会变化，除非你使用付费 ngrok 账号获得固定域名。

**测试**：拨打你的 Twilio 号码。你应该听到 OpenClaw 接听，说出你的问题，然后听到语音回复。首次通话可能需要 3–5 秒冷启动；后续通话 STT + 模型 + TTS 合计通常在 2 秒以内。

## 第四步：为语音优化系统提示词

语音对话需要与文字聊天不同的提示词策略。AI 需要知道它在说话，而不是在写作：

在 OpenClaw Dashboard → **设置 → 语音模式 → 系统提示词** 中：

```
你是一个语音 AI 助手。用户正在通过电话联系你。

语音回复规则：
- 除非用户要求详细说明，否则用 2–4 句话作答。
- 永远不要使用项目符号、编号列表、Markdown 或代码块——用自然的句子表达。
- 避免"当然！"、"没问题！"、"好问题！"等填充性短语。
- 如果你不知道某事，简短承认，并主动提出其他帮助。
- 当问题需要较长回答时，先给出要点，再询问是否需要展开。
- 说话自然，像与知识渊博的朋友交谈。

你的名字是【你的助手名称】。你乐于助人、直接坦率，偶尔幽默风趣。
```

语音提示词最常见的错误是忘记禁用 Markdown。如果不禁止，AI 会开始说"星号星号重要星号星号"。

## 第五步：添加插件，释放真正的能力

只能闲聊的语音助手价值有限。真正的能力来自插件：

- **Google Search**："东京明天天气怎么样？"——搜索并播报天气预报
- **Calendar**："我这周有哪些会议？"——读取你的 Google 日历并汇总
- **Email**："起草一封对昨天发给客户邮件的跟进"——找到原邮件，准备回复
- **WhatsApp/SMS**："发消息给我老婆说我 7 点到家"——发送消息并口头确认

每个插件的安装说明请参阅[完整插件指南](/blog/openclaw-plugins-productivity)。

## 端到端通话流程

配置完成后，体验是这样的：

1. **你拨打** Twilio 号码，从任意电话发起
2. **OpenClaw 接听**，开始录制你的语音
3. **你说出**你的问题
4. **Deepgram 实时转写**语音为文字（约 200ms）
5. **AI 模型生成**回复（约 500ms–1.5s，取决于提供商）
6. **TTS 将**文字转为语音（约 300ms–500ms）
7. **你通过电话听到回答**——短回复通常在 1–3 秒端到端完成

延迟预算对语音很重要。如果总往返时间超过 4–5 秒，对话会感觉别扭。使用 Deepgram（而非 Whisper）和 `eleven_turbo_v2`（而非 ElevenLabs 的标准模型），能让你的延迟轻松保持在这个范围内。

## 稳定部署

对于日常使用的个人助手，在云端虚拟机或在家里运行一台有稳定在线时间的[树莓派 5](/blog/openclaw-raspberry-pi-5) 是值得的。全天候的树莓派方案每月电费约 3–6 元，同时让你完全掌控自己的私有服务器。

如果你在评估是自己搭建还是使用托管服务，参阅[Clawdia Phone Bridge 文章](/blog/clawdia-phone-bridge)了解托管方案的对比情况。

## 常见问题

**每月费用大概多少？**
很大程度取决于使用量。以每月 100 分钟通话量为例的粗略估算：
- Twilio：约 1–2 美元（通话路由 + 电话号码）
- Deepgram STT：约 0.60 美元
- ElevenLabs TTS：约 1–3 美元（视套餐而定）
- AI 模型（DeepSeek-V3）：回复费用约 0.10 美元
- **总计：轻度个人使用每月大约 3–7 美元**

**能服务多个电话号码/呼叫者吗？**
可以。Twilio 支持多路并发通话。你还可以为不同用途（个人、家庭、工作）设置不同电话号码，全部指向同一个 OpenClaw 实例，但使用不同的系统提示词。

**支持中文等非英语语言吗？**
Whisper 原生支持 57 种语言。Deepgram 支持主要语言，但各语言准确率不同。对于中文、日语或韩语，Whisper 通常表现更好。将 `DEEPGRAM_LANGUAGE` 设为你的语言代码，或改用 Whisper 获得更广泛的语言支持。

**能识别特定来电者吗？**
OpenClaw 支持通过来电显示获取上下文——来电时，来电方的电话号码会传入。你可以根据来电号码配置不同的系统提示词或权限。详细说明见 Twilio Voice 插件的设置文档。

**没有公网域名，只在本地运行可以吗？**
测试时可以——用 ngrok 暴露你的本地实例。日常使用需要一个稳定的公网 URL，因为每次来电 Twilio 都必须能访问你的 Webhook。
