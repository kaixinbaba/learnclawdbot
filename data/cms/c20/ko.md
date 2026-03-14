---
title: "OpenClaw + Home Assistant: AI 기반 스마트홈 제어"
description: "OpenClaw를 Home Assistant에 연결하여 자연어로 스마트홈을 제어하세요. Home Assistant MCP 서버를 사용한 단계별 설정 가이드와 함께, 실제 자동화 예시 및 음성 명령 패턴을 소개합니다."
publishedAt: 2026-03-21
status: published
visibility: public
---

# OpenClaw + Home Assistant: AI 기반 스마트홈 제어

스마트홈 자동화의 일반적인 방식은 자동화 규칙을 직접 작성하는 것입니다. 해가 지고 누군가 집에 있으면 거실 조명을 켜거나, 평일 오전 7시에 문이 열리면 커피 메이커를 시작하는 식입니다. 이런 방식도 잘 동작하지만, 미리 시나리오를 예상하고 정확한 조건을 코드로 정의해야 한다는 번거로움이 있습니다.

제가 원했던 건 다른 방식이었습니다. "좀 덥네, 좀 더 쾌적하게 조절해 줘"라고 말하면 AI가 어떤 엔티티를 얼마나, 어떤 순서로 수정할지 스스로 판단하는 것입니다. 이것은 근본적으로 다른 상호작용 모델이며, 놀라울 정도로 잘 작동합니다.

이 가이드에서는 HA MCP 서버를 사용하여 OpenClaw를 Home Assistant에 연결하는 방법을 다룹니다. 설정이 완료되면 자연어 대화로 스마트홈을 제어하고, OpenClaw에게 자동화를 작성하도록 요청하고, 기기 문제를 진단하고, 집의 상태를 조회할 수 있습니다.

## 아키텍처 개요

이 통합은 세 가지 컴포넌트로 작동합니다.

1. **Home Assistant** — 기존 HA 설치 환경 (2024 이상 버전)
2. **Home Assistant MCP 서버** — HA의 API를 MCP 도구로 노출하는 브리지
3. **OpenClaw** — 요청에 따라 해당 도구를 호출하는 AI

"침실 조명 다 꺼줘"라고 말하면 OpenClaw가 모델에 전달하고, 모델은 `call_service` 도구를 `light.turn_off`와 침실 엔티티 ID와 함께 호출하기로 결정하고, MCP 서버가 HA에 해당 서비스 호출을 실행하고, HA가 조명을 끕니다.

간단한 명령의 경우 입력부터 실행까지의 왕복 시간은 보통 1~3초입니다.

## 사전 요구 사항

- Home Assistant 설치 및 실행 중 (HA OS, Supervised, Container, 또는 Core)
- HA의 장기 액세스 토큰 (Long-Lived Access Token)
- OpenClaw 설치 완료
- Node.js 20 이상

## Home Assistant 액세스 토큰 발급

Home Assistant에서 다음 단계를 따릅니다.
1. 프로필 (왼쪽 하단) 클릭
2. "Long-Lived Access Tokens"까지 스크롤
3. "토큰 생성" 클릭
4. 이름을 "OpenClaw"로 지정하고 토큰을 즉시 복사 — 다시 표시되지 않습니다

## Home Assistant MCP 서버 설치

```bash
npm install -g @modelcontextprotocol/server-home-assistant
```

정상 동작 확인:

```bash
HA_URL=http://homeassistant.local:8123 \
HA_TOKEN=your_token_here \
npx @modelcontextprotocol/server-home-assistant
# Should start without errors
```

## OpenClaw 설정

OpenClaw 설정 파일에 MCP 서버를 추가합니다.

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

환경 변수를 설정합니다.

```bash
export HA_TOKEN="your_long_lived_access_token"
# Add to ~/.zshrc or ~/.bashrc to persist
```

OpenClaw를 재시작합니다.

```bash
openclaw restart
openclaw mcp list
# Should show: home-assistant (X tools)
```

## 사용 가능한 도구

HA MCP 서버는 OpenClaw에 다음 도구를 제공합니다.

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

이것은 매우 광범위한 인터페이스입니다 — 모델은 HA UI에서 할 수 있는 거의 모든 작업을 수행할 수 있습니다.

