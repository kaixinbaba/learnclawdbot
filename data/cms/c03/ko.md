---
title: "C03 사용자 사례: SNAG로 화면 조각을 OpenClaw용 Markdown으로 변환하기"
description: "SNAG + OpenClaw 워크플로우로 화면 영역을 markdown으로 변환해 LLM 컨텍스트 전달 속도를 높이는 방법."
---

# C03 사용자 사례: SNAG로 화면 조각을 OpenClaw용 Markdown으로 변환하기

## 사례 개요

- **분류:** 자동화 / 개발 워크플로우
- **대상:** 화면의 코드·UI 조각을 AI 채팅에 자주 옮기는 사용자
- **출처:**
  - [OpenClaw Docs: Showcase](https://docs.openclaw.ai/start/showcase)
  - [am-will/snag](https://github.com/am-will/snag)

## 배경

디버깅/리서치 작업에서는 UI 일부, 코드 스니펫, 다이어그램을 LLM에 전달해야 하는 경우가 많습니다. 수동 전사는 느리고 누락이 생기기 쉽습니다.

이 사례의 목표는 다음 흐름을 재사용 가능한 절차로 고정하는 것입니다.

- 화면 영역 캡처
- markdown 변환
- OpenClaw 대화에 붙여넣기

## 출처로 검증 가능한 기능

SNAG README와 OpenClaw Showcase에서 확인되는 내용:

1. SNAG는 screenshot-to-text CLI 도구
2. 영역 선택 및 멀티 모니터 캡처 지원
3. 텍스트/코드/다이어그램/UI 처리 후 markdown 결과를 클립보드로 복사
4. Google Gemini / OpenRouter / Z.AI 다중 제공자 지원
5. OpenClaw Showcase에 SNAG("Screenshot-to-Markdown")가 커뮤니티 사례로 등록

## 적용 경로

### 1) SNAG 설치

```bash
uv tool install git+https://github.com/am-will/snag.git
```

### 2) 제공자와 API 키 설정

```bash
snag --setup
```

환경에 맞게 provider/model/API key를 설정합니다.

### 3) 캡처 및 변환 실행

```bash
snag
```

선택한 화면 영역이 markdown으로 변환되어 클립보드에 복사됩니다.

### 4) OpenClaw 워크플로우에 연결

클립보드 결과를 OpenClaw 대화에 붙여넣어 디버깅, 요약, 코드 리뷰를 이어갑니다.

## 결과(근거 기반)

- 수동 재작성 단계를 명령 기반 단계로 전환 가능
- markdown 즉시 클립보드 출력으로 컨텍스트 전달 마찰 감소
- 다중 제공자 지원으로 기존 AI 스택에 맞춘 운영 가능

## 확인된 사실 vs 추가 검증 필요

### ✅ 확인됨(출처 기반)

- SNAG는 영역 캡처와 멀티 모니터를 지원
- SNAG는 Gemini / OpenRouter / Z.AI를 지원
- SNAG는 markdown 사용 가능한 텍스트를 클립보드로 복사
- OpenClaw Showcase에 SNAG 사례가 포함됨

### ⚠️ 추가 검증 필요(사용자 인터뷰/계측)

- 캡처 1회당 평균 시간 절감
- 수동 전사 대비 오류율 변화
- 장기적인 디버깅 생산성 개선 효과

## 실무 메모

- macOS는 최초 실행 시 화면 녹화 권한 허용이 필요
- 전역 단축키 사용 시 `snag` 명령이 PATH에 있어야 함
- API 키는 SNAG 문서의 로컬 설정 경로(`~/.config/snag/`)에 저장 권장

## 참고 링크

- [OpenClaw Showcase](https://docs.openclaw.ai/start/showcase)
- [SNAG README](https://github.com/am-will/snag)
