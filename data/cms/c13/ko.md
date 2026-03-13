---
title: "OpenClaw으로 첫 번째 음성 AI 어시스턴트 만들기"
description: "OpenClaw, Twilio, Deepgram 또는 Whisper로 자비스 스타일 음성 AI 구축. STT/TTS 설정부터 어떤 전화기에서든 AI에게 전화하기까지 완전한 튜토리얼."
publishedAt: 2026-03-14
status: published
visibility: public
---

# OpenClaw으로 첫 번째 음성 AI 어시스턴트 만들기

어떤 전화기에서도 전화를 걸 수 있고, 무엇이든 물어볼 수 있으며, 음성으로 답변을 받을 수 있는 자비스 같은 AI를 갖는다는 꿈은 수십 년간 SF 소설의 세계에 머물러 있었습니다. OpenClaw, Twilio, 그리고 현대적인 음성 인식(STT)과 음성 합성(TTS) 프로바이더를 사용하면 이것을 오후 반나절 만에 실제로 구축할 수 있습니다.

이 가이드는 STT/TTS 프로바이더 설정부터 전화 브리지 연결, 음성 상호작용을 위한 어시스턴트 개성 조정까지 전체 설정을 단계별로 안내합니다.

## 기술 스택

| 컴포넌트 | 선택지 |
|---|---|
| **AI 게이트웨이** | OpenClaw (셀프 호스팅 또는 클라우드) |
| **전화 브리지** | Twilio Voice |
| **STT (음성→텍스트)** | Deepgram Nova-2, OpenAI Whisper |
| **TTS (텍스트→음성)** | ElevenLabs, OpenAI TTS, Google Cloud TTS |
| **AI 모델** | DeepSeek-V3, GPT-4o, Claude, 또는 OpenClaw 지원 모델 |

모두 동시에 사용할 필요는 없습니다. 최소 구성은 **OpenClaw + Twilio + Deepgram(STT) + OpenAI TTS**입니다.

## 사전 준비