## 기본 명령어

연결이 완료되면 자연어 명령을 바로 사용할 수 있습니다.

```
"거실 온도가 몇 도야?"
"조명 다 꺼줘"
"침실 온도 조절기를 68°F로 설정해줘"
"지금 집에 누구 있어?"
"현관문 잠가줘"
"모든 센서 배터리 잔량 보여줘"
```

모델은 이를 적절한 서비스 호출로 변환합니다. "조명 다 꺼줘"처럼 여러 엔티티가 관련된 명령의 경우, 먼저 `get_states`를 호출하여 모든 조명 엔티티를 찾은 다음 해당 엔티티에 `call_service`를 호출합니다.

## 실제 활용 사례

**요청 시 아침 루틴 설정:**

```
나: "좋은 아침, 집을 아침 준비 상태로 만들어줘 — 출발까지 45분 정도 있어"

OpenClaw: 아침 루틴을 설정할게요.
- 주방 조명 → 밝기 80%, 따뜻한 백색
- 커피 메이커 → 켜기 (엔티티가 사용 가능한 경우)
- 거실 블라인드 → 열기
- 온도 조절기 → 70°F
- 현관문 잠금 → 잠김 확인됨

아침 준비에 더 필요한 게 있나요?
```

**기기 문제 진단:**

```
나: "사무실 모션 센서가 이틀째 반응을 안 하는데, 무슨 문제야?"

OpenClaw: [해당 센서 엔티티의 get_history 호출]

binary_sensor.office_motion 기록을 확인했습니다:
- 마지막 반응: 2일 전 오전 9:47
- 배터리: 8% (3일 전 마지막 보고)
- 현재 상태: 사용 불가

센서가 사용 불가 상태가 됐고, 배터리가 8%인 것을 보면 전원이 소진된 것 같습니다. 배터리를 교체하면 자동으로 재연결될 것입니다. 10분 이내에 재연결되지 않으면 Zigbee/Z-Wave 코디네이터와 다시 페어링해야 할 수 있습니다.
```

**자동화 작성:**

```
나: "일몰 후에 현관문이 열리면 현관 조명을 켜고, 문이 닫힌 후 5분 뒤에 꺼지는 자동화를 만들어줘"

OpenClaw: [충돌 여부 확인을 위해 list_automations 호출 후 create_automation 실행]

자동화 "일몰 후 문이 열리면 현관 조명 켜기"를 생성했습니다:
- 트리거: front_door 상태가 'open'으로 변경
- 조건: 태양이 지평선 아래 있음
- 동작: porch_light 켜기
- 추가 트리거: front_door 상태가 'closed'로 변경
- 추가 동작: 5분 지연 후 porch_light 끄기

자동화가 활성화되었습니다. 문 열림 이벤트를 시뮬레이션해서 테스트해 볼까요?
```

**에너지 모니터링 조회:**

```
나: "지금 전력을 가장 많이 쓰는 기기가 뭐야?"

OpenClaw: [모든 전력 모니터링 엔티티의 get_states 호출]

현재 소비 전력 (높은 순):
1. HVAC 시스템: 2,340W
2. 오븐 (켜진 채로 방치!): 1,800W
3. 전기차 충전기: 1,200W
4. 냉장고: 145W
5. TV + 엔터테인먼트: 87W

참고: 오븐이 켜져 있는 것 같은데, 의도하신 건가요? 현재 총 소비 전력: 약 5.6kW
```

## 보안 고려 사항

HA MCP 서버는 로컬에서 실행되며 HA 인스턴스와 직접 통신합니다. 주요 보안 사항은 다음과 같습니다.

**OpenClaw의 권한을 제한하세요.** HA 액세스 토큰은 기본적으로 인스턴스에 대한 전체 접근 권한을 가집니다. 더 제한된 설정을 원한다면 HA의 API 키 범위 지정 기능(일부 HA 버전에서 사용 가능)을 활용하거나, 호출 가능한 서비스를 제한하는 프록시를 배포하는 것을 고려하세요.

**HA의 외부 URL을 노출하지 마세요.** MCP 서버를 외부 HA Cloud URL이 아닌 로컬 HA 주소를 사용하도록 설정하세요. 모든 통신은 로컬 네트워크 안에서만 이루어져야 합니다.

