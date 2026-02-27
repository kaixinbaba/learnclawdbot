---
title: "SNAG：화면 스냅샷을 LLM 준비 마크다운으로 변환"
description: "SNAG와 OpenClaw를 사용하여 화면 영역을 캡처하고 즉시 마크다운으로 변환하여 더 빠른 AI 컨텍스트 전달하는 방법을 알아봅니다."
---

# C07 유저 케이스: SNAG - 화면 스냅샷을 LLM 준비 마크다운으로 변환

## 케이스 개요

- **카테고리:** DevTools / 개발자 워크플로우
- **대상:** 화면 캡처를 자주 텍스트로 변환하여 AI 대화에 사용해야 하는 개발자
- **출처:**
  - [OpenClaw 문서: Showcase](https://docs.openclaw.ai/start/showcase)
  - [am-will/snag](https://github.com/am-will/snag)

## 배경

화면 중심 워크플로우에서 개발자는 UI 요소, 코드 스니펫 또는 다이어그램을 LLM 대화로 복사해야 하는 경우가 많습니다. 수동 전사는 느리고 오류가 발생하기 쉽습니다.

SNAG는 간소화된 솔루션을 제공합니다:

- 클릭 앤 드래그로 모든 화면 영역 캡처
- AI 기반 마크다운 변환
- 자동 클립보드 출력 - 즉시 붙여넣기 가능

## 검증된 기능

SNAG README 및 OpenClaw Showcase에서 확인:

1. **영역 선택**: 클릭 앤 드래그로 화면의 모든 부분 캡처
2. **멀티 모니터 지원**: 연결된 모든 디스플레이에서 작동
3. **스마트 전사**: 텍스트, 코드, 다이어그램, 차트, UI 요소 처리
4. **즉시 클립보드**: 결과 자동 복사, 즉시 붙여넣기 가능
5. **다중 공급자**: Google Gemini, OpenRouter 또는 Z.AI (GLM-4.6V)
6. **크로스 플랫폼**: Linux (X11/Wayland), Windows, macOS

## 구현 단계

### 1) SNAG 설치

```bash
uv tool install git+https://github.com/am-will/snag.git
```

### 2) API 키 구성

```bash
snag --setup
```

대화형 메뉴가 열리고 원하는 공급자와 API 키를 구성할 수 있습니다.

### 3) 화면 캡처

```bash
snag
```

- 왼쪽 클릭 + 드래그로 영역 선택
- 마우스를 놓으면 캡처 및 처리
- 오른쪽 클릭 또는 Escape로 취소

### 4) OpenClaw에 붙여넣기

마크다운 결과가 이미 클립보드에 있습니다. 디버깅, 요약 또는 코드 리뷰를 위해 OpenClaw 대화면에 바로 붙여넣으세요.

## 개발자 생산성을 향상시키는 이유

- **속도**: 캡처에서 마크다운까지 수분이 아닌 수초 소요
- **정확성**: AI 전사는 복잡한 레이아웃, 코드 구문, 다이어그램 처리
- **클립보드 우선**: 파일 저장 필요 없음 - 즉시 붙여넣기 워크플로우
- **유연성**: 필요에 따라 다양한 AI 공급자 선택 가능

## 실용적인 참고사항

- **macOS**: 첫 실행 시 화면 녹화 권한 허용 (시스템 설정 → 개인 정보 보호 및 보안 → 화면 녹화)
- **전역 단축키**: 데스크톱 환경 단축키(예: GNOME의 Super+Shift+S)를 설정하여 즉시 액세스
- **API 키**: `~/.config/snag/.env`에 저장 - 셸 환경 변수에 액세스할 수 없는 단축키와 호환

## 확인된 사실 vs 가정

### ✅ 출처에서 확인됨

- SNAG는 영역 캡처 및 멀티 모니터 사용 지원
- SNAG는 Gemini, OpenRouter, Z.AI 공급자 지원
- SNAG는 마크다운 출력 및 클립보드 자동 복사
- OpenClaw Showcase는 SNAG를 커뮤니티 예제로 포함

### ⚠️ 사용자DEPENDENT

- 실제 시간 절약은 사용 사례에 따라 다름
- 특정 콘텐츠 유형(코드 vs 다이어그램)에 대한 공급자 품질 차이

## 참조

- [OpenClaw Showcase](https://docs.openclaw.ai/start/showcase)
- [SNAG GitHub 저장소](https://github.com/am-will/snag)