- OpenClaw 설치 및 공개 URL 접근 가능 (또는 [ngrok](https://ngrok.com)으로 터널링)
- 전화번호가 있는 Twilio 계정
- Deepgram API 키 (또는 Whisper용 OpenAI API 키)
- TTS 프로바이더 API 키

## 1단계: STT/TTS 프로바이더 설정

### 옵션 A: Deepgram (STT 권장)

Deepgram Nova-2는 대화체 영어에서 뛰어난 정확도와 낮은 레이턴시를 제공 — 전화 통화에 이상적입니다.

```bash
# OpenClaw .env에 추가:
STT_PROVIDER=deepgram
DEEPGRAM_API_KEY=your_deepgram_key_here
DEEPGRAM_MODEL=nova-2
DEEPGRAM_LANGUAGE=en-US
```

### 옵션 B: OpenAI Whisper

Whisper는 가장 정확한 범용 STT 모델로 50개 이상의 언어를 지원합니다:

```bash
STT_PROVIDER=openai_whisper
OPENAI_API_KEY=your_openai_key_here
WHISPER_MODEL=whisper-1
```

### TTS 설정

음성 응답을 위해 TTS 프로바이더를 설정합니다. ElevenLabs가 가장 자연스러운 음성을 생성합니다:

```bash
TTS_PROVIDER=elevenlabs
ELEVENLABS_API_KEY=your_elevenlabs_key_here
ELEVENLABS_VOICE_ID=21m00Tcm4TlvDq8ikWAM  # "Rachel" - 명확하고 전문적인 음성
ELEVENLABS_MODEL=eleven_turbo_v2           # 실시간 음성용 저레이턴시 모델
```

또는 간단한 올인원 설정으로 OpenAI TTS 사용:

```bash
TTS_PROVIDER=openai_tts
OPENAI_API_KEY=your_openai_key_here
OPENAI_TTS_VOICE=nova  # 선택지: alloy, echo, fable, onyx, nova, shimmer
OPENAI_TTS_MODEL=tts-1  # 더 높은 품질은 tts-1-hd (레이턴시 증가)
```

## 2단계: Twilio로 전화 브리지 연결

Twilio는 웹훅을 사용해 수신 전화를 서버로 전달합니다. OpenClaw의 Twilio Voice 플러그인이 이를 자동으로 처리합니다.

### Twilio Voice 플러그인 설치

OpenClaw Dashboard에서:
1. **플러그인 → 탐색** 이동
2. "Twilio Voice" 검색
3. **설치** 클릭 후 자격 증명 입력:

```bash
# .env에 추가:
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_PHONE_NUMBER=+15551234567
```

### Twilio 웹훅 설정

Twilio 콘솔에서:
1. **전화번호 → 활성 번호** 이동
2. 해당 번호 클릭
3. **Voice & Fax** 아래에서 웹훅 설정:

```
https://your-openclaw-domain.com/api/twilio/voice
```

OpenClaw 인스턴스가 공개 인터넷에서 접근 가능한지 확인하세요. 로컬 개발에는 ngrok 사용:

```bash
ngrok http 3000
# https URL을 복사해 Twilio에서 사용
```

### 연결 테스트

Twilio 번호로 전화합니다. 모든 설정이 올바르면 OpenClaw가 응답하고, STT 프로바이더로 음성을 처리하고, 텍스트를 AI 모델에 전송하고, TTS로 응답을 음성으로 변환해 재생합니다. 첫 번째 통화는 콜드 스타트로 2~3초 걸릴 수 있으며, 이후 통화는 더 빠릅니다.

## 3단계: 음성에 맞게 개성 커스터마이징

텍스트 기반 AI 프롬프트와 음성 최적화 프롬프트는 다릅니다. 음성 대화는 짧은 문장, 자연스러운 구어체, 전화라는 매체에 대한 인식이 필요합니다.

### 음성 시스템 프롬프트 편집

OpenClaw Dashboard에서 **설정 → 음성 모드 → 시스템 프롬프트**로 이동해 커스터마이징:

```
당신은 음성 AI 어시스턴트입니다. 사용자가 전화로 연락하고 있습니다.

음성 응답 규칙:
- 간결하게 답변하세요. 자세한 설명을 요청받지 않는 한 2~4문장을 목표로 합니다.
- 글머리 기호, 마크다운, 목록 사용 금지 — 자연스러운 단락으로 말하세요.
- "물론이죠!", "알겠습니다!" 같은 채움말 표현을 피하세요.
- 모르는 것은 간단히 인정하고 다른 도움을 제안하세요.
- 긴 답변이 필요한 질문은 핵심을 먼저 요약한 후 더 자세히 설명할지 물어보세요.
- 문서를 읽어주는 것이 아니라 친구와 대화하듯 자연스럽게 말하세요.

당신의 이름은 [어시스턴트 이름]입니다. 도움이 되고, 직접적이며, 가끔 위트 있습니다.
```

### 개성 조정 팁

**전문적인 어시스턴트** (업무, 일정 관리, 이메일):
- 추가: "격식 있지만 친근한 언어를 사용하세요. 일정이나 중요한 세부사항을 논의할 때는 간결함보다 정확성을 우선시하세요."

**캐주얼 개인 어시스턴트** (일반 질문, 알림, 잡담):
- 추가: "대화는 편안하고 자연스럽게. 짧은 응답을 선호합니다. 축약형을 자유롭게 사용하세요."

**다국어 지원**:
- 추가: "사용자가 말하는 언어를 감지하고 같은 언어로 응답하세요."

## 결과: 어떤 전화기에서든 AI에게 전화하기

모든 설정이 완료되면 놀라울 정도로 자연스러운 경험을 얻을 수 있습니다:

1. **전화를 걸면** — 전 세계 어디서든 Twilio 번호로
2. **OpenClaw가 응답하고** 녹음 시작
3. **질문이나 명령을 말하면**
4. **Deepgram/Whisper가 실시간으로** 음성을 텍스트로 변환
5. **AI 모델이** 응답 생성
6. **ElevenLabs/OpenAI TTS가** 텍스트를 음성으로 변환
7. **전화기로 답변을 듣는다** — 엔드투엔드 보통 2~4초

Google Search 플러그인으로 정보를 찾거나, 캘린더를 관리하거나, 메시지를 보내거나, 그냥 대화할 수도 있습니다. 전 세계 어떤 전화기에서도 작동합니다 — 발신자는 앱을 설치하거나 계정을 만들 필요가 없습니다.

### 통화 예시

**일정 확인**: "내일 일정이 어떻게 돼?" → Google Calendar를 읽어 음성으로 요약 전달.

**정보 검색**: "이번 주말 도쿄 날씨는?" → 검색 후 음성으로 예보 제공.

**작업 실행**: "아내한테 7시에 집에 간다고 카톡 보내줘" → 메시지 전송 후 구두로 확인.

## 다음 단계

음성 AI 어시스턴트가 가동됩니다. 여기서 더 할 수 있는 것들:

- [OpenClaw 플러그인](/blog/openclaw-plugins-productivity)으로 더 많은 스킬 추가
- [Raspberry Pi 5](/blog/openclaw-raspberry-pi-5)에 배포해 상시 가동 홈 어시스턴트 구현
- 더 강력한 AI 모델로 교체해 심층 추론 실현
- 특정 용도를 위한 전용 전화번호 생성 (가족 전용, 업무 전용 등)

[지금 OpenClaw를 시작하세요](https://openclaw.dev) — 당신의 자비스가 기다리고 있습니다.