**자동화를 활성화하기 전에 검토하세요.** OpenClaw에게 자동화 생성을 요청할 때는 적용 전에 YAML을 반드시 확인하세요. 모델은 성능이 뛰어나지만 완벽하지는 않습니다 — 엣지 케이스를 점검하세요.

```yaml
# More restrictive config: use local network only
mcpServers:
  home-assistant:
    env:
      HA_URL: "http://192.168.1.100:8123"  # Direct IP, not external URL
      HA_TOKEN: "${HA_TOKEN}"
```

**OpenClaw의 동작을 로그로 기록하세요.** HA에서 중요한 엔티티에 대해 로그북을 활성화하세요. 예상치 못한 일이 발생했을 때 어떤 서비스가 언제 호출됐는지 추적할 수 있습니다.

## 고급: 음성 명령

OpenClaw의 MCP 통합과 음성 입력 지원을 결합하면 핸즈프리로 스마트홈을 제어할 수 있습니다.

```bash
# OpenClaw with voice input (when configured)
openclaw voice --provider home-assistant

# Or use the keyboard shortcut in OpenClaw's terminal UI
# Voice input → transcription → model processes → HA executes
```

음성부터 실행까지의 지연 시간은 일반적으로 총 3~5초입니다. 음성 인식에 약 1초, 모델 추론에 1~2초, HA 서비스 실행에 약 1초가 소요됩니다.

## 여러 집 또는 구역 관리

여러 HA 인스턴스(본가 + 별장 등)가 있는 경우 여러 MCP 서버 인스턴스를 설정하세요.

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

모델은 두 곳 모두 처리할 수 있습니다. "별장 조명을 누군가 끄지 않고 나왔는지 확인해줘."

## 자주 묻는 질문

**Zigbee/Z-Wave/Matter/WiFi 기기에서도 작동하나요?**

네. OpenClaw는 모든 기기 프로토콜을 추상화한 Home Assistant의 엔티티 레이어와 상호작용합니다. HA에서 엔티티로 표시되는 기기라면 무엇이든 OpenClaw로 제어할 수 있습니다.

**OpenClaw가 실수로 문제를 일으킬 수 있나요?**

모델은 실제 HA 서비스를 호출합니다. 이론상 의도하지 않은 서비스를 호출할 가능성도 있습니다. 실제로는 모델이 파괴적인 동작에 보수적으로 접근하며, 되돌릴 수 없는 작업(예: 알람 비활성화)을 수행하기 전에 일반적으로 확인을 요청합니다. 예상치 못한 명령은 항상 주의 깊게 감독하세요.

**Home Assistant Cloud (Nabu Casa)에서도 작동하나요?**

네. 로컬 주소 대신 HA Cloud 외부 URL을 사용하면 됩니다. 클라우드를 통한 추가 왕복 통신으로 인해 성능이 약간 느려질 수 있습니다.

**HA 인스턴스에 수백 개의 엔티티가 있으면 어떻게 되나요?**

`get_states` 호출은 모든 엔티티를 반환하므로 페이로드가 클 수 있습니다. 모델이 정상적으로 처리하지만 응답이 약간 느려질 수 있습니다. 엔티티 수가 매우 많은 설치 환경(500개 이상)에서는 명령에서 도메인으로 필터링하는 것을 권장합니다. "모든 조명 엔티티를 보여줘."

**Ollama 오프라인 설정으로도 사용할 수 있나요?**

네. MCP 서버는 모델 백엔드와 독립적으로 작동합니다. OpenClaw를 Ollama를 제공자로 사용하도록 설정해도 HA MCP 서버는 계속 사용 가능합니다. HA가 로컬에 설치되어 있다면 스마트홈 제어가 완전히 오프라인으로 동작합니다.

OpenClaw + Home Assistant 통합은 제가 집과 상호작용하는 방식을 바꿔 놓았습니다. YAML을 직접 편집하는 것보다 대화 형식으로 자동화를 작성하는 것이 훨씬 자연스럽게 느껴지고, 자연어로 진단 질문을 할 수 있어 문제 해결 시간도 크게 줄었습니다. 기존 HA 설치 환경이 있는 분이라면 설정에 약 15분이면 충분합니다.
