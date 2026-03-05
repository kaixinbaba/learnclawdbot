---
title: Clawdia Phone Bridge - Vapi 및 OpenClaw로 음성 AI 어시스턴트 구축
description: Vapi 음성 어시스턴트를 OpenClaw에 HTTP 브릿지를 통해 연결하여 실시간 음성 AI 어시스턴트를 구축하는 방법을 알아보세요. 전화를 통해 AI 에이전트와 통화할 수 있습니다.
slug: /clawdia-phone-bridge
tags: voice, vapi, bridge, phone, ai-assistant
publishedAt: 2026-03-05
status: published
visibility: public
featuredImageUrl: /images/features/clawdia-phone-bridge.webp
---

# Clawdia Phone Bridge - Vapi 및 OpenClaw로 음성 AI 어시스턴트 구축

AI 어시스턴트에게 전화를 걸어본 적이 있으신가요? **Clawdia Phone Bridge**를 사용하면 가능합니다. 이 프로젝트는 Vapi 음성 AI와 OpenClaw 간의 실시간 음성 브릿지를 만들어 전화를 통한 거의 실시간 음성 대화할 수 있게 합니다.

## Clawdia Phone Bridge란?

[Clawdia Phone Bridge](https://github.com/alejandroOPI/clawdia-bridge)는 Vapi(음성 어시스턴트 플랫폼)를 OpenClaw에 연결하는 HTTP 브릿지입니다. 이를 통해 다음이 가능합니다:

- AI 어시스턴트에게 전화하기
- 실시간 음성 응답 받기
- 음성으로 모든 OpenClaw 스킬(캘린더, 이메일, 날씨 등) 접근

## 작동 원리

아키텍처는 간단합니다:

1. **사용자**가 전화를 건다
2. **Vapi**가 음성을 캡처하여 브릿지로 전송
3. **Clawdia Bridge**가 WebSocket을 통해 OpenClaw로 요청을转发
4. **OpenClaw**가 AI 에이전트를 사용하여 요청을 처리
5. **응답**이 브릿지를 통해 Vapi로 돌아옴
6. **Vapi**가 음성으로 응답을 읽어줌

```
사용자 (전화)
    ↓
Clawdia (Vapi 음성 AI)
    ↓ POST /ask (도구 호출)
Clawdia Bridge
    ↓ Gateway로 WebSocket
Clawdius (요청 처리)
    ↓ 응답 반환
Clawdia Bridge
    ↓ Vapi로 반환
Clawdia
    ↓ 음성으로 말함
사용자
```

## 빠른 시작

### 전제 조건

- Node.js 설치됨
- Vapi 계정
- OpenClaw Gateway 실행 중

### 설치

```bash
# 저장소 클론
git clone https://github.com/alejandroOPI/clawdia-bridge.git
cd clawdia-bridge

# 의존성 설치
npm install

# 브릿지 실행
npm start
```

### 환경 변수

| 변수 | 기본값 | 설명 |
|------|--------|------|
| BRIDGE_PORT | 3847 | 수신 포트 |
| GATEWAY_URL | ws://127.0.0.1:18789 | OpenClaw Gateway WebSocket URL |

### Vapi 구성

1. **어시스턴트 생성**: Vapi 대시보드에서 "Clawdia"라는 어시스턴트 생성
2. **음성 구성**: 여성 음성 선택 (Vapi의 Lily 등)
3. **도구 추가**: `ask_clawdius` 함수 도구 추가
4. **전화번호 할당**: Vapi 전화번호 연결

### 인터넷에 노출

프로덕션에서는:

```bash
# Tailscale Funnel 사용 (권장)
npm start
tailscale funnel 3847

# 또는 ngrok 사용
npm start
ngrok http 3844
```

## API 엔드포인트

### POST /ask

Vapi가 OpenClaw와 통신하기 위해 호출하는 주요 엔드포인트:

```json
{
  "question": "오늘 날씨가 어때요?"
}
```

응답:

```json
{
  "answer": "현재 맑고 기온은 22°C입니다."
}
```

### GET /health

상태 확인 엔드포인트:

```json
{
  "status": "ok",
  "mode": "gateway-ws"
}
```

## 왜 중요한가?

이 브릿지는 무한한 가능성을 열립니다:

- **음성 우선 워크플로**: 손-free로 AI와 상호작용
- **전화 기반 AI 에이전트**: 일반 전화를 통해 호출 가능한 AI 어시스턴트 생성
- **접근성**: 기술에 익숙하지 않은 사용자도 AI 도움말 이용 가능
- **비즈니스 응용**: 고객 지원, 예약, 정보 검색

## 사용 사례

- **개인 AI 어시스턴트**: AI에게 전화하여 캘린더, 날씨, 이메일 확인
- **비즈니스 핫라인**: 전화를 통한 AI 기반 고객 지원
- **노인 지원**: 간단한 음성 인터페이스로 AI 접근
- **손이 바쁜 생산성**: 운전하거나 요리하는 동안 작업 완료

## 결론

Clawdia Phone Bridge는 음성 AI와 OpenClaw의 에이전트 기능을 결합한 강력한 데모를 보여줍니다. Vapi와 OpenClaw를 브릿지하면 모든 OpenClaw 스킬과 통합을 활용하는 정교한 음성 AI 어시스턴트를 만들 수 있습니다.

음성 AI 구축 준비가 되셨나요? 전체 문서는 [GitHub 저장소](https://github.com/alejandroOPI/clawdia-bridge)를 참조하세요.
